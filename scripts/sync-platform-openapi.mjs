#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sourceSnapshotPath = join(root, 'api-reference', 'source', 'platform.openapi.json');
export const publicOpenApiPath = join(root, 'api-reference', 'openapi.json');

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'options', 'head']);
const PUBLIC_PATH_PREFIX = '/api/v1/';
const PUBLIC_JOB_TIMEOUT_MAX_SECONDS = 3540;
const PUBLIC_JOB_MEMORY_MAX_MIB = 2048;
const PUBLIC_EXTENSION_KEYS = new Set(['x-revo-safety-tier']);
const PUBLIC_STANDALONE_SCHEMA_NAMES = new Set([
  'JobTemplateRequestDto',
  'UpdateJobTemplate',
  'JobOptionsDto',
]);
const PUBLIC_SCHEMA_PROPERTIES = Object.freeze({
  AssistantAppPreferencesDto: ['hideReasoning', 'reasoning', 'workMode', 'persona', 'customInstructions'],
  AssistantThreadReportDto: ['reason', 'summary'],
  CreateMessageDto: ['content', 'preflightMessageId', 'model', 'reasoningEffort', 'reasoning', 'backgroundProcessing', 'interruptActive', 'goal', 'executionMode', 'planningPolicy', 'permissions', 'toolPermissions', 'toolNames', 'pluginIds'],
  CreateThreadDto: ['content', 'preflightMessageId', 'model', 'reasoningEffort', 'reasoning', 'backgroundProcessing', 'interruptActive', 'goal', 'executionMode', 'planningPolicy', 'permissions', 'toolPermissions', 'toolNames', 'pluginIds', 'version'],
  CreateThreadlessResponseDto: ['content', 'preflightMessageId', 'model', 'reasoningEffort', 'reasoning', 'backgroundProcessing', 'interruptActive', 'goal', 'executionMode', 'planningPolicy', 'permissions', 'toolPermissions', 'toolNames', 'pluginIds', 'version', 'context', 'persistThread'],
  AgentConfigDto: ['model', 'reasoningEffort', 'executionMode', 'planningPolicy', 'workMode', 'persona', 'systemInstructions', 'definition', 'memoryPolicy', 'release', 'automation', 'toolNames', 'pluginIds', 'plugins', 'maxActiveRootRuns', 'maxChildRuns', 'maxConcurrentChildRuns', 'maxTicks', 'childFailureMode'],
  AgentReleaseConfigDto: ['versionLabel', 'changeSummary'],
  AgentPluginComponentToolConfigDto: ['enabled', 'deferLoading', 'alias', 'title', 'description', 'entrypoint', 'inputs', 'popResult', 'inputSchema', 'outputSchema', 'approvalPolicy', 'mutationIntent', 'reversibility', 'targetScope', 'sideEffectSummary', 'sideEffectCategories'],
  AgentPluginMcpToolConfigDto: ['enabled', 'deferLoading', 'alias', 'approvalPolicy', 'mutationIntent', 'reversibility', 'targetScope', 'sideEffectSummary'],
});
const MODEL_SCHEMA_PROPERTIES = Object.freeze([
  'InstanceUsageTokenByModelDto',
  'AssistantRealtimeTranscriptionSessionResponseDto',
  'AssistantAudioTranscriptionResponseDto',
  'CreateThreadDto',
  'CreateThreadlessResponseDto',
  'CreateThreadPreflightDto',
  'CreateMessageDto',
  'ResolveActionRequiredDto',
  'AgentConfigDto',
  'AgentTokenUsageByModelDto',
]);

