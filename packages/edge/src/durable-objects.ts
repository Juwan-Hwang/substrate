/**
 * Durable Object — real-time collaboration & presence for Crucible experiments.
 */
import { DurableObject } from 'cloudflare:workers';

export class ExperimentDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = pair;

      this.ctx.acceptWebSocket(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/state') {
      const state = await this.ctx.storage.get('experimentState');
      return Response.json(state ?? { status: 'idle' });
    }

    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Broadcast experiment state changes to all connected clients
    const data = JSON.parse(message as string);
    await this.ctx.storage.put('experimentState', data);
    this.ctx.getWebSockets().forEach((socket) => {
      if (socket !== ws) socket.send(message as string);
    });
  }
}
