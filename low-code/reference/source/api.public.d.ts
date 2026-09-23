/**
 * Generated public low-code method contract used by the documentation reference.
 */
declare class api {
  /**
     * Creates a logical database. The server assigns databaseId, version, and timestamps;
     * never generate or send those values. A normal database needs at least one definition.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.createDatabase({
     *   name: 'audit_log',
     *   category: 'Ops',
     *   desc: 'Audit',
     *   restricted: false,
     *   groups: [],
     *   users: [],
     *   definition: [{
     *     name: 'auditId', type: 'UUID',
     *     isPrimaryKey: true, isArray: false, isUnique: true,
     *     isNullable: false, isIndex: true, foreignReferences: [],
     *   }],
     * });
     */
  static createDatabase(data: DatabaseCreateInput): Promise<Database>;

  /**
     * Clones a logical database by name.
     *
     * Notes:
     * - No-op in debug mode.
     * - By default waits for the clone and returns cloned database metadata.
     * - Set `{ async: true }` to start a backend clone task and return immediately with an accepted response.
     * - Omit `name` to use the backend default source-name plus `_Clone`.
     *
     * Example:
     * const result = await api.cloneDatabase('customers', {
     *   includeItems: false,
     *   includePartitions: true,
     * });
     *
     * return result.databases;
     */
  static cloneDatabase<TAsync extends boolean = false>(
      name: string,
      options?: DatabaseCloneInput & { async?: TAsync },
    ): Promise<
      TAsync extends true
        ? CloneDatabaseAcceptedResponse
        : TAsync extends false
          ? CloneDatabaseCompletedResponse
          : CloneDatabaseResponse
    >;

  /**
     * Exports a logical table, saved view, or materialized view by name directly into Storage as CSV or XLSX.
     * The root and every structured join may independently target any of these relation types.
     *
     * Notes:
     * - No-op in debug mode.
     * - By default waits for the export, final compose, and storage entry persistence.
     * - CSV is the default and its dialect, headers, and byte map are indexed during upload.
     * - XLSX streams directly from the database through the native Storage writer into the final resumable upload,
     *   preserves database value types where Excel supports them, and runs a server-side COUNT(*) before starting.
     *   A failed export is discarded and can be retried by its job; a header row leaves 1,048,575 data rows available.
     * - Low-code exports currently complete synchronously; omit `async` or set it to `false`.
     * - Omit `storageDestination` for private user storage, use `ROOT` for Explorer root,
     *   or provide an accessible Explorer folder storageEntryId.
     *
     * Example:
     * const result = await api.exportDatabase('contracts', {
     *   format: 'xlsx',
     *   storageDestination: 'ROOT',
     *   fileName: 'contracts-full.xlsx',
     *   restricted: false,
     *   fields: ['contractId', 'customerId'],
     *   sort: { contractId: 'ASC' },
     * });
     *
     * return result.storageEntryId;
     */
  static exportDatabase<TAsync extends boolean = false>(
      name: string,
      options?: ExportDatabaseOptions & { async?: TAsync },
    ): Promise<
      TAsync extends true
        ? ExportDatabaseAcceptedResponse
        : TAsync extends false
          ? ExportDatabaseCompletedResponse
          : ExportDatabaseResponse
    >;

  /**
     * Updates selected logical-database fields by name. The public contract requires the current
     * version for optimistic locking; send only the fields that should change. Do not
     * copy server-owned databaseId, timestamps, or size into this payload.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.updateDatabase('orders', {
     *   version: current.version,
     *   audit: true,
     * });
     */
  static updateDatabase(name: string, data: DatabaseUpdateInput): Promise<Database>;

  /**
     * Soft-deletes a logical database and its active partition subtree by name.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.deleteDatabase('orders');
     */
  static deleteDatabase(name: string): Promise<void>;

  /**
     * Restores a deleted logical database by its original name.
     * The name must identify exactly one accessible deleted database; for ambiguous
     * names select the database by ID through REST or the UI. Strings always mean names.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.restoreDatabase('orders');
     */
  static restoreDatabase(name: string): Promise<void>;

  /**
     * Removes all rows from a logical database selected by name.
     *
     * Notes:
     * - No-op in debug mode.
     * - TRUNCATE does not create row audit events, even when database audit is enabled.
     * - Use an ordinary filtered delete, such as primary key IS NOT NULL, to preserve row audit events.
     * - Identity counters are preserved by default.
     * - Set restartIdentity only when generated key reuse is explicitly intended.
     *
     * Example:
     * await api.truncateDatabase('orders', { restartIdentity: false });
     */
  static truncateDatabase(
      name: string,
      options?: TruncateDatabaseOptions,
    ): Promise<void>;

  /**
     * Runs database-data operations inside a short-lived transaction.
     *
     * Notes:
     * - Commits automatically when the callback resolves.
     * - Rolls back automatically when the callback throws.
     * - The default timeout is 15,000 ms.
     * - Use `{ flexTimeout: true }` when the transaction intentionally needs
     *   the enclosing execution's remaining timeout budget.
     * - Long transactions reserve a database connection and may retain locks;
     *   keep waits and remote side effects outside the callback when possible.
     * - SERIALIZABLE is the default isolation level.
     * - Parallel tx.* operations are rejected; await each tx.* call sequentially.
     *
     * Example:
     * await api.transactionDatabase(async (tx) => {
     *   const existing = await tx.getDatabaseData(
     *     'contracts',
     *     { filter: { field: 'contractId', op: 'eq', value: api.input('contractId') }, take: 1 },
     *     { lock: 'update' },
     *   );
     *   if (existing.results === 0) {
     *     await tx.insertDatabaseData('contracts', [
     *       { contractId: api.input('contractId') },
     *     ]);
     *   }
     * });
     */
  static transactionDatabase<T>(
      callback: (tx: DatabaseTransactionApi) => Promise<T> | T,
      options?: DatabaseTransactionStartOptions,
    ): Promise<T>;

  /**
     * @deprecated Use `api.transactionDatabase()` instead.
     */
  static transactionDatabaseData<T>(
      callback: (tx: DatabaseTransactionApi) => Promise<T> | T,
      options?: DatabaseTransactionStartOptions,
    ): Promise<T>;

  /**
     * Reads rows from a database, view, or materialized view using the structured query shape.
     *
     * Notes:
     * - This is the canonical read API.
     * - Pass take: null for a bounded 2,000-row page without a warning.
     * - Omitting take also uses 2,000 rows and logs one warning per execution.
     *
     * Example:
     * const rows = await api.getDatabaseData('customers', {
     *   fields: ['customerId', 'name'],
     *   filter: { field: 'status', op: 'eq', value: 'ACTIVE' },
     *   sort: { name: 'ASC' },
     *   take: 100,
     * });
     */
  static getDatabaseData<T = any>(
      name: string,
      request?: DatabaseBoundedReadQuery,
    ): Promise<GetDatabaseDataResponse<T>>;

  /**
     * Reads one matching row from a database, view, or materialized view in a single operation,
     * returning null when absent.
     * The query supports fields, filter, joins and sort but not take, skip or count.
     * Specify sort when choosing among multiple matching rows matters.
     * Example: const customer = await api.getDatabaseDataRow('customers',
     *   { filter: { field: 'customerId', op: 'eq', value: customerId } });
     */
  static getDatabaseDataRow<T = any>(name: string, query: DatabaseRowQuery): Promise<T | null>;

  /** Counts matching rows in a database, view, or materialized view with one query. */
  static countDatabase(name: string, query?: DatabaseCountQuery): Promise<number>;

  /**
     * Processes a large database, view, or materialized-view result in sequential,
     * awaited batches without collecting
     * all rows in the isolate. Specify query.take or options.fullScan:true.
     * Every non-final batch has exactly batchSize rows when available.
     * The callback may await writes; do not accumulate batches in an array.
     *
     * Example:
     * await api.walkDatabaseData('customers', { take: 100000, sort: ['customerId'] },
     *   async (batch) => {
     *     await api.upsertDatabaseData('customer_export', batch, { return: false });
     *   }, { batchSize: 2000 });
     */
  static walkDatabaseData<T = any>(
      name: string,
      query: SelectInput,
      callback: (batch: T[], context: { batch: number; processed: number }) => void | Promise<void>,
      options?: DatabaseWalkOptions,
    ): Promise<DatabaseWalkResult>;

  /**
     * @deprecated Use getDatabaseData(), getDatabaseDataRow(), countDatabase(),
     * or walkDatabaseData(). They resolve databases, views, and materialized views
     * through the same logical relation namespace and support relation joins.
     */
  static getDatabaseViewData<T = any>(
      name: string,
      request?: SelectInput,
    ): Promise<GetDatabaseDataResponse<T>>;

  /**
     * Reads newest-first audit events. Prefer narrow fields and changed/filter over a
     * full snapshot.* or changes.* payload. Missing requested paths return null.
     */
  static getDatabaseAudit(
      name: string,
      query?: DatabaseAuditQuery,
    ): Promise<DatabaseAuditResponse>;

  /**
     * Inserts rows. Pass options to control the response: return defaults to true and
     * onlyKeys returns only primary-key fields. Insert always validates the complete
     * row required for creation; patch is not an insert option.
     *
     * Notes:
     * - A call accepts at most 100,000 rows and executes atomically in one transaction.
     * - return defaults to true and includes full rows. return: false omits data; onlyKeys
     *   returns primary keys only. Returning full rows has a higher response-memory cost.
     * - No-op in debug mode.
     *
     * Example:
     * await api.insertDatabaseData('customers', [
     *   { customerId: 'c-1', name: 'Acme' },
     * ]);
     */
  static insertDatabaseData(
      name: string,
      data: LooseObject<any>[],
      options?: DatabaseDataWriteOptions,
    ): Promise<DatabaseDataActionResponse>;

  /**
     * Creates missing rows and PATCHes only properties present in each conflicting row.
     * This is the default: omit unrelated properties rather than reading a full row first.
     * A present null clears a nullable property; an omitted or undefined property is unchanged.
     * Pass { patch: false } only for the legacy full-replacement conflict behavior.
     * Pass { return: false } to skip returned rows, or { onlyKeys: true } for keys only.
     *
     * Notes:
     * - A call accepts at most 100,000 rows and executes atomically in one transaction.
     * - return defaults to true and includes full rows. return: false omits data; onlyKeys
     *   returns primary keys only. Returning full rows has a higher response-memory cost.
     * - No-op in debug mode.
     *
     * Example:
     * await api.upsertDatabaseData('customers', [
     *   { customerId: 'c-1', status: 'ACTIVE' },
     * ]);
     */
  static upsertDatabaseData(
      name: string,
      data: LooseObject<any>[],
      options?: DatabaseUpsertOptions,
    ): Promise<DatabaseDataActionResponse>;

  /**
     * PATCHes the row identified by its primary-key oldObject. newObject contains only
     * properties to change; omitted or undefined properties are unchanged, while null
     * explicitly clears a nullable property. Use updateDatabaseDataRequest for a
     * structured-filter bulk PATCH.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.updateDatabaseData(
     *   'customers',
     *   { customerId: 'c-1' },
     *   { status: 'ACTIVE' },
     * );
     */
  static updateDatabaseData(
      name: string,
      oldObject: LooseObject<any>,
      newObject: LooseObject<any>,
    ): Promise<ResourceItem>;

  /**
     * Deletes an explicit list of rows identified by primary key.
     *
     * Notes:
     * - A call accepts at most 100,000 rows and executes atomically in one transaction.
     * - Prefer deleteDatabaseDataRequest() when the rows can be described by a filter;
     *   it avoids loading and transferring every matching primary key to the runtime.
     * - Structured query and mutation filters are rejected before SQL execution when they exceed
     *   8 MiB, 1,000 nodes, 100,000 values, 16 nested levels, or 10,000 bound parameters.
     * - No-op in debug mode.
     *
     * Example:
     * await api.deleteDatabaseData('customers', [
     *   { customerId: 'c-1' },
     * ]);
     */
  static deleteDatabaseData(name: string, data: ResourceItem[]): Promise<any>;

