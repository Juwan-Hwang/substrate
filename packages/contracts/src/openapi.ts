/**
 * @substrate/contracts/openapi — OpenAPI 3.1 document factory.
 *
 * The platform provides reusable Zod schemas and a factory function.
 * The application calls `createOpenApiDocument` with its own title,
 * server URL, tags, and path registrations.
 *
 * The platform does NOT define a fixed set of HTTP API routes.
 * Each application decides which endpoints exist and how they are
 * documented.
 */
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { z } from 'zod';
import { articleSchema, experimentSchema } from './index';

// Re-export schemas so applications can import everything from one module.
export { articleSchema, experimentSchema };

// ── Reusable component schemas ───────────────────────────────────────
//
// These schemas are available as OpenAPI components. Applications
// register them (or their own schemas) when defining paths.

export const createArticleSchema = articleSchema.omit({ id: true, date: true });
export const articleResponseSchema = articleSchema.extend({
  url: z.string().url().optional(),
});

export const submitExperimentSchema = experimentSchema.omit({
  id: true,
  result: true,
  durationMs: true,
});

export const experimentResultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  result: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number().int().positive().optional(),
});

export const searchRequestSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(10),
});

export const searchResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      title: z.string(),
      excerpt: z.string(),
      type: z.enum(['article', 'project', 'note']),
      score: z.number(),
    }),
  ),
});

export const newsletterSchema = z.object({
  email: z.string().email(),
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

// ── Factory ─────────────────────────────────────────────────────────
//
// Applications call this with their own configuration. The factory
// creates a registry, calls the application's `register` callback to
// define paths and components, then generates the document.

export type OpenApiConfig = {
  title: string;
  description: string;
  version: string;
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  /**
   * Callback that receives the registry. The application registers
   * its paths, component schemas, and security schemes here.
   */
  register: (registry: OpenAPIRegistry) => void;
};

export function createOpenApiDocument(config: OpenApiConfig): OpenAPIObject {
  const registry = new OpenAPIRegistry();

  // Register the standard bearer auth security scheme.
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Better Auth bearer token',
  });

  // Let the application register its own paths and schemas.
  config.register(registry);

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: config.title,
      description: config.description,
      version: config.version,
      license: { name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
    },
    servers: config.servers,
    tags: config.tags,
  });
}

export type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
export type { OpenAPIObject };