const SUMMARY_OVERRIDES = Object.freeze({
  DatabaseViewController_findAll: 'List Database Views',
  DatabaseViewController_create: 'Create a Database View',
  DatabaseViewController_preview: 'Preview a Database View definition',
  DatabaseViewController_rawPreview: 'Preview a raw Database View query',
  DatabaseViewController_deleteMany: 'Delete Database Views',
  DatabaseViewController_getOne: 'Get a Database View',
  DatabaseViewController_update: 'Update a Database View',
  DatabaseViewController_exportData: 'Export Database View data',
  DatabaseViewController_getData: 'Query Database View data',
  DatabaseViewController_refresh: 'Refresh a materialized Database View',
  DatabaseViewController_restore: 'Restore a Database View',
  DatabaseViewController_previewAction: 'Preview a Database View action',
  DatabaseViewController_getActionPreviewOperation: 'Get a Database View action preview',
  DatabaseViewController_updateAction: 'Apply an update through a Database View',
  DatabaseViewController_deleteAction: 'Apply a delete through a Database View',
  DatabaseCacheController_list: 'List Database cache entries',
  DatabaseCacheController_stats: 'Get Database cache statistics',
  DatabaseCacheController_get: 'Get a Database cache value',
  DatabaseCacheController_create: 'Create a Database cache value',
  DatabaseCacheController_expire: 'Expire a Database cache value',
  DatabaseCacheController_persist: 'Persist a Database cache value',
  DatabaseCacheController_delete: 'Delete a Database cache value',
  DatabaseController_getDataRequest: 'Query Database data with a request body',
  AgentMemoryController_createMemory: 'Create Agent memory',
  AgentMemoryController_getMemory: 'Get Agent memory',
  AgentMemoryController_updateMemory: 'Update Agent memory',
  AgentMemoryController_removeMemory: 'Delete Agent memory',
  AgentMemoryController_removeMemories: 'Delete multiple Agent memory entries',
  AgentMemoryController_restoreMemory: 'Restore Agent memory',
  AgentController_listAgents: 'List Agents',
  AgentController_createAgent: 'Create an Agent',
  AgentController_getToolRegistry: 'Get the Agent tool registry',
  AgentController_listStorage: 'Explore an Agent workspace',
  AgentController_archiveStorageEntries: 'Archive Agent workspace entries',
  AgentController_downloadStorageEntry: 'Create an Agent workspace download URL',
  AgentController_previewStorageEntry: 'Create an Agent workspace preview URL',
  AgentController_thumbnailStorageEntry: 'Create an Agent workspace thumbnail URL',
  AgentController_createStorageFolder: 'Create an Agent workspace folder',
  AgentController_createStorageUploadSession: 'Create an Agent workspace upload session',
  AgentController_getStorageUploadSession: 'Get an Agent workspace upload session',
  AgentController_finalizeStorageUploadSession: 'Finalize an Agent workspace upload',
  AgentController_abortStorageUploadSession: 'Abort an Agent workspace upload',
  AgentController_setWorkspace: 'Assign an Agent workspace',
  AgentController_getRun: 'Get an Agent run',
  AgentController_getSession: 'Get an Agent session',
  AgentController_listRunEvents: 'List Agent run events',
  AgentController_listRunThreads: 'List Assistant threads linked to an Agent run',
  AgentController_requestTick: 'Request an Agent run tick',
  AgentController_resume: 'Resume an Agent run',
  AgentController_retry: 'Retry an Agent run',
  AgentController_continueRun: 'Continue an Agent run',
  AgentController_cancel: 'Cancel an Agent run',
  AgentController_listInbox: 'List Agent inbox items',
  AgentController_pushInbox: 'Create an Agent inbox item',
  AgentController_claimInbox: 'Claim the next Agent inbox item',
  AgentController_listMemory: 'List memory for an Agent',
  AgentController_createMemory: 'Create memory for an Agent',
  AgentController_getMemory: 'Get memory for an Agent',
  AgentController_updateMemory: 'Update memory for an Agent',
  AgentController_removeMemory: 'Delete memory for an Agent',
  AgentController_restoreMemory: 'Restore memory for an Agent',
  AgentController_getInboxItem: 'Get an Agent inbox item',
  AgentController_updateInbox: 'Update an Agent inbox item',
  AgentController_removeInbox: 'Delete an Agent inbox item',
  AgentController_reconcile: 'Reconcile Agent runtime state',
  AgentController_getAgentSummary: 'Get an Agent summary',
  AgentController_getAgentOverview: 'Get an Agent overview',
  AgentController_getAgent: 'Get an Agent',
  AgentController_updateAgent: 'Update an Agent',
  AgentController_deleteAgent: 'Delete an Agent',
  AgentController_uploadAgentAvatar: 'Upload an Agent avatar',
  AgentController_clearAgentAvatar: 'Clear an Agent avatar',
  AgentController_restoreAgent: 'Restore an Agent',
  AgentController_listRuns: 'List runs for an Agent',
  AgentController_startRun: 'Start an Agent run',
});

const DESCRIPTION_OVERRIDES = Object.freeze({
  DatabaseViewController_findAll: 'Lists active Database Views visible to the caller. Use the type filter to separate regular and materialized views; standard list filtering, sorting, projection, and pagination parameters remain available.',
  DatabaseViewController_create: 'Creates a regular or materialized Database View after validating its definition, source access, output columns, ACL, quota, and materialization settings. The exact request contract is generated below.',
  DatabaseViewController_preview: 'Executes a structured Database View definition without saving it. Preview output is capped at 1000 rows and includes the derived output definition, field lineage, source Database IDs, and paging information.',
  DatabaseViewController_rawPreview: 'Executes one read-only SELECT/WITH definition without saving it. This operation requires Resource Admin, the instance raw-query capability, accessible Database sources, and uses a 15-second preview statement timeout.',
  DatabaseViewController_deleteMany: 'Soft-deletes accessible Database Views and tombstones their physical relations so they can be restored. A materialized view cannot be deleted while an active Schedule targets it.',
  DatabaseViewController_getOne: 'Returns one active Database View and its definition, derived fields, lineage, source dependencies, ACL, version, and refresh metadata when it is visible to the caller.',
  DatabaseViewController_update: 'Revalidates and transactionally rebuilds a Database View. The version field provides optimistic concurrency; stale versions fail instead of overwriting a newer definition.',
  DatabaseViewController_exportData: 'Starts an asynchronous CSV or Excel (XLSX) export of the saved View output to an authorized Storage destination. CSV is the default. Excel exports enforce worksheet row and column limits. Export queries may filter, project, sort, and page the output but cannot redefine joins, CTEs, or raw where clauses.',
  DatabaseViewController_getData: 'Queries the saved View output with structured field projection, filters, sorting, grouping, casts, pagination, and optional total count. The saved View remains the source; this operation does not mutate source rows.',
  DatabaseViewController_refresh: 'Refreshes a materialized Database View concurrently. Although the operation uses HTTP 202, the request resolves after the refresh and refresh metadata update complete; it is not a background polling contract.',
  DatabaseViewController_restore: 'Restores a soft-deleted Database View when its original logical name is available and returns the active definition.',
  DatabaseViewController_previewAction: 'Builds a governed UPDATE or DELETE workset for a structured View using direct primary-key lineage. Regular Views return the preview directly; materialized Views return a tracked asynchronous preview operation after refreshing their snapshot.',
  DatabaseViewController_getActionPreviewOperation: 'Returns the caller-owned status of a materialized View action preview: PENDING, RUNNING, COMPLETED, or FAILED. Preview operations expire after 10 minutes.',
  DatabaseViewController_updateAction: 'Updates source Database rows selected by a previously previewed structured View workset. The 10-minute mutation token is bound to the caller, View version, target, action, key mapping, and materialized refresh when applicable.',
  DatabaseViewController_deleteAction: 'Deletes source Database rows selected by a previously previewed structured View workset. The 10-minute mutation token is bound to the caller, View version, target, action, key mapping, and materialized refresh when applicable.',
});