  /**
     * Bulk-updates rows matched by an advanced structured filter.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.updateDatabaseDataRequest(
     *   'customers',
     *   { filter: { field: 'status', op: 'eq', value: 'NEW' } },
     *   { status: 'PROCESSED' },
     * );
     */
  static updateDatabaseDataRequest(
      name: string,
      request: DatabaseMutationRequest,
      payload: DatabaseUpdateData,
      options?: { return?: boolean; onlyKeys?: boolean },
    ): Promise<{ success: number; elapsed: number; data?: any }>;

  /**
     * Bulk-deletes rows matched by an advanced structured filter.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.deleteDatabaseDataRequest('customers', {
     *   filter: { field: 'archivedAt', op: 'isNotNull' },
     * });
     */
  static deleteDatabaseDataRequest(
      name: string,
      request: DatabaseMutationRequest,
      options?: { return?: boolean; onlyKeys?: boolean },
    ): Promise<{ success: number; elapsed: number; data?: any }>;

  /**
     * Executes raw SELECT/WITH SQL when the structured helpers are not enough.
     * Do not use this for writes; use insert/upsert/update/delete helpers or
     * transactionDatabase for write flows.
     *
     * Example:
     * const rows = await api.queryDatabase('SELECT NOW() AS now');
     */
  static queryDatabase(query: string, params?: any[]): Promise<any>;

  /**
     * Returns file metadata.
     *
     * @deprecated Use `storage.getFile(storageEntryId)` for Explorer Storage.
     *
     * Migration:
     * const file = await storage.getFile(storageEntryId);
     *
     * Example:
     * const file = await api.getFile(fileId);
     */
  static getFile(fileId: string): Promise<File>;

  /**
     * Reads file content.
     *
     * Notes:
     * - Text file stats are auto-generated on demand and usually precomputed after upload finalization.
     * - Direct reads are limited to 10 MB unless you request a ranged buffer.
     *
     * @deprecated Use `storage.getFileData(storageEntryId, options)` or `storage.getText(storageEntryId)`.
     *
     * Migration:
     * const data = await storage.getFileData(storageEntryId, { batchNumber: 1 });
     *
     * Example:
     * const data = await api.getFileData(fileId, { batchNumber: 1 });
     */
  static getFileData(
      fileId: string,
      options?: {
        batchNumber?: number;
        buffer?: boolean;
        start?: number;
        end?: number;
      },
    ): Promise<any>;

  /**
     * Computes or refreshes file metadata such as line batches.
     *
     * @deprecated Use `storage.getFileStats(storageEntryId, options)`.
     *
     * Migration:
     * const stats = await storage.getFileStats(storageEntryId, { separator: '\\n', batchSize: 5000 });
     *
     * Example:
     * const stats = await api.getFileStats(fileId, {
     *   separator: '\\n',
     *   batchSize: 5000,
     * });
     */
  static getFileStats(
      fileId: string,
      options?: {
        separator?: string;
        reloadStats?: boolean;
        ocrType?: 'image' | 'document';
        ocrOptions?: any;
        batchSize?: number;
      },
    ): Promise<FileExtra>;

  /**
     * Generates a signed upload URL.
     *
     * @deprecated Use `storage.createUploadSession({ uploadMode: 'direct', ... })`.
     *
     * Migration:
     * const { session, upload } = await storage.createUploadSession({
     *   name: 'report.csv',
     *   uploadMode: 'direct',
     *   contentTypeHint: 'text/csv',
     *   computeStats: 'sync',
     * });
     *
     * Example:
     * const url = await api.getFileUploadUrl(fileId, 300);
     */
  static getFileUploadUrl(fileId: string, ttl?: number): Promise<string>;

  /**
     * Generates a signed download URL.
     *
     * @deprecated Use `storage.getDownload(storageEntryId, download?, ttl?)`.
     *
     * Migration:
     * const { downloadUrl } = await storage.getDownload(storageEntryId, true, 300);
     *
     * Example:
     * const url = await api.getFileDownloadUrl(fileId, {
     *   ttl: 300,
     *   download: true,
     * });
     */
  static getFileDownloadUrl(
      fileId: string,
      options?: { ttl?: number; download?: boolean; customName?: string },
    ): Promise<string>;

  /**
     * Appends text, arrays, or buffers to an existing file.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * @deprecated Use storage upload sessions for append-style writes.
     *
     * Migration:
     * const { session } = await storage.createUploadSession({
     *   name: 'report.csv',
     *   uploadMode: 'incremental',
     *   contentTypeHint: 'text/csv',
     *   computeStats: 'sync',
     * });
     * await storage.uploadPart(session.storageUploadSessionId, null, { data: 'row1\\nrow2\\n' });
     * const result = await storage.finalizeUploadSession(session.storageUploadSessionId, { computeStats: 'sync' });
     *
     * Example:
     * await api.appendFile(fileId, 'row1\\nrow2\\n');
     */
  static appendFile(
      fileId: string,
      data: Uint8Array | string | string[],
      options?: { saveBase64AsString?: boolean },
    ): Promise<void>;

  /**
     * Deletes one or more files.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * @deprecated Use `storage.deleteEntry(storageEntryId, { version })`.
     *
     * Migration:
     * await storage.deleteEntry(storageEntryId, { version });
     *
     * Example:
     * await api.deleteFile(fileId);
     */
  static deleteFile(fileId: string | string[]): Promise<void>;

  /**
     * Creates and optionally uploads a file in one call.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * @deprecated Use `storage.putObject(...)` for simple writes or storage upload sessions for large writes.
     *
     * Migration:
     * const entry = await storage.putObject({
     *   name: 'report.csv',
     *   data: 'id,name\\n1,Acme\\n',
     *   mimeType: 'text/csv',
     *   computeStats: 'sync',
     * });
     *
     * Example:
     * const fileId = await api.saveFile(
     *   {
     *     fileName: 'report.csv',
     *     path: 'exports',
     *     mime: 'text/csv',
     *   },
     *   'id,name\\n1,Acme',
     * );
     */
  static saveFile(
      file: {
        fileName: string;
        path: string;
        mime: string;
        refId?: string;
        refVer?: number;
        refType?: string;
        createdBy?: string;
      },
      data?: string | string[] | Buffer,
    ): Promise<string>;

  /**
     * Creates an empty file placeholder.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * @deprecated Use `storage.createUploadSession({ uploadMode: 'direct', ... })`.
     *
     * Migration:
     * const { session, upload } = await storage.createUploadSession({
     *   name: 'report.csv',
     *   uploadMode: 'direct',
     *   contentTypeHint: 'text/csv',
     *   computeStats: 'sync',
     * });
     *
     * Example:
     * const fileId = await api.createFile('report.csv', 'exports', 'text/csv');
     */
  static createFile(
      name: string,
      path: string | null,
      mime: string,
      createdBy?: string,
    ): Promise<string>;

  /**
     * Creates a folder placeholder.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * @deprecated Use `storage.createFolder({ name, parentStorageEntryId })`.
     *
     * Migration:
     * const folder = await storage.createFolder({ name: 'exports', parentStorageEntryId: null });
     *
     * Example:
     * await api.createFolder('exports', null);
     */
  static createFolder(
      name: string,
      path: string | null,
      createdBy?: string,
    ): Promise<string>;

  /**
     * Returns the current logged user or service account synchronously.
     * `avatar` is the Storage entry ID, not a signed download URL.
     *
     * Example:
     * const user = api.currentUser();
     */
  static currentUser(): LoggedUser;

  /**
     * Returns true when debug mode is enabled.
     *
     * Example:
     * if (api.isDebug()) {
     *   api.log('Debug mode', 'WARN');
     * }
     */
  static isDebug(): boolean;

  /**
     * Disables debug mode for the current execution.
     *
     * Example:
     * api.disableDebug();
     */
  static disableDebug(): void;

  /**
     * Enables debug mode for the current execution.
     *
     * Example:
     * api.enableDebug();
     */
  static enableDebug(): void;

  /**
     * Reads request-scoped in-memory cache.
     *
     * Example:
     * const token = api.getCache('token');
     */
  static getCache(key: string): any;

  /**
     * Writes request-scoped in-memory cache.
     *
     * Example:
     * api.setCache('token', 'abc');
     */
  static setCache(key: string, value: any): void;

  /**
   * Returns the current execution context.
   *
   * Example:
   * const ctx = api.getContext();
   */
  static getContext(): Context;

  /**
     * Returns a snapshot of error logs collected so far in this execution.
     * Each call reads the current host collection; modifying the returned array does not clear host errors.
     *
     * Example:
     * const errors = api.getErrors();
     */
  static getErrors(): ProcessLog[];

  /**
     * Returns the UUID that identifies the current low-code execution.
     * For durable jobs this is the job id. Endpoint and Sandbox executions
     * receive an independent execution UUID while retaining their operation id
     * for distributed request tracing.
     *
     * Example:
     * const executionId = api.getExecutionId();
     */
  static getExecutionId(): string;

  /**
     * Returns the current execution id.
     *
     * @deprecated Use api.getExecutionId().
     *
     * Example:
     * const id = api.getJobId();
     */
  static getJobId(): string;

  /**
     * Returns the current operation id.
     *
     * Example:
     * const op = api.getOperationId();
     */
  static getOperationId(): string;

  /**
   * Executes another active component in the managed RevoEngine runtime and returns its execution result.
   *
   * Notes:
   * - Supports CODE_JS, CODE_TS, and CUSTOM_NODEJS components.
   * - CODE_JS and CODE_TS run in a fresh isolated execution on the current host by default.
   * - Set options.executionHost to "remote" to use the separate Sandbox host.
   * - CUSTOM_NODEJS runs in its governed RevoEngine component environment.
   * - If timeoutMs is omitted, the child receives the parent execution's remaining timeout budget.
   * - A larger timeoutMs is clamped to that remaining budget.
   * - Nesting is limited to five levels across local, remote and custom component calls.
   * - At least 1 second of parent budget is required for remote Sandbox calls.
   * - Promise.all() starts independent child component executions.
   *
   * Example:
   * const [pricing, taxes] = await Promise.all([
   *   api.executeComponent({ componentId: pricingComponentId, inputs: { customerId }, timeoutMs: 9000 }),
   *   api.executeComponent({ componentId: taxComponentId, inputs: { customerId }, timeoutMs: 9000 }),
   * ]);
   */
  static executeComponent<T = LooseObject<any>>(
      request: ComponentExecuteRequest,
    ): Promise<ComponentExecuteResult<T>>;

  /**
     * Returns the current execution payload.
     *
     * Notes:
     * - In endpoint context this usually includes body, query, headers, params, path, and method.
     * - In event or job context it commonly includes type and message.
     * - Passing a name returns a single top-level property.
     *
     * Example:
     * const customerId = api.input()?.body?.customerId;
     */
  static input(name?: string): Input;

  /**
     * Adds a log entry.
     *
     * Limits:
     * - Endpoint executions accept at most 100 `api.log` calls per execution.
     * - Processor and non-streaming Sandbox executions accept at most 10,000 calls.
     * - Streaming Sandbox executions emit logs only to the active SSE stream; this
     *   count limit is not applied there, but the stream remains protected by its
     *   backpressure queue limit.
     * - Calls after the applicable limit are ignored. Other API methods do not
     *   consume this limit.
     *
     * Example:
     * api.log(
     *   { message: 'Call finished', args: { status: 200 } },
     *   'INFO',
     *   120,
     * );
     */
  static log(
      log: string | LogInterface,
      type?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG',
      duration?: number,
      time?: string,
    ): void;

  /**
     * Stops execution early without marking it as a sandbox failure.
     *
     * Example:
     * if (!enabled) {
     *   api.exit();
     * }
     */
  static exit(): void;

  /**
     * Stores an HTTP-style response and aborts execution.
     *
     * Notes:
     * - Reserved 502 and 503 codes are not allowed from Endpoint user code.
     *
     * Example:
     * api.throw(400, { message: 'customerId is required' });
     */
  static throw(code: number, body?: any): void;

  /**
     * Waits asynchronously, capped at 60 seconds per call.
     *
     * @deprecated Prefer util.sleep() for new code.
     *
     * Example:
     * await api.sleep(250);
     */
  static sleep(ms: number): Promise<void>;

