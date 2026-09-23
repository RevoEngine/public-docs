import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('groups overloaded low-code methods into one reference section', () => {
  const reference = readFileSync(join(root, 'low-code/reference/api.mdx'), 'utf8');

  assert.equal(reference.match(/^## `api\.httpCall\(\)`$/gm)?.length, 1);
  assert.equal(reference.match(/\[`api\.httpCall\(\)`\]\(#api-httpCall\)/g)?.length, 1);
  assert.match(reference, /## `api\.httpCall\(\)`[\s\S]*?### Overloads[\s\S]*?streamFormat: 'sse'/);
  assert.match(reference, /### Overloads[\s\S]*?responseType: 'storage'/);
});