const TAG_CONTEXT = Object.freeze({
  Accounts: 'The request is scoped to the authenticated instance and enforces account administration policy.',
  Activity: 'The request is scoped to activity visible to the authenticated caller.',
  'Agent Memory': 'The request enforces Agent memory roles, scope, ownership, and lifecycle state.',
  'Agent Plugins': 'The request enforces Agent plugin roles, provider policy, and lifecycle state.',
  Agents: 'The request enforces Agent roles, ownership, workspace boundaries, and lifecycle state.',
  Assistant: 'The request is scoped to Assistant threads and content accessible to the authenticated caller.',
  Automation: 'The request is scoped to the authenticated instance and enforces Automation roles and lifecycle state.',
  Chat: 'The request enforces thread membership and content visibility for the authenticated caller.',
  'Component deployments': 'The request validates the component lifecycle and current runtime deployment state.',
  Components: 'The request is scoped to the authenticated instance and enforces Component roles and version state.',
  Config: 'The request enforces instance administration policy.',
  'Database Cache': 'The request is scoped to the authenticated instance and enforces Database cache access.',
  'Database Views': 'The request is scoped to the authenticated instance and enforces View access and lifecycle state.',
  Databases: 'The request is scoped to the authenticated instance and enforces Database access policy.',
  Endpoints: 'The request is scoped to the authenticated instance and enforces Endpoint roles and lifecycle state.',
  Files: 'The request is scoped to files accessible to the authenticated caller.',
  Groups: 'The request is scoped to the authenticated instance and enforces group administration policy.',
  Me: 'The request acts on the current authenticated identity.',
  Preferences: 'The request is scoped to preferences accessible to the authenticated caller.',
  'Role Groups': 'The request enforces role-group administration policy for the authenticated instance.',
  Roles: 'The request returns roles visible to the authenticated caller.',
  Search: 'Results are limited to objects visible to the authenticated caller.',
  Secrets: 'The request enforces Secret roles and never returns secret material unless the operation explicitly authorizes reveal.',
  Storage: 'The request enforces Storage access, workspace ownership, and entry lifecycle state.',
});

const TAG_DESCRIPTIONS = Object.freeze({
  Accounts: 'Users, service accounts, API keys, status, and platform access.',
  Activity: 'Snapshot-backed activity and version history.',
  'Agent Memory': 'Administrative access to durable Agent memory.',
  'Agent Plugins': 'Agent plugin definitions, synchronization, testing, and lifecycle.',
  Agents: 'Agent definitions, runs, sessions, inboxes, memory, tools, workspaces, and lifecycle.',
  Assistant: 'Assistant threads, messages, responses, goals, reports, sharing, attachments, and control.',
  Automation: 'Jobs, templates, schedules, events, webhooks, execution history, and lifecycle.',
  Chat: 'Collaborative chat threads, messages, reactions, uploads, and attachments.',
  'Component deployments': 'Custom Node.js runtime deployment attempts, readiness, activation, and rollback.',
  Components: 'Components, elements, versions, validation, activation, and lifecycle.',
  Config: 'Instance configuration, usage, logs, and cache administration.',
  'Database Cache': 'Instance Database cache values and statistics.',
  'Database Views': 'Database Views, previews, refreshes, exports, and controlled data actions.',
  Databases: 'Database definitions, data, audits, exports, cloning, and lifecycle.',
  Endpoints: 'Endpoint definitions, activation, validation, generated OpenAPI, and statistics.',
  Files: 'Compatibility file listing, preview, download, and deletion operations.',
  Groups: 'Groups, membership, avatars, and lifecycle.',
  Me: 'Current user profile, keys, avatar, and session information.',
  Preferences: 'User and instance preference values.',
  'Role Groups': 'Role groups, members, assigned roles, and lifecycle.',
  Roles: 'Available platform roles and role details.',
  Search: 'Cross-domain search over objects visible to the caller.',
  Share: 'Short-lived authenticated links to supported application routes and grid state.',
  Secrets: 'Secret definitions, revisions, activation, reveal, disable, and destruction.',
  Storage: 'Storage workspaces, folders, objects, upload sessions, signed access, and lifecycle.',
});