  /**
     * Returns the current instance id.
     *
     * Example:
     * const instanceId = api.getCurrentInstance();
     */
  static getCurrentInstance(): string;

  /**
     * Reads data from platform-managed sources.
     *
     * Example:
     * const files = await api.getInstanceData('Files', {
     *   take: 20,
     *   sort: ['-createdAt'],
     * });
     */
  static getInstanceData(
      dataSource:
        | 'Users'
        | 'Groups'
        | 'RoleGroups'
        | 'Keys'
        | 'Secrets'
        | 'SecretsData'
        | 'Templates'
        | 'Events'
        | 'Schedule'
        | 'Jobs'
        | 'Webhooks'
        | 'Components'
        | 'Logs'
        | 'Files'
        | 'EventsHistory'
        | 'Endpoints'
        | 'Databases'
        | 'DatabaseData',
      request?: InstanceData,
    ): Promise<any>;

  /**
     * Returns public instance metadata.
     *
     * Example:
     * const details = api.getInstanceDetails();
     */
  static getInstanceDetails(): InstanceDetails;

  /**
     * Resolves a single secret value by name.
     *
     * Example:
     * const apiKey = await api.getSecret('CRM_API_KEY');
     */
  static getSecret(name: string): Promise<string>;

  /**
     * Resolves multiple secret values by name.
     *
     * Example:
     * const secrets = await api.getSecrets([
     *   'CRM_API_KEY',
     *   'CRM_API_URL',
     * ]);
     */
  static getSecrets(name: string[]): Promise<{ [key: string]: string }>;

  /**
     * Publishes a realtime message.
     *
     * Notes:
     * - No-op in debug mode.
     * - Currently only the 'ALL' channel is supported.
     *
     * Example:
     * await api.publishMessage('ALL', { state: 'started' });
     */
  static publishMessage(channel: string, message: any): Promise<void>;

  /**
     * Reads instance-scoped cache.
     *
     * Example:
     * const state = await api.getInstanceCache('sync:state');
     */
  static getInstanceCache(key: string): Promise<any>;

  /**
     * Writes instance-scoped cache.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.setInstanceCache('sync:state', { step: 'loading' }, 300);
     */
  static setInstanceCache(
      key: string,
      value: any,
      seconds?: number,
    ): Promise<void>;

  /**
     * Writes instance-scoped cache only when the key does not exist.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const created = await api.setInstanceCacheIfNotExists('sync:state', { step: 'queued' }, 300);
     */
  static setInstanceCacheIfNotExists(
      key: string,
      value: any,
      seconds?: number,
    ): Promise<boolean>;

  /**
     * Reads a cache key or stores the fallback value atomically if it is missing.
     *
     * Example:
     * const state = await api.getOrSetInstanceCache('sync:state', { step: 'queued' }, 300);
     */
  static getOrSetInstanceCache(
      key: string,
      value: any,
      seconds?: number,
    ): Promise<any>;

  /**
     * Removes cache keys.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.removeInstanceCache('sync:*', true);
     */
  static removeInstanceCache(key: string, wildcard?: boolean): Promise<void>;

  /**
     * Checks whether an instance cache key exists.
     *
     * Example:
     * const exists = await api.existsInstanceCache('sync:state');
     */
  static existsInstanceCache(key: string): Promise<boolean>;

  /**
     * Makes a cache key persistent.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.persistInstanceCache('sync:state');
     */
  static persistInstanceCache(key: string): Promise<void>;

  /**
     * Sets cache TTL in seconds.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.expireInstanceCache('sync:state', 600);
     */
  static expireInstanceCache(key: string, ttl: number): Promise<void>;

  /**
     * Returns cache TTL in seconds, 0 for no expiry, or null when the key does not exist.
     *
     * Example:
     * const ttl = await api.getExpireInstanceCache('sync:state');
     */
  static getExpireInstanceCache(key: string): Promise<number | null>;

  /**
     * Lists instance cache keys by prefix or pattern.
     *
     * Example:
     * const keys = await api.listInstanceCache('sync:*');
     */
  static listInstanceCache(key: string): Promise<string[]>;

  /**
     * Atomically increments an integer cache key.
     *
     * Notes:
     * - No-op in debug mode.
     * - 'by' must be an integer.
     *
     * Example:
     * const count = await api.incrementInstanceCache('sync:counter', 1, 300);
     */
  static incrementInstanceCache(
      key: string,
      by?: number,
      seconds?: number,
    ): Promise<number>;

  /**
     * Atomically decrements an integer cache key.
     *
     * Notes:
     * - No-op in debug mode.
     * - 'by' must be an integer.
     *
     * Example:
     * const count = await api.decrementInstanceCache('sync:counter');
     */
  static decrementInstanceCache(
      key: string,
      by?: number,
      seconds?: number,
    ): Promise<number>;

  /**
     * Atomically updates a cache key only when the current value matches 'expected'.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const swapped = await api.compareAndSetInstanceCache('sync:state', { step: 'queued' }, { step: 'running' }, 300);
     */
  static compareAndSetInstanceCache(
      key: string,
      expected: any,
      value: any,
      seconds?: number,
    ): Promise<boolean>;

  /**
   * Acquires an idempotency key in the instance-scoped managed cache.
   *
   * Notes:
   * - No-op in debug mode.
   *
   * Example:
   * const first = await api.acquireIdempotencyKey('orders:123', 600, { state: 'running' });
   */
  static acquireIdempotencyKey(
      key: string,
      ttl: number,
      value?: any,
    ): Promise<boolean>;

  /**
     * Reads stored idempotency metadata.
     *
     * Example:
     * const current = await api.getIdempotencyKey('orders:123');
     */
  static getIdempotencyKey(key: string): Promise<any>;

  /**
     * Deletes an idempotency key unconditionally, allowing another attempt to acquire it.
     *
     * Notes:
     * - This does not roll back business effects and does not check an ownership token.
     * - Release for retry only when no business effect occurred (or rollback is confirmed),
     *   and the key still belongs to this attempt. Retain it when the outcome is uncertain.
     * - Never release in a generic catch/finally merely because processing threw or timed out:
     *   a partial effect or committed operation could then be executed twice.
     * - A late cleanup after TTL expiry may delete a key acquired by another worker.
     * - No-op in debug mode.
     *
     * Example:
     * // This attempt acquired the key, no business operation started, and the key has not expired.
     * await api.releaseIdempotencyKey('orders:123');
     */
  static releaseIdempotencyKey(key: string): Promise<void>;

  /**
     * Acquires an instance-scoped concurrency token.
     *
     * Notes:
     * - Returns whether admission succeeded; ttl is in seconds.
     * - Each successful admission acquires one slot. Release it exactly once with releaseConcurrencyLimit.
     * - TTL applies to the shared counter and is refreshed on successful admission; it is not a per-worker lease.
     *   Processing must finish before expiry. There is no ownership token to protect against late cleanup.
     * - No-op in debug mode.
     *
     * Example:
     * const locked = await api.concurrencyLimit('sync:customers', 1, 300);
     */
  static concurrencyLimit(
      key: string,
      limit: number,
      ttl: number,
    ): Promise<boolean>;

  /**
     * Acquires an instance-scoped rate-limit token.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const allowed = await api.rateLimit('outbound:crm', 10, 60);
     */
  static rateLimit(key: string, limit: number, ttl: number): Promise<boolean>;

  /**
     * Resets the entire rate-limit key, including all consumed tokens.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.releaseRateLimit('outbound:crm');
     */
  static releaseRateLimit(key: string): Promise<void>;

  /**
     * Atomically releases one acquired concurrency slot, preserving slots held by other workers.
     *
     * Notes:
     * - Decrements the counter by one and deletes the key only when no slots remain. A missing key is a no-op.
     * - Call exactly once after a successful admission; do not release after admission returned false.
     * - This key-only API has no ownership token. Duplicate release or cleanup after expiry/reacquisition
     *   can release another worker's slot. It does not provide an ownership-safe lease.
     * - No-op in debug mode.
     *
     * Example:
     * // Once, for this worker's successful admission, before the counter expires.
     * await api.releaseConcurrencyLimit('sync:customers');
     */
  static releaseConcurrencyLimit(key: string): Promise<void>;

  /**
     * Schedules a custom event.
     * Matches active definitions by `custom: true` and the uppercase event type.
     * No implicit CUSTOM_ prefix is added. Native events can only be replayed from history.
     *
     * Notes:
     * - Use the options object's `scheduleFor`; legacy delay properties are ignored.
     * - New code should use `scheduleFor` with a Date, ISO 8601 date-time, or Unix timestamp in milliseconds.
     * - The absolute time cannot be in the past or more than 30 days ahead.
     * - No-op in debug mode.
     *
     * Example:
     * const eventId = await api.triggerEvent(
     *   'customer_sync',
     *   { customerId: 'c-1' },
     *   {
     *     scheduleFor: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
     *     metadata: { correlationId: 'sync-123' },
     *   },
     * );
     */
  static triggerEvent(
      name: string,
      message: any,
      options?: TriggerEventOptions,
    ): Promise<string>;

  /**
     * Schedules generic execution against a normalized target.
     *
     * Notes:
     * - Use `JOB_TEMPLATE` for legacy template execution or `AGENT` for agent-native dispatch.
     * - Pass `{ scheduleFor }`; the maximum horizon is 30 days.
     * - Retired positional date and relative-delay arguments are ignored.
     * - No-op in debug mode.
     * - For `JOB_TEMPLATE`, `targetId` accepts an exact active template ID or unique name.
     *   The third argument is copied directly into the
     *   target job's flat `api.input().templateInputs`. It is shallow-spread over
     *   template defaults, retaining non-colliding defaults and overwriting only
     *   matching keys; it is never nested below another input property.
     *
     * Example:
     * const jobId = await api.triggerTarget(
     *   'JOB_TEMPLATE',
     *   templateId,
     *   { customerId: 'c-1' },
     *   { scheduleFor: Date.now() + 5 * 60 * 1000 },
     * );
     */
  static triggerTarget(
      targetType: ExecutionTargetType,
      targetId: string,
      input?: Record<string, JsonValue>,
      options?: AutomationScheduleOptions,
    ): Promise<string>;

  /**
     * Schedules an active job template by its exact ID or exact unique name.
     *
     * Notes:
     * - No-op in debug mode.
     * - Convenience wrapper for `api.triggerTarget('JOB_TEMPLATE', templateIdOrName, ...)`.
     * - The input argument is copied directly into the target job's flat
     *   `api.input().templateInputs`, shallow-spread over template defaults.
     *   Non-colliding defaults remain and matching keys are overwritten; it is not
     *   nested under `templateInputs.input` or exposed at top level.
     * - Pass `{ scheduleFor }`; the maximum horizon is 30 days.
     * - Retired positional date and relative-delay arguments are ignored.
     *
     * Example:
     * const jobId = await api.triggerJob(
     *   templateId,
     *   { customerId: 'c-1' },
     *   { scheduleFor: new Date(Date.now() + 15 * 60 * 1000) },
     * );
     */
  static triggerJob(
      templateIdOrName: string,
      templateInputs?: Record<string, JsonValue>,
      options?: AutomationScheduleOptions,
    ): Promise<string>;

  /**
     * Schedules a webhook delivery.
     *
     * Notes:
     * - Pass `{ scheduleFor }`; the maximum horizon is 30 days.
     * - Retired positional date and relative-delay arguments are ignored.
     * - No-op in debug mode.
     *
     * Example:
     * const webhook = await api.triggerWebhook({
     *   request: {
     *     url: 'https://example.com/hook',
     *     method: 'POST',
     *     body: { ok: true },
     *   },
     * }, {
     *   scheduleFor: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
     * });
     */
  static triggerWebhook(
      webhook: WebhookInput,
      options?: AutomationScheduleOptions,
    ): Promise<Webhook>;

  /** @localOnly V8 only. The initial await resolves after response headers. */
  static httpCall(config: HttpRequestInterface, options: Omit<HttpRequestOptionsInterface, 'responseType' | 'target'> & {
      responseType: 'stream'; streamFormat: 'sse'; timeout?: number; proxy?: false;
    }): Promise<HttpStreamResponse<HttpSseEvent>>;

