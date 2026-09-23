#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { permitsHistoricalMethod } from './historical-release-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);
const policyPages = [
  'resources/platform-terms-and-conditions.mdx',
  'resources/cloud-services-and-support-terms-and-conditions.mdx',
  'resources/privacy-policy-and-cookies.mdx',
  'resources/service-level-agreement-sla.mdx',
  'resources/support-policy.mdx',
];
const databaseWorkspacePages = [
  'operate/database-definitions',
  'operate/database-audit',
  'operate/database-views',
  'operate/materialized-views',
  'operate/database-cache',
];
const storageProductPages = [
  'operate/storage.mdx',
  'operate/storage-uploads.mdx',
  'operate/storage-structured-files.mdx',
  'low-code/http.mdx',
  'low-code/sftp.mdx',
  'developers/sdk-storage-and-batching.mdx',
];
const agentProductPages = [
  'ai/overview.mdx',
  'ai/agent-harness.mdx',
  'ai/compare-coding-agents.mdx',
  'ai/tools-and-skills.mdx',
  'ai/plugins.mdx',
  'ai/memory-and-workspaces.mdx',
];
const requiredProductPages = [
  'build/overview',
  'platform/file-processing-workflow',
  'platform/external-integration-workflow',
  'platform/agent-production-workflow',
  'platform/incident-investigation-workflow',
  ...agentProductPages.map((page) => page.replace(/\.mdx$/, '')),
];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function collectNavigationPages(value, pages = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectNavigationPages(entry, pages);
    return pages;
  }
  if (!value || typeof value !== 'object') return pages;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'pages' && Array.isArray(entry)) {
      for (const page of entry) {
        if (typeof page === 'string') pages.push(page);
        else collectNavigationPages(page, pages);
      }
    } else {
      collectNavigationPages(entry, pages);
    }
  }
  return pages;
}

function bodyWithoutFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/, '').trim();
}

function frontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  if (!match) return null;
  return Object.fromEntries(match[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z][\w-]*):\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((entry) => [entry[1], entry[2].replace(/^['"]|['"]$/g, '')]));
}

function declarationClassBody(source, className) {
  const start = source.indexOf(`declare class ${className} {`);
  if (start === -1) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(open + 1, index);
  }
  return '';
}

function deprecatedLowCodeMethods(source) {
  return ['api', 'storage', 'agent', 'util'].flatMap((global) => {
    const body = declarationClassBody(source, global);
    return [...body.matchAll(/\/\*\*([\s\S]*?)\*\/\s*static\s+([A-Za-z_$][\w$]*)/g)]
      .filter((match) => /@deprecated\b/i.test(match[1]))
      .map((match) => `${global}.${match[2]}`);
  });
}

function main() {
  const issues = [];
  const docs = JSON.parse(readFileSync(join(root, 'docs.json'), 'utf8'));
  const navigationPages = collectNavigationPages(docs);
  const navigationSet = new Set(navigationPages);
  const mdxFiles = filesUnder(root).filter((file) => extname(file) === '.mdx');
  const mdxPages = mdxFiles.map((file) => relative(root, file).replaceAll('\\', '/').replace(/\.mdx$/, ''));
  const mdxSet = new Set(mdxPages);

  for (const page of navigationPages) {
    if (!mdxSet.has(page)) issues.push(`Navigation page does not exist: ${page}.mdx`);
  }
  for (const page of mdxPages) {
    if (!navigationSet.has(page)) issues.push(`MDX page is missing from docs.json navigation: ${page}.mdx`);
  }
  for (const page of new Set(navigationPages.filter((page, index) => navigationPages.indexOf(page) !== index))) {
    issues.push(`Navigation page is listed more than once: ${page}.mdx`);
  }
  for (const page of requiredProductPages) {
    if (!navigationSet.has(page)) issues.push(`Required product guide is missing from navigation: ${page}.mdx`);
  }
  const databaseWorkspacePositions = databaseWorkspacePages.map((page) => navigationPages.indexOf(page));
  if (
    databaseWorkspacePositions.some((position) => position === -1)
    || databaseWorkspacePositions.some((position, index) => index > 0 && position !== databaseWorkspacePositions[index - 1] + 1)
  ) {
    issues.push(`Database workspace pages must follow the product UI order: ${databaseWorkspacePages.join(' -> ')}.`);
  }
  for (const file of mdxFiles) {
    const content = readFileSync(file, 'utf8');
    const metadata = frontmatter(content);
    if (!metadata) {
      issues.push(`MDX page has no frontmatter: ${relative(root, file)}`);
    } else {
      for (const field of ['title', 'description', 'icon']) {
        if (!metadata[field]?.trim()) {
          issues.push(`MDX page has no ${field} in frontmatter: ${relative(root, file)}`);
        }
      }
    }
    if (!bodyWithoutFrontmatter(content)) issues.push(`MDX page has no body content: ${relative(root, file)}`);
    if (/\bRun API\b/i.test(content)) issues.push(`Legacy product name "Run API" found in ${relative(root, file)}.`);
    if (/(?:\d{1,3}\.){3}\d{1,3}/.test(content)) {
      issues.push(`Public documentation contains a literal IP address: ${relative(root, file)}.`);
    }
  }

  for (const policyPage of policyPages) {
    const content = readFileSync(join(root, policyPage), 'utf8');
    const metadata = frontmatter(content);
    if (!metadata?.icon) issues.push(`Policy page has no navigation icon: ${policyPage}.`);
    if ((content.match(/^<Note>$/gm) ?? []).length !== 1) {
      issues.push(`Policy page must contain exactly one top-level revision Note: ${policyPage}.`);
    }
    if (!/^## Revision History$/m.test(content) || !/^\| Version \| Date \| Status \| Changes \|$/m.test(content)) {
      issues.push(`Policy page does not use the canonical revision history format: ${policyPage}.`);
    }
    if (/^## Definitions?$/m.test(content) && !/^## Definitions$/m.test(content)) {
      issues.push(`Policy page must use the canonical "Definitions" heading: ${policyPage}.`);
    }
  }

  for (const storagePage of storageProductPages) {
    const content = readFileSync(join(root, storagePage), 'utf8');
    if (/\bGCS\b|\bRedis\b|provider event|provider upload|provider-streamed/i.test(content)) {
      issues.push(`Storage product documentation exposes replaceable implementation detail: ${storagePage}.`);
    }
  }

  const memoryGuide = readFileSync(join(root, 'ai/memory-and-workspaces.mdx'), 'utf8');
  for (const scope of ['`USER`', '`AGENT`', '`WORKSPACE`']) {
    if (!memoryGuide.includes(scope)) issues.push(`Memory guide must document active runtime scope ${scope}.`);
  }
  if (/\|\s*`(?:INSTANCE|SHARED)`\s*\|/.test(memoryGuide)) {
    issues.push('Memory guide must not present legacy INSTANCE or SHARED values as active runtime scopes.');
  }

  const harnessGuide = readFileSync(join(root, 'ai/agent-harness.mdx'), 'utf8');
  if (!/Interactive Agents[\s\S]*Autonomous Agents/i.test(harnessGuide)) {
    issues.push('Agent Harness guide must distinguish Interactive Agents from Autonomous Agents.');
  }
  if (!/does\s+\*{0,2}not\*{0,2}\s+(?:currently\s+)?(?:expose|promise)\s+(?:an?\s+)?(?:unrestricted\s+)?host shell|not a general host shell|not the same as unrestricted host access/i.test(harnessGuide)) {
    issues.push('Agent Harness guide must state the current public terminal boundary.');
  }

  for (const agentPage of agentProductPages) {
    const content = readFileSync(join(root, agentPage), 'utf8');
    if (/packages\/[A-Za-z0-9@._/-]+\/src\/|apps\/[A-Za-z0-9@._/-]+\/src\/|provider request payload:/i.test(content)) {
      issues.push(`Agent product documentation exposes non-contract implementation detail: ${agentPage}.`);
    }
  }

  const eventGuide = readFileSync(join(root, 'operate/events.mdx'), 'utf8');
  if (/provider cleanup was requested|\/operate\/storage\) for Component code/i.test(eventGuide)) {
    issues.push('Events guide contains a technical Storage implementation dump or stale ingestion link.');
  }

  const legacyFilesGuide = readFileSync(join(root, 'operate/files.mdx'), 'utf8');
  if (/backend Files controller/i.test(legacyFilesGuide)) {
    issues.push('Legacy Files guide must describe the public contract, not backend controllers.');
  }

  const httpGuide = readFileSync(join(root, 'low-code/http.mdx'), 'utf8');
  for (const requiredPattern of [
    /responseType:\s*['"]stream['"]/,
    /streamFormat:\s*['"]sse['"]/,
    /requestType:\s*['"]form-data['"]/,
    /requestType:\s*['"]storage['"]/,
    /receive callbacks and events/i,
  ]) {
    if (!requiredPattern.test(httpGuide)) issues.push(`HTTP guide is missing required contract coverage: ${requiredPattern}.`);
  }
  if (/requestType:\s*['"]stream['"]/.test(httpGuide)) {
    issues.push('HTTP guide must not describe stream as a request encoding.');
  }

  const sftpGuide = readFileSync(join(root, 'low-code/sftp.mdx'), 'utf8');
  for (const method of ['sftpImport', 'sftpExport', 'sftpCommands']) {
    if (!sftpGuide.includes(`transport.${method}`)) issues.push(`SFTP guide is missing transport.${method}.`);
  }

  const uploadGuide = readFileSync(join(root, 'operate/storage-uploads.mdx'), 'utf8');
  if (!/upload session is a temporary, durable \*\*control record\*\*/i.test(uploadGuide)) {
    issues.push('Storage upload guide must distinguish an upload session from a file entry.');
  }
  if (!/`uploadMode`[\s\S]*`writeMode`/i.test(uploadGuide)) {
    issues.push('Storage upload guide must distinguish uploadMode from writeMode.');
  }

  const generatedStorageReference = readFileSync(join(root, 'low-code/reference/storage.mdx'), 'utf8');
  if (/@example\b|No dedicated example is encoded|\bRedis\b|provider event|provider-streamed/i.test(generatedStorageReference)) {
    issues.push('Generated Storage reference contains raw JSDoc or private implementation prose.');
  }

  const declarationSnapshot = join(root, 'low-code', 'reference', 'source', 'api.public.d.ts');
  const deprecatedMethods = deprecatedLowCodeMethods(readFileSync(declarationSnapshot, 'utf8'));
  for (const method of deprecatedMethods) {
    const pattern = new RegExp(`\\b${method.replace('.', '\\.')}(?![A-Za-z0-9_$])`);
    for (const file of mdxFiles) {
      const content = readFileSync(file, 'utf8');
      if (pattern.test(content) && !permitsHistoricalMethod(relative(root, file).replaceAll('\\', '/'), method, content)) {
        issues.push(`Deprecated low-code method ${method} is published in ${relative(root, file)}.`);
      }
    }
  }

  const generatedReference = join(root, 'api-reference', 'openapi.json');
  if (statSync(generatedReference).isFile()) {
    const publicOpenApi = readFileSync(generatedReference, 'utf8');
    if (/\bRun API\b/i.test(publicOpenApi)) {
      issues.push('Legacy product name "Run API" found in api-reference/openapi.json.');
    }
    if (/\/api\/v1\/storage\/provider-configs|\bGCS\b|Provider bucket\/container name/i.test(publicOpenApi)) {
      issues.push('Public OpenAPI exposes replaceable Storage infrastructure configuration.');
    }
  }

  if (issues.length > 0) throw new Error(`Content quality gate failed:\n- ${issues.join('\n- ')}`);
  console.log(`Content quality passed: ${mdxFiles.length} non-empty MDX pages, complete navigation, current terminology.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