const TAG_GUIDES = Object.freeze({
  Accounts: ['Identity and access guide', '/operate/identity-and-access'],
  Activity: ['Observability guide', '/operate/observability'],
  'Agent Memory': ['Agent memory and workspaces guide', '/ai/memory-and-workspaces'],
  'Agent Plugins': ['Agent plugins guide', '/ai/plugins'],
  Agents: ['Autonomous Agents guide', '/ai/agents'],
  Assistant: ['Assistant guide', '/ai/assistant'],
  Automation: ['Automation guide', '/operate/automation'],
  Chat: ['Team Chat guide', '/operate/chat'],
  'Component deployments': ['Custom Node.js guide', '/build/custom-nodejs'],
  Components: ['Components guide', '/build/components'],
  Config: ['Instance settings guide', '/platform/instance-settings'],
  'Database Cache': ['Database Cache guide', '/operate/database-cache'],
  'Database Views': ['Database Views guide', '/operate/database-views'],
  Databases: ['Databases guide', '/operate/databases'],
  Endpoints: ['Endpoints guide', '/operate/endpoints'],
  Files: ['Files compatibility guide', '/operate/files'],
  Groups: ['Groups guide', '/operate/groups'],
  Me: ['Authentication guide', '/developers/authentication'],
  Preferences: ['Platform UI guide', '/platform/ui-tour'],
  'Role Groups': ['Permissions guide', '/operate/permissions'],
  Roles: ['Permissions guide', '/operate/permissions'],
  Search: ['Search and discovery guide', '/platform/search'],
  Share: ['Platform API share-link guide', '/developers/platform-api#share-application-context'],
  Secrets: ['Secrets guide', '/operate/secrets'],
  Storage: ['Storage guide', '/operate/storage'],
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function parseJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function serialized(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sentence(text) {
  const normalized = text.trim();
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function generatedDescription(operation) {
  const tag = operation.tags?.[0];
  const context = TAG_CONTEXT[tag] ?? 'The request is scoped to the authenticated RevoEngine instance and operation policy.';
  return `${sentence(operation.summary)} ${context}`;
}

function isAgentProtectedOperation(operation) {
  return /^(AgentController|AgentMemoryController)_/.test(operation.operationId ?? '');
}

export function operationEntries(document) {
  const entries = [];
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (HTTP_METHODS.has(method)) entries.push({ path, method, operation });
    }
  }
  return entries;
}

export function operationKey({ path, method }) {
  return `${method.toUpperCase()} ${path}`;
}

export function publicOperationKeys(document) {
  return operationEntries(document)
    .filter(({ path }) => path.startsWith(PUBLIC_PATH_PREFIX))
    .map(operationKey)
    .sort();
}

function schemaProperties(document, schemaName) {
  return document.components?.schemas?.[schemaName]?.properties;
}

function operationById(document, operationId) {
  return operationEntries(document).find(({ operation }) => operation.operationId === operationId)?.operation;
}

function applyPublicExtensionProjection(value) {
  if (Array.isArray(value)) {
    for (const item of value) applyPublicExtensionProjection(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith('x-') && !PUBLIC_EXTENSION_KEYS.has(key)) {
      delete value[key];
      continue;
    }
    applyPublicExtensionProjection(nested);
  }
}

function replaceModelExamples(value) {
  if (Array.isArray(value)) {
    for (const item of value) replaceModelExamples(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'model' && typeof nested === 'string') {
      value[key] = 'configured-model';
      continue;
    }
    replaceModelExamples(nested);
  }
}

function sanitizeModelProperties(document) {
  for (const schemaName of MODEL_SCHEMA_PROPERTIES) {
    const model = schemaProperties(document, schemaName)?.model;
    if (!model || typeof model !== 'object') continue;
    delete model.enum;
    delete model.example;
    if (schemaName.includes('Transcription')) {
      model.description = 'Identifier of the transcription model selected by the instance.';
    } else if (schemaName.includes('Usage')) {
      model.description = 'Execution model identifier used to group this usage.';
    } else {
      model.description = 'Optional execution model identifier enabled for this instance.';
    }
  }
  replaceModelExamples(document.components?.schemas);
}

function applyPublicSchemaProjection(document) {
  for (const [schemaName, allowedNames] of Object.entries(PUBLIC_SCHEMA_PROPERTIES)) {
    const schema = document.components?.schemas?.[schemaName];
    if (!schema?.properties) continue;
    const allowed = new Set(allowedNames);
    schema.properties = Object.fromEntries(
      Object.entries(schema.properties).filter(([propertyName]) => allowed.has(propertyName)),
    );
    if (Array.isArray(schema.required)) {
      schema.required = schema.required.filter((propertyName) => allowed.has(propertyName));
    }
  }
}

function reachableSchemaNames(document) {
  const schemas = document.components?.schemas;
  const reachable = new Set();
  const pending = [];
  const collectSchemaReferences = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) collectSchemaReferences(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const reference = value.$ref;
    const prefix = '#/components/schemas/';
    if (typeof reference === 'string' && reference.startsWith(prefix)) {
      const schemaName = reference.slice(prefix.length);
      if (!reachable.has(schemaName)) {
        reachable.add(schemaName);
        pending.push(schemaName);
      }
    }
    for (const nested of Object.values(value)) collectSchemaReferences(nested);
  };

  collectSchemaReferences(document.paths);
  while (pending.length > 0) {
    const schemaName = pending.pop();
    collectSchemaReferences(schemas?.[schemaName]);
  }
  return reachable;
}

function pruneUnreferencedSchemas(document) {
  const schemas = document.components?.schemas;
  if (!schemas) return;
  const reachable = reachableSchemaNames(document);
  for (const schemaName of Object.keys(schemas)) {
    if (!reachable.has(schemaName) && !PUBLIC_STANDALONE_SCHEMA_NAMES.has(schemaName)) delete schemas[schemaName];
  }
}

/**
 * Build the commit-safe public projection of the canonical API document.
 *
 * This function deliberately runs before the source snapshot is written, so a
 * later sync cannot restore private build provenance, environment-only response
 * branches, provider details, or runtime diagnostics to the public repository.
 */
export function sanitizePlatformOpenApiSource(source) {
  const output = structuredClone(source);
  applyPublicExtensionProjection(output);
  const contact = output.info?.contact;
  output.info = {
    title: output.info?.title ?? 'RevoEngine Platform API',
    description: 'Official RevoEngine Platform API documentation.',
    version: output.info?.version ?? '1.0.0',
    ...(contact
      ? {
          contact: {
            ...(contact.name ? { name: contact.name } : {}),
            ...(contact.email ? { email: contact.email } : {}),
          },
        }
      : {}),
    ...(output.info?.termsOfService ? { termsOfService: output.info.termsOfService } : {}),
  };
  output.servers = [{ url: 'https://api.revoengine.com', description: 'Production' }];
  output.paths = Object.fromEntries(
    Object.entries(output.paths ?? {}).filter(([path]) => path.startsWith(PUBLIC_PATH_PREFIX)),
  );

  const configOperationSummaries = {
    ConfigController_instanceConfigOverview: 'Get instance configuration.',
    ConfigController_upsertInstanceConfig: 'Update instance configuration.',
    ConfigController_cacheKeys: 'List instance cache keys.',
    ConfigController_cacheKeyStats: 'Get instance cache statistics.',
    ConfigController_cacheKey: 'Get an instance cache value.',
    ConfigController_setCacheKey: 'Set an instance cache value.',
  };
  for (const operation of operationEntries(output).map(({ operation }) => operation)) {
    if (configOperationSummaries[operation.operationId]) {
      operation.summary = configOperationSummaries[operation.operationId];
    }
    for (const parameter of operation.parameters ?? []) {
      if (parameter.name === 'storageProviderConfigId') {
        parameter.description = 'Optional storage scope for root exploration. Omit to include every configured storage, pass an empty value for managed default storage, or pass a configured storage id.';
      }
    }
  }

  const realtimeTranscription = operationById(output, 'AssistantController_createRealtimeTranscriptionSession');
  if (realtimeTranscription) {
    realtimeTranscription.description = 'Create a short-lived transcription session credential for direct browser audio.';
    if (realtimeTranscription.responses?.['502']) {
      realtimeTranscription.responses['502'].description = 'Transcription session request failed.';
    }
  }
  const audioTranscription = operationById(output, 'AssistantController_transcribeAudioFile');
  if (audioTranscription) {
    audioTranscription.description = 'Upload a completed audio recording for transcription without exposing provider credentials to the client.';
    if (audioTranscription.responses?.['502']) {
      audioTranscription.responses['502'].description = 'Audio transcription failed.';
    }
  }
  const getGoal = operationById(output, 'AssistantController_getThreadGoal');
  if (getGoal) getGoal.description = 'Get the current durable goal for a thread, if one was set.';

  const report = operationById(output, 'AssistantController_reportThread');
  if (report) {
    report.description = 'Submit an Assistant conversation report, with an optional user-provided reason, to the team improving the RevoEngine Agentic System. The report is accepted without returning diagnostic artifacts or credentials.';
    const publicResponseCodes = new Set(['204', '403', '404']);
    report.responses = Object.fromEntries(
      Object.entries(report.responses ?? {}).filter(([status]) => publicResponseCodes.has(status)),
    );
    if (report.responses?.['204']) {
      report.responses['204'].description = 'Conversation report submitted to the team improving the RevoEngine Agentic System.';
    }
  }

  const uploadDetail = operationById(output, 'AssistantController_uploadThreadAttachment')
    ?.requestBody?.content?.['multipart/form-data']?.schema?.properties?.detail;
  if (uploadDetail) uploadDetail.description = 'Optional image processing detail hint.';
  const replayStream = operationById(output, 'AssistantController_resumeThreadMessageStream');
  if (replayStream) {
    replayStream.description = 'Replay retained Assistant SSE events after Last-Event-ID or the after query parameter, then follow new events until the Assistant turn completes.';
  }

  applyPublicSchemaProjection(output);
  const appAssistantExample = schemaProperties(output, 'AppPreferencesDto')?.assistant?.example;
  if (appAssistantExample && typeof appAssistantExample === 'object') {
    const allowed = new Set(PUBLIC_SCHEMA_PROPERTIES.AssistantAppPreferencesDto);
    schemaProperties(output, 'AppPreferencesDto').assistant.example = Object.fromEntries(
      Object.entries(appAssistantExample).filter(([propertyName]) => allowed.has(propertyName)),
    );
  }

  const updateMe = schemaProperties(output, 'UpdateMeDto');
  if (updateMe?.name) updateMe.name.example = 'Avery';
  if (updateMe?.surname) updateMe.surname.example = 'Morgan';

  const realtimeResponse = schemaProperties(output, 'AssistantRealtimeTranscriptionSessionResponseDto');
  if (realtimeResponse?.clientSecret) realtimeResponse.clientSecret.description = 'Short-lived credential for browser audio transcription.';
  if (realtimeResponse?.sessionType) realtimeResponse.sessionType.description = 'Audio transcription session type.';
  const audioResponse = schemaProperties(output, 'AssistantAudioTranscriptionResponseDto');
  if (audioResponse?.text) audioResponse.text.description = 'Final transcript text for the uploaded audio file.';

  const backgroundProcessingDescription = 'Allow the Assistant turn to continue after the client disconnects. Defaults to false unless the operation states otherwise.';
  for (const schemaName of ['CreateThreadDto', 'CreateThreadlessResponseDto', 'CreateMessageDto', 'ResolveActionRequiredDto']) {
    const properties = schemaProperties(output, schemaName);
    const backgroundProcessing = properties?.backgroundProcessing;
    if (backgroundProcessing) backgroundProcessing.description = backgroundProcessingDescription;
    if (properties?.planningPolicy) {
      properties.planningPolicy.description = 'Planning policy for the turn. standard can create and show progress; review_required creates a user-reviewed plan before execution.';
    }
  }
  const assistantStreamBackground = schemaProperties(output, 'AssistantStreamOptionsDto')?.backgroundProcessing;
  if (assistantStreamBackground) assistantStreamBackground.description = backgroundProcessingDescription;

  const concurrencyTtl = schemaProperties(output, 'ConcurrencyJobDto')?.ttl;
  if (concurrencyTtl) concurrencyTtl.description = 'Seconds after which abandoned concurrency capacity is reclaimed.';

  const managedStorageDescriptions = {
    CreateStorageFolderDto: 'Optional configured storage id for root-level folders. Omit for managed default storage. Ignored when parentStorageEntryId is provided.',
    CreateStorageUploadSessionDto: 'Optional configured storage id for root-level uploads. Omit for managed default storage. Ignored when parentStorageEntryId is provided or when replacing an existing file.',
    EnsureStorageFolderPathDto: 'Optional configured storage id used only when the first path segment must be created at root. Omit for managed default storage.',
    MoveStorageEntryDto: 'Optional destination storage id for root-level moves. Omit for managed default storage. Ignored when parentStorageEntryId is provided.',
  };
  for (const [schemaName, description] of Object.entries(managedStorageDescriptions)) {
    const storageId = schemaProperties(output, schemaName)?.storageProviderConfigId;
    if (storageId) storageId.description = description;
  }

  const instanceConfig = schemaProperties(output, 'InstanceConfigOverviewDto')?.config;
  if (instanceConfig) instanceConfig.description = 'Instance configuration values keyed by supported configuration kind.';
  const databaseViewIndexName = schemaProperties(output, 'DatabaseViewIndexDto')?.name;
  if (databaseViewIndexName) databaseViewIndexName.description = 'Database View index name. A stable name is generated when omitted.';
  const agentPluginPackageExternalId = schemaProperties(output, 'AgentPluginPackageConfigDto')?.externalId;
  if (agentPluginPackageExternalId) agentPluginPackageExternalId.description = 'Stable package identifier used by this plugin definition.';
  const releaseConfig = schemaProperties(output, 'AgentReleaseConfigDto');
  if (releaseConfig?.changeSummary) releaseConfig.changeSummary.description = 'Short operator-facing change summary for the current definition.';
  const agentConfig = schemaProperties(output, 'AgentConfigDto');
  if (agentConfig?.executionMode) agentConfig.executionMode.description = 'Default execution mode used for Agent turns.';
  if (agentConfig?.release) agentConfig.release.description = 'Release metadata for the current Agent definition.';
  const agentPluginRouting = schemaProperties(output, 'AgentPluginRoutingConfigDto');
  if (agentPluginRouting?.title) agentPluginRouting.title.description = 'Canonical English capability title used for tool selection. Display names may remain localized.';
  if (agentPluginRouting?.summary) agentPluginRouting.summary.description = 'Canonical English capability summary used for tool selection. Display descriptions may remain localized.';
  for (const schemaName of ['AgentPluginConfigDto', 'CreateAgentPluginDto', 'UpdateAgentPluginDto']) {
    const properties = schemaProperties(output, schemaName);
    if (properties?.routing) properties.routing.description = 'Canonical English capability metadata used for tool selection. Operator-facing content may remain localized.';
    if (properties?.mutationIntent) properties.mutationIntent.description = 'Declared mutation intent used for governance and approval safety.';
    if (properties?.sideEffectCategories) properties.sideEffectCategories.description = 'Normalized side-effect categories used for governance and operator review.';
  }
  const componentTool = schemaProperties(output, 'AgentPluginComponentToolConfigDto');
  if (componentTool?.sideEffectCategories) componentTool.sideEffectCategories.description = 'Normalized side-effect categories used for governance and operator review.';
  const createAgentConfig = schemaProperties(output, 'CreateAgentDto')?.config;
  if (createAgentConfig) createAgentConfig.description = 'Persisted Agent identity and runtime defaults, including work mode, persona, instructions, memory policy, and execution limits.';
  const updateAgentConfig = schemaProperties(output, 'UpdateAgentDto')?.config;
  if (updateAgentConfig) updateAgentConfig.description = 'Replacement Agent identity and runtime defaults.';

  sanitizeModelProperties(output);
  pruneUnreferencedSchemas(output);
  return output;
}

export function auditPublicSanitization(document) {
  const issues = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) {
        if (key.startsWith('x-') && !PUBLIC_EXTENSION_KEYS.has(key)) {
          issues.add('Public OpenAPI contains a non-public extension.');
        }
        visit(nested);
      }
      return;
    }
  };
  visit(document);

  for (const [schemaName, allowedNames] of Object.entries(PUBLIC_SCHEMA_PROPERTIES)) {
    const properties = schemaProperties(document, schemaName);
    if (!properties) continue;
    const allowed = new Set(allowedNames);
    if (Object.keys(properties).some((propertyName) => !allowed.has(propertyName))) {
      issues.add(`${schemaName} contains fields outside its public projection.`);
    }
  }
  const reachable = reachableSchemaNames(document);
  if (Object.keys(document.components?.schemas ?? {}).some(
    (schemaName) => !reachable.has(schemaName) && !PUBLIC_STANDALONE_SCHEMA_NAMES.has(schemaName),
  )) {
    issues.add('Public OpenAPI contains schemas outside its reachable public contract.');
  }
  return [...issues];
}