  /** @localOnly V8 only. break and close() release the upstream request. */
  static httpCall(config: HttpRequestInterface, options: Omit<HttpRequestOptionsInterface, 'responseType' | 'target'> & {
      responseType: 'stream'; streamFormat?: 'bytes'; timeout?: number; proxy?: false;
    }): Promise<HttpStreamResponse<Uint8Array>>;

  /** Stores only 2xx bodies and returns after finalization; other statuses return bounded diagnostic text. */
  static httpCall(config: HttpRequestInterface, options: HttpRequestOptionsInterface & { responseType: 'storage'; target: HttpStorageTargetRef; timeout?: number; proxy?: false }): Promise<{
      status: number; statusText: string; time: number; headers: LooseObject<string>;
      revo?: HttpRevoResponseScope;
      request: { config: HttpRequestInterface; options: HttpRequestOptionsInterface };
    } & ({ data: undefined; storage: { session: StorageUploadSession; entry: StorageEntryView } } | { data: string; storage?: undefined })>;

  /**
     * Performs an outbound HTTP request.
     *
     * Notes:
     * - No-op in debug mode and returns `null`; call `api.disableDebug()` only when this external side effect is intentionally allowed.
     * - Supports proxy mode, form-data, Storage streaming, and optional current credentials.
     * - Use `source: { storageEntryId }` when streaming an Explorer Storage file into an HTTP request.
     * - Use `target: { name, ... }` or `target: { storageEntryId, replace: true }` when streaming an HTTP response into Explorer Storage.
     * - `source` and `target` may be used together to stream a Storage entry through an external conversion API and save its response into Storage.
     * - For multipart requests, put `formData` on the first config argument. Use one empty part with `source`, or put `storageEntryId` directly on each binary `formData` part.
     * - HTTP Storage targets use one managed direct upload and are finalized automatically. Use `storage.createUploadSession` plus `storage.uploadPart` for resumable/chunked session workflows.
     * - Use `requestType: 'storage'` for a Storage source and `responseType: 'storage'` for a Storage target. These formats are independent.
     * - `target: { storageUploadSessionId }` fills and finalizes an existing active empty direct session, preserving its stored settings.
     * - Only 2xx responses are saved; other statuses return at most 64 KiB of diagnostic text. Legacy Files and nested Storage references are rejected.
     * - Revo responses expose `revo.sameInstance`. The runtime compares
     *   SHA-256("revo-instance:v1:" + current instance id) internally; `x-revo-oid`
     *   is returned only when `revo.sameInstance` is true. Cross-instance or
     *   unconfirmed Revo headers are removed from the public response.
     * - `response.data` is `undefined` when the response is stored; use `response.storage.entry` after successful finalization.
     * - For text files, prefer `computeStats: 'sync'` on the storage target so line stats are immediately available after finalize.
     * - JSON is the default request and response format. Explicit `requestType: 'json'` is valid for every supported HTTP method and may be combined with any response type because it does not declare a request body.
     *
     * Example:
     * const response = await api.httpCall(
     *   {
     *     url: 'https://example.com/customers',
     *     method: 'POST',
     *     data: { customerId: 'customer-1' },
     *   },
     *   {
     *     requestType: 'json',
     *     responseType: 'json',
     *     timeout: 15000,
     *   },
     * );
     *
     * Multipart request with one Storage file:
     * const response = await api.httpCall(
     *   {
     *     url: 'https://example.com/upload',
     *     method: 'POST',
     *     formData: [
     *       { key: 'description', value: 'Contract' },
     *       { key: 'file' },
     *     ],
     *   },
     *   {
     *     requestType: 'form-data',
     *     source: { storageEntryId },
     *   },
     * );
     *
     * Multipart request with multiple Storage files:
     * const response = await api.httpCall(
     *   {
     *     url: 'https://example.com/merge',
     *     method: 'POST',
     *     formData: [
     *       { key: 'contract', storageEntryId: contractEntryId },
     *       { key: 'attachments', storageEntryId: attachmentsEntryId },
     *     ],
     *   },
     *   { requestType: 'form-data' },
     * );
     *
     * Storage response stream:
     * const response = await api.httpCall(
     *   { url: 'https://example.com/report.csv', method: 'GET' },
     *   {
     *     responseType: 'storage',
     *     target: {
     *       name: 'report.csv',
     *       contentTypeHint: 'text/csv',
     *       computeStats: 'sync',
     *     },
     *   },
     * );
     *
     * Storage request stream:
     * await api.httpCall(
     *   { url: 'https://example.com/import', method: 'POST' },
     *   { requestType: 'storage', source: { storageEntryId } },
     * );
     *
     * Storage conversion:
     * await api.httpCall(
     *   { url: 'https://example.com/convert', method: 'POST' },
     *   {
     *     requestType: 'storage',
     *     source: { storageEntryId: sourceEntryId },
     *     responseType: 'storage',
     *     target: { name: 'converted.pdf', contentTypeHint: 'application/pdf' },
     *   },
     * );
     */
  static httpCall(
      config: HttpRequestInterface,
      options?: HttpRequestOptionsInterface & {
        timeout?: number;
        proxy?: boolean;
      },
    ): Promise<{
      status: number;
      statusText: string;
      time: number;
      headers: LooseObject<string>;
      revo?: HttpRevoResponseScope;
      data: any;
      storage?: { session: StorageUploadSession; entry: StorageEntryView };
      request: {
        config: HttpRequestInterface & { timeout?: number };
        options: HttpRequestOptionsInterface & {
          timeout?: number;
          proxy?: boolean;
        };
      };
    }>;

  /**
     * Executes multiple SFTP commands in order.
     * @deprecated Legacy. Use transport.sftpCommands(commands, secretNameOrId) for new code.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await api.sftpExec([['mkdir', '/archive']], connection);
     */
  static sftpExec(commands: any[], config: SFTPClient): Promise<any>;

  /**
     * Streams a Storage entry to SFTP through a short-lived signed
     * download URL. The SFTP bridge reads the URL and writes directly to the
     * remote path; file bytes do not pass through low-code memory.
     * @deprecated Legacy. Use transport.sftpExport(path, { storageEntryId }, secretNameOrId) for new code.
     *
     * Notes:
     * - No-op in debug mode.
     * - Prefer `{ storageEntryId, namespace? }` for Storage files. String inputs are legacy fileIds.
     * - Storage refs use the same registered namespace and effective ACL rules as storage.* and HTTP streaming.
     *
     * Legacy example:
     * await api.sftpPut(fileId, '/outbound/report.csv', connection);
     *
     * Storage example:
     * await api.sftpPut({ storageEntryId }, '/outbound/report.csv', connection);
     */
  static sftpPut(
      source: SFTPFileSourceRef,
      path: string,
      config: SFTPClient,
    ): Promise<void>;

  /**
     * Streams an SFTP file directly into Explorer Storage and returns the
     * finalized Storage entry.
     * @deprecated Legacy. Use transport.sftpImport(path, storage, secretNameOrId) for new code.
     *
     * Notes:
     * - No-op in debug mode.
     * - Prefer `{ storage: ... }` to create a Storage entry in one call or `{ storageEntryId, replace: true }` to replace one. String inputs are legacy fileIds.
     * - Storage refs use the same registered namespace and effective ACL rules as storage.* and HTTP streaming.
     * - New Storage targets accept the create-upload fields except `uploadMode` and `replaceStorageEntryId`; SFTP always uses a native direct upload.
     * - The managed transfer finalizes the uploaded object synchronously after Storage verification. Repeated completion signals are idempotent.
     * - For text files, prefer `computeStats: 'sync'` so line stats are immediately available after finalize.
     *
     * Legacy example:
     * await api.sftpGet(fileId, '/incoming/report.csv', connection);
     *
     * Storage example:
     * const result = await api.sftpGet({
     *   storage: {
     *     name: 'daily.csv',
     *     parentStorageEntryId: folderId,
     *     contentTypeHint: 'text/csv',
     *     computeStats: 'sync',
     *     retention: { ttlSeconds: 604800 },
     *   },
     * }, '/incoming/daily.csv', connection);
     */
  static sftpGet(
      target: SFTPFileTargetRef,
      path: string,
      config: SFTPClient,
    ): Promise<void | { session: StorageUploadSession; entry: StorageEntryView }>;

  /**
     * AES decrypt helper.
     *
     * @deprecated Prefer util.aesDecrypt() for new code.
     *
     * Ciphertext: at most 5592464 base64 characters; passphrase: at most 4096 UTF-16 code units.
     *
     * Example:
     * const plain = await api.aesDecrypt(encrypted, passphrase);
     */
  static aesDecrypt(encrypted: string, passphrase: string): Promise<string>;

  /**
     * AES encrypt helper.
     *
     * @deprecated Prefer util.aesEncrypt() for new code.
     *
     * Payload: at most 1048576 UTF-16 code units; passphrase: at most 4096.
     *
     * Example:
     * const encrypted = await api.aesEncrypt('secret', passphrase);
     */
  static aesEncrypt(payload: string, passphrase: string): Promise<string>;

  /**
     * Compares a value against a password hash.
     *
     * @deprecated Prefer util.compareHash() for new code.
     *
     * Password: at most 4096 UTF-16 code units; unsupported scrypt work factors return false.
     *
     * Example:
     * const valid = await api.compareHash(password, hash);
     */
  static compareHash(
      password: string | undefined,
      hash: string | undefined,
    ): Promise<boolean>;

  /**
     * Checks whether a value is base64.
     *
     * @deprecated Prefer util.isBase64() for new code.
     *
     * Example:
     * const ok = api.isBase64(value);
     */
  static isBase64(input: any): boolean;

  /**
     * Decodes a base64 string.
     *
     * @deprecated Prefer util.decodeBase64() for new code.
     *
     * Example:
     * const text = api.decodeBase64(base64String);
     */
  static decodeBase64(base64String: string): string;

  /**
     * Encodes a string to base64.
     *
     * @deprecated Prefer util.encodeBase64() for new code.
     *
     * Example:
     * const encoded = api.encodeBase64('hello');
     */
  static encodeBase64(plainString: string): string;

  /**
     * Generates a password hash.
     *
     * @deprecated Prefer util.generateHash() for new code.
     *
     * Password: at most 4096 UTF-16 code units.
     *
     * Example:
     * const hash = await api.generateHash(password, 10);
     */
  static generateHash(
      password: string | undefined,
      rounds?: number,
    ): Promise<string>;

  /**
     * Validates UUID shape.
     *
     * @deprecated Prefer util.isUUID() for new code.
     *
     * Example:
     * const ok = api.isUuid(value);
     */
  static isUuid(input: any): boolean;

  /**
     * Validates UUID shape.
     *
     * @deprecated Prefer util.isUUID() for new code.
     *
     * Example:
     * const ok = api.isUUID(value);
     */
  static isUUID(input: any): boolean;

  /**
     * Generates a random UUIDv7.
     *
     * @deprecated Prefer util.randomUUID() for new code.
     *
     * Example:
     * const id = api.generateUuid();
     */
  static generateUuid(): string;

  /**
     * Generates a random UUIDv7.
     *
     * @deprecated Prefer util.randomUUID() for new code.
     *
     * Example:
     * const id = api.randomUUID();
     */
  static randomUUID(): string;

  /**
     * Returns a random UUIDv7 with no arguments, or a deterministic UUIDv5 only when
     * both value and namespace are supplied. Do not generate IDs for server-created
     * platform resources; use this only for caller-owned data values.
     *
     * @deprecated Prefer util.getUUID() for new code.
     *
     * Example:
     * const id = api.getUUID('customer-1', 'customers');
     */
  static getUUID(...args: [] | [value: string, namespace: string]): string;

  /**
     * Creates a stable hash from an object.
     *
     * @deprecated Prefer util.hashObject() for new code.
     *
     * Example:
     * const hash = api.hashObject({ customerId: 'c-1' });
     */
  static hashObject(object: any): string;

  /**
     * Synchronous SHA-1 hash. Payload: at most 5242880 UTF-8 bytes (5 MiB).
     *
     * @deprecated Prefer util.sha1() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const digest = api.sha1('payload');
     */
  static sha1(payload: string): string;

