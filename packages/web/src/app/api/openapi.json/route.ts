/**
 * OpenAPI JSON endpoint — serves the generated OpenAPI 3.1 document.
 *
 * Accessible at /api/openapi.json for Swagger UI, Scalar, or client generation.
 */
import { openApiDocument } from '@substrate/contracts/openapi';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(openApiDocument);
}
