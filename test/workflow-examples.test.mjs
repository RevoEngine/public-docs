import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { codeExamples, exampleSyntaxIssues, publicMemberIssues } from '../scripts/documentation-examples.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the example scanner distinguishes JSON, source examples and class signatures', () => {
  assert.equal(codeExamples('```json\n{"name":"example"}\n```').length, 0);
  assert.deepEqual(exampleSyntaxIssues('```ts\nstatic get(): Promise<string>;\n```'), []);
  assert.deepEqual(exampleSyntaxIssues('```ts Pricing · @default\nexport function quote(): number { return 1; }\n```'), []);
  assert.ok(exampleSyntaxIssues('```ts\nMultipart upload:\nconst value = 1;\n```').length > 0);
});

test('published Pricing source calculates the displayed result and rejects invalid money input', () => {
  const [source] = codeExamples(read('build/library-authoring.mdx'));
  const output = ts.transpileModule(source.code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {} }; vm.runInNewContext(output, context);
  const quote = context.exports.quote;
  assert.equal(quote([{ sku: 'AST-FILTER-100', quantity: 4, unitPriceMinor: 1250, discountBps: 750 }]).totalMinor, 4625);
  assert.equal(quote([{ sku: 'AST-FILTER-100', quantity: 4, unitPriceMinor: 1250, discountBps: 0 }]).totalMinor, 5000);
  assert.equal(quote([{ sku: 'AST-FILTER-100', quantity: 4, unitPriceMinor: 1250, discountBps: 10000 }]).totalMinor, 0);
  assert.equal(context.exports.integer, undefined);
  for (const input of [[], [{ sku: 'x', quantity: 0.5, unitPriceMinor: 100, discountBps: 0 }],
    [{ sku: 'x', quantity: 1, unitPriceMinor: -1, discountBps: 0 }],
    [{ sku: 'x', quantity: 100000, unitPriceMinor: 100000000, discountBps: 0 }]]) {
    assert.throws(() => quote(input));
  }
});

test('asynchronous export example consumes the accepted response rather than a missing file', () => {
  const examples = codeExamples(read('operate/database-exports.mdx'));
  const background = examples.find(example => /async: true/.test(example.code));
  assert.ok(background);
  const properties = new Set();
  const file = ts.createSourceFile('sample.js', background.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const walk = node => { if (ts.isPropertyAccessExpression(node) && node.expression.getText(file) === 'operation') properties.add(node.name.text); ts.forEachChild(node, walk); };
  walk(file);
  assert.deepEqual([...properties].sort(), ['accepted', 'exportId', 'jobId']);
});


test('Job guides agree with the generated request ceiling rather than advertising unsupported memory', () => {
  const spec = JSON.parse(read('api-reference/openapi.json'));
  const maximum = spec.components.schemas.JobOptionsDto.properties.memory.maximum;
  for (const page of ['operate/jobs.mdx', 'platform/limits-and-quotas.mdx']) {
    assert.ok(read(page).includes(String(maximum)));
    assert.doesNotMatch(read(page), /4096|4,096|4 GiB/);
  }
});


test('examples use declared methods; historical removals require the exact current replacement', () => {
  const declaration = 'declare class api { static getDatabaseData(): void; }';
  assert.deepEqual(publicMemberIssues('```js\napi.getDatabaseData();\n```', declaration, 'low-code/database.mdx'), []);
  assert.equal(publicMemberIssues('```js\napi.imaginaryMethod();\n```', declaration, 'low-code/database.mdx').length, 1);
  const historical = '```js\napi.getDatabaseDataV2();\n```\nHistorical API: `api.getDatabaseDataV2()` is no longer available in the current runtime. Use [`api.getDatabaseData()`](/low-code/database) for new code.';
  assert.deepEqual(publicMemberIssues(historical, declaration, 'changelog/0.8.0.mdx'), []);
  assert.equal(publicMemberIssues(historical, declaration, 'low-code/database.mdx').length, 1);
});