  /**
     * Synchronous SHA-256 hash. Payload: at most 5242880 UTF-8 bytes (5 MiB).
     *
     * @deprecated Prefer util.sha256() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const digest = api.sha256('payload');
     */
  static sha256(payload: string): string;

  /**
     * Synchronous MD5 hash. Payload: at most 5242880 UTF-8 bytes (5 MiB).
     *
     * @deprecated Prefer util.md5() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const digest = api.md5('payload');
     */
  static md5(payload: string): string;

  /**
     * Synchronous timing-safe comparison. Each input: at most 65536 bytes (UTF-8 for strings).
     *
     * @deprecated Prefer util.timingSafeEqual() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const match = api.timingSafeEqual(a, b);
     */
  static timingSafeEqual(a: string | Buffer, b: string | Buffer): boolean;

  /**
     * Synchronous HMAC signature. Payload: at most 5242880 bytes; secret: at most 65536 UTF-8 bytes.
     *
     * @deprecated Prefer util.hmac() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const signature = api.hmac('payload', secret, 'sha256', 'hex');
     */
  static hmac(
      payload: Uint8Array | string,
      secret: string,
      algorithm?: 'sha1' | 'sha256' | 'sha512',
      encoding?: 'hex' | 'base64',
    ): string;

  /**
     * Synchronous HMAC verification. Payload: at most 5242880 bytes; secret and signature: at most 65536 UTF-8 bytes each.
     *
     * @deprecated Prefer util.verifyHmacSignature() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const ok = api.verifyHmacSignature('payload', signature, secret);
     */
  static verifyHmacSignature(
      payload: Uint8Array | string,
      signature: string,
      secret: string,
      algorithm?: 'sha1' | 'sha256' | 'sha512',
      encoding?: 'hex' | 'base64',
    ): boolean;

  /**
     * Encodes base64url.
     *
     * @deprecated Prefer util.base64UrlEncode() for new code.
     *
     * Example:
     * const encoded = api.base64UrlEncode('payload');
     */
  static base64UrlEncode(input: Uint8Array | string): string;

  /**
     * Decodes base64url.
     *
     * @deprecated Prefer util.base64UrlDecode() for new code.
     *
     * Example:
     * const decoded = api.base64UrlDecode(tokenPart);
     */
  static base64UrlDecode(input: string): Uint8Array;

  /**
     * Synchronously generates random bytes as a string. Size: integer 0..65536 bytes before encoding.
     *
     * @deprecated Prefer util.randomBytes() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const bytes = api.randomBytes(16, 'hex');
     */
  static randomBytes(size?: number, encoding?: 'hex' | 'base64'): string;

  /**
     * Synchronously generates a random integer in the inclusive min..max range.
     * Bounds and max + 1 must be safe integers; range size must be smaller than 2^48.
     *
     * @deprecated Prefer util.randomInt() for new code.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const n = api.randomInt(1000, 9999);
     */
  static randomInt(min?: number, max?: number): number;

  /**
     * Generates a random string.
     *
     * @deprecated Prefer util.randomString() for new code.
     *
     * Length: integer 0..65536. Alphabet: 1..65536 UTF-16 code units.
     *
     * Example:
     * const token = api.randomString(24);
     */
  static randomString(length?: number, alphabet?: string): string;

  /**
     * Generates a numeric one-time code.
     *
     * @deprecated Prefer util.otp() for new code.
     *
     * Length: integer 0..65536.
     *
     * Example:
     * const code = api.otp(6);
     */
  static otp(length?: number): string;

  /**
     * Decodes a JWT without verifying it.
     *
     * @deprecated Prefer util.jwtDecode() for new code.
     *
     * Example:
     * const payload = api.jwtDecode(token);
     */
  static jwtDecode(
      token: string,
      options?: { complete?: boolean; json?: boolean },
    ): any;

  /**
     * Signs a JWT.
     *
     * @deprecated Prefer util.jwtSign() for new code.
     *
     * Example:
     * const token = api.jwtSign(
     *   { sub: 'c-1' },
     *   secret,
     *   { expiresIn: '1h' },
     * );
     */
  static jwtSign(
      payload: string | object,
      secret: string | { key: string; passphrase: string },
      options?: {
        algorithm?:
          | 'HS256'
          | 'HS384'
          | 'HS512'
          | 'RS256'
          | 'RS384'
          | 'RS512'
          | 'ES256'
          | 'ES384'
          | 'ES512'
          | 'PS256'
          | 'PS384'
          | 'PS512'
          | 'none';
        keyid?: string;
        expiresIn?: string | number;
        notBefore?: string | number;
        audience?: string | string[];
        subject?: string;
        issuer?: string;
        jwtid?: string;
        mutatePayload?: boolean;
        noTimestamp?: boolean;
        header?: JWTHeader;
        encoding?: string;
        allowInsecureKeySizes?: boolean;
        allowInvalidAsymmetricKeyTypes?: boolean;
      },
    ): string;

  /**
     * Verifies a JWT.
     *
     * @deprecated Prefer util.jwtVerify() for new code.
     *
     * Example:
     * const payload = api.jwtVerify(token, secret);
     */
  static jwtVerify(
      token: string,
      secret: string | { key: string; passphrase: string },
      options?: {
        algorithms?: (
          | 'HS256'
          | 'HS384'
          | 'HS512'
          | 'RS256'
          | 'RS384'
          | 'RS512'
          | 'ES256'
          | 'ES384'
          | 'ES512'
          | 'PS256'
          | 'PS384'
          | 'PS512'
          | 'none'
        )[];
        audience?: string | RegExp | Array<string | RegExp>;
        clockTimestamp?: number;
        clockTolerance?: number;
        complete?: boolean;
        issuer?: string | string[];
        ignoreExpiration?: boolean;
        ignoreNotBefore?: boolean;
        jwtid?: string;
        nonce?: string;
        subject?: string;
        maxAge?: string | number;
        allowInvalidAsymmetricKeyTypes?: boolean;
      },
    ): any;

  /**
     * Decrypts with RSA-OAEP and SHA-256 asynchronously. PEM import (including passphrase processing) still executes synchronously.
     *
     * @deprecated Prefer util.rsaDecrypt() for new code.
     *
     * Example:
     * const plain = await api.rsaDecrypt(privateKey, encrypted, passphrase);
     */
  static rsaDecrypt(
      privateKey: string,
      payload: string,
      passphrase?: string,
    ): Promise<string>;

  /**
     * Encrypts with RSA-OAEP and SHA-256 asynchronously. PEM import and data encoding still execute synchronously.
     *
     * @deprecated Prefer util.rsaEncrypt() for new code.
     *
     * Example:
     * const encrypted = await api.rsaEncrypt(publicKey, 'hello');
     */
  static rsaEncrypt(publicKey: string, payload: string): Promise<string>;

  /**
     * Generates an RSA key pair.
     *
     * @deprecated Prefer util.rsaGeneratePair() for new code.
     *
     * Asynchronous; modulusLength: multiple of 256 in 1024..4096; passphrase: at most 4096 code units.
     *
     * Example:
     * const pair = await api.rsaGeneratePair({ modulusLength: 2048 });
     */
  static rsaGeneratePair(config?: {
      modulusLength?: number;
      passphrase?: string;
    }): Promise<{ publicKey: string; privateKey: string }>;

  /**
     * Signs data with RSA-PSS and SHA-256 asynchronously. PEM import and input conversion can still occupy the event loop.
     *
     * @deprecated Prefer util.rsaSign() for new code.
     *
     * Example:
     * const signature = await api.rsaSign(privateKey, 'hello', passphrase);
     */
  static rsaSign(
      privateKey: string,
      payload: string,
      passphrase?: string,
    ): Promise<string>;

  /**
     * Verifies an RSA-PSS SHA-256 signature asynchronously, preserving automatic salt-length detection.
     *
     * @deprecated Prefer util.rsaVerify() for new code.
     *
     * Example:
     * const ok = await api.rsaVerify(publicKey, 'hello', signature);
     */
  static rsaVerify(
      publicKey: string,
      payload: string,
      signature: string,
    ): Promise<boolean>;
}

declare class storage {
  /**
     * Lists files and folders from the default `explorer` namespace.
     *
     * Example:
     * const listing = await storage.explore({ parentStorageEntryId: folderId });
     */
  static explore(query?: StorageExploreRequest): Promise<StorageExploreResult>;

  /**
     * Resolves an exact active folder path relative to the default `explorer` root.
     *
     * Notes:
     * - Matching is case-insensitive and follows each parent/name segment; this is not a broad term search.
     * - Leading and trailing slashes are optional.
     * - Missing, archived, deleted, or inaccessible paths fail without creating folders.
     *
     * Example:
     * const folder = await storage.resolveFolderPath('exports/daily');
     */
  static resolveFolderPath(path: string): Promise<StorageEntryView>;

  /**
     * Resolves a folder path and idempotently creates any missing segments.
     *
     * Notes:
     * - No-op in debug mode.
     * - Existing folders are never mutated.
     * - ACL options apply to every newly created segment.
     *
     * Example:
     * const folder = await storage.ensureFolderPath('exports/daily', {
     *   restricted: true,
     * });
     */
  static ensureFolderPath(
      path: string,
      options?: StorageEnsureFolderPathOptions,
    ): Promise<StorageEntryView>;

  /**
     * Returns metadata for a file entry. Without an explicit namespace the entry
     * is resolved by its globally unique id, matching the REST Storage API.
     *
     * Example:
     * const file = await storage.getFile(storageEntryId);
     */
  static getFile(
      storageEntryId: string,
      includeDeleted?: boolean,
    ): Promise<StorageEntryView>;

  /**
     * Reads storage file content.
     *
     * Notes:
     * - Use this storage API instead of deprecated legacy `api.getFile*` file reads.
     * - CSV/TSV, XLSX, NDJSON/JSONL, JSON arrays, and XML return structured pages with rows, headers, columns, and a cursor. Detection uses MIME or the supported file extension; XML requires recordPath.
     * - Other text file batch reads reuse cached line stats and auto-build them if missing.
     * - Binary reads return a base64 string.
     * - Direct binary reads are limited to 10 MiB unless you request a ranged buffer.
     *
     * Example:
     * const page = await storage.getFileData(storageEntryId, { sheet: 'Cennik' });
     */
  static getFileData(
      storageEntryId: string,
      options?: StorageFileReadOptions,
    ): Promise<StorageStructuredFileDataPage | string[] | string>;

  /**
     * Streams records into awaited callbacks. Omitted take scans all rows.
     * XLSX: first visible sheet by default. XML: recordPath required.
     * Defaults: batchSize=2000, readBatchSize=100000; both accept 1–100,000.
     * Source changes or callback errors stop the scan. Keep only aggregates.
     *
     * @example
     * let processed = 0;
     * await storage.walkFileData(storageEntryId, {}, async (rows) => {
     *   processed += rows.length;
     * }, { fullScan: true });
     * return { processed };
     */
  static walkFileData<T = any>(
      storageEntryId: string,
      read: StorageWalkReadOptions,
      callback: (rows: T[], context: StorageWalkContext) => void | Promise<void>,
      options?: StorageWalkOptions,
    ): Promise<StorageWalkResult>;

  /**
     * Builds reusable record or worksheet indexes and returns file statistics.
     *
     * Notes:
     * - Use this storage API instead of deprecated legacy `api.getFileStats` file stats.
     * - Derived stats are cached on the storage entry metadata for later batch reads.
     *
     * Example:
     * const stats = await storage.getFileStats(storageEntryId, {
     *   separator: '\n',
     *   batchSize: 5000,
     * });
     */
  static getFileStats(
      storageEntryId: string,
      options?: StorageFileStatsOptions,
    ): Promise<StorageFileStats>;

  /**
     * Returns metadata for any storage entry. Without an explicit namespace the
     * entry is resolved by its globally unique id, matching the REST Storage API.
     *
     * Example:
     * const entry = await storage.getEntry(storageEntryId);
     */
  static getEntry(
      storageEntryId: string,
      includeDeleted?: boolean,
    ): Promise<StorageEntryView>;

