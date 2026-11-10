import assert from 'node:assert/strict';
import test from 'node:test';
import { readDocsIndex } from '../scripts/read-docs-index.mjs';

const origin = 'https://docs.example.com';

test('reads links directly from a flat Mintlify index', async () => {
  const { indexPaths, pages } = await readDocsIndex(origin, '/llms.txt', async () => `
# Docs

- [Introduction](${origin}/introduction.md): Start here.
- [Quickstart](/quickstart.md): Try an example.
- [External introduction](https://example.net/introduction.md)
`);
  assert.deepEqual([...indexPaths], ['/llms.txt']);
  assert.deepEqual([...pages], ['/introduction', '/quickstart']);
});

test('finds highlighted root links and follows nested indexes once', async () => {
  const sources = new Map([
    ['/llms.txt', `
> ## Agent Instructions
>
> - [Introduction](${origin}/introduction.md)
> - [Quickstart](/quickstart.md)

- [Guides](${origin}/_llms/guides.txt)
- [Reference](/_llms/reference.txt)
- [Example](/examples/job.md)
- [External index](https://example.net/_llms/guides.txt)
`],
    ['/_llms/guides.txt', '- [Introduction](/introduction.md)'],
    ['/_llms/reference.txt', `
- [Platform API](reference/platform-api.txt)
- [Example](/examples/job.md)
`],
    ['/_llms/reference/platform-api.txt', `
- [Operation](/api-reference/jobs/start.md)
- [Reference](/_llms/reference.txt)
`],
  ]);
  const reads = [];
  const { pages, rootPages } = await readDocsIndex(origin, '/llms.txt', async (path) => {
    reads.push(path);
    return sources.get(path);
  });
  assert.deepEqual(reads, [...sources.keys()]);
  assert.deepEqual([...rootPages], ['/introduction', '/quickstart', '/examples/job']);
  assert.deepEqual([...pages], ['/introduction', '/quickstart', '/examples/job', '/api-reference/jobs/start']);
});

test('reports a broken linked index', async () => {
  await assert.rejects(readDocsIndex(origin, '/llms.txt', async (path) => {
    if (path === '/llms.txt') return '- [Guides](/_llms/guides.txt)';
    throw new Error(`${path}: HTTP 404`);
  }), /\/_llms\/guides\.txt: HTTP 404/);
});