export function enrichPlatformOpenApi(source) {
  const output = sanitizePlatformOpenApiSource(source);

  for (const { operation } of operationEntries(output)) {
    if (!operation.summary && SUMMARY_OVERRIDES[operation.operationId]) {
      operation.summary = SUMMARY_OVERRIDES[operation.operationId];
    }
    if (DESCRIPTION_OVERRIDES[operation.operationId]) {
      operation.description = DESCRIPTION_OVERRIDES[operation.operationId];
    } else if (!operation.description && operation.summary) {
      operation.description = generatedDescription(operation);
    }
    if (operation.security === undefined && isAgentProtectedOperation(operation)) {
      operation.security = [{ bearer: [] }];
    }
  }

  const usedTags = [...new Set(operationEntries(output).flatMap(({ operation }) => operation.tags ?? []))].sort();
  output.tags = usedTags.map((name) => {
    const guide = TAG_GUIDES[name];
    return {
      name,
      description: TAG_DESCRIPTIONS[name] ?? `Operations in the ${name} Platform API domain.`,
      ...(guide
        ? {
            externalDocs: {
              description: guide[0],
              url: `https://docs.revoengine.com${guide[1]}`,
            },
          }
        : {}),
    };
  });

  const jobCreateTimeout = output.components?.schemas?.JobTemplateRequestDto?.properties?.timeout;
  const jobUpdateTimeout = output.components?.schemas?.UpdateJobTemplate?.properties?.timeout;
  const jobMemory = output.components?.schemas?.JobOptionsDto?.properties?.memory;
  for (const timeout of [jobCreateTimeout, jobUpdateTimeout]) {
    if (!timeout) continue;
    timeout.maximum = PUBLIC_JOB_TIMEOUT_MAX_SECONDS;
    timeout.description = 'Job execution timeout in seconds. The effective limit comes from the instance jobTimeout quota, up to 3540 seconds (59 minutes).';
  }
  if (jobMemory) {
    jobMemory.maximum = PUBLIC_JOB_MEMORY_MAX_MIB;
    jobMemory.description = 'Job execution memory budget in MiB, up to 2048 MiB (2 GiB).';
  }

  return output;
}

