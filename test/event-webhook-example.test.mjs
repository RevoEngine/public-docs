import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { codeExamples } from '../scripts/documentation-examples.mjs';

const page = readFileSync(new URL('../patterns/event-to-webhook.mdx', import.meta.url), 'utf8');
const blocks = codeExamples(page);
const publisher = blocks.find(item => item.code.includes('api.triggerEvent(')).code;
const consumer = blocks.find(item => item.code.includes('api.triggerWebhook(')).code;
const run = (code, api) => vm.runInNewContext('(async () => {\n' + code + '\n})()', { api });
const plain = value => JSON.parse(JSON.stringify(value));

test('published Event-to-Webhook example carries business identity explicitly across both boundaries', async () => {
  let envelope;
  const published = await run(publisher, { triggerEvent: async (type, message, options) => {
    envelope = plain({ type, message, metadata: options.metadata });
    return 'event-1';
  } });
  assert.deepEqual(plain(published), { accepted: true, eventId: 'event-1' });
  const sent = [];
  const result = await run(consumer, { input: () => envelope, triggerWebhook: async request => {
    sent.push(plain(request)); return { webhookId: 'webhook-1' };
  } });
  assert.deepEqual(plain(result), { accepted: true, webhookId: 'webhook-1' });
  assert.equal(sent[0].metadata.correlationId, 'checkout-1');
  assert.equal(sent[0].request.headers['Idempotency-Key'], 'order-1:ready:v1');
  assert.equal(sent[0].request.body.operationKey, sent[0].metadata.operationKey);
  assert.equal(sent[0].maxRetries, 1);
  assert.equal(sent[0].request.body.orderId, 'order-1');
  assert.ok(!('finished' in result), 'Webhook acceptance is not business completion');
});

test('target validation rejects incomplete envelopes before outbound creation', async () => {
  for (const input of [undefined, {}, { type: 'ORDER_READY', message: { orderId: 'order-1', status: 'READY' } },
    { type: 'ORDER_CANCELLED', message: { orderId: 'order-1', status: 'READY' }, metadata: { operationKey: 'key', correlationId: 'correlation' } }]) {
    let dispatched = false;
    await assert.rejects(run(consumer, { input: () => input, triggerWebhook: async () => { dispatched = true; } }), /required/);
    assert.equal(dispatched, false);
  }
});

test('a repeated target run can create another Webhook but retains the receiver business key', async () => {
  const requests = [];
  const api = { input: () => ({ type: 'ORDER_READY', message: { orderId: 'order-1', status: 'READY' },
    metadata: { operationKey: 'order-1:ready:v1', correlationId: 'checkout-1' } }),
    triggerWebhook: async request => { requests.push(plain(request)); return { webhookId: 'webhook-' + requests.length }; } };
  const first = await run(consumer, api);
  const second = await run(consumer, api);
  assert.notEqual(first.webhookId, second.webhookId);
  assert.equal(requests[0].request.headers['Idempotency-Key'], requests[1].request.headers['Idempotency-Key']);
});
