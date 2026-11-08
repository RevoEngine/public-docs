import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { codeExamples } from '../scripts/documentation-examples.mjs';
import { referenceNavigation, referenceFiles } from '../scripts/generate-low-code-reference.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const body = page => codeExamples(read(page))[0].code;
const plain = value => JSON.parse(JSON.stringify(value));
const run = (code, api) => vm.runInNewContext('(async () => {\n' + code + '\n})()', { api });

test('first widget renders initially and refreshes only the greeting while preserving empty input', async () => {
  const code = body('widgets/quickstart.mdx');
  const initial = plain(await run(code, { input: () => ({}) }));
  assert.deepEqual(initial.flat().map(cell => cell.id), ['name', 'greeting']);
  assert.equal(initial[1][0].value, 'Hello, Ada!');
  assert.deepEqual(initial[0][0].on.change, { type: 'REFRESH', target: 'greeting' });
  for (const [name, result] of [['Grace', 'Hello, Grace!'], ['', 'Enter your name.']]) {
    const rows = plain(await run(code, { input: () => ({ $widget: { targetIds: ['greeting'], values: { name } } }) }));
    assert.deepEqual(rows.flat().map(cell => cell.id), ['greeting']);
    assert.equal(rows[0][0].value, result);
  }
});

test('form example reads committed field values and keeps the form outside a partial response', async () => {
  const code = body('widgets/forms.mdx');
  const initial = plain(await run(code, { input: () => ({}) }));
  assert.equal(initial[0][0].fields[0].id, 'quantity');
  assert.equal(initial[1][0].value, 'Units: 2');
  const partial = plain(await run(code, { input: () => ({ $widget: { targetIds: ['total'], values: { quantity: 7 } } }) }));
  assert.deepEqual(partial, [[{ id: 'total', type: 'TEXT', value: 'Units: 7' }]]);
});

test('periodic refresh source returns exactly its requested target', async () => {
  const code = body('widgets/refresh.mdx');
  const initial = plain(await run(code, { input: () => ({}) }));
  assert.deepEqual(initial.flat().map(cell => cell.id), ['status', 'help']);
  assert.equal(initial[0][0].refresh.intervalSeconds, 30);
  const partial = plain(await run(code, { input: () => ({ $widget: { targetIds: ['status'] } }) }));
  assert.deepEqual(partial.flat().map(cell => cell.id), ['status']);
});

test('low-code admission example releases only its acquired slot, including after a failed read', async () => {
  const code = body('patterns/low-code-concurrency.mdx');
  const input = { customerId: 'customer-1' };
  let admitted = false, reads = 0, releases = 0, fail = false;
  const api = {
    input: () => input,
    concurrencyLimit: async (key, limit, ttl) => {
      assert.equal(key, 'customer-summary:customer-1');
      assert.equal(limit, 2); assert.equal(ttl, 60); return admitted;
    },
    getDatabaseData: async (table, query) => {
      reads++;
      assert.equal(table, 'orders');
      assert.deepEqual(plain(query), { fields: ['orderId', 'status'], filter: { field: 'customerId', op: 'eq', value: 'customer-1' }, take: 20 });
      if (fail) throw new Error('read failed');
      return { data: [{ orderId: 'order-1', status: 'OPEN' }] };
    },
    releaseConcurrencyLimit: async key => { assert.equal(key, 'customer-summary:customer-1'); releases++; },
  };
  assert.deepEqual(plain(await run(code, api)), { status: 'BUSY' });
  assert.equal(reads, 0); assert.equal(releases, 0);
  admitted = true;
  assert.deepEqual(plain(await run(code, api)), { status: 'FINISHED', rows: [{ orderId: 'order-1', status: 'OPEN' }] });
  assert.equal(releases, 1);
  fail = true;
  await assert.rejects(run(code, api), /read failed/);
  assert.equal(releases, 2);
  input.customerId = '';
  await assert.rejects(run(code, api), /valid customerId/);
  assert.equal(releases, 2);
});