export function auditPlatformOpenApi(document, source) {
  const issues = auditPublicSanitization(document);
  const operationIds = new Set();
  const securitySchemes = new Set(Object.keys(document.components?.securitySchemes ?? {}));
  const declaredTags = new Map((document.tags ?? []).map((tag) => [tag.name, tag]));

  if (JSON.stringify(document.servers) !== JSON.stringify([{ url: 'https://api.revoengine.com', description: 'Production' }])) {
    issues.push('Public servers must contain only the production Platform API origin.');
  }
  const jobCreateTimeout = document.components?.schemas?.JobTemplateRequestDto?.properties?.timeout;
  const jobUpdateTimeout = document.components?.schemas?.UpdateJobTemplate?.properties?.timeout;
  const jobMemory = document.components?.schemas?.JobOptionsDto?.properties?.memory;
  if (jobCreateTimeout?.maximum !== PUBLIC_JOB_TIMEOUT_MAX_SECONDS) {
    issues.push(`JobTemplateRequestDto.timeout.maximum must be ${PUBLIC_JOB_TIMEOUT_MAX_SECONDS}.`);
  }
  if (jobUpdateTimeout?.maximum !== PUBLIC_JOB_TIMEOUT_MAX_SECONDS) {
    issues.push(`UpdateJobTemplate.timeout.maximum must be ${PUBLIC_JOB_TIMEOUT_MAX_SECONDS}.`);
  }
  if (jobMemory?.maximum !== PUBLIC_JOB_MEMORY_MAX_MIB) {
    issues.push(`JobOptionsDto.memory.maximum must be ${PUBLIC_JOB_MEMORY_MAX_MIB}.`);
  }

  const actualKeys = publicOperationKeys(document);
  const expectedKeys = publicOperationKeys(source);
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    const actual = new Set(actualKeys);
    const expected = new Set(expectedKeys);
    for (const key of expectedKeys.filter((key) => !actual.has(key))) issues.push(`Missing source operation: ${key}`);
    for (const key of actualKeys.filter((key) => !expected.has(key))) issues.push(`Unexpected public operation: ${key}`);
  }
  for (const path of Object.keys(document.paths ?? {})) {
    if (!path.startsWith(PUBLIC_PATH_PREFIX)) issues.push(`Non-public path published: ${path}`);
  }

  for (const entry of operationEntries(document)) {
    const key = operationKey(entry);
    const { operation } = entry;
    if (!operation.operationId) issues.push(`${key}: missing operationId.`);
    else if (operationIds.has(operation.operationId)) issues.push(`${key}: duplicate operationId ${operation.operationId}.`);
    else operationIds.add(operation.operationId);
    if (!operation.summary?.trim()) issues.push(`${key}: missing summary.`);
    if (!operation.description?.trim()) issues.push(`${key}: missing description.`);
    if (!Array.isArray(operation.tags) || operation.tags.length === 0) issues.push(`${key}: missing tags.`);
    for (const tag of operation.tags ?? []) {
      const tagDefinition = declaredTags.get(tag);
      if (!tagDefinition?.description?.trim()) issues.push(`${key}: tag ${tag} is not declared with a description.`);
      if (!tagDefinition?.externalDocs?.url?.startsWith('https://docs.revoengine.com/')) {
        issues.push(`${key}: tag ${tag} does not link to a RevoEngine product guide.`);
      }
    }
    if (!Array.isArray(operation.security)) issues.push(`${key}: missing explicit security metadata.`);
    for (const requirement of operation.security ?? []) {
      for (const scheme of Object.keys(requirement)) {
        if (!securitySchemes.has(scheme)) issues.push(`${key}: unknown security scheme ${scheme}.`);
      }
    }
  }
  return issues;
}

