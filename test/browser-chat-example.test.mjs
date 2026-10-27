import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {readFileSync, existsSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {codeExamples, exampleSyntaxIssues} from '../scripts/documentation-examples.mjs';
import {publicTextPrivacyIssues} from '../scripts/public-content-privacy.mjs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const moduleFrom = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const {createSseParser} = await moduleFrom(read('examples/sse/browser-chat/sse-parser.mjs.txt'));
const {createDemoServer} = await moduleFrom(read('examples/sse/browser-chat/server.mjs.txt'));

test('SSE parser handles arbitrary chunk boundaries, CRLF, multiline, UTF-8 BOM and retry', () => {
 const text = '\uFEFF: heartbeat\r\nid: 7\r\nevent: model.delta\r\nretry: 1000\r\ndata: first\r\ndata: second\r\n\r\nevent: done\ndata: {"error":false}\n\n';
 for (let size = 1; size <= text.length; size++) {
  const frames = []; const parser = createSseParser(frame => frames.push(frame));
  for (let i = 0; i < text.length; i += size) parser.push(text.slice(i, i + size));
  assert.deepEqual(frames, [{event:'model.delta',id:'7',retry:1000,data:'first\nsecond'},{event:'done',data:'{"error":false}'}]);
 }
});
test('SSE parser does not dispatch an unfinished frame or accept invalid IDs/retry', () => {
 const frames = []; const parser = createSseParser(frame => frames.push(frame));
 parser.push('id: bad\0id\nretry: +3\ndata: safe\n\ndata: incomplete');
 assert.deepEqual(frames, [{event:'message',data:'safe'}]);
});
test('local proxy keeps auth on server, forwards cursor/body and propagates browser disconnect upstream', async () => {
 let received; let resolveClosed;
 const upstreamClosed = new Promise(resolve => {resolveClosed = resolve;});
 const upstream = http.createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  received = {headers:req.headers,body:JSON.parse(Buffer.concat(chunks))};
  res.on('close', resolveClosed);
  res.writeHead(200, {'Content-Type':'text/event-stream'});
  res.write('event: tool.pending\nid: 2\ndata: {"name":"calc"}\n\n');
 });
 upstream.listen(0,'localhost'); await once(upstream,'listening');
 const server = createDemoServer({authorization:'local-test-credential',upstream:`http://localhost:${upstream.address().port}`});
 // Bind an OS-assigned port and keep origin checks tied to its actual listener.
 server.listen(0,'localhost'); await once(server,'listening');
 const base = `http://localhost:${server.address().port}`;
 try {
  const denied = await fetch(base + '/api/run', {method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(denied.status,403); assert.equal(received,undefined);
  const controller = new AbortController();
  const response = await fetch(base + '/api/run',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','Last-Event-ID':'1'},body:'{"runId":"test"}',signal:controller.signal});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('authorization'),null);
  const reader = response.body.getReader(); const frame = await reader.read();
  assert.match(new TextDecoder().decode(frame.value),/tool.pending/);
  assert.equal(received.headers.authorization,'local-test-credential');
  assert.equal(received.headers['last-event-id'],'1');
  assert.deepEqual(received.body,{runId:'test'});
  controller.abort(); await reader.cancel().catch(() => {});
  await Promise.race([upstreamClosed, new Promise((_, reject) => {const timer=setTimeout(() => reject(new Error('Upstream was not disconnected')),3000); timer.unref();})]);
 } finally {server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(resolve => server.close(resolve)),new Promise(resolve => upstream.close(resolve))]);}
});


test('the full HTML/client/parser/proxy files match their displayed source and contain no embedded private configuration', () => {
 const page = read('operate/sse-browser-client.mdx');
 assert.deepEqual(exampleSyntaxIssues(page), []);
 assert.deepEqual(publicTextPrivacyIssues(page), []);
 const files = ['index.html','chat.mjs','sse-parser.mjs','server.mjs'];
 for (const name of files) {
  const source = read('examples/sse/browser-chat/' + name + '.txt');
  const escaped = name.replaceAll('.', '\\.');
  const block = page.match(new RegExp('```(?:html|js) title="' + escaped + '"\\n([\\s\\S]*?)```'));
  assert.ok(block, 'Complete displayed source for ' + name);
  assert.equal(block[1].trim(), source.trim());
  assert.deepEqual(publicTextPrivacyIssues(source), []);
  assert.equal(existsSync(new URL('../examples/sse/browser-chat/' + name, import.meta.url)),false);
 }
 const html=read('examples/sse/browser-chat/index.html.txt');
 const client=read('examples/sse/browser-chat/chat.mjs.txt');
 assert.match(html,/<html lang="en">/);
 assert.match(html,/Calculate 37 times 19 using calc\. Reply briefly in English\./);
 assert.doesNotMatch(html + client,/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
 for (const match of client.matchAll(/\$\(["']([^"']+)["']\)/g)) assert.ok(ids.has(match[1]), 'Client control exists: '+match[1]);
 assert.match(html,/<script type="module" src="\/chat\.mjs"><\/script>/);
});

function archiveFiles(bytes) {
 const files=new Map();let offset=0;
 while(bytes.readUInt32LE(offset)===0x04034b50) {
  const flags=bytes.readUInt16LE(offset+6),method=bytes.readUInt16LE(offset+8),size=bytes.readUInt32LE(offset+18);
  assert.equal(flags & 8,0,'Bundled ZIP uses explicit local sizes');
  const nameSize=bytes.readUInt16LE(offset+26),extraSize=bytes.readUInt16LE(offset+28);
  const name=bytes.subarray(offset+30,offset+30+nameSize).toString();
  const start=offset+30+nameSize+extraSize,compressed=bytes.subarray(start,start+size);
  assert.ok([0,8].includes(method));
  files.set(name,method===8?inflateRawSync(compressed):compressed);
  offset=start+size;
 }
 return files;
}

test('the ready-to-run ZIP contains exactly the public application files and the same complete Component body', () => {
 const entries=archiveFiles(readFileSync(new URL('../examples/sse/browser-chat.zip',import.meta.url)));
 const names=['index.html','chat.mjs','sse-parser.mjs','server.mjs','component.txt'];
 assert.deepEqual([...entries.keys()].sort(),names.sort());
 for(const name of names) {
  const path=name==='component.txt'?'examples/sse/openai-component.txt':'examples/sse/browser-chat/'+name+'.txt';
  assert.equal(entries.get(name).toString(),read(path));
 }
 assert.equal(entries.has('.env'),false);
});
