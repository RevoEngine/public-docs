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

test('Storage reference shows both id-only and namespace signatures', () => {
  const reference = readFileSync(join(root, 'low-code/reference/storage.mdx'), 'utf8');
  assert.match(reference, /## `storage\.getFileData\(\)`[\s\S]*?### Overloads[\s\S]*?static getFileData\(\s*storageEntryId: string[\s\S]*?static getFileData\(\s*namespace: string,/);
  assert.match(reference, /## `storage\.walkFileData\(\)`[\s\S]*?### Overloads[\s\S]*?static walkFileData<T = any>\(\s*storageEntryId: string[\s\S]*?static walkFileData<T = any>\(\s*namespace: string,/);
  const methods = [...reference.matchAll(/^## `storage\.([A-Za-z]+)\(\)`$/gm)].map((match) => match[1]);
  assert.equal(methods.length, 23);
  for (const name of methods) {
    const section = reference.split(`## \`storage.${name}()\``)[1]?.split('\n## `')[0] ?? '';
    assert.match(section, /### Overloads/);
    assert.equal(section.match(new RegExp(`static ${name}(?:<[^>]+>)?\\(`, 'g'))?.length, 2, name);
  }
  assert.doesNotMatch(reference, /## `storage\.getText\(\)`/);
});
