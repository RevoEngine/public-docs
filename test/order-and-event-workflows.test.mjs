import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { codeExamples } from '../scripts/documentation-examples.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const compile = path => ts.transpileModule(
  '(async () => {\n' + codeExamples(read(path))[0].code + '\n})()',
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const run = (source, globals) => vm.runInNewContext(source, globals);
const reservation = compile('tutorials/order-reservation.mdx');
const settlement = compile('tutorials/order-settlement.mdx');
const eventJob = compile('examples/event-job.mdx');
const util = { isUUID: value => typeof value === 'string' && value.length > 0, randomUUID: () => 'transaction-1' };

test('both order tutorial Components typecheck against the public low-code declaration', () => {
  const sources = new Map(['order-reservation', 'order-settlement'].map(name => [
    resolve(name + '.ts'),
    'export {};\nasync function documentedComponent() {\n' + codeExamples(read('tutorials/' + name + '.mdx'))[0].code + '\n}',
  ]));
  const options = { target: ts.ScriptTarget.ES2022, noEmit: true, strict: true, skipLibCheck: true, types: [] };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = name => sources.get(name) ?? readFile(name);
  host.fileExists = name => sources.has(name) || fileExists(name);
  const program = ts.createProgram([...sources.keys(), resolve('low-code/reference/source/api.public.d.ts')], options, host);
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
});

function orderWorkflow() {
  const rows = {
    orders: { orderId: 'order-1', accountId: 'account-1', amountMinor: '1250', currency: 'USD', status: 'PENDING' },
    balances: { balanceId: 'balance-1', accountId: 'account-1', currency: 'USD', availableMinor: '2000', reservedMinor: '0' },
    transactions: null,
  };
  const calls = { enqueue: 0, provider: 0, receipts: 0 };
  let reserved = false;
  let jobInput;
  let receipt;
  const errors = {};
  const readRows = async table => {
    const row = rows[table];
    return { results: row ? 1 : 0, data: row ? [{ ...row }] : [] };
  };
  const update = async (table, _target, changes) => {
    if (table === 'transactions' && changes.settlementJobId && errors.jobReceipt) {
      throw new Error('job receipt write unavailable');
    }
    if (table === 'transactions' && changes.receiptStorageEntryId && errors.storageLink) {
      throw new Error('storage link write unavailable');
    }
    Object.assign(rows[table], plain(changes));
  };
  const tx = {
    getDatabaseData: readRows,
    updateDatabaseData: update,
    insertDatabaseData: async (table, data) => { rows[table] = plain(data[0]); },
  };
  const transactionDatabase = async callback => {
    const snapshot = plain(rows);
    try { return await callback(tx); }
    catch (error) { Object.assign(rows, snapshot); throw error; }
  };
  const request = { orderId: 'order-1', requestKey: 'reservation-test-1' };
  const endpointApi = {
    input: () => ({ body: request, templateInputs: { settleOrderTemplateId: 'template-1' } }),
    getOperationId: () => 'reservation-operation',
    currentUser: () => ({ userId: 'operator-1' }),
    acquireIdempotencyKey: async () => {
      if (reserved) return false;
      reserved = true;
      return true;
    },
    releaseIdempotencyKey: async () => { reserved = false; },
    transactionDatabase,
    getDatabaseData: readRows,
    throw: (status, body) => { throw Object.assign(new Error(body.message), { status }); },
    triggerJob: async (template, input) => {
      assert.equal(template, 'template-1');
      calls.enqueue++;
      if (errors.enqueue) throw new Error('job admission unavailable');
      jobInput = plain(input);
      return 'job-' + calls.enqueue;
    },
    log() {},
  };
  const workerApi = {
    input: key => ({ templateInputs: jobInput })[key],
    getDatabaseDataRow: async table => ({ ...rows[table] }),
    getOperationId: () => 'settlement-operation',
    transactionDatabase,
    updateDatabaseData: update,
    httpCall: async request => {
      calls.provider++;
      assert.equal(request.headers['Idempotency-Key'], 'transaction-1');
      if (errors.providerPending) return { status: 202, data: { status: 'ACCEPTED' } };
      return { status: 200, data: { status: 'SETTLED', reference: 'provider-receipt' } };
    },
  };
  const storage = {
    ensureFolderPath: async () => ({ storageEntryId: 'folder-1', effectiveRestricted: true }),
    explore: async () => ({ data: receipt ? [receipt] : [] }),
    putObject: async input => {
      calls.receipts++;
      if (errors.storageWrite) throw new Error('storage write unavailable');
      receipt = { storageEntryId: 'receipt-1', name: input.name };
      return receipt;
    },
  };
  return {
    rows, calls, errors, request,
    reserve: () => run(reservation, { api: endpointApi, util }),
    settle: () => run(settlement, {
      api: workerApi, util, storage,
      vault: { get: async () => ({ revision: { value: 'example-only' } }) },
    }),
  };
}

