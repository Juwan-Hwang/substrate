/**
 * @substrate/edge — Edge functions & middleware.
 *
 * Request handlers for the Crucible experiment runner, API routes for
 * Archive content delivery, and Lattice graph serialization endpoints.
 */
import type { Result, SubsystemName } from '@substrate/contracts';

export type EdgeRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type EdgeResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export type EdgeHandler = (req: EdgeRequest) => Promise<Result<EdgeResponse>>;

export type RouteEntry = {
  pattern: string;
  subsystem: SubsystemName;
  handler: EdgeHandler;
};

export const createRouter = (routes: readonly RouteEntry[]) => {
  return async (req: EdgeRequest): Promise<Result<EdgeResponse>> => {
    const match = routes.find((r) => req.url.startsWith(r.pattern));
    if (!match) {
      return { ok: false, error: new Error(`No route for ${req.url}`) };
    }
    return match.handler(req);
  };
};
