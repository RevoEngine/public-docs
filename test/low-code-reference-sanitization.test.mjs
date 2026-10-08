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
  assert.match(sanitized, /durable instance-scoped idempotency key/);
  assert.match(sanitized, /Cache outages do not remove duplicate protection/);
  assert.doesNotMatch(sanitized, /idempotency key in.*cache/);
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

test('public sanitization preserves rejection of restricted platform writes', () => {
  const source = `declare class api {
    /** Acquires a key. */
    static acquireIdempotencyKey(key: string, ttl: number): Promise<boolean>;
    /** Uploads a file. */
    static sftpPut(source: string, target: string): Promise<void>;
    /** Downloads a file into Storage. */
    static sftpGet(target: string, source: string): Promise<void>;
  }`;
  const sanitized = sanitizeDeclarationSource(source);
  assert.doesNotMatch(sanitized, /no-op in debug mode/i);
  assert.equal(sanitized.match(/throws READ_ONLY_OPERATION_FORBIDDEN/g)?.length, 3);
});


test('public mutation guidance retains atomicity and limits without query optimization mechanics', () => {
  const source = `declare class api {
    /**
     * A call executes atomically in one transaction.
     * Scalar in/notIn arrays use one typed array parameter. Application guards still enforce
     * 8 MiB of serialized query input and 16 nested filter levels.
     * REST/public SDK requests retain the 100,000-row limit per request.
     */
    static deleteDatabaseData(databaseId: string, rows: object[]): Promise<void>;
  }`;
  const sanitized = sanitizeDeclarationSource(source);
  assert.doesNotMatch(sanitized, /typed array parameter/);
  assert.match(sanitized, /atomically in one transaction/);
  assert.match(sanitized, /8 MiB/);
  assert.match(sanitized, /16 nested/);
  assert.match(sanitized, /100,000-row/);
  assert.match(sanitized, /static deleteDatabaseData/);
});
