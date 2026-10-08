import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Agent documentation separates product modes and states the current execution boundary', () => {
  const overview = read('ai/overview.mdx');
  const harness = read('ai/agent-harness.mdx');
  const comparison = read('ai/compare-coding-agents.mdx');
  const terminals = read('ai/terminals.mdx');

  assert.match(overview, /Interactive Agents/);
  assert.match(overview, /Autonomous Agents/);
  assert.match(harness, /does \*\*not\*\* promise an unrestricted host shell/);
  assert.match(comparison, /user-approved terminal on a computer or virtual machine/);
  assert.match(comparison, /does not create a managed VM automatically/);
  assert.match(terminals, /\*\*Workspace Access\*\* is the default command permission/);
  assert.match(terminals, /saved Full Access command grant or Full Network Access grant covers its own dimension regardless of Composer mode/);
  assert.match(terminals, /runner checks the current grants before each dispatch/);
  for (const mode of ['Workspace Access', 'Full Access', 'No Network', 'Local Access', 'Full Network Access']) {
    assert.match(terminals, new RegExp(`\\*\\*${mode}\\*\\*`));
  }
  assert.match(terminals, /Workspace Access with a temporary exception/);
  assert.match(terminals, /two independent controls/);
  assert.match(terminals, /system and toolchain files needed to run programs/);
  assert.match(terminals, /can read, change, or delete anything the runner's operating-system account can access/);
  assert.doesNotMatch(terminals, /Codex|ChatGPT/i);
  assert.match(terminals, /\*\*15 minutes\*\*, \*\*one hour\*\*, \*\*eight hours\*\*, \*\*24 hours\*\*, or \*\*this thread\*\*/);
  assert.match(terminals, /not included in the model-visible tool call/);
  assert.doesNotMatch(terminals, /remembered approval/i);
  assert.match(terminals, /Each workspace has its own access and sharing contract/);
  assert.match(terminals, /Recovery has a two-minute window/);
  assert.match(terminals, /four sessions and sixteen tabs per session/);
  assert.match(terminals, /recreates the browser context and loses its cookies/);
  assert.match(terminals, /90-second idle timeout/);
  assert.match(comparison, /OpenAI Codex/);
  assert.match(comparison, /Claude Code/);
});

test('memory documentation separates Assistant digests from one configured Agent memory text', () => {
  const memory = read('ai/memory-and-workspaces.mdx');

  for (const scope of ['`USER`', '`AGENT`', '`WORKSPACE`']) assert.ok(memory.includes(scope));
  assert.doesNotMatch(memory, /\|\s*`(?:INSTANCE|SHARED)`\s*\|/);
  assert.match(memory, /soft context/i);
  assert.match(memory, /version-aware/i);
  assert.match(memory, /20,000 tokens/);
  assert.match(memory, /every model request/);
  assert.match(memory, /not automatically recalled/);
  assert.match(memory, /Historical `WORKSPACE` records do not add an automatic runtime memory scope/);
  const config = read('ai/agent-configuration.mdx');
  assert.match(config, /`config\.memory`/);
  assert.doesNotMatch(config, /memoryPolicy|maxRecallEntries|maxRecallChars/);
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
    'ai/terminals.mdx',
    'ai/tools-and-skills.mdx',
    'ai/plugins.mdx',
    'platform/overview.mdx',
    'build/overview.mdx',
    'operate/vault.mdx',
  ];

  for (const page of pages) assert.doesNotMatch(read(page), /(?:\d{1,3}\.){3}\d{1,3}/, page);
});
