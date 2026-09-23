import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Agent documentation separates product modes and states the current execution boundary', () => {
  const overview = read('ai/overview.mdx');
  const harness = read('ai/agent-harness.mdx');
  const comparison = read('ai/compare-coding-agents.mdx');

  assert.match(overview, /Interactive Agents/);
  assert.match(overview, /Autonomous Agents/);
  assert.match(harness, /does \*\*not\*\* promise an unrestricted host shell/);
  assert.match(comparison, /not yet a promise that every Agent has a general-purpose shell/);
  assert.match(comparison, /OpenAI Codex/);
  assert.match(comparison, /Claude Code/);
});

test('memory documentation describes only active runtime digest scopes', () => {
  const memory = read('ai/memory-and-workspaces.mdx');

  for (const scope of ['`USER`', '`AGENT`', '`WORKSPACE`']) assert.ok(memory.includes(scope));
  assert.doesNotMatch(memory, /\|\s*`(?:INSTANCE|SHARED)`\s*\|/);
  assert.match(memory, /soft context/i);
  assert.match(memory, /version-aware/i);
});

test('plugin documentation separates discovery, loading, admission and execution', () => {
  const plugins = read('ai/plugins.mdx');
  const tools = read('ai/tools-and-skills.mdx');

  for (const phase of ['Installed', 'Enabled', 'Loaded', 'Admitted', 'Executed']) {
    assert.match(plugins, new RegExp(`\\*\\*${phase}\\*\\*`));
  }
  assert.match(tools, /Deferred or auto-discovered plugin/);
  assert.match(tools, /Eager skill loading/);
  assert.match(tools, /it does not promise a general-purpose shell/i);
});

test('public docs contain no literal IPv4 addresses', () => {
  const pages = [
    'ai/agent-harness.mdx',
    'ai/compare-coding-agents.mdx',
    'ai/tools-and-skills.mdx',
    'ai/plugins.mdx',
    'platform/overview.mdx',
    'build/overview.mdx',
  ];

  for (const page of pages) assert.doesNotMatch(read(page), /(?:\d{1,3}\.){3}\d{1,3}/, page);
});
