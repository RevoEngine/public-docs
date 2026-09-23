import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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
