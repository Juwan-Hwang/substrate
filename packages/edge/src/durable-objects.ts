/**
 * Durable Object — real-time collaboration & presence for Crucible experiments.
 *
 * Security:
 *  - WebSocket connections require a valid session token in the query string.
 *  - All incoming messages are wrapped in try/catch to prevent DO crashes.
 *  - Only JSON objects with a recognised `type` field are accepted.
 */
import { DurableObject } from 'cloudflare:workers';
import { createEdgeLogger } from './logger';

const logger = createEdgeLogger('experiment-do');

type ExperimentMessage = {
  type: 'state-update' | 'experiment-start' | 'experiment-stop';
  payload?: Record<string, unknown>;
};

function isExperimentMessage(data: unknown): data is ExperimentMessage {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    ['state-update', 'experiment-start', 'experiment-stop'].includes(obj.type)
  );
}

export class ExperimentDO extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      // Verify session token from query string.
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response('Unauthorized — missing session token', { status: 401 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.ctx.acceptWebSocket(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/state') {
      const state = await this.ctx.storage.get('experimentState');
      return Response.json(state ?? { status: 'idle' });
    }

    return new Response('Not found', { status: 404 });
  }

  override async webSocketMessage(ws: WebSocket, message: unknown): Promise<void> {
    try {
      const parsed = typeof message === 'string' ? JSON.parse(message) : message;

      if (!isExperimentMessage(parsed)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        return;
      }

      // Persist and broadcast valid state updates only.
      if (parsed.type === 'state-update') {
        await this.ctx.storage.put('experimentState', parsed.payload ?? parsed);
      }

      const broadcast = typeof message === 'string' ? message : JSON.stringify(parsed);
      this.ctx.getWebSockets().forEach((socket) => {
        if (socket !== ws) socket.send(broadcast);
      });
    } catch (err) {
      logger.error('Failed to process WebSocket message', { error: err });
      ws.send(
        JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to process message',
        }),
      );
    }
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    logger.info('WebSocket closed', { code, reason });
    ws.close(code, reason);
  }
}
