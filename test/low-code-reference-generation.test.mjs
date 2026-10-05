import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deprecatedLowCodeMethods } from '../scripts/check-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Service Account reference retains the native camelCase namespace and immutable rotation contract', () => {
  const reference = readFileSync(join(root, 'low-code/reference/serviceAccount.mdx'), 'utf8');
  assert.match(reference, /## `serviceAccount\.create\(\)`/);
  assert.match(reference, /## `serviceAccount\.rotateKey\(\)`/);
  assert.match(reference, /gracePeriodMs/);
  assert.match(reference, /newKey\.secret/);
  assert.match(reference, /expireAt is immutable/);
  const methods = [...reference.matchAll(/^## `serviceAccount\.([A-Za-z]+)\(\)`$/gm)].map(match => match[1]);
  assert.deepEqual(methods, ['get', 'list', 'create', 'update', 'delete', 'activate', 'disable', 'restore', 'enablePlatformAccess', 'disablePlatformAccess', 'getKeys', 'getKey', 'createKey', 'updateKey', 'rotateKey', 'revokeKey']);
  const navigation = JSON.parse(readFileSync(join(root, 'docs.json'), 'utf8'));
  assert.ok(JSON.stringify(navigation).includes('low-code/reference/serviceAccount'));
});

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


test('content gate groups overloads and removes obsolete bound decoding', () => {
  const declarations = `declare class api {
    /** @deprecated Prefer util.decodeBase64(). */
    static decodeBase64(value: string): string;
    /** Explicit bound decoding. */
    static decodeBase64(value: VaultBoundValue): Promise<string>;
    /** @deprecated Old alias. */
    static retired(value: string): string;
    /** @deprecated Old alias. */
    static retired(value: number): string;
    /** @deprecated Legacy shape. */
    static mixed(value: string): string;
    static mixed(value: number): string;
  }`;
  assert.deepEqual(deprecatedLowCodeMethods(declarations), ['api.retired']);
  const reference = readFileSync(join(root, 'low-code/reference/api.mdx'), 'utf8');
  assert.doesNotMatch(reference, /## `api.decodeBase64\(\)`/);
  const utils = readFileSync(join(root, 'low-code/reference/util.mdx'), 'utf8');
  assert.match(utils, /static decodeBase64\(base64String: string\): string/);
  const manager = readFileSync(join(root, 'low-code/reference/vault.mdx'), 'utf8');
  assert.match(manager, /static getAccessToken\(/);
  assert.doesNotMatch(manager, /static ref\(/);
});


test('every generated reference linked from the index belongs to the platform contract manifest', () => {
  const index = readFileSync(join(root, 'low-code/reference/index.mdx'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(root, 'platform-contracts.json'), 'utf8'));
  const links = [...index.matchAll(/\]\(\/low-code\/reference\/([a-z]+)\)/g)].map(match => `low-code/reference/${match[1]}.mdx`);
  assert.ok(links.includes('low-code/reference/vault.mdx'));
  for (const page of links) assert.ok(manifest.contracts.lowCodeRuntime.generated.includes(page), `Missing contract artifact: ${page}`);
});


test('bulk automation reference documents mutations, preview and progress reads', () => {
  const reference = readFileSync(join(root, 'low-code/reference/api.mdx'), 'utf8');
  for (const method of [
    'cancelJobs', 'retryJobs', 'deleteJobs',
    'cancelWebhooks', 'retryWebhooks', 'deleteWebhooks',
    'previewAutomationOperation', 'getAutomationOperation', 'getAutomationOperationItems',
  ]) {
    assert.ok(reference.includes(`## \`api.${method}()\``), `Missing bulk lifecycle method: ${method}`);
    assert.ok(reference.includes(`static ${method}(`), `Missing canonical signature: ${method}`);
  }
});
