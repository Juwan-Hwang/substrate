/**
 * Durable Object — real-time room with presence, chat, and shared state.
 *
 * This is the server-side DO that runs on Cloudflare Workers.
 * It manages WebSocket connections, tracks presence, broadcasts
 * cursor positions, and maintains shared room state.
 *
 * When deployed to Cloudflare, this runs at the edge. In development
 * (next dev), the client falls back to a local simulation.
 */
import { DurableObject } from 'cloudflare:workers';

type PresenceUser = {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  lastSeen: number;
};

type ChatMessage = {
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
};

/** Cloudflare extends WebSocket with attachment methods not in the DOM type. */
type CFWebSocket = WebSocket & {
  serializeAttachment(data: string): void;
  deserializeAttachment(): unknown;
};

export class RoomDO extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade.
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // REST: get current room state.
    if (url.pathname === '/state') {
      const state = await this.ctx.storage.get('roomState');
      const messages = (await this.ctx.storage.get('messages')) ?? [];
      return Response.json({
        state: state ?? {},
        messages,
        userCount: this.ctx.getWebSockets().length,
      });
    }

    return new Response('Not found', { status: 404 });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    let data: { type: string; [key: string]: unknown };
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    // Retrieve the userId previously attached to this WebSocket.
    const cfWs = ws as CFWebSocket;
    let userId = (cfWs.deserializeAttachment() as string) ?? '';

    switch (data.type) {
      case 'join': {
        const user = data.user as { id: string } | undefined;
        userId = user?.id ?? '';
        cfWs.serializeAttachment(userId);
        await this.broadcastPresence();
        // Send sync message to the new client.
        const state = (await this.ctx.storage.get('roomState')) ?? {};
        const messages = (await this.ctx.storage.get('messages')) ?? [];
        const users = this.getPresenceUsers();
        ws.send(JSON.stringify({ type: 'sync', state, users, messages }));
        break;
      }

      case 'cursor': {
        // Broadcast cursor position to all other clients.
        this.broadcast({ type: 'cursor', userId, x: data.x, y: data.y }, ws);
        break;
      }

      case 'chat': {
        const msg: ChatMessage = {
          userId,
          userName: data.userName as string,
          text: data.text as string,
          timestamp: Date.now(),
        };
        // Persist messages (keep last 100).
        const messages =
          ((await this.ctx.storage.get('messages')) as ChatMessage[] | undefined) ?? [];
        messages.push(msg);
        if (messages.length > 100) messages.shift();
        await this.ctx.storage.put('messages', messages);
        this.broadcast({ type: 'chat', ...msg });
        break;
      }

      case 'state': {
        // Update shared room state.
        const state =
          ((await this.ctx.storage.get('roomState')) as Record<string, unknown> | undefined) ?? {};
        state[data.key as string] = data.value;
        await this.ctx.storage.put('roomState', state);
        this.broadcast({ type: 'state', key: data.key, value: data.value });
        break;
      }
    }
  }

  override async webSocketClose(_ws: WebSocket): Promise<void> {
    await this.broadcastPresence();
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    ws.close();
  }

  // ── Helpers ────────────────────────────────────────────────────

  private getPresenceUsers(): PresenceUser[] {
    const now = Date.now();
    const users: PresenceUser[] = [];
    const seen = new Set<string>();

    for (const ws of this.ctx.getWebSockets()) {
      const id = (ws as CFWebSocket).deserializeAttachment() as string | null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      users.push({ id, name: 'Guest', color: '#7C8BA0', cursor: null, lastSeen: now });
    }

    return users;
  }

  private async broadcastPresence(): Promise<void> {
    const users = this.getPresenceUsers();
    this.broadcast({ type: 'presence', users });
  }

  private broadcast(message: unknown, exclude?: WebSocket): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      try {
        ws.send(data);
      } catch {
        /* socket may be closed */
      }
    }
  }
}
