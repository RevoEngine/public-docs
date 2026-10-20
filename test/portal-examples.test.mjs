import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { EventEmitter, once } from 'node:events';
import { codeExamples } from '../scripts/documentation-examples.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const [backend, browser] = codeExamples(read('developers/customer-ai-portal.mdx'));
function client(fetch) {
  const context = vm.createContext({ fetch, TextDecoder, Error });
  vm.runInContext(browser.code.replace('export async function', 'async function'), context);
  return context.askSalesDesk;
}
function streamed(text) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    // Every byte boundary is exercised, including CRLF and the three-byte euro sign.
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } }));
}
test('published SSE client reconstructs fragmented UTF-8 events and reads the real final message field', async () => {
  const received = [];
  const ask = client(async () => streamed(
    'event: tool.completed\r\ndata: {"toolExecutionId":"quote-1","toolStatus":"completed"}\r\n\r\n' +
    'event: message.delta\r\ndata: {"delta":"€46"}\r\n\r\n' +
    'event: message.completed\r\ndata: {"message":{"message":"€46.25"}}\r\n\r\n'));
  await ask('Quote four filters', (event, payload) => received.push({ event, payload }));
  assert.deepEqual(received.map(x => x.event), ['tool.completed', 'message.delta', 'message.completed']);
  assert.equal(received.at(-1).payload.message.message, '€46.25');
  assert.equal(received[0].payload.toolExecutionId, 'quote-1');
});
test('published SSE client rejects a partial answer, server error and failed HTTP request', async () => {
  await assert.rejects(client(async () => streamed('event: message.delta\ndata: {"delta":"partial"}\n\n'))('x', () => {}), /before a completed answer/);
  await assert.rejects(client(async () => streamed('event: error\ndata: {"message":"Provider unavailable"}\n\n'))('x', () => {}), /Provider unavailable/);
  await assert.rejects(client(async () => new Response('{}', { status: 403 }))('x', () => {}), /Sales Desk unavailable/);
});
test('published portal backend keeps the key server-side and admits plugin dispatch tools', async () => {
  let request;
  const context = vm.createContext({ once, URL, AbortController, AbortSignal, Buffer,
    process: { env: { REVO_API_URL: 'https://api.example.test', REVO_PORTAL_KEY: 'test-only-key', REVO_INSTANCE: 'demo-instance', REVO_SALES_PLUGIN_ID: 'sales-plugin' } },
    fetch: async (url, init) => { request = { url: String(url), ...init }; return streamed('event: message.completed\ndata: {"message":{"message":"€46.25"}}\n\n'); },
  });
  vm.runInContext(backend.code.replace("import { once } from 'node:events';", '').replace('export async function', 'async function'), context);
  const response = Object.assign(new EventEmitter(), {
    chunks: [], writableEnded: false, destroyed: false, headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    flushHeaders() {}, write(chunk) { this.chunks.push(Buffer.from(chunk)); return true; },
    end(chunk) { if (chunk) this.chunks.push(Buffer.from(chunk)); this.writableEnded = true; this.emit('close'); },
  });
  await context.streamSalesDesk('Quote four filters', response);
  const body = JSON.parse(request.body);
  assert.equal(request.url, 'https://api.example.test/api/v1/assistant/threads/stream');
  assert.equal(request.headers.Authorization, 'Bearer test-only-key');
  assert.deepEqual(body.pluginIds, ['sales-plugin']);
  assert.deepEqual(body.toolNames, ['plugin_load', 'plugin_call']);
  assert.equal(body.permissions, 'default');
  assert.equal(response.status, 200);
  assert.doesNotMatch(Buffer.concat(response.chunks).toString(), /test-only-key/);
});
test('published business plugin derives price from server records and rejects unknown buyers', async () => {
  const pricing = codeExamples(read('build/library-authoring.mdx'))[0];
  const pricingContext = { exports: {} };
  vm.runInNewContext(ts.transpileModule(pricing.code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, pricingContext);
  const code = codeExamples(read('ai/business-plugins.mdx'))[0].code;
  const run = new Function('api', 'lib', `return (async () => {\n${code}\n})();`);
  let customerExists = true;
  const api = {
    input: () => ({ agentTool: { entrypoint: 'quote_contract', args: { sku: 'AST-FILTER-100', quantity: 4, discountBps: 9999, unitPriceMinor: 1 } } }),
    throw: (status, result) => { throw Object.assign(new Error(result.message), { status }); },
    getDatabaseDataRow: async name => name === 'as_products' ? { sku: 'AST-FILTER-100', active: true } : name === 'as_customers' ? (customerExists ? { name: 'Demo buyer', discountBps: 750 } : null) : { unitPriceMinor: 1250 },
    getDatabaseData: async () => ({ data: [{ warehouse: 'Central', available: 12, reserved: 8 }] }),
    getExecutionId: () => 'quote-execution',
  };
  const result = await run(api, { Pricing: pricingContext.exports });
  assert.equal(result.totalMinor, 4625);
  assert.equal(result.reserved, false);
  assert.equal(result.executionId, 'quote-execution');
  customerExists = false;
  await assert.rejects(run(api, { Pricing: pricingContext.exports }), { status: 409 });
});
