#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const product = JSON.parse(readFileSync(new URL('../platform/product-contract.json', import.meta.url), 'utf8'));
const origin = product.documentation.origin;
const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
let rpcId = 0;
async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, { ...options, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}
async function rpc(method, params) {
  const response = await request(product.documentation.mcp, {
    method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  if (response.headers.get('mcp-session-id')) headers['Mcp-Session-Id'] = response.headers.get('mcp-session-id');
  const body = await response.text();
  const messages = body.trim().startsWith('{') ? [JSON.parse(body)] : body.split(/\r?\n/).filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
  const message = messages.find((entry) => entry.id === rpcId);
  if (!message || message.error || message.result?.isError) throw new Error(`${method}: ${JSON.stringify(message?.error || message?.result || 'missing response')}`);
  return message.result;
}
function text(result) {
  return (result.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('\n');
}
function normalize(value) { return value.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim(); }
try {
  const initialized = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'revo-docs-freshness', version: '1.0' } });
  headers['MCP-Protocol-Version'] = initialized.protocolVersion;
  await request(product.documentation.mcp, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  const manifest = await rpc('tools/list', {});
  for (const [name, field] of [['search_revo_engine', 'query'], ['query_docs_filesystem_revo_engine', 'command']]) {
    const tool = manifest.tools?.find((entry) => entry.name === name);
    if (tool?.inputSchema?.properties?.[field]?.type !== 'string' || !tool?.inputSchema?.required?.includes(field)) throw new Error(`Docs tool contract changed: ${name}`);
  }
  const index = await (await request(product.documentation.index)).text();
  for (const page of ['/introduction', '/platform/product-model']) {
    if (!index.includes(`${origin}${page}.md`)) throw new Error(`Published index omits ${page}`);
    const markdown = await (await request(`${page}.md`)).text();
    const retrieved = text(await rpc('tools/call', { name: 'query_docs_filesystem_revo_engine', arguments: { command: `head -35 ${page}.mdx` } }));
    for (const [label, content] of [['Markdown', markdown], ['MCP', retrieved]]) {
      if (!normalize(content).includes(normalize(product.summary))) throw new Error(`${page}: ${label} does not contain the current released product summary.`);
    }
  }
  const search = text(await rpc('tools/call', { name: 'search_revo_engine', arguments: { query: 'RevoEngine enterprise Backend as a Service governed execution purpose' } }));
  if (!normalize(search).includes(normalize(product.summary))) throw new Error('Search index does not contain the current product summary.');
  console.log('Published Docs verified: MCP schemas, index, Markdown, page retrieval, and search match the released product knowledge.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
