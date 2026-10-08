import { isIP } from 'node:net';

const privateProse = /\b(?:Redis|Firestore|BigQuery|Postgres|PostgreSQL|Google Cloud|GCP|Cloud Run|Cloud Tasks|Cloud Scheduler|Pub\/Sub|ExcelJS|isolated-vm|QueryWrapper)\b/i;
const privateRuntimeOptimization = /\b(?:L0|cachedData|canonical(?: source)? snapshots?|source[- ]read start|source hash(?:es)?|digest[- ]addressed|singleflight|cache generation fences?|agent[- ]gateway|executor requests|max_output_tokens|typed array parameters?|durable outcome receipts?|maintenance recovery tick)\b/i;
const privateDiagnosticApi = /\/api\/v1\/assistant\/(?:reports(?:\/|\b)|evidence(?:\/|\b)|threads\/[^\s/]+\/evidence(?:\/|\b))/i;

export function isPrivateDiagnosticApiPath(path) {
  return path.startsWith('/api/v1/') && privateDiagnosticApi.test(path);
}

const privateType = /\b[A-Z][A-Za-z0-9]*(?:Service|Controller|Repository|Entity)\b/;
const credentialField = /^(?:authorization|(?:x[-_])?api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|password|secret(?:Value|AccessKey)?|private[-_]?key|token)$/i;
const privateSourcePath = /\b(?:packages\/(?:platform[^/]*|agent-core|domain|runtime-sdk|execution[^/]*)|apps\/(?:api|auth|agents|manage|run|processor|sandbox|realtime|mcp)|src\/(?:modules|@agents|services))\/[A-Za-z0-9@_.\/-]+/i;

function placeholder(value) {
  return /^(?:(?:Bearer|Basic)\s+)?(?:\$\{[^}]+\}|\$[A-Z_][A-Z0-9_]*|\{\{[^}]+\}\}|<[^>]+>|\[(?:redacted|secret|token|credential)\])$/i.test(value.trim())
    || /^(?:example(?:[-_ ].*)?|your[-_ ].*|replace[-_ ].*|change[-_ ]?me|redacted|placeholder|password|secret|token|\.{3}|(?:x|\*){4,})$/i.test(value.trim());
}

// Return categories only: a failed publication gate must not echo the secret it detects.
export function publicTextPrivacyIssues(text, { prose = true } = {}) {
  const issues = new Set();
  const addresses = text.match(/(?:[0-9a-f]{0,4}:){2,}[0-9a-f:.]*(?:%[A-Za-z0-9_.-]+)?|\b(?:\d{1,3}\.){3}\d{1,3}\b/gi) ?? [];
  if (addresses.some(address => isIP(address))) issues.add('IP address literal');
  if (prose && (privateProse.test(text) || privateType.test(text) || privateRuntimeOptimization.test(text))) issues.add('private implementation prose');
  if (prose && privateSourcePath.test(text)) issues.add('private repository path');
  if (prose && privateDiagnosticApi.test(text)) issues.add('private diagnostic API');
  if (/\b(?:redis|rediss):\/\//i.test(text)) issues.add('private infrastructure locator');
  const opaque = /\b(?:sk-[A-Za-z0-9_-]{20,}|sk_(?:live|test)_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{15,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g;
  const urls = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/<>"']+:([^\s/<>"']+)@/gi;
  const bearer = /\bBearer\s+([A-Za-z0-9._~+/-]{20,}=*)/gi;
  const basic = /\bBasic\s+([A-Za-z0-9+/]{8,}={0,2})(?![A-Za-z0-9+/=])/gi;
  const assignments = /\b(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret(?:Value|AccessKey)?|private[_-]?key|token)\b["']?\s*[:=]\s*(["'`])([^"'`\r\n]+)\1/gi;
  if ([...text.matchAll(opaque)].some(match => !placeholder(match[0]))
      || [...text.matchAll(urls)].some(match => !placeholder(match[1]))
      || [...text.matchAll(bearer)].some(match => !placeholder(match[1]))
      || [...text.matchAll(basic)].some(match => {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        return separator > 0 && separator < decoded.length - 1;
      })
      || [...text.matchAll(assignments)].some(match => !placeholder(match[2]))) issues.add('credential literal');
  const pem = /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----([\s\S]*?)-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g;
  if ([...text.matchAll(pem)].some(match => /^[A-Za-z0-9+/=]{32,}$/.test(match[1].replace(/\s/g, '')) && !placeholder(match[1]))) issues.add('private key literal');
  const signedUrls = /[?&](?:x-goog-signature|x-amz-signature|signature|sig)=([^&#\s"'<>]+)/gi;
  if ([...text.matchAll(signedUrls)].some(match => {
    let value = match[1];
    try { value = decodeURIComponent(value); } catch { /* Malformed escaping is not a placeholder. */ }
    return value.length >= 20 && !placeholder(value);
  })) issues.add('signed URL credential');
  return [...issues];
}

export function publicOpenApiPrivacyIssues(document) {
  const issues = [];
  if (Object.keys(document.paths ?? {}).some(isPrivateDiagnosticApiPath)) issues.push('$.paths: private diagnostic API');
  function visit(value, path = '$', prose = false, example = false, credential = false) {
    if (typeof value === 'string') {
      if (example && credential && !placeholder(value)) issues.push(`${path}: credential literal`);
      for (const category of publicTextPrivacyIssues(value, { prose })) issues.push(`${path}: ${category}`);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, prose, example, credential));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        const inExample = example || key === 'example' || key === 'examples';
        visit(item, `${path}.${key}`, key === 'summary' || key === 'description', inExample, credentialField.test(key));
      }
    }
  }
  visit(document);
  return issues;
}