  /**
     * Creates a folder in the default `explorer` namespace.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const folder = await storage.createFolder({ name: 'Exports' });
     */
  static createFolder(data: StorageFolderInput): Promise<StorageEntryView>;

  /**
     * Uploads a small object in one request in the default `explorer` namespace.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const file = await storage.putObject({
     *   name: 'summary.md',
     *   data: '# Daily summary',
     *   mimeType: 'text/markdown',
     *   computeStats: 'sync',
     * });
     */
  static putObject(data: StorageBinaryPutObjectInput): Promise<StorageEntryView>;

  /**
     * Opens an upload session for a file in the default `explorer` namespace.
     *
     * Notes:
     * - No-op in debug mode.
     * - A session is a temporary, durable upload control record. It reserves the
     *   intended file name and destination, stores upload policy, ACL, retention,
     *   schema, and progress, but it is not a readable Storage file. The durable
     *   entry exists only after the session reaches `FINALIZED`.
     * - `uploadMode` controls how bytes arrive. `direct` returns a temporary
     *   upload target for the complete file. `chunked` accepts caller-numbered
     *   parts. `incremental` assigns part numbers by default and also accepts an
     *   explicit number for repair. `writeMode` is independent: it controls only
     *   CSV/XLSX row materialization (`staged` or declared-schema `direct`).
     * - Use this instead of `storage.appendFile(...)`. Managed direct uploads are
     *   finalized automatically after Storage confirms the transfer; observe the
     *   session until `FINALIZED` and do not call `finalizeUploadSession` for that
     *   path. Explicitly finalize chunked and incremental sessions.
     * - Structured CSV/TSV and XLSX sessions default to `computeStats: 'sync'` so
     *   byte maps, row indexes, and file stats are ready after finalize. Text
     *   `text/*` upload sessions also default to `sync`; other binary sessions
     *   default to `none`. An explicit compute mode always overrides the
     *   default. The `staged` XLSX path may still persist its reusable index when
     *   `none` is explicit; structured `direct` with `none` skips it.
     *   Both default to `writeMode: 'staged'`.
     * - XLSX, CSV, and TSV share `schemaPolicy` plus
     *   `sheets[].table.columns[]`. CSV/TSV has one logical sheet. Column types
     *   are string, number, boolean, date, and object; object parses only a JSON
     *   object or array. The default fallback policy leaves an incompatible whole
     *   column as strings and records diagnostics without replacing cells with
     *   null. Strict preserves the raw file but structured indexing fails with
     *   STORAGE_TABULAR_SCHEMA_MISMATCH. Styles never infer column types.
     * - Set `restricted: true` with explicit `users` and/or `groups` to define
     *   the finalized entry ACL. These relations may be changed later with
     *   `storage.updateEntry(...)`; `restricted: false` clears them.
     *   Use `writeMode: 'direct'` for configured CSV/XLSX row exports with a
     *   declared schema. For XLSX, declare every worksheet
     *   with a non-empty `table.columns` before appending; direct XLSX parts are
     *   row-only and cannot contain `cells`. Use the default `staged` mode when
     *   append requests can be retried, replaced, reordered, or need inferred
     *   columns, sparse cells, formulas, or dynamic worksheets.
     *   A single `sheets` part can append rows to multiple declared worksheets.
     *   Staged mode is the durable default for independent requests that may be
     *   retried, replaced, reordered, or use inferred columns, sparse cells,
     *   formulas, or dynamic worksheets.
     *
     * @example direct upload
     * const { session, upload } = await storage.createUploadSession({
     *   name: 'notes.txt', contentTypeHint: 'text/plain', uploadMode: 'direct',
     * });
     * return { sessionId: session.storageUploadSessionId, upload };
     * // The client uploads with upload.method/headers/uploadUrl, then polls the
     * // session. Managed direct uploads finalize automatically.
     *
     * @example declared-schema XLSX
     * const declared = await storage.createUploadSession({
     *   name: 'report.xlsx',
     *   contentTypeHint: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     *   uploadMode: 'incremental', writeMode: 'direct',
     *   sheets: [{ name: 'Report', table: { columns: [
     *     { key: 'productId', header: 'Product ID' },
     *     { key: 'price', header: 'Price', type: 'number' },
     *   ] } }],
     * });
     * await storage.uploadPart(declared.session.storageUploadSessionId, {
     *   rows: [{ productId: 'P-1', price: 12.5 }],
     * });
     * // Append row-only parts according to the declared schema, then finalize.
     * const result = await storage.finalizeUploadSession(
     *   declared.session.storageUploadSessionId,
     * );
     *
     * Example (server-mediated row parts):
     * const upload = await storage.createUploadSession({
     *   name: 'report.xlsx',
     *   contentTypeHint: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     *   uploadMode: 'incremental',
     *   sheets: [{ name: 'Report', table: { autoFilter: true } }],
     * });
     * await storage.uploadPart(upload.session.storageUploadSessionId, {
     *   rows: [{ productId: 'P-1', price: 12.5 }],
     * });
     * const result = await storage.finalizeUploadSession(
     *   upload.session.storageUploadSessionId,
     * );
     */
  static createUploadSession(
      data: StorageUploadSessionInput,
    ): Promise<{ session: StorageUploadSession; upload: StorageUploadTarget }>;

  /**
     * Extends the TTL for an active upload session.
     *
     * Notes:
     * - No-op in debug mode.
     * - uploadPart renews the durable session lease automatically; call this only across idle gaps.
     *
     * Example:
     * const session = await storage.extendUploadSession(storageUploadSessionId);
     */
  static extendUploadSession(
      storageUploadSessionId: string,
    ): Promise<StorageUploadSession>;

  /**
     * Returns the current upload session state together with uploaded part manifests.
     *
     * Notes:
     * - No-op in debug mode.
     * - Multipart sessions expose uploaded parts with computed byte ranges.
     *
     * Example:
     * const state = await storage.getUploadSession(storageUploadSessionId);
     */
  static getUploadSession(
      storageUploadSessionId: string,
    ): Promise<StorageUploadSessionView>;

  /**
     * Uploads one part into an active multipart upload session.
     *
     * Notes:
     * - No-op in debug mode.
     * - Renews the durable session lease before processing and after committing the part.
     * - Accepted part manifests remain durable across worker restarts.
     *
     * Example:
     * await storage.uploadPart(storageUploadSessionId, 2, {
     *   data: nextChunk,
     *   dataEncoding: 'utf8',
     * });
     *
     * Example (incremental numbering):
     * await storage.uploadPart(storageUploadSessionId, {
     *   data: nextChunk,
     *   dataEncoding: 'utf8',
     * });
     *
     * Example (repair a specific multipart chunk):
     * await storage.uploadPart(storageUploadSessionId, 7, {
     *   data: repairedChunk,
     *   dataEncoding: 'utf8',
     * });
     */
  static uploadPart(
      storageUploadSessionId: string,
      partNumber: number | StorageBinaryUploadPartInput,
      data?: StorageBinaryUploadPartInput,
    ): Promise<StorageUploadPartResult>;

  /**
     * Finalizes a chunked or incremental upload session and materializes the
     * Storage entry. Managed direct uploads finalize automatically and should be
     * observed with `getUploadSession()` instead of calling this method.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const result = await storage.finalizeUploadSession(storageUploadSessionId);
     */
  static finalizeUploadSession(
      storageUploadSessionId: string,
      data?: StorageUploadSessionFinalizeInput,
    ): Promise<{ session: StorageUploadSession; entry: StorageEntryView; fileStats?: StorageFileStats }>;

  /**
     * Cancels an active upload session.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await storage.abortUploadSession(storageUploadSessionId);
     */
  static abortUploadSession(
      storageUploadSessionId: string,
    ): Promise<StorageUploadSession>;

  /**
     * Updates mutable storage entry fields such as name, metadata, or ACLs.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const entry = await storage.updateEntry(storageEntryId, {
     *   name: 'report-final.csv',
     *   version: currentVersion,
     * });
     */
  static updateEntry(
      storageEntryId: string,
      data: StorageEntryUpdateInput,
    ): Promise<StorageEntryView>;

  /**
     * Moves an entry to another folder or registered Storage root.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const entry = await storage.moveEntry(storageEntryId, {
     *   parentStorageEntryId: destinationFolderId,
     *   version: currentVersion,
     * });
     */
  static moveEntry(
      storageEntryId: string,
      data: StorageEntryMoveInput,
    ): Promise<StorageEntryView>;

  /**
     * Archives an entry without deleting its backing object.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const entry = await storage.archiveEntry(storageEntryId, { version: currentVersion });
     */
  static archiveEntry(
      storageEntryId: string,
      data: StorageVersionInput,
    ): Promise<StorageEntryView>;

  /**
     * Restores an archived or deleted storage entry.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const entry = await storage.restoreEntry(storageEntryId, { version: currentVersion });
     */
  static restoreEntry(
      storageEntryId: string,
      data: StorageRestoreInput,
    ): Promise<StorageEntryView>;

  /**
     * Soft-deletes a storage entry.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const entry = await storage.deleteEntry(storageEntryId, { version: currentVersion });
     */
  static deleteEntry(
      storageEntryId: string,
      data: StorageVersionInput,
    ): Promise<StorageEntryView>;

  /**
     * Generates a signed download URL for a storage file. Without an explicit
     * namespace the entry is resolved by its globally unique id, matching REST.
     *
     * Example:
     * const download = await storage.getDownload(storageEntryId, true);
     */
  static getDownload(
      storageEntryId: string,
      preview?: boolean,
    ): Promise<StorageDownload>;

  /**
     * @deprecated Use storage.getDocument(storageEntryId, { format: "text", startLine, endLine, maxChars }).
     * Delegates to the document reader and preserves the original text-window result.
     *
     * Example:
     * const excerpt = await storage.getText(storageEntryId, {
     *   startLine: 1,
     *   endLine: 50,
     * });
     */
  static getText(
      storageEntryId: string,
      options?: StorageTextReadOptions,
    ): Promise<StorageTextContent>;

  /** @deprecated Use storage.getDocument with text line options. */
  static getText(
      namespace: string,
      storageEntryId: string,
      options?: StorageTextReadOptions,
    ): Promise<StorageTextContent>;

  /**
     * Reads bounded text, JSON, XML, or PDF/DOCX text from Storage. PDF/DOCX
     * extraction is text-only, capped at 40,000 characters and 100 PDF pages,
     * with explicit extraction/truncation and possible-OCR metadata. Source input
     * is limited to 10 MiB; use getFileData for XLSX or record-oriented files.
     *
     * `format: 'text'` is the default and supports optional byte ranges.
     * For text line windows pass startLine/endLine/maxChars; the result contains
     * line metadata instead of byte offsets. Do not mix line and byte ranges.
     * `format: 'json'` returns `document` from JSON.parse; `format: 'xml'`
     * returns an order-preserving XML representation. `format: 'auto'` selects
     * JSON/XML from the stored MIME type or file extension.
     *
     * @example
     * const doc = await storage.getDocument(storageEntryId, { format: 'auto' });
     * return doc.document ?? doc.content;
     */
  static getDocument(
      storageEntryId: string,
      options?: StorageDocumentReadOptions,
    ): Promise<StorageDocument>;
}

declare class transport {
  /**
     * Streams a remote path into Storage, then finalizes it using storage.* namespace/ACL rules.
     * Uses `transport` Secret formats and optional host-key pinning.
     * Automatic execution.log: details.source identifies the call;
     * details.error carries code/retryable/resource/reference/statusCode.
     * runtimeError may expose the same failure/source metadata.
     *
     * Example:
     * const imported = await transport.sftpImport('/incoming/daily.csv', {
     *   name: 'daily.csv', parentStorageEntryId: folderId, computeStats: 'sync',
     * }, 'SFTP_PRODUCTION');
     */
  static sftpImport(
      path: string,
      storage: SFTPImportStorage,
      secretNameOrId: string,
    ): Promise<{ session: StorageUploadSession; entry: StorageEntryView }>;

