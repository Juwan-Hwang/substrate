/**
 * Presence protocol — messages exchanged between client and Durable Object.
 *
 * The DO broadcasts presence updates and cursor positions to all
 * connected clients. This module defines the wire format and
 * provides helper functions for the client.
 */

export type PresenceUser = {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  lastSeen: number;
};

export type RoomMessage =
  | { type: 'join'; user: Omit<PresenceUser, 'cursor' | 'lastSeen'> }
  | { type: 'leave'; userId: string }
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'cursor'; userId: string; x: number; y: number }
  | { type: 'chat'; userId: string; userName: string; text: string; timestamp: number }
  | { type: 'state'; key: string; value: unknown }
  | {
      type: 'sync';
      state: Record<string, unknown>;
      users: PresenceUser[];
      messages: ChatMessage[];
    };

export type ChatMessage = {
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
};

/** Generate a random user ID. */
export function generateUserId(): string {
  return crypto.randomUUID();
}

/** Pick a color from a palette based on user ID hash. */
export function pickColor(userId: string): string {
  const colors = ['#7C8BA0', '#5B8DB8', '#8B7355', '#6B8E6B', '#9B7B9B', '#B8866B'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Generate a random guest name. */
export function generateGuestName(): string {
  const adjectives = [
    'Swift',
    'Cosmic',
    'Quantum',
    'Stellar',
    'Nebula',
    'Phantom',
    'Crystal',
    'Solar',
  ];
  const nouns = ['Fox', 'Hawk', 'Wolf', 'Owl', 'Cat', 'Deer', 'Bear', 'Raven'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  return `${a} ${n}`;
}
