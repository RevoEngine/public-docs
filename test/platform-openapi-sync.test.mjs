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