  /**
     * Streams Storage to a remote path using storage.* namespace/ACL rules.
     * Automatic execution.log includes details.source, details.error and telemetry.transfer.
     *
     * Example:
     * await transport.sftpExport('/outgoing/daily.csv', { storageEntryId }, 'SFTP_PRODUCTION');
     */
  static sftpExport(
      path: string,
      storage: SFTPExportStorage,
      secretNameOrId: string,
    ): Promise<void>;

  /**
     * Runs allowed file commands in one leased SFTP session, without a remote shell.
     * Automatic execution.log identifies the call in details.source.
     * Inspect command errors even when batch HTTP succeeds.
     */
  static sftpCommands(
      commands: any[],
      secretNameOrId: string,
    ): Promise<any>;
}

declare class agent {
  /**
     * Lists agents visible to the current execution context.
     *
     * Example:
     * const agents = await agent.list();
     */
  static list(): Promise<Agent[]>;

  /**
     * Returns one agent by id.
     *
     * Example:
     * const one = await agent.get(agentId);
     */
  static get(agentId: string): Promise<Agent>;

  /**
     * Creates a new agent. The server creates agentId, status, managed workspace,
     * timestamps, and version; supply an existing service-account user id only.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const created = await agent.create({
     *   name: 'Ops copilot',
     *   serviceAccountUserId: userId,
     * });
     */
  static create(data: AgentCreateInput): Promise<Agent>;

  /**
     * Updates mutable agent fields such as config, policy, or profile.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const updated = await agent.update(agentId, {
     *   desc: 'Handles operational runbooks.',
     * });
     */
  static update(agentId: string, data: AgentUpdateInput): Promise<Agent>;

  /**
     * Lists queued and historical inbox items for an agent.
     *
     * Example:
     * const inbox = await agent.listInbox(agentId);
     */
  static listInbox(agentId: string): Promise<AgentInboxItem[]>;

  /**
     * Returns one inbox item for an agent.
     *
     * Example:
     * const item = await agent.getInboxItem(agentId, agentInboxItemId);
     */
  static getInboxItem(
      agentId: string,
      agentInboxItemId: string,
    ): Promise<AgentInboxItem>;

  /**
     * Enqueues a new inbox item for an agent.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const item = await agent.pushInbox(agentId, {
     *   instruction: 'Review failed deploy logs.',
     * });
     */
  static pushInbox(
      agentId: string,
      data: AgentInboxItemCreateInput,
    ): Promise<AgentInboxItem>;

  /**
     * Updates an existing inbox item.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const item = await agent.updateInboxItem(agentId, agentInboxItemId, {
     *   instruction: 'Review the updated deployment evidence.',
     * });
     */
  static updateInboxItem(
      agentId: string,
      agentInboxItemId: string,
      data: AgentInboxItemUpdateInput,
    ): Promise<AgentInboxItem>;

  /**
     * Removes an inbox item.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await agent.removeInboxItem(agentId, agentInboxItemId);
     */
  static removeInboxItem(
      agentId: string,
      agentInboxItemId: string,
    ): Promise<AgentInboxItem>;

  /**
     * Lists agent plugins configured for an agent.
     *
     * Example:
     * const tools = await agent.listPlugins(agentId);
     */
  static listPlugins(agentId: string): Promise<AgentPlugin[]>;

  /**
     * Returns one agent plugin definition for an agent.
     *
     * Example:
     * const tool = await agent.getPlugin(agentId, toolId);
     */
  static getPlugin(
      agentId: string,
      toolId: string,
    ): Promise<AgentPlugin>;

  /**
     * Lists runs for an agent.
     *
     * Example:
     * const runs = await agent.listRuns(agentId);
     */
  static listRuns(agentId: string): Promise<AgentRun[]>;

  /**
     * Returns one agent run.
     *
     * Example:
     * const run = await agent.getRun(agentRunId);
     */
  static getRun(agentRunId: string): Promise<AgentRun>;

  /**
     * Lists persisted events for a run.
     *
     * Example:
     * const events = await agent.listRunEvents(agentRunId);
     */
  static listRunEvents(agentRunId: string): Promise<AgentRunEvent[]>;

  /**
     * Lists assistant threads associated with a run.
     *
     * Example:
     * const threads = await agent.listRunThreads(agentRunId);
     */
  static listRunThreads(agentRunId: string): Promise<AgentRunThread[]>;

  /**
     * Starts a new agent run.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const run = await agent.startRun(agentId, {
     *   instruction: 'Summarize today\\'s alerts.',
     * });
     */
  static startRun(agentId: string, data: AgentRunInput): Promise<AgentRun>;

  /**
     * Resumes a paused run.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const run = await agent.resumeRun(agentRunId);
     */
  static resumeRun(agentRunId: string): Promise<AgentRun>;

  /**
     * Retries a failed or completed run from its retry policy.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const run = await agent.retryRun(agentRunId);
     */
  static retryRun(agentRunId: string): Promise<AgentRun>;

  /**
     * Forces one autonomous tick for a run.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const run = await agent.tickRun(agentRunId);
     */
  static tickRun(agentRunId: string): Promise<AgentRun>;

  /**
     * Cancels a run, optionally recording a reason.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const run = await agent.cancelRun(agentRunId, { reason: 'Operator stop' });
     */
  static cancelRun(
      agentRunId: string,
      data?: AgentRunCancelInput,
    ): Promise<AgentRun>;

  /**
     * Reconciles stalled runs with the loop scheduler.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await agent.reconcileRuns();
     */
  static reconcileRuns(): Promise<any>;

  /**
     * Lists assistant threads visible through the agent helper.
     *
     * Example:
     * const threads = await agent.listThreads({ take: 20 });
     */
  static listThreads(
      query?: Record<string, any>,
    ): Promise<CollectionResult<AssistantThread>>;

  /**
     * Returns one assistant thread.
     *
     * Example:
     * const thread = await agent.getThread(assistantThreadId);
     */
  static getThread(
      assistantThreadId: string,
      options?: { hideDeleted?: boolean },
    ): Promise<AssistantThread>;

  /**
     * Returns the hidden runtime planning state for a thread.
     *
     * Example:
     * const state = await agent.getThreadState(assistantThreadId);
     */
  static getThreadState(
      assistantThreadId: string,
    ): Promise<AssistantThreadState>;

  /**
     * Returns the current share state for a thread owned by the current user.
     *
     * Example:
     * const share = await agent.getThreadShare(assistantThreadId);
     */
  static getThreadShare(
      assistantThreadId: string,
    ): Promise<AssistantThreadShare | null>;

  /**
     * Creates or re-enables a stable share link for a thread owned by the current user.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const share = await agent.enableThreadShare(assistantThreadId);
     */
  static enableThreadShare(
      assistantThreadId: string,
    ): Promise<AssistantThreadShare>;

  /**
     * Disables the stable share link for a thread owned by the current user.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await agent.disableThreadShare(assistantThreadId);
     */
  static disableThreadShare(
      assistantThreadId: string,
    ): Promise<AssistantThreadShare>;

  /**
     * Returns a read-only shared thread by share ID.
     *
     * Example:
     * const shared = await agent.getSharedThread(shareId);
     */
  static getSharedThread(
      shareId: string,
    ): Promise<AssistantSharedThreadResponse>;

  /**
     * Lists visible messages for a shared thread.
     *
     * Example:
     * const messages = await agent.listSharedThreadMessages(shareId, { take: 50 });
     */
  static listSharedThreadMessages(
      shareId: string,
      query?: Record<string, any>,
    ): Promise<CollectionResult<AssistantMessage>>;

  /**
     * Returns sanitized execution details for a visible shared-thread message.
     *
     * Example:
     * const details = await agent.getSharedThreadMessageExecutionDetails(shareId, assistantMessageId);
     */
  static getSharedThreadMessageExecutionDetails(
      shareId: string,
      assistantMessageId: string,
    ): Promise<Record<string, any>>;

  /**
     * Returns one sanitized artifact for a visible shared-thread message.
     *
     * Example:
     * const artifact = await agent.getSharedThreadMessageArtifact(shareId, assistantMessageId, artifactId);
     */
  static getSharedThreadMessageArtifact(
      shareId: string,
      assistantMessageId: string,
      artifactId: string,
    ): Promise<Record<string, any>>;

  /**
     * Forks a shared thread from a selected visible message.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const fork = await agent.forkSharedThreadMessage(shareId, assistantMessageId);
     */
  static forkSharedThreadMessage(
      shareId: string,
      assistantMessageId: string,
      data?: AssistantForkMessageInput,
    ): Promise<AssistantThreadResponse>;

  /**
     * Creates a new assistant thread and first message.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const response = await agent.createThread({ content: 'Draft a release note.' });
     */
  static createThread(
      data: AssistantMessageInput,
    ): Promise<AssistantThreadResponse>;

  /**
     * Soft-deletes a thread.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await agent.deleteThread(assistantThreadId);
     */
  static deleteThread(assistantThreadId: string): Promise<void>;

  /**
     * Restores a deleted thread.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await agent.restoreThread(assistantThreadId);
     */
  static restoreThread(assistantThreadId: string): Promise<void>;

  /**
     * Lists visible messages for a thread.
     *
     * Example:
     * const messages = await agent.listThreadMessages(assistantThreadId, { take: 50 });
     */
  static listThreadMessages(
      assistantThreadId: string,
      query?: Record<string, any>,
    ): Promise<CollectionResult<AssistantMessage>>;

  /**
     * Sends a new message into an existing thread.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const response = await agent.sendMessage(assistantThreadId, {
     *   content: 'Continue with the rollout checklist.',
     * });
     */
  static sendMessage(
      assistantThreadId: string,
      data: AssistantMessageInput,
    ): Promise<AssistantThreadResponse>;

  /**
     * Retries one assistant message.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const response = await agent.retryMessage(assistantThreadId, assistantMessageId);
     */
  static retryMessage(
      assistantThreadId: string,
      assistantMessageId: string,
    ): Promise<AssistantThreadResponse>;

  /**
     * Cancels in-flight work on a thread.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * await agent.cancelThread(assistantThreadId, thread.version);
     */
  static cancelThread(assistantThreadId: string, expectedVersion: number): Promise<void>;

  /**
     * Forks a thread from a selected message.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const fork = await agent.forkMessage(assistantThreadId, assistantMessageId);
     */
  static forkMessage(
      assistantThreadId: string,
      assistantMessageId: string,
      data?: AssistantForkMessageInput,
    ): Promise<AssistantThreadResponse>;

  /**
     * Renames a thread.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const thread = await agent.renameThread(assistantThreadId, {
     *   title: 'Postmortem draft',
     * });
     */
  static renameThread(
      assistantThreadId: string,
      data: AssistantThreadTitleInput,
    ): Promise<AssistantThread>;

  /**
     * Resolves an action-required checkpoint with an explicit payload.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const response = await agent.resolveAction(assistantThreadId, actionId, {
     *   decision: 'approve',
     * });
     */
  static resolveAction(
      assistantThreadId: string,
      assistantActionRequiredId: string,
      data: AssistantActionResolutionInput,
    ): Promise<AssistantThreadResponse>;

  /**
     * Approves an action-required checkpoint.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const response = await agent.approveAction(assistantThreadId, actionId);
     */
  static approveAction(
      assistantThreadId: string,
      assistantActionRequiredId: string,
      options?: Omit<AssistantActionResolutionInput, 'decision'>,
    ): Promise<AssistantThreadResponse>;

  /**
     * Rejects an action-required checkpoint.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const response = await agent.rejectAction(assistantThreadId, actionId, {
     *   responseText: 'Need a narrower scope.',
     * });
     */
  static rejectAction(
      assistantThreadId: string,
      assistantActionRequiredId: string,
      options?: Omit<AssistantActionResolutionInput, 'decision'>,
    ): Promise<AssistantThreadResponse>;

  /**
     * Submits operator input for an action-required checkpoint.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const response = await agent.submitAction(assistantThreadId, actionId, {
     *   responsePayload: { selectedPlanId: 'plan-1' },
     * });
     */
  static submitAction(
      assistantThreadId: string,
      assistantActionRequiredId: string,
      options?: Omit<AssistantActionResolutionInput, 'decision'>,
    ): Promise<AssistantThreadResponse>;

