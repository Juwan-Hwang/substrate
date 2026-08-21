/**
 * @substrate-platform/contracts/openapi — OpenAPI 3.1 document factory.
 *
 * The platform provides a factory function and a few reusable Zod schemas
 * for common API patterns (search, health, newsletter). The application
 * calls `createOpenApiDocument` with its own title, server URL, tags, and
 * path registrations.
 *
 * The platform does NOT define a fixed set of HTTP API routes or
 * application-specific schemas (articles, projects, etc.). Each
 * application decides which endpoints exist and how they are documented.
 */
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { z } from 'zod';

// ── Reusable generic schemas ─────────────────────────────────────────
//
// These schemas cover common API patterns. Applications can use them or
// define their own.

export const searchRequestSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(10),
});

export const searchResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      excerpt: z.string().optional(),
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
    description: 'Bearer token authentication',
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
