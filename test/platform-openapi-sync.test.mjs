import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditPlatformOpenApi,
  enrichPlatformOpenApi,
  operationEntries,
  publicOperationKeys,
} from '../scripts/sync-platform-openapi.mjs';

function fixture() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'RevoEngine Platform API',
      description: 'Official documentation<br>Build: abcdef1234',
      version: '1.3.0',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
    tags: [],
    paths: {
      '/api/v1/agents': {
        get: {
          operationId: 'AgentController_listAgents',
          tags: ['Agents'],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/api/v1/search': {
        get: {
          operationId: 'SearchController_getAll',
          tags: ['Search'],
          summary: 'Search',
          security: [{ bearer: [] }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/api/v1/databases/views': {
        post: {
          operationId: 'DatabaseViewController_create',
          tags: ['Database Views'],
          summary: 'Create a Database View',
          security: [{ bearer: [] }],
          responses: { 201: { description: 'Created' } },
        },
      },
      '/api/v1/storage/provider-configs': {
        post: {
          operationId: 'StorageController_createProviderConfig',
          tags: ['Storage'],
          summary: 'Create storage provider config',
          security: [{ bearer: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateStorageProviderConfigDto' },
              },
            },
          },
          responses: { 200: { description: 'OK' } },
        },
      },
      '/internal/maintenance': {
        post: {
          operationId: 'InternalController_run',
          tags: ['Internal'],
          summary: 'Run internal maintenance',
          description: 'Must not be published.',
          security: [{ bearer: [] }],
          responses: { 200: { description: 'OK' } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        JobTemplateRequestDto: { properties: { timeout: { type: 'number' } } },
        UpdateJobTemplate: { properties: { timeout: { type: 'number' } } },
        JobOptionsDto: { properties: { memory: { type: 'number' } } },
        CreateStorageProviderConfigDto: {
          properties: {
            providerType: { type: 'string', enum: ['GCS'] },
            bucket: { type: 'string' },
          },
        },
      },
    },
  };
}

test('enriches protected Agent operations and removes non-public paths', () => {
  const source = fixture();
  const output = enrichPlatformOpenApi(source);
  const operation = output.paths['/api/v1/agents'].get;

  assert.equal(operation.summary, 'List Agents');
  assert.match(operation.description, /Agent roles/);
  assert.deepEqual(operation.security, [{ bearer: [] }]);
  assert.equal(output.paths['/internal/maintenance'], undefined);
  assert.equal(output.paths['/api/v1/storage/provider-configs'], undefined);
  assert.equal(output.components.schemas.CreateStorageProviderConfigDto, undefined);
  assert.doesNotMatch(JSON.stringify(output), /GCS/);
  assert.deepEqual(publicOperationKeys(output), publicOperationKeys(source));
  assert.equal(output.components.schemas.JobTemplateRequestDto.properties.timeout.maximum, 3540);
  assert.equal(output.components.schemas.UpdateJobTemplate.properties.timeout.maximum, 3540);
  assert.equal(output.components.schemas.JobOptionsDto.properties.memory.maximum, 2048);
  assert.equal(output.tags.every((tag) => tag.externalDocs?.url?.startsWith('https://docs.revoengine.com/')), true);
  assert.equal(auditPlatformOpenApi(output, source).length, 0);
});

test('preserves source metadata and generates a scoped missing description', () => {
  const source = fixture();
  const output = enrichPlatformOpenApi(source);
  const operation = output.paths['/api/v1/search'].get;

  assert.equal(operation.summary, 'Search');
  assert.match(operation.description, /visible to the authenticated caller/);
  assert.deepEqual(operation.security, [{ bearer: [] }]);
  assert.doesNotMatch(output.info.description, /Build:/);
  assert.equal(operationEntries(output).length, 3);
});

test('links Database Views to the guide and publishes reviewed operation semantics', () => {
  const source = fixture();
  const output = enrichPlatformOpenApi(source);
  const operation = output.paths['/api/v1/databases/views'].post;
  const tag = output.tags.find(({ name }) => name === 'Database Views');

  assert.match(operation.description, /validating its definition/);
  assert.equal(tag.externalDocs.url, 'https://docs.revoengine.com/operate/database-views');
});

test('quality gate reports missing operation metadata and unknown security schemes', () => {
  const source = fixture();
  const output = enrichPlatformOpenApi(source);
  const operation = output.paths['/api/v1/search'].get;
  operation.summary = '';
  operation.description = '';
  operation.security = [{ missing: [] }];

  const issues = auditPlatformOpenApi(output, source).join('\n');
  assert.match(issues, /missing summary/);
  assert.match(issues, /missing description/);
  assert.match(issues, /unknown security scheme missing/);
});


test('publishes canonical Rotate DTOs without introducing scheduling or response secret material', () => {
  const source = fixture();
  source.paths['/api/v1/secrets/{secretId}/rotate'] = { post: {
    operationId: 'SecretsController_rotateSecret', tags: ['Secrets'],
    summary: 'Rotate a secret.',
    description: 'Immediately replaces active and scheduled revisions while retaining history.',
    security: [{ bearer: [] }],
    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/RotateSecretDto' } } } },
    responses: { 201: { description: 'Metadata only.', content: { 'application/json': { schema: { $ref: '#/components/schemas/SecretRevisionResponseDto' } } } } },
  } };
  source.components.schemas.RotateSecretDto = { type: 'object', required: ['secret'], properties: { secret: { type: 'string', minLength: 1 } } };
  source.components.schemas.SecretRevisionResponseDto = { type: 'object', properties: { secretDataId: { type: 'string', format: 'uuid' }, active: { type: 'boolean' } } };
  const output = enrichPlatformOpenApi(source);
  assert.deepEqual(output.components.schemas.RotateSecretDto, source.components.schemas.RotateSecretDto);
  assert.deepEqual(output.components.schemas.SecretRevisionResponseDto, source.components.schemas.SecretRevisionResponseDto);
  assert.equal(output.paths['/api/v1/secrets/{secretId}/rotate'].post.responses[201].content['application/json'].schema.$ref, '#/components/schemas/SecretRevisionResponseDto');
  assert.match(output.tags.find(tag => tag.name === 'Secrets').description, /rotation/);
  assert.equal(auditPlatformOpenApi(output, source).length, 0);
});


test('publishes conversation feedback receipts and message anchors without private diagnostic APIs', () => {
  const source = fixture();
  const reportRequest = { content: { 'application/json': { schema: { $ref: '#/components/schemas/AssistantThreadReportDto' } } } };
  const receiptResponse = { description: 'Diagnostic metadata stored in Firestore without Storage export.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AssistantThreadReportResponseDto' } } } };
  for (const [path, operationId, tags] of [
    ['/api/v1/assistant/threads/{id}/report', 'AssistantController_reportThread', ['Assistant']],
    ['/api/v1/agents/runs/{agentRunId}/report', 'AgentController_reportRunConversation', ['Agents']],
  ]) source.paths[path] = { post: { operationId, tags, summary: 'Report a conversation.', security: [{ bearer: [] }], description: 'Writes Firestore metadata with private support diagnostics.', requestBody: reportRequest, responses: { 200: receiptResponse, 403: { description: 'Forbidden.' }, 404: { description: 'Not found.' } } } };
  source.paths['/api/v1/assistant/threads/{id}'] = { get: { operationId: 'AssistantController_getThread', tags: ['Assistant'], summary: 'Get a conversation.', description: 'Get an authorized conversation.', security: [{ bearer: [] }], responses: { 200: { description: 'Conversation.', content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerThreadDto' } } } } } } };
  const privatePaths = [
    '/api/v1/assistant/reports/{reportId}/evidence',
    '/api/v1/assistant/threads/{id}/evidence',
    '/api/v1/assistant/evidence/threads',
  ];
  privatePaths.forEach((path, index) => {
    source.paths[path] = { get: { operationId: `PrivateSupportEvidence_${index}`, tags: ['Assistant'], responses: { 200: { description: 'Private support payload.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AssistantEvidenceResponseDto' } } } } } } };
  });
  Object.assign(source.components.schemas, {
    AssistantThreadReportDto: { type: 'object', properties: { reason: { type: 'string' }, summary: { type: 'string' }, assistantMessageId: { type: 'string', format: 'uuid' }, includeLocalModelCallSnapshots: { type: 'boolean' } } },
    AssistantThreadReportResponseDto: { type: 'object', required: ['reportId', 'assistantThreadId', 'status', 'createdAt'], properties: { reportId: { type: 'string', format: 'uuid' }, assistantThreadId: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['pending'] }, createdAt: { type: 'string', format: 'date-time' } } },
    CustomerThreadDto: { type: 'object', properties: { title: { type: 'string' } } },
    AssistantEvidenceResponseDto: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/AssistantEvidenceItemDto' } } } },
    AssistantEvidenceItemDto: { type: 'object', properties: { chunk: { $ref: '#/components/schemas/AssistantEvidenceChunkDto' } } },
    AssistantEvidenceChunkDto: { type: 'object', properties: { fingerprint: { type: 'string' } } },
  });
  const output = enrichPlatformOpenApi(source);
  for (const path of privatePaths) {
    assert.equal(output.paths[path], undefined);
    assert.equal(publicOperationKeys(source).some(key => key.endsWith(path)), false);
  }
  for (const name of ['AssistantEvidenceResponseDto', 'AssistantEvidenceItemDto', 'AssistantEvidenceChunkDto']) assert.equal(output.components.schemas[name], undefined);
  assert(output.paths['/api/v1/assistant/threads/{id}']);
  assert(output.components.schemas.CustomerThreadDto);
  assert.deepEqual(output.components.schemas.AssistantThreadReportDto.properties.assistantMessageId.format, 'uuid');
  assert.equal(output.components.schemas.AssistantThreadReportDto.properties.includeLocalModelCallSnapshots, undefined);
  for (const path of ['/api/v1/assistant/threads/{id}/report', '/api/v1/agents/runs/{agentRunId}/report']) {
    const operation = output.paths[path].post;
    assert.equal(operation.responses[200].content['application/json'].schema.$ref, '#/components/schemas/AssistantThreadReportResponseDto');
    assert.doesNotMatch(JSON.stringify(operation), /Firestore|Storage|private support/i);
  }
  assert.deepEqual(output.components.schemas.AssistantThreadReportResponseDto.required, ['reportId', 'assistantThreadId', 'status', 'createdAt']);
  assert.deepEqual(publicOperationKeys(output), publicOperationKeys(source));
  assert.deepEqual(auditPlatformOpenApi(output, source), []);
  const polluted = structuredClone(output);
  polluted.paths[privatePaths[0]] = source.paths[privatePaths[0]];
  assert.match(auditPlatformOpenApi(polluted, source).join('\n'), /Private diagnostic path published/);
});
