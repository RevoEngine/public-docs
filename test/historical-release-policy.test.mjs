import assert from 'node:assert/strict';
import test from 'node:test';
import { permitsHistoricalMethod } from '../scripts/historical-release-policy.mjs';

const note = 'This historical example uses the method name available in 1.0.3. For new code, use `api.transactionDatabase()`; the older name is now deprecated.';

test('a dated historical example needs an explicit current replacement', () => {
  assert.equal(permitsHistoricalMethod('changelog/1.0.3.mdx', 'api.transactionDatabaseData', note), true);
  assert.equal(permitsHistoricalMethod('changelog/1.0.3.mdx', 'api.transactionDatabaseData', ''), false);
});

test('historical exception never permits deprecated APIs in current guides or other releases', () => {
  assert.equal(permitsHistoricalMethod('low-code/database.mdx', 'api.transactionDatabaseData', note), false);
  assert.equal(permitsHistoricalMethod('changelog/1.5.0.mdx', 'api.transactionDatabaseData', note), false);
  assert.equal(permitsHistoricalMethod('changelog/1.0.3.mdx', 'api.getJobId', note), false);
});

test('permits the historical SFTP import example only with its current replacement', () => {
  const note = 'This historical example uses the method name available in 1.3.2. For new code, use `transport.sftpImport()` with a Secret-backed connection; the older name is now deprecated.';

  assert.equal(permitsHistoricalMethod('changelog/1.3.2.mdx', 'api.sftpGet', note), true);
  assert.equal(permitsHistoricalMethod('changelog/1.3.2.mdx', 'api.sftpGet', ''), false);
  assert.equal(permitsHistoricalMethod('changelog/1.3.2.mdx', 'api.sftpPut', note), false);
});