  /**
     * Triggers thread compaction.
     *
     * Notes:
     * - No-op in debug mode.
     *
     * Example:
     * const thread = await agent.compactThread(assistantThreadId, {
     *   force: true,
     * });
     */
  static compactThread(
      assistantThreadId: string,
      options?: AssistantThreadCompactionRequest,
    ): Promise<AssistantThread>;
}

declare class util {
  /**
     * Waits asynchronously, capped at 60 seconds per call.
     *
     * Example:
     * await util.sleep(250);
     */
  static sleep(ms: number): Promise<void>;

  /**
     * AES decrypt helper.
     *
     * Ciphertext: at most 5592464 base64 characters; passphrase: at most 4096 UTF-16 code units.
     *
     * Example:
     * const plain = await util.aesDecrypt(encrypted, passphrase);
     */
  static aesDecrypt(encrypted: string, passphrase: string): Promise<string>;

  /**
     * AES encrypt helper.
     *
     * Payload: at most 1048576 UTF-16 code units; passphrase: at most 4096.
     *
     * Example:
     * const encrypted = await util.aesEncrypt('secret', passphrase);
     */
  static aesEncrypt(payload: string, passphrase: string): Promise<string>;

  /**
     * Compares a value against a password hash.
     *
     * Password: at most 4096 UTF-16 code units; unsupported scrypt work factors return false.
     *
     * Example:
     * const valid = await util.compareHash(password, hash);
     */
  static compareHash(
      password: string | undefined,
      hash: string | undefined,
    ): Promise<boolean>;

  /**
     * Checks whether a value is base64.
     *
     * Example:
     * const ok = util.isBase64(value);
     */
  static isBase64(input: any): boolean;

  /**
     * Decodes a base64 string.
     *
     * Example:
     * const text = util.decodeBase64(base64String);
     */
  static decodeBase64(base64String: string): string;

  /**
     * Encodes a string to base64.
     *
     * Example:
     * const encoded = util.encodeBase64('hello');
     */
  static encodeBase64(plainString: string): string;

  /**
     * Generates a password hash.
     *
     * Password: at most 4096 UTF-16 code units.
     *
     * Example:
     * const hash = await util.generateHash(password, 10);
     */
  static generateHash(
      password: string | undefined,
      rounds?: number,
    ): Promise<string>;

  /**
     * Validates UUID shape.
     *
     * @deprecated Prefer util.isUUID() for new code.
     *
     * Example:
     * const ok = util.isUuid(value);
     */
  static isUuid(input: any): boolean;

  /**
     * Validates UUID shape.
     *
     * Example:
     * const ok = util.isUUID(value);
     */
  static isUUID(input: any): boolean;

  /**
     * Generates a random UUIDv7.
     *
     * @deprecated Prefer util.randomUUID() for new code.
     *
     * Example:
     * const id = util.generateUuid();
     */
  static generateUuid(): string;

  /**
     * Generates a random UUIDv7.
     *
     * Example:
     * const id = util.randomUUID();
     */
  static randomUUID(): string;

  /**
     * Returns a random UUIDv7 with no arguments, or a deterministic UUIDv5 only when
     * both value and namespace are supplied. Do not generate IDs for server-created
     * platform resources; use this only for caller-owned data values.
     *
     * Example:
     * const id = util.getUUID('customer-1', 'customers');
     */
  static getUUID(...args: [] | [value: string, namespace: string]): string;

  /**
     * Creates a stable hash from an object.
     *
     * Example:
     * const hash = util.hashObject({ customerId: 'c-1' });
     */
  static hashObject(object: any): string;

  /**
     * Synchronous SHA-1 hash. Payload: at most 5242880 UTF-8 bytes (5 MiB).
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const digest = util.sha1('payload');
     */
  static sha1(payload: string): string;

  /**
     * Synchronous SHA-256 hash. Payload: at most 5242880 UTF-8 bytes (5 MiB).
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const digest = util.sha256('payload');
     */
  static sha256(payload: string): string;

  /**
     * Synchronous MD5 hash. Payload: at most 5242880 UTF-8 bytes (5 MiB).
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const digest = util.md5('payload');
     */
  static md5(payload: string): string;

  /**
     * Synchronous timing-safe comparison. Each input: at most 65536 bytes (UTF-8 for strings).
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const match = util.timingSafeEqual(a, b);
     */
  static timingSafeEqual(a: string | Buffer, b: string | Buffer): boolean;

  /**
     * Synchronous HMAC signature. Payload: at most 5242880 bytes; secret: at most 65536 UTF-8 bytes.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const signature = util.hmac('payload', secret, 'sha256', 'hex');
     */
  static hmac(
      payload: Uint8Array | string,
      secret: string,
      algorithm?: 'sha1' | 'sha256' | 'sha512',
      encoding?: 'hex' | 'base64',
    ): string;

  /**
     * Synchronous HMAC verification. Payload: at most 5242880 bytes; secret and signature: at most 65536 UTF-8 bytes each.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const ok = util.verifyHmacSignature('payload', signature, secret);
     */
  static verifyHmacSignature(
      payload: Uint8Array | string,
      signature: string,
      secret: string,
      algorithm?: 'sha1' | 'sha256' | 'sha512',
      encoding?: 'hex' | 'base64',
    ): boolean;

  /**
     * Encodes base64url.
     *
     * Example:
     * const encoded = util.base64UrlEncode('payload');
     */
  static base64UrlEncode(input: Uint8Array | string): string;

  /**
     * Decodes base64url.
     *
     * Example:
     * const decoded = util.base64UrlDecode(tokenPart);
     */
  static base64UrlDecode(input: string): Uint8Array;

  /**
     * Synchronously generates random bytes as a string. Size: integer 0..65536 bytes before encoding.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const bytes = util.randomBytes(16, 'hex');
     */
  static randomBytes(size?: number, encoding?: 'hex' | 'base64'): string;

  /**
     * Synchronously generates a random integer in the inclusive min..max range.
     * Bounds and max + 1 must be safe integers; range size must be smaller than 2^48.
     *
     * Invalid types/options throw TypeError; size/range throws RangeError.
     *
     * Example:
     * const n = util.randomInt(1000, 9999);
     */
  static randomInt(min?: number, max?: number): number;

  /**
     * Generates a random string.
     *
     * Length: integer 0..65536. Alphabet: 1..65536 UTF-16 code units.
     *
     * Example:
     * const token = util.randomString(24);
     */
  static randomString(length?: number, alphabet?: string): string;

  /**
     * Generates a numeric one-time code.
     *
     * Length: integer 0..65536.
     *
     * Example:
     * const code = util.otp(6);
     */
  static otp(length?: number): string;

  /**
     * Validates a payload with the platform schema validator used by Endpoints.
     *
     * Notes:
     * - Prefer enum/const, types, lengths, numeric bounds and supported date/time formats over regex when equivalent.
     * - Use regex only for a required text pattern; even simple patterns can materially increase Endpoint guard preparation time.
     * - Use profile: 'strict' for new schemas; omitted profiles retain legacy behavior.
     * - required controls presence, nullable controls null, and empty controls empty strings and arrays.
     * - Use additionalProperties: 'allow', 'strip' or 'reject' for unknown fields.
     * - Legacy whitelist: true retains unknown fields. With whitelist: false, whitelistErrors: false removes them; true reports errors.
     * - The result contains valid, errors, issues and value. Structured issues expose code, path, message and optional params.
     * - After success, use value so configured field removal is respected.
     * - Input, schema and execution limits apply; cyclic data is rejected. Capacity or execution failures can reject the Promise.
     *
     * Example:
     * const result = await util.validate(
     *   api.input()?.body,
     *   {
     *     profile: 'strict',
     *     additionalProperties: 'reject',
     *     schema: {
     *       type: 'object',
     *       required: true,
     *       objectSchema: [
     *         { property: 'status', schema: { type: 'string', required: true, enum: ['pending', 'ready'] } },
     *       ],
     *     },
     *   },
     * );
     * if (!result.valid) throw new Error('Invalid request');
     * const validatedInput = result.value;
     */
  static validate(
      payload: any,
      schema: ValidatorSchemaInput,
    ): Promise<ValidationResult<any>>;

  /**
     * Decodes a JWT without verifying it.
     *
     * Example:
     * const payload = util.jwtDecode(token);
     */
  static jwtDecode(
      token: string,
      options?: { complete?: boolean; json?: boolean },
    ): any;

  /**
     * Signs a JWT.
     *
     * Example:
     * const token = util.jwtSign(
     *   { sub: 'c-1' },
     *   secret,
     *   { expiresIn: '1h' },
     * );
     */
  static jwtSign(
      payload: string | object,
      secret: string | { key: string; passphrase: string },
      options?: {
        algorithm?:
          | 'HS256'
          | 'HS384'
          | 'HS512'
          | 'RS256'
          | 'RS384'
          | 'RS512'
          | 'ES256'
          | 'ES384'
          | 'ES512'
          | 'PS256'
          | 'PS384'
          | 'PS512'
          | 'none';
        keyid?: string;
        expiresIn?: string | number;
        notBefore?: string | number;
        audience?: string | string[];
        subject?: string;
        issuer?: string;
        jwtid?: string;
        mutatePayload?: boolean;
        noTimestamp?: boolean;
        header?: JWTHeader;
        encoding?: string;
        allowInsecureKeySizes?: boolean;
        allowInvalidAsymmetricKeyTypes?: boolean;
      },
    ): string;

  /**
     * Verifies a JWT.
     *
     * Example:
     * const payload = util.jwtVerify(token, secret);
     */
  static jwtVerify(
      token: string,
      secret: string | { key: string; passphrase: string },
      options?: {
        algorithms?: (
          | 'HS256'
          | 'HS384'
          | 'HS512'
          | 'RS256'
          | 'RS384'
          | 'RS512'
          | 'ES256'
          | 'ES384'
          | 'ES512'
          | 'PS256'
          | 'PS384'
          | 'PS512'
          | 'none'
        )[];
        audience?: string | RegExp | Array<string | RegExp>;
        clockTimestamp?: number;
        clockTolerance?: number;
        complete?: boolean;
        issuer?: string | string[];
        ignoreExpiration?: boolean;
        ignoreNotBefore?: boolean;
        jwtid?: string;
        nonce?: string;
        subject?: string;
        maxAge?: string | number;
        allowInvalidAsymmetricKeyTypes?: boolean;
      },
    ): any;

  /**
     * Decrypts with RSA-OAEP and SHA-256 asynchronously. PEM import (including passphrase processing) still executes synchronously.
     *
     * Example:
     * const plain = await util.rsaDecrypt(privateKey, encrypted, passphrase);
     */
  static rsaDecrypt(
      privateKey: string,
      payload: string,
      passphrase?: string,
    ): Promise<string>;

  /**
     * Encrypts with RSA-OAEP and SHA-256 asynchronously. PEM import and data encoding still execute synchronously.
     *
     * Example:
     * const encrypted = await util.rsaEncrypt(publicKey, 'hello');
     */
  static rsaEncrypt(publicKey: string, payload: string): Promise<string>;

  /**
     * Generates an RSA key pair.
     *
     * Asynchronous; modulusLength: multiple of 256 in 1024..4096; passphrase: at most 4096 code units.
     *
     * Example:
     * const pair = await util.rsaGeneratePair({ modulusLength: 2048 });
     */
  static rsaGeneratePair(config?: {
      modulusLength?: number;
      passphrase?: string;
    }): Promise<{ publicKey: string; privateKey: string }>;

  /**
     * Signs data with RSA-PSS and SHA-256 asynchronously. PEM import and input conversion can still occupy the event loop.
     *
     * Example:
     * const signature = await util.rsaSign(privateKey, 'hello', passphrase);
     */
  static rsaSign(
      privateKey: string,
      payload: string,
      passphrase?: string,
    ): Promise<string>;

  /**
     * Verifies an RSA-PSS SHA-256 signature asynchronously, preserving automatic salt-length detection.
     *
     * Example:
     * const ok = await util.rsaVerify(publicKey, 'hello', signature);
     */
  static rsaVerify(
      publicKey: string,
      payload: string,
      signature: string,
    ): Promise<boolean>;
}
