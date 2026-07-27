/**
 * OpenAPI 3.1 schema generation from Zod schemas.
 *
 * Uses @asteasolutions/zod-to-openapi to convert the shared Zod schemas
 * into a standard OpenAPI document. The generated schema can be served
 * at `/api/openapi.json` and used with Swagger UI / Scalar / Stoplight.
 *
 * tRPC procedures are mapped to REST-style paths for the OpenAPI document,
 * enabling third-party API consumers and automated client generation.
 */
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { z } from 'zod';
import { articleSchema, experimentSchema } from './index';

// ── Extended schemas for API request/response ───────────────────────

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
  brand: z.literal('Aevum'),
  timestamp: z.string().datetime(),
});

// ── Registry ────────────────────────────────────────────────────────

const registry = new OpenAPIRegistry();

// Register component schemas.
registry.register('Article', articleResponseSchema);
registry.register('CreateArticle', createArticleSchema);
registry.register('Experiment', experimentSchema);
registry.register('SubmitExperiment', submitExperimentSchema);
registry.register('ExperimentResult', experimentResultSchema);
registry.register('SearchRequest', searchRequestSchema);
registry.register('SearchResponse', searchResponseSchema);
registry.register('Newsletter', newsletterSchema);
registry.register('Health', healthResponseSchema);

// Register security scheme (Better Auth bearer token).
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Better Auth bearer token',
});

// ── Paths ───────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/health',
  tags: ['System'],
  summary: 'Health check',
  responses: {
    200: {
      description: 'Service health status',
      content: {
        'application/json': { schema: healthResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/articles/{slug}',
  tags: ['Archive'],
  summary: 'Get article by slug',
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: 'Article found',
      content: { 'application/json': { schema: articleResponseSchema } },
    },
    404: { description: 'Article not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/articles',
  tags: ['Archive'],
  summary: 'List articles',
  request: {
    query: z.object({
      tag: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: 'List of articles',
      content: {
        'application/json': {
          schema: z.array(articleResponseSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/crucible/run',
  tags: ['Crucible'],
  summary: 'Submit an experiment',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: submitExperimentSchema } },
    },
  },
  responses: {
    202: {
      description: 'Experiment queued',
      content: { 'application/json': { schema: experimentResultSchema } },
    },
    400: { description: 'Invalid input' },
    401: { description: 'Unauthorized' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/crucible/experiments',
  tags: ['Crucible'],
  summary: 'List experiments',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      subsystem: z.enum(['lattice', 'crucible', 'archive']).optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      description: 'List of experiments',
      content: {
        'application/json': { schema: z.array(experimentSchema) },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/archive/search',
  tags: ['Archive'],
  summary: 'Full-text search',
  request: {
    body: {
      content: { 'application/json': { schema: searchRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Search results',
      content: { 'application/json': { schema: searchResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/archive/reindex',
  tags: ['Archive'],
  summary: 'Trigger content reindex',
  security: [{ bearerAuth: [] }],
  responses: {
    202: {
      description: 'Reindex queued',
      content: {
        'application/json': {
          schema: z.object({ status: z.literal('queued') }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/newsletter/subscribe',
  tags: ['Newsletter'],
  summary: 'Subscribe to newsletter',
  request: {
    body: {
      content: { 'application/json': { schema: newsletterSchema } },
    },
  },
  responses: {
    200: {
      description: 'Subscribed successfully',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.literal(true),
            message: z.string(),
          }),
        },
      },
    },
    400: { description: 'Invalid email' },
  },
});

// ── Generator ───────────────────────────────────────────────────────

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument: OpenAPIObject = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Aevum API',
    description: 'Personal site platform API — Lattice, Crucible, and Archive.',
    version: '0.1.0',
    license: { name: 'AGPL-3.0-or-later', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
    contact: { url: 'https://aevum.dev' },
  },
  servers: [
    { url: 'https://aevum.dev', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Development' },
  ],
  tags: [
    { name: 'System', description: 'Health & system endpoints' },
    { name: 'Archive', description: 'Articles, projects, notes, and search' },
    { name: 'Crucible', description: 'Experiment submission and results' },
    { name: 'Newsletter', description: 'Newsletter subscription' },
  ],
});

export type OpenApiDocument = typeof openApiDocument;