function sourceFlagValue(argv) {
  const index = argv.indexOf('--source');
  return index === -1 ? undefined : argv[index + 1];
}

export function resolveCanonicalSource(sourceArg = undefined) {
  const candidates = [
    sourceArg ? resolve(sourceArg) : undefined,
    process.env.REVOENGINE_PLATFORM_OPENAPI ? resolve(process.env.REVOENGINE_PLATFORM_OPENAPI) : undefined,
  ].filter(Boolean);
  return candidates.find(existsSync);
}

function assertSourceSnapshotCurrent(sourceFile, snapshot) {
  if (!sourceFile) return;
  const source = sanitizePlatformOpenApiSource(parseJson(sourceFile));
  if (canonicalJson(source) !== canonicalJson(snapshot)) {
    throw new Error(`OpenAPI source snapshot is stale against ${sourceFile}. Run npm run sync:openapi.`);
  }
}

export function run(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  const sourceFile = resolveCanonicalSource(sourceFlagValue(argv));

  if (args.has('--sync')) {
    if (!sourceFile) {
      throw new Error('Canonical Platform OpenAPI was not provided. Pass --source or set REVOENGINE_PLATFORM_OPENAPI.');
    }
    mkdirSync(dirname(sourceSnapshotPath), { recursive: true });
    writeFileSync(sourceSnapshotPath, serialized(sanitizePlatformOpenApiSource(parseJson(sourceFile))));
  }

  if (!existsSync(sourceSnapshotPath)) {
    throw new Error('Missing OpenAPI source snapshot. Run npm run sync:openapi from the platform monorepo.');
  }
  const snapshot = parseJson(sourceSnapshotPath);

  if (args.has('--require-source') && !sourceFile) {
    throw new Error('Canonical Platform OpenAPI is required but was not provided.');
  }
  if (args.has('--check')) assertSourceSnapshotCurrent(sourceFile, snapshot);

  const snapshotIssues = auditPublicSanitization(snapshot);
  if (snapshotIssues.length > 0) {
    throw new Error(`Platform OpenAPI source snapshot sanitization failed:\n- ${snapshotIssues.join('\n- ')}`);
  }

  const expected = enrichPlatformOpenApi(snapshot);
  const issues = auditPlatformOpenApi(expected, snapshot);
  if (issues.length > 0) {
    throw new Error(`Platform OpenAPI quality gate failed:\n- ${issues.join('\n- ')}`);
  }

  if (args.has('--check')) {
    if (!existsSync(publicOpenApiPath) || readFileSync(publicOpenApiPath, 'utf8') !== serialized(expected)) {
      throw new Error(`Published OpenAPI is stale: ${publicOpenApiPath}. Run npm run sync:openapi.`);
    }
    console.log(`Platform OpenAPI is current: ${operationEntries(expected).length} operations, ${expected.tags.length} tags.`);
    return;
  }

  writeFileSync(publicOpenApiPath, serialized(expected));
  console.log(`Published ${operationEntries(expected).length} Platform API operations from ${sourceSnapshotPath}.`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
