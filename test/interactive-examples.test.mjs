import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { publicTextPrivacyIssues } from '../scripts/public-content-privacy.mjs';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('snippets/revo-playground.jsx', root), 'utf8');
const compiled = ts.transpileModule(source, { fileName: 'revo-playground.jsx', reportDiagnostics: true,
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exported = {};
vm.runInNewContext(compiled.outputText, { exports: exported });
const { makeQueue, advanceQueue, attemptKey, flowCatalog } = exported;
const plain = value => JSON.parse(JSON.stringify(value));

test('Job admission never exceeds each key limit and every task completes', () => {
  for (const separate of [false, true]) for (const limit of [1, 2, 3]) {
    let jobs = makeQueue(separate);
    for (let tick = 0; tick < 25; tick++) {
      const previous = JSON.stringify(jobs);
      const next = advanceQueue(jobs, limit);
      assert.equal(JSON.stringify(jobs), previous, 'state transitions must not mutate prior state');
      const keys = new Set(next.map(job => job.key));
      for (const key of keys) assert.ok(next.filter(job => job.key === key && job.status === 'running').length <= limit);
      assert.equal(next.length, 6);
      assert.equal(new Set(next.map(job => job.id)).size, 6);
      jobs = next;
    }
    assert.ok(jobs.every(job => job.status === 'finished'));
    assert.deepEqual(plain(advanceQueue(jobs, limit)), plain(jobs));
  }
});

test('shared and separate template keys produce different total admission capacity', () => {
  const shared = advanceQueue(makeQueue(false), 2);
  const separate = advanceQueue(makeQueue(true), 2);
  assert.equal(shared.filter(job => job.status === 'running').length, 2);
  assert.equal(separate.filter(job => job.status === 'running').length, 4);
  assert.ok(shared.some(job => job.status === 'waiting'));
  assert.ok(shared.every(job => ['waiting', 'running'].includes(job.status)), 'waiting is not an application ERROR');
});

test('finished slots admit waiting work without creating new task identities', () => {
  let jobs = advanceQueue(makeQueue(false), 1);
  jobs = advanceQueue(advanceQueue(advanceQueue(jobs, 1), 1), 1);
  assert.equal(jobs[0].status, 'finished');
  assert.equal(jobs[1].status, 'running');
  assert.equal(jobs[1].remaining, 3);
});

test('stable idempotency keys reject repeated work but admit a different business operation', () => {
  let state = { keys: [], attempts: [] };
  state = attemptKey(state, 'invoice-1', 'stable');
  state = attemptKey(state, 'invoice-1', 'stable');
  state = attemptKey(state, 'invoice-2', 'stable');
  assert.deepEqual(plain(state.attempts.map(item => item.admitted)), [true, false, true]);
  assert.equal(state.keys.length, 2);
  assert.equal(state.attempts[0].key, state.attempts[1].key);
});

test('fresh keys defeat deduplication; global keys block unrelated invoices', () => {
  let state = attemptKey({ keys: [], attempts: [] }, 'invoice-1', 'random');
  state = attemptKey(state, 'invoice-1', 'random');
  assert.ok(state.attempts.every(item => item.admitted));
  state = attemptKey({ keys: [], attempts: [] }, 'invoice-1', 'global');
  state = attemptKey(state, 'invoice-2', 'global');
  assert.equal(state.attempts[1].admitted, false);
});

test('expiry permits admission again without erasing the earlier attempt evidence', () => {
  const first = attemptKey({ keys: [], attempts: [] }, 'invoice-1', 'stable');
  const second = attemptKey({ ...first, keys: [] }, 'invoice-1', 'stable');
  assert.equal(second.attempts.length, 2);
  assert.equal(second.attempts[1].admitted, true);
  assert.equal(first.attempts.length, 1);
  assert.match(source, /Acquiring a key is not proof of a completed effect/);
  assert.match(source, /TTL expiry allows admission again; it does not undo a previous effect/);
});

test('Endpoint success follows access, route, request guard, Component, response', () => {
  const success = flowCatalog.endpoint.cases.find(item => item.name === 'Valid request');
  assert.deepEqual(plain(success.steps.map(step => step[0])), ['Access', 'Route', 'Guard', 'Component', 'Response']);
  for (const name of ['Guard rejects input', 'No matching route', 'Access denied']) {
    const rejected = flowCatalog.endpoint.cases.find(item => item.name === name);
    assert.ok(!rejected.steps.some(step => step[0] === 'Component'), name);
    assert.equal(rejected.steps.at(-1)[3], 'error');
  }
  assert.ok(flowCatalog.endpoint.cases.find(item => item.name === 'Static response').steps.some(step => step[0] === 'Guard'));
});

test('all demo topics are embedded, all scenarios have readable outcomes, and imports are valid', () => {
  const pages = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.git'].includes(entry.name)) continue;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) walk(url);
      else if (entry.name.endsWith('.mdx')) pages.push(readFileSync(url, 'utf8'));
    }
  };
  walk(root);
  for (const [topic, flow] of Object.entries(flowCatalog)) {
    assert.ok(pages.some(page => page.includes('topic="' + topic + '"')), topic);
    assert.ok(flow.cases.length >= 2, topic);
    for (const scenario of flow.cases) {
      assert.ok(scenario.steps.length >= 1, topic);
      for (const step of scenario.steps) assert.ok(step.slice(0, 3).every(value => typeof value === 'string' && value.length > 0));
    }
  }
  for (const page of pages.filter(page => page.includes('/snippets/revo-playground.jsx'))) {
    for (const match of page.matchAll(/<FlowDemo topic="([^"]+)"/g)) assert.ok(flowCatalog[match[1]], match[1]);
    assert.match(page, /## Explore the behavior/);
    const imported = page.match(/import \{ ([^}]+) \} from "\/snippets\/revo-playground\.jsx"/)[1].split(',').map(value => value.trim());
    const required = {
      FlowDemo: ['PlaygroundStyle', 'useDemoPlayback', 'flowCatalog'],
      ConcurrencyDemo: ['PlaygroundStyle', 'useDemoPlayback', 'makeQueue', 'advanceQueue'],
      IdempotencyDemo: ['PlaygroundStyle', 'useDemoPlayback', 'attemptKey'],
      FilterDemo: ['PlaygroundStyle', 'routeExample'],
      DeliveryDemo: ['PlaygroundStyle', 'useDemoPlayback', 'dispatchExample'],
      WebhookDemo: ['PlaygroundStyle', 'useDemoPlayback', 'webhookAttempt'],
    };
    const dependencies = Object.entries(required).filter(([name]) => imported.includes(name)).flatMap(([, names]) => names);
    assert.ok(dependencies.length, 'Every snippet import must have a known component dependency contract');
    for (const name of dependencies) assert.ok(imported.includes(name), 'Mintlify requires parent-level import: ' + name);
  }
});

