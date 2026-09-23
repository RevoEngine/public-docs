#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  operationEntries,
  publicOpenApiPath,
  sourceSnapshotPath,
} from './sync-platform-openapi.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'platform-contracts.json');
const lowCodeSnapshotPath = join(root, 'low-code', 'reference', 'source', 'api.public.d.ts');
const lowCodeGeneratedPaths = ['index', 'api', 'storage', 'transport', 'agent', 'util']
  .map((name) => join(root, 'low-code', 'reference', `${name}.mdx`));
const args = new Set(process.argv.slice(2));

function repoPath(file) {
  return relative(root, file).replaceAll('\\', '/');
}

function runScript(script, mode, requireSource) {
  const childArgs = [join(root, 'scripts', script), mode];
  if (requireSource) childArgs.push('--require-source');
  const result = spawnSync(process.execPath, childArgs, { cwd: root, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${script} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function requireGeneratedFiles() {
  for (const file of [sourceSnapshotPath, publicOpenApiPath, lowCodeSnapshotPath, ...lowCodeGeneratedPaths]) {
    if (!existsSync(file)) throw new Error(`Missing generated contract artifact: ${repoPath(file)}`);
  }
}

function buildManifest() {
  requireGeneratedFiles();
  const publishedOpenApi = JSON.parse(readFileSync(publicOpenApiPath, 'utf8'));
  return {
    schemaVersion: 1,
    contracts: {
      productKnowledge: {
        snapshot: 'platform/product-contract.json',
        generated: ['platform/product-model.mdx'],
        summaries: ['introduction.mdx', 'platform/overview.mdx'],
      },
      platformOpenApi: {
        snapshot: repoPath(sourceSnapshotPath),
        published: repoPath(publicOpenApiPath),
        operations: operationEntries(publishedOpenApi).length,
      },
      lowCodeRuntime: {
        snapshot: repoPath(lowCodeSnapshotPath),
        generated: lowCodeGeneratedPaths.map(repoPath),
      },
    },
  };
}

function serialized(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main() {
  const sync = args.has('--sync');
  const check = args.has('--check');
  const requireSource = args.has('--require-source');
  if (sync === check) throw new Error('Choose exactly one mode: --sync or --check.');

  const mode = sync ? '--sync' : '--check';
  runScript('product-knowledge.mjs', mode, requireSource);
  runScript('generate-low-code-reference.mjs', mode, requireSource);
  runScript('sync-platform-openapi.mjs', mode, requireSource);

  const expected = serialized(buildManifest());
  if (sync) {
    writeFileSync(manifestPath, expected);
    console.log(`Wrote ${repoPath(manifestPath)}.`);
    return;
  }
  if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== expected) {
    throw new Error('Platform contract manifest is stale. Run npm run sync:platform-contracts from the platform monorepo.');
  }
  console.log('Platform contract manifest is current.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
