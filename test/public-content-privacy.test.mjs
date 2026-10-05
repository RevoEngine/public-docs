import assert from 'node:assert/strict';
import test from 'node:test';
import { publicOpenApiPrivacyIssues, publicTextPrivacyIssues } from '../scripts/public-content-privacy.mjs';

for (const [name, content, category] of [
  ['IPv4', 'host: 192.0.2.17', 'IP address literal'],
  ['compressed IPv6', 'host: [2001:db8::17]', 'IP address literal'],
  ['mapped IPv6', 'host: [::ffff:192.0.2.17]', 'IP address literal'],
  ['private provider', 'Replay redis events.', 'private implementation prose'],
  ['private class', 'QueryService generates results.', 'private implementation prose'],
  ['private repo path', 'packages/platform/src/internal.ts', 'private repository path'],
  ['private locator', 'rediss://cache.internal:6379', 'private infrastructure locator'],
  ['credential assignment', 'apiKey: "synthetic-not-a-real-credential"', 'credential literal'],
  ['credential URL', 'sftp://user:synthetic-credential@sftp.example.com', 'credential literal'],
  ['bearer', 'Bearer syntheticCredentialWithLength1234', 'credential literal'],
  ['GitLab token', 'glpat-' + 'A'.repeat(36), 'credential literal'],
  ['npm token', 'npm_' + 'A'.repeat(36), 'credential literal'],
  ['signed URL', 'https://example.com/file?x-goog-signature=syntheticCredentialWithLength1234', 'signed URL credential'],
  ['private key', '-----BEGIN PRIVATE KEY-----\n'+ 'A'.repeat(48)+'\n-----END PRIVATE KEY-----', 'private key literal'],
]) {
  test(`rejects ${name} without echoing the value`, () => {
    const result = publicTextPrivacyIssues(content);
    assert.ok(result.includes(category));
    assert.ok(result.every(item => !item.includes(content)));
  });
}

test('allows field names, version numbers and explicit credential placeholders', () => {
  for (const content of ['version 1.6.4', 'Store credentials in an approved secret manager.', 'https://example.com/file?sig=%3Csigned-url-signature%3E', 'src/normalize-order.js optional relative module', 'password: "<password>"', 'apiKey: "${API_KEY}"', 'Authorization: Bearer <TOKEN>', 'Authorization: Basic <CREDENTIALS>', 'authorization: "Basic ${BASIC_CREDENTIALS}"', 'Basic authentication uses an Authorization header.', 'sftp://user:password@sftp.example.com', 'privateKey: "<private-key-pem>"', 'fields: password, token, privateKey']) {
    assert.deepEqual(publicTextPrivacyIssues(content), []);
  }
});

test('checks summaries, descriptions and examples without banning public dialect enums or schema names', () => {
  const contract = { components: { schemas: { QueryServiceRequestDto: { properties: { dialect: { enum: ['postgres', 'bigquery'] } } } } }, paths: { '/query': { post: { summary: 'Read results.', description: 'Filter using logical fields.' } } } };
  assert.deepEqual(publicOpenApiPrivacyIssues(contract), []);
  contract.paths['/query'].post.description = 'Read results from BigQuery.';
  assert.deepEqual(publicOpenApiPrivacyIssues(contract), ['$.paths./query.post.description: private implementation prose']);
  contract.paths['/query'].post.description = 'Read results.';
  contract.paths['/query'].post.example = { host: '2001:db8::17' };
  assert.deepEqual(publicOpenApiPrivacyIssues(contract), ['$.paths./query.post.example.host: IP address literal']);
});


test('an appended placeholder cannot mask literal credential material', () => {
  for (const content of [
    'password: "synthetic-passphrase-${TOKEN}"',
    'https://fixture:synthetic-passphrase-${TOKEN}@example.com',
  ]) assert.deepEqual(publicTextPrivacyIssues(content), ['credential literal']);
  assert.deepEqual(publicTextPrivacyIssues('https://files.example.com/object?sig=syntheticCredentialWithLength1234%3Credacted%3E'), ['signed URL credential']);
});


test('checks credential fields in structured public examples without echoing their values', () => {
  for (const key of ['password', 'client_secret', 'Authorization', 'x-api-key', 'privateKey']) {
    const contract = { requestBody: { content: { 'application/json': { examples: { sample: { value: { [key]: 'synthetic-not-a-real-credential' } } } } } } };
    const result = publicOpenApiPrivacyIssues(contract);
    assert.deepEqual(result, [`$.requestBody.content.application/json.examples.sample.value.${key}: credential literal`]);
    assert.ok(result.every(item => !item.includes('synthetic-not-a-real-credential')));
    contract.requestBody.content['application/json'].examples.sample.value[key] = '<credential>';
    assert.deepEqual(publicOpenApiPrivacyIssues(contract), []);
  }
});

test('preserves ordinary schema information for credential fields', () => {
  const contract = { components: { schemas: { InputDto: { required: ['password'], properties: { password: { type: 'string', description: 'Password for the selected connection.' }, token: { type: 'string' } } } } } };
  assert.deepEqual(publicOpenApiPrivacyIssues(contract), []);
});


test('rejects encoded Basic credentials without returning the encoded or decoded value', () => {
  const encoded = Buffer.from('fixture:synthetic-password').toString('base64');
  assert.deepEqual(publicTextPrivacyIssues('Authorization: Basic '+encoded), ['credential literal']);
});