test('reservation retry recovers failed admission and passes the real Job input envelope', async () => {
  const flow = orderWorkflow();
  flow.errors.enqueue = true;
  await assert.rejects(flow.reserve(), /job admission unavailable/);
  assert.equal(flow.rows.transactions.status, 'PENDING_SETTLEMENT');
  flow.errors.enqueue = false;

  const result = await flow.reserve();
  assert.equal(result.jobId, 'job-2');
  assert.equal(result.duplicate, true);
  assert.equal(flow.rows.balances.availableMinor, '750');
  assert.equal(flow.rows.balances.reservedMinor, '1250');
  assert.equal((await flow.reserve()).jobId, result.jobId);
  assert.equal(flow.calls.enqueue, 2);

  flow.request.orderId = 'another-order';
  await assert.rejects(flow.reserve(), error => error.status === 409);
  assert.equal(flow.calls.enqueue, 2);
  const finished = await flow.settle();
  assert.equal(finished.parentOperationId, 'reservation-operation');
  assert.equal(finished.status, 'SETTLED');
  assert.equal(flow.rows.orders.status, 'SETTLED');
  assert.equal(flow.rows.balances.reservedMinor, '0');
});

test('a lost Job receipt can enqueue again while settlement still applies once', async () => {
  const flow = orderWorkflow();
  flow.errors.jobReceipt = true;
  await assert.rejects(flow.reserve(), /job receipt write unavailable/);
  assert.equal(flow.calls.enqueue, 1);
  flow.errors.jobReceipt = false;
  assert.equal((await flow.reserve()).jobId, 'job-2');
  assert.equal((await flow.settle()).receiptStorageEntryId, 'receipt-1');
  assert.equal((await flow.settle()).receiptStorageEntryId, 'receipt-1');
  assert.deepEqual(flow.calls, { enqueue: 2, provider: 1, receipts: 1 });
});

test('settlement recovers both a failed Storage write and a lost receipt link without provider replay', async () => {
  const flow = orderWorkflow();
  await flow.reserve();
  flow.errors.storageWrite = true;
  await assert.rejects(flow.settle(), /storage write unavailable/);
  assert.equal(flow.rows.transactions.status, 'SETTLED');
  assert.equal(flow.rows.balances.reservedMinor, '0');

  flow.errors.storageWrite = false;
  flow.errors.storageLink = true;
  await assert.rejects(flow.settle(), /storage link write unavailable/);
  flow.errors.storageLink = false;
  const retry = await flow.settle();
  assert.equal(retry.receiptStorageEntryId, 'receipt-1');
  assert.equal(flow.rows.transactions.receiptStorageEntryId, 'receipt-1');
  assert.equal(flow.rows.balances.reservedMinor, '0');
  assert.deepEqual(flow.calls, { enqueue: 1, provider: 1, receipts: 2 });
});

test('provider acceptance leaves the order reserved until settlement is confirmed', async () => {
  const flow = orderWorkflow();
  await flow.reserve();
  flow.errors.providerPending = true;
  await assert.rejects(flow.settle(), /settlement is not confirmed/);
  assert.equal(flow.rows.transactions.status, 'PENDING_SETTLEMENT');
  assert.equal(flow.rows.orders.status, 'RESERVED');
  assert.equal(flow.rows.balances.reservedMinor, '1250');
  assert.equal(flow.calls.receipts, 0);
});

test('Event-to-Job example keeps message, metadata and resolved policy separate', async () => {
  const page = read('examples/event-job.mdx');
  const block = title => JSON.parse(page.split('```json title="' + title + '"\n')[1].split('\n```')[0]);
  const published = block('Event publication');
  const defaults = block('Job template · Runtime input');
  const inputs = { ...published, templateInputs: { ...defaults, maxRecords: 10 } };
  const api = { input: key => inputs[key] };
  assert.deepEqual(plain(await run(eventJob, { api })), block('Report result'));
  inputs.metadata.correlationId = 'unsanitized-input';
  assert.equal((await run(eventJob, { api })).correlationId, null);
  inputs.message.recordCount = 11;
  await assert.rejects(run(eventJob, { api }), /outside the batch limit/);
  inputs.message = { ...published.message, kind: 'orders' };
  await assert.rejects(run(eventJob, { api }), /valid inventory batch/);
});
