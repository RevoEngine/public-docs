#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = join(root, 'platform/product-contract.json');
const canonical = resolve(root, '../@revoengine-platform/packages/domain/src/config/revo-product.contract.ts');

export function parseProductContract(source) {
  const match = source.match(/export const REVO_PRODUCT_CONTRACT = (\{[\s\S]*\}) as const;/);
  if (!match) throw new Error('Invalid canonical product contract.');
  const contract = JSON.parse(match[1]);
  validateProductContract(contract);
  return contract;
}

export function validateProductContract(contract) {
  if (contract.schemaVersion !== 1 || contract.name !== 'RevoEngine') throw new Error('Unsupported product contract.');
  for (const field of ['summary', 'purpose']) {
    if (typeof contract[field] !== 'string' || !contract[field].trim()) throw new Error(`Missing product ${field}.`);
  }
  if (!Array.isArray(contract.boundaries) || !contract.boundaries.length || contract.boundaries.some((v) => typeof v !== 'string' || !v.trim())) throw new Error('Missing product responsibilities.');
  if (!Array.isArray(contract.domains) || !contract.domains.length || !Array.isArray(contract.decisions) || !contract.decisions.length) throw new Error('Missing product choices.');
  for (const [entries, fields] of [[contract.domains, ['name', 'purpose', 'docs']], [contract.decisions, ['goal', 'choose', 'verify', 'docs']]]) {
    const keys = new Set();
    for (const entry of entries) {
      if (fields.some((field) => typeof entry[field] !== 'string' || !entry[field].trim())) throw new Error('Incomplete product entry.');
      if (keys.has(entry[fields[0]])) throw new Error('Duplicate product entry.');
      keys.add(entry[fields[0]]);
      if (!/^\/[a-z0-9/-]+$/.test(entry.docs)) throw new Error('Product references must use public documentation paths.');
    }
  }
  if (contract.documentation?.origin !== 'https://docs.revoengine.com') throw new Error('Unexpected product documentation origin.');
}

export function renderProductModel(product) {
  validateProductContract(product);
  return [
    '---', 'title: Choose your approach',
    'description: Understand when RevoEngine fits, select capabilities, and separate platform responsibilities from application decisions.',
    'icon: compass', '---', '', product.summary, '', product.purpose, '',
    '## What the platform owns and what you own', '',
    ...product.boundaries.map((line) => `- ${line}`), '',
    '## Choose capabilities for the outcome', '',
    ...product.decisions.flatMap((decision) => [
      `### ${decision.goal}`, '', decision.choose, '', `**Check before implementing:** ${decision.verify}`, '',
      `[Read the guide](${decision.docs})`, '',
    ]),
    '## How the capabilities fit together', '',
    '| Capability | Responsibility | Guide |', '| --- | --- | --- |',
    ...product.domains.map((domain) => `| ${domain.name} | ${domain.purpose} | [${domain.name}](${domain.docs}) |`), '',
    '## Move from a design to verified work', '',
    'State the business outcome, existing system of record, identity, expected volume, completion boundary, and failure policy. Choose the smallest combination of platform capabilities that meets those requirements. Inspect the exact contract and validate both success and failure paths before production use.', '',
    'Continue with [Secure order processing](/platform/first-production-workflow) for a complete example, or [Developer overview](/developers/overview) to choose an interface.', '',
  ].join('\n');
}

const start = '{/* product-summary:start */}';
const end = '{/* product-summary:end */}';
export function replaceProductSummary(page, summary) {
  if (page.split(start).length !== 2 || page.split(end).length !== 2 || page.indexOf(start) > page.indexOf(end)) throw new Error('Missing or duplicate product-summary markers.');
  return page.slice(0, page.indexOf(start)) + `${start}\n${summary}\n${end}` + page.slice(page.indexOf(end) + end.length);
}

function main() {
  const args = new Set(process.argv.slice(2));
  const sync = args.has('--sync');
  if (sync === args.has('--check')) throw new Error('Choose --sync or --check.');
  if (args.has('--require-source') && !existsSync(canonical)) throw new Error('Canonical product source is required.');
  const product = sync || args.has('--require-source')
    ? parseProductContract(readFileSync(canonical, 'utf8'))
    : JSON.parse(readFileSync(snapshot, 'utf8'));
  validateProductContract(product);
  for (const entry of [...product.domains, ...product.decisions]) {
    if (!existsSync(join(root, `${entry.docs.slice(1)}.mdx`))) throw new Error(`Missing product guide: ${entry.docs}`);
  }
  const outputs = new Map([
    [snapshot, `${JSON.stringify(product, null, 2)}\n`],
    [join(root, 'platform/product-model.mdx'), renderProductModel(product)],
    ...['introduction.mdx', 'platform/overview.mdx'].map((page) => {
      const path = join(root, page);
      return [path, replaceProductSummary(readFileSync(path, 'utf8'), product.summary)];
    }),
  ]);
  for (const [path, content] of outputs) {
    if (sync) writeFileSync(path, content);
    else if (!existsSync(path) || readFileSync(path, 'utf8') !== content) throw new Error(`Stale product knowledge: ${path.slice(root.length + 1)}. Run npm run sync:product-knowledge.`);
  }
  console.log(`Product knowledge ${sync ? 'synchronized' : 'verified'}: summary, capability model, choices, and source parity.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
