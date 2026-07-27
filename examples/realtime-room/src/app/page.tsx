/** Home — overview of the realtime room example. */
import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '6rem 1.5rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Realtime Room</h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
          Cloudflare Durable Objects, WebSocket presence, and real-time collaboration.
        </p>
      </header>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <Link href="/room" className="room-card" style={{ display: 'block' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Enter Room</h2>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Join a real-time collaboration space with live cursors, presence, and chat. Backed by a
            Durable Object with WebSocket Hibernation.
          </p>
        </Link>

        <div className="room-card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            How it works
          </h2>
          <ul
            style={{
              paddingLeft: '1.25rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
            }}
          >
            <li>Each room is a Cloudflare Durable Object with single-threaded consistency.</li>
            <li>
              Clients connect via WebSocket; the DO tracks presence and broadcasts cursor positions.
            </li>
            <li>Chat messages are persisted in DO storage (last 100 retained).</li>
            <li>WebSocket Hibernation reduces costs when the room is idle.</li>
            <li>Without a backend, the room runs in simulation mode for local development.</li>
          </ul>
        </div>

        <div className="room-card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Architecture
          </h2>
          <pre
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-geist-mono), monospace',
              color: 'var(--text-secondary)',
              overflowX: 'auto',
            }}
          >
            {`Client (Browser)
  │ WebSocket
  ▼
Cloudflare Worker (Hono)
  │ Durable Object stub
  ▼
RoomDO (single-threaded)
  ├─ WebSocket connections
  ├─ Presence tracking
  ├─ Chat message storage
  └─ Shared room state`}
          </pre>
        </div>
      </div>
    </main>
  );
}
