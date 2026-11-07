import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { codeExamples } from '../scripts/documentation-examples.mjs';

const page = readFileSync(new URL('../operate/reactive-widgets.mdx', import.meta.url), 'utf8');
const examples = codeExamples(page);
const view = examples.find(item => item.code.includes("wanted('jobForm')")).code;
const start = examples.find(item => item.code.includes('api.triggerJob(')).code;
const status = examples.find(item => item.code.includes("const jobId = api.input()?.jobId")).code;
const execute = (code, api) => vm.runInNewContext('(async () => {\n' + code + '\n})()', { api });
const plain = value => JSON.parse(JSON.stringify(value));

test('published widget submits the form and requests only its result tile after exact-job confirmation', async () => {
  const calls = [];
  const api = {
    input: () => ({ templateId: 'template-1' }),
    getInstanceData: async (resource, query) => {
      calls.push([resource, plain(query)]);
      return { data: [{ jobId: 'job-1', status: 'FINISHED' }] };
    },
  };
  const rows = plain(await execute(view, api));
  assert.deepEqual(rows.map(row => row[0].id), ['jobForm', 'jobResult']);
  const form = rows[0][0];
  assert.equal(form.fields[0].id, 'batch');
  assert.deepEqual(form.on.submit.input.batch, { from: 'input', id: 'batch' });
  assert.deepEqual(form.on.submit.waitFor.input.jobId, { from: 'result', path: 'jobId' });
  assert.equal(form.on.submit.waitFor.equals, 'FINISHED');
  assert.equal(form.on.submit.refresh, 'jobResult');
  assert.equal(calls[0][1].filter.jobTemplateId.equals, 'template-1');

  api.input = () => ({ templateId: 'template-1', $widget: {
    targetIds: ['jobResult'], values: { batch: 'KEEP-MY-INPUT' },
  } });
  const partial = plain(await execute(view, api));
  assert.deepEqual(partial.map(row => row[0].id), ['jobResult']);
  assert.match(partial[0][0].value, /job-1: \*\*FINISHED\*\*/);
  assert.equal(calls.length, 2);
  api.input = () => ({ templateId: 'template-1', $widget: { targetIds: ['jobForm'] } });
  await execute(view, api);
  assert.equal(calls.length, 2, 'a form-only response must not read job history');
});

test('published start component validates arguments and guards duplicate dispatches', async () => {
  const cache = new Map();
  let triggers = 0;
  const input = { templateId: 'template-1', batch: ' BATCH-001 ', $widget: { requestId: 'request-1' } };
  const api = {
    input: () => input,
    setInstanceCacheIfNotExists: async (key, value, ttl) => {
      assert.equal(ttl, 3600);
      if (cache.has(key)) return false;
      cache.set(key, value);
      return true;
    },
    getInstanceCache: async key => cache.get(key),
    setInstanceCache: async (key, value) => { cache.set(key, value); },
    triggerJob: async (template, args) => {
      assert.equal(template, 'template-1');
      assert.deepEqual(plain(args), { batch: 'BATCH-001', requestId: 'request-1' });
      triggers++;
      return 'job-1';
    },
  };
  assert.deepEqual(plain(await execute(start, api)), { jobId: 'job-1' });
  assert.deepEqual(plain(await execute(start, api)), { jobId: 'job-1' });
  assert.equal(triggers, 1);
  input.batch = ' ';
  await assert.rejects(execute(start, api), /required/);
  assert.equal(triggers, 1);
});

test('published start component does not enqueue again when the receipt write is uncertain', async () => {
  const cache = new Map();
  let triggers = 0;
  const api = {
    input: () => ({ templateId: 'template-1', batch: 'BATCH-001', $widget: { requestId: 'request-2' } }),
    setInstanceCacheIfNotExists: async (key, value) => {
      if (cache.has(key)) return false;
      cache.set(key, value); return true;
    },
    getInstanceCache: async key => cache.get(key),
    setInstanceCache: async () => { throw new Error('receipt write interrupted'); },
    triggerJob: async () => { triggers++; return 'job-2'; },
  };
  await assert.rejects(execute(start, api), /receipt write interrupted/);
  await assert.rejects(execute(start, api), /unconfirmed/);
  assert.equal(triggers, 1);
});

test('published status component queries the receipt job ID and keeps unknown separate from completion', async () => {
  let rows = [{ jobId: 'job-1', status: 'FINISHED' }];
  const api = {
    input: () => ({ jobId: 'job-1' }),
    getInstanceData: async (resource, query) => {
      assert.equal(resource, 'Jobs');
      assert.deepEqual(plain(query), { filter: { jobId: { equals: 'job-1' } }, fields: ['jobId', 'status'], take: 1 });
      return { data: rows };
    },
  };
  assert.deepEqual(plain(await execute(status, api)), { status: 'FINISHED' });
  rows = [];
  assert.deepEqual(plain(await execute(status, api)), { status: 'UNKNOWN' });
  api.input = () => ({});
  await assert.rejects(execute(status, api), /jobId is required/);
});

test('published target configuration explicitly separates the write executor and read-only probe', () => {
  const json = [...page.matchAll(/^```json\n([\s\S]*?)^```/gm)].map(match => JSON.parse(match[1]));
  const targets = json.find(value => value.startBatch);
  assert.equal(targets.startBatch.readOnly, false);
  assert.equal(targets.batchStatus.readOnly, true);
  assert.equal(JSON.parse(targets.startBatch.inputs).templateId, json[0].templateId);
});

test('published drill-down passes the clicked ID into a self-contained destination with Back', async () => {
  const json = [...page.matchAll(/^```json\n([\s\S]*?)^```/gm)].map(match => JSON.parse(match[1]));
  const target = json.find(value => value.orderDetail).orderDetail;
  const parentCode = examples.find(item => item.code.includes("target: 'orderDetail', mode: 'replace'")).code;
  const parent = plain(await execute(parentCode, { input: () => ({}) }));
  const action = parent[0][0].on.rowClick;
  assert.equal(action.target, 'orderDetail');
  assert.deepEqual(action.input.orderId, { from: 'event', path: 'row.id' });
  const detail = plain(await execute(target.code, { input: () => ({ orderId: parent[0][0].data[1].id }) }));
  assert.equal(detail[0][0].value, 'Order: order-2');
  assert.deepEqual(detail[1][0].on.click, { type: 'BACK' });
  assert.equal(target.readOnly, true);
});
