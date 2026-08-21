/**
 * Unit tests for @substrate/contracts/openapi — OpenAPI 3.1 document factory.
 */
import { describe, expect, it } from 'vitest';
import { createOpenApiDocument } from '../openapi';

describe('openapi subpath', () => {
  it('creates a valid OpenAPI 3.1 document', () => {
    const doc = createOpenApiDocument({
      title: 'Test API',
      description: 'A test API',
      version: '0.1.0',
      servers: [{ url: 'https://api.example.com', description: 'Production' }],
      tags: [{ name: 'test', description: 'Test tag' }],
      register: (registry) => {
        registry.registerPath({
          method: 'get',
          path: '/health',
          responses: {
            200: {
              description: 'OK',
              content: { 'application/json': { schema: {} } },
            },
          },
        });
      },
    });

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Test API');
    expect(doc.info.version).toBe('0.1.0');
    expect(doc.info.license).toEqual({
      name: 'Apache-2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0',
    });
    expect(doc.servers).toHaveLength(1);
    expect(doc.servers?.[0]?.url).toBe('https://api.example.com');
    expect(doc.tags).toHaveLength(1);
    expect(doc.tags?.[0]?.name).toBe('test');
  });

  it('registers the bearer auth security scheme', () => {
    const doc = createOpenApiDocument({
      title: 'Auth Test',
      description: 'Security scheme test',
      version: '1.0.0',
      servers: [],
      tags: [],
      register: () => {},
    });

    expect(doc.components?.securitySchemes?.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Bearer token authentication',
    });
  });
});