test('idempotency example reuses business identity and does not release an admitted operation', async () => {
  const code = body('patterns/idempotency.mdx');
  const keys = new Set();
  const api = {
    input: () => ({ invoiceId: 'invoice-1' }),
    acquireIdempotencyKey: async (key, ttl, metadata) => {
      assert.equal(ttl, 3600); assert.equal(metadata.invoiceId, 'invoice-1');
      if (keys.has(key)) return false;
      keys.add(key); return true;
    },
    releaseIdempotencyKey: () => { throw new Error('Must retain the admission key'); },
  };
  assert.deepEqual(plain(await run(code, api)), { key: 'invoice:invoice-1:issue:v1', admitted: true });
  assert.deepEqual(plain(await run(code, api)), { key: 'invoice:invoice-1:issue:v1', admitted: false });
});

test('Assistant-card sources remain independent and use the confirmed Job receipt', async () => {
  const code = body('widgets/examples/assistant-card.mdx');
  const result = plain(await run(code, { input: () => ({}) }));
  assert.equal(result.matrix[1][0].value, 'No confirmed job yet.');
  const config = result.widgetConfig;
  assert.equal(config.actionTargets.launch.readOnly, false);
  assert.equal(config.actionTargets.status.readOnly, true);
  const receipt = plain(await run(config.actionTargets.launch.code, {
    input: () => ({ quantity: 3 }),
    triggerJob: async (id, input) => { assert.equal(input.quantity, 3); return 'job-1'; },
  }));
  assert.deepEqual(receipt, { jobId: 'job-1' });
  const partial = plain(await run(code, {
    input: () => ({ $widget: { targetIds: ['total'], actionResult: receipt, values: { quantity: 3 } } }),
    getInstanceData: async (resource, query) => {
      assert.deepEqual(plain(query.filter), { jobId: { equals: 'job-1' } });
      return { data: [{ jobId: 'job-1', status: 'FINISHED' }] };
    },
  }));
  assert.deepEqual(partial.matrix.flat().map(cell => cell.id), ['total']);
  assert.equal(partial.matrix[0][0].value, 'job-1: FINISHED');
  const detail = plain(await run(config.widgetTargets.details.code, { input: () => ({ quantity: 3 }) }));
  assert.equal(detail[0][0].value, 'Quantity: 3');
  assert.equal(detail[1][0].on.click.type, 'BACK');
  const deeper = plain(await run(config.widgetTargets.deeper.code, { input: () => ({ quantity: 3 }) }));
  assert.equal(deeper[0][0].value, 'Received quantity: 3');
});

test('every public method overload has exactly one generated method page and navigation entry', () => {
  const source = read('low-code/reference/source/api.public.d.ts');
  const ast = ts.createSourceFile('public.d.ts', source, ts.ScriptTarget.Latest, true);
  const paths = [];
  const walk = node => {
    if (typeof node === 'string') paths.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(referenceNavigation(source).pages);
  const generated = new Set(referenceFiles(source).map(path => path.split('/low-code/reference/')[1]));
  const publicMethods = new Map();
  for (const declaration of ast.statements) {
    if (!ts.isClassDeclaration(declaration)) continue;
    for (const member of declaration.members) {
      if (!ts.isMethodDeclaration(member)) continue;
      if (ts.getJSDocTags(member).some(tag => tag.tagName.text === 'deprecated')) continue;
      const key = declaration.name.text + '/' + member.name.getText(ast);
      publicMethods.set(key, (publicMethods.get(key) ?? 0) + 1);
    }
  }
  for (const [key, overloads] of publicMethods) {
    assert.ok(generated.has(key + '.mdx'), key);
    assert.equal(paths.filter(path => path === 'low-code/reference/' + key).length, 1, key);
    const page = read('low-code/reference/' + key + '.mdx');
    const name = key.split('/')[1];
    const signatures = codeExamples(page).filter(example => /^\s*static\s/.test(example.code));
    const parsed = ts.createSourceFile('signature.ts', 'declare class Signature {\n' + signatures.map(example => example.code).join('\n') + '\n}', ts.ScriptTarget.Latest, true);
    assert.equal(parsed.statements[0].members.filter(member => member.name?.getText(parsed) === name).length, overloads, key);
  }
  assert.equal(generated.size, publicMethods.size + 9, 'Only eight namespace indexes and the global index are additional');
  assert.equal(paths.filter(path => path.startsWith('low-code/reference/')).length, generated.size);
});