test('interactive public assets have no private infrastructure or outbound calls', () => {
  for (const name of readdirSync(new URL('snippets/', root)).filter(name => /\.(jsx|js)$/.test(name))) {
    const code = readFileSync(new URL('snippets/' + name, root), 'utf8');
    assert.deepEqual(publicTextPrivacyIssues(code), [], name);
    assert.doesNotMatch(code, /\b(?:AWS|Azure|Google Cloud|GCP|Cloud Run|Cloud Tasks|Firestore|Amazon Web Services)\b/i, name);
    assert.doesNotMatch(code, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/, name);
    assert.doesNotMatch(code, /dangerouslySetInnerHTML|localStorage|sessionStorage/, name);
  }
});

test('playback is opt-in, bounded by visibility, cleaned up and reduced-motion aware', () => {
  assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  assert.match(source, /useState\(false\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /!document.hidden/);
  assert.match(source, /cancelAnimationFrame\(frame\)/);
  assert.match(source, /removeEventListener\('change', reduce\)/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /:focus-visible/);
  assert.match(source, /@media \(max-width: 480px\)/);
});

test('playback counts visible time, honors motion changes, and releases listeners', () => {
  const frames = new Map();
  const motionListeners = new Map();
  const documentListeners = new Map();
  const motion = {
    matches: false,
    addEventListener: (type, listener) => motionListeners.set(type, listener),
    removeEventListener: type => motionListeners.delete(type),
  };
  const page = {
    hidden: false,
    addEventListener: (type, listener) => documentListeners.set(type, listener),
    removeEventListener: type => documentListeners.delete(type),
  };
  let cleanup;
  let frameId = 0;
  let advances = 0;
  let stops = 0;
  const runtime = {};
  vm.runInNewContext(compiled.outputText, {
    exports: runtime,
    useEffect: setup => { cleanup = setup(); },
    window: { matchMedia: () => motion },
    document: page,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const advance = () => { advances++; };
  const stop = () => { stops++; };
  const draw = now => {
    assert.equal(frames.size, 1);
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback(now);
  };

  runtime.useDemoPlayback(false, advance, stop);
  assert.equal(frames.size, 0);
  motion.matches = true;
  runtime.useDemoPlayback(true, advance, stop);
  assert.equal(stops, 1);
  assert.equal(frames.size, 0);

  motion.matches = false;
  runtime.useDemoPlayback(true, advance, stop);
  for (let now = 0; now <= 1000; now += 100) draw(now);
  assert.equal(advances, 0);
  page.hidden = true;
  documentListeners.get('visibilitychange')();
  for (let now = 1100; now <= 5100; now += 100) draw(now);
  assert.equal(advances, 0);
  page.hidden = false;
  documentListeners.get('visibilitychange')();
  for (let now = 5200; now <= 5600; now += 100) draw(now);
  assert.equal(advances, 1);
  motion.matches = true;
  motionListeners.get('change')();
  assert.equal(stops, 2);
  cleanup();
  assert.equal(frames.size, 0);
  assert.equal(motionListeners.size, 0);
  assert.equal(documentListeners.size, 0);
});

test('filter example distinguishes numeric values, metadata and compound groups', () => {
  assert.equal(exported.routeExample('eu', 12500, 'checkout').matches, true);
  const wrongType = exported.routeExample('eu', '12500', 'checkout');
  assert.equal(wrongType.matches, false);
  assert.equal(wrongType.rules[1].matches, false);
  assert.equal(exported.routeExample('eu', 12500, 'import').matches, false);
  assert.equal(exported.routeExample('us', 500, 'import', 'or').matches, false);
  assert.equal(exported.routeExample('us', 12500, 'import', 'or').matches, true);
  assert.equal(exported.routeExample('eu', 10000, 'checkout').matches, true);
  assert.equal(exported.routeExample('eu', 9999, 'checkout').matches, false);
});

test('Event redelivery reuses children while Replay creates a new occurrence per subscription', () => {
  const initial = { occurrences: [], jobs: [], deliveries: 0 };
  assert.equal(exported.dispatchExample(initial, 'redeliver'), initial);
  assert.equal(exported.dispatchExample(initial, 'replay'), initial);
  let state = exported.dispatchExample(initial, 'accept');
  assert.equal(initial.jobs.length, 0);
  assert.equal(state.jobs.length, 2);
  assert.equal(state.occurrences.length, 1);
  const accepted = JSON.stringify(state);
  for (let i = 0; i < 10; i++) state = exported.dispatchExample(state, 'redeliver');
  assert.equal(state.jobs.length, 2);
  assert.equal(JSON.stringify(exported.dispatchExample(initial, 'accept')), accepted);
  state = exported.dispatchExample(state, 'replay');
  assert.equal(state.occurrences.length, 2);
  assert.equal(state.jobs.length, 4);
  assert.equal(new Set(state.jobs.map(item => item.id)).size, 4);
  assert.equal(state.jobs.filter(item => item.definition === 'billing').length, 2);
  assert.equal(exported.dispatchExample(state, 'accept'), state);
});

const emptyWebhook = () => ({ attempts: 0, effects: 0, status: 'PENDING', terminal: false, log: [] });

test('lost HTTP response can leave a business effect while delivery remains unconfirmed', () => {
  for (const protectedReceiver of [true, false]) {
    const initial = emptyWebhook();
    const lost = exported.webhookAttempt(initial, 'lost', protectedReceiver, 1, false);
    assert.equal(initial.effects, 0);
    assert.equal(lost.effects, 1);
    assert.equal(lost.status, 'PENDING');
    const retried = exported.webhookAttempt(lost, 'success', protectedReceiver, 1, false);
    assert.equal(retried.attempts, 2);
    assert.equal(retried.status, 'FINISHED');
    assert.equal(retried.effects, protectedReceiver ? 1 : 2);
    assert.equal(exported.webhookAttempt(retried, 'success', protectedReceiver, 1, false), retried);
  }
});

test('webhook retry cap counts additional attempts and cannot be bypassed by redelivery', () => {
  for (const retries of [0, 1, 3]) {
    let state = emptyWebhook();
    for (let i = 0; i < 10; i++) state = exported.webhookAttempt(state, 'lost', true, retries, false);
    assert.equal(state.attempts, retries + 1);
    assert.equal(state.effects, 1);
    assert.equal(state.status, 'ERROR');
    assert.equal(state.log.length, retries + 1);
  }
});

test('stop-on-401 is independent of remaining retries', () => {
  const stopped = exported.webhookAttempt(emptyWebhook(), 'unauthenticated', true, 3, true);
  assert.equal(stopped.status, 'ERROR');
  assert.equal(stopped.effects, 0);
  const retry = exported.webhookAttempt(emptyWebhook(), 'unauthenticated', true, 3, false);
  assert.equal(retry.status, 'PENDING');
  const success = exported.webhookAttempt(retry, 'success', true, 3, false);
  assert.equal(success.status, 'FINISHED');
  assert.equal(success.effects, 1);
});

test('walkthroughs retain failure and stale-evidence boundaries across product families', () => {
  assert.ok(flowCatalog.batching.cases.every(item => item.steps.some(step => /roll|reconcil|inspect|retry/i.test(step.join(' ')))));
  assert.ok(flowCatalog.nativeTests.cases.every(item => item.steps.some(step => /captur/i.test(step.join(' ')))));
  assert.ok(flowCatalog.view.cases.find(item => item.name.includes('changed')).steps.at(-1)[3] === 'error');
  assert.ok(flowCatalog.permissions.cases.find(item => item.name.includes('without')).steps.at(-1)[3] === 'error');
});
