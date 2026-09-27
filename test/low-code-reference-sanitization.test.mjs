import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeDeclarationSource } from '../scripts/generate-low-code-reference.mjs';

test('keeps the public low-code contract without private declaration provenance', () => {
  const source = `/**
 * Canonical public low-code API declarations shared by private tooling.
 * Edit a private source file, then regenerate another private artifact.
 */
/// <reference path="./private.generated.d.ts" />
declare class api {
  /**
   * PRIVATE ENGINE DETAIL.
   * Example:
   * const first = await api.acquireIdempotencyKey('order:1', 60);
   */
  static acquireIdempotencyKey(key: string, ttl: number): Promise<boolean>;
}`;

  const sanitized = sanitizeDeclarationSource(source);

  assert.doesNotMatch(sanitized, /private/i);
  assert.doesNotMatch(sanitized, /<reference path=/i);
  assert.match(sanitized, /instance-scoped managed cache/);
  assert.match(sanitized, /static acquireIdempotencyKey\(key: string, ttl: number\)/);
});

test('publishes stable runtime behavior without carrying method implementation prose', () => {
  const source = `declare class api {
  /** ENGINE-SPECIFIC TRANSPORT DETAIL. */
  static executeComponent(request: ComponentExecuteRequest): Promise<ComponentExecuteResult>;
  /** ENGINE-SPECIFIC CONTEXT DETAIL. */
  static getContext(): Context;
}`;

  const sanitized = sanitizeDeclarationSource(source);

  assert.doesNotMatch(sanitized, /ENGINE-SPECIFIC/);
  assert.match(sanitized, /managed RevoEngine runtime/);
  assert.match(sanitized, /current execution context/);
  assert.match(sanitized, /static executeComponent/);
  assert.match(sanitized, /options.executionHost/);
  assert.match(sanitized, /required for remote Sandbox calls/);
  assert.match(sanitized, /static getContext/);
});

test('keeps undocumented namespace overloads beside their documented Storage method', () => {
  const source = `declare class storage {
  /** Reads a file. */
  static getFileData(storageEntryId: string): Promise<string>;
  static getFileData(namespace: string, storageEntryId: string): Promise<string>;
  /** @deprecated Use getFileData. */
  static oldRead(storageEntryId: string): Promise<string>;
  static oldRead(namespace: string, storageEntryId: string): Promise<string>;
}`;
  const sanitized = sanitizeDeclarationSource(source);
  assert.equal(sanitized.match(/static getFileData\(/g)?.length, 2);
  assert.match(sanitized, /static getFileData\(namespace: string, storageEntryId: string\)/);
  assert.equal(sanitized.match(/static oldRead\(/g)?.length, 2);
  assert.match(sanitized, /@deprecated Use getFileData/);
});
