import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseProductContract, renderProductModel, replaceProductSummary, validateProductContract } from '../scripts/product-knowledge.mjs';
const product = JSON.parse(readFileSync(new URL('../platform/product-contract.json', import.meta.url), 'utf8'));

test('public product model covers responsibilities and every decision without losing guide links', () => {
  const page = renderProductModel(product);
  assert.ok(page.includes(product.summary));
  for (const decision of product.decisions) {
    assert.ok(page.includes(decision.choose));
    assert.ok(page.includes(decision.verify));
    assert.ok(page.includes(`(${decision.docs})`));
  }
  assert.throws(() => validateProductContract({ ...product, schemaVersion: 2 }));
  assert.throws(() => validateProductContract({ ...product, domains: [product.domains[0], product.domains[0]] }));
  assert.throws(() => parseProductContract('not a contract'));
});

test('summary synchronization preserves authored content and fails closed without boundaries', () => {
  const input = 'Before\n{/* product-summary:start */}\nOld\n{/* product-summary:end */}\nAfter';
  assert.equal(replaceProductSummary(input, 'Current'), 'Before\n{/* product-summary:start */}\nCurrent\n{/* product-summary:end */}\nAfter');
  assert.throws(() => replaceProductSummary('No markers', 'Current'));
});

test('source-backed checks accept an explicit canonical contract outside the docs checkout and reject drift', async () => {
  const work = await mkdtemp(join(tmpdir(), 'revo-docs-product-source-'));
  try {
    const source = join(work, 'product.contract.ts');
    const check = () => spawnSync(process.execPath, [new URL('../scripts/product-knowledge.mjs', import.meta.url).pathname,
      '--check', '--require-source'], { env: { ...process.env, REVOENGINE_PRODUCT_CONTRACT: source }, encoding: 'utf8' });
    await writeFile(source, `export const REVO_PRODUCT_CONTRACT = ${JSON.stringify(product)} as const;\n`);
    const current = check();
    assert.equal(current.status, 0, current.stderr);
    await writeFile(source, `export const REVO_PRODUCT_CONTRACT = ${JSON.stringify({ ...product, summary: `${product.summary} Changed.` })} as const;\n`);
    const stale = check();
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Stale product knowledge/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
