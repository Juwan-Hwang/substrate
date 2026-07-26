/**
 * Room — interactive real-time collaboration page.
 *
 * Connects to a WebSocket backed by a Cloudflare Durable Object.
 * Shows live presence (who's online), cursor positions, and a
 * shared chat panel.
 *
 * If no WebSocket endpoint is configured (local dev), falls back
 * to a simulated presence demo.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  generateUserId,
  generateGuestName,
  pickColor,
  type PresenceUser,
  type ChatMessage,
} from '../../lib/presence';

export default function RoomPage() {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [cursors, setCursors] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [myName, setMyName] = useState('');
  const [joined, setJoined] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const userIdRef = useRef<string>('');
  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialise user identity.
  useEffect(() => {
    userIdRef.current = generateUserId();
    setMyName(generateGuestName());
  }, []);

  // Connect to WebSocket.
  const connect = useCallback(() => {
    // In production, this would be wss://your-worker.dev/room/{roomId}
    // For the example, we use a configurable endpoint or fall back to simulation.
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;

    if (!wsUrl) {
      // Simulation mode — show demo presence.
      setConnected(true);
      simulatePresence();
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        type: 'join',
        user: {
          id: userIdRef.current,
          name: myName,
          color: pickColor(userIdRef.current),
        },
      }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'sync':
          setUsers(msg.users);
          setMessages(msg.messages);
          break;
        case 'presence':
          setUsers(msg.users);
          break;
        case 'cursor':
          setCursors((prev) => {
            const next = new Map(prev);
            next.set(msg.userId, { x: msg.x, y: msg.y });
            return next;
          });
          break;
        case 'chat':
          setMessages((prev) => [...prev, msg]);
          break;
        case 'state':
          // Handle shared state updates.
          break;
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
  }, [myName]);

  // Simulation mode — fake presence for local dev.
  function simulatePresence() {
    const fakeUsers: PresenceUser[] = [
      { id: 'bot-1', name: 'Cosmic Fox', color: '#5B8DB8', cursor: { x: 200, y: 150 }, lastSeen: Date.now() },
      { id: 'bot-2', name: 'Quantum Owl', color: '#6B8E6B', cursor: { x: 400, y: 300 }, lastSeen: Date.now() },
      { id: 'bot-3', name: 'Stellar Wolf', color: '#9B7B9B', cursor: { x: 600, y: 200 }, lastSeen: Date.now() },
    ];
    setUsers(fakeUsers);
    setCursors(new Map(fakeUsers.map((u) => [u.id, u.cursor!])));

    // Simulate cursor movement.
    const interval = setInterval(() => {
      setCursors((prev) => {
        const next = new Map(prev);
        for (const [id, pos] of next) {
          if (id === userIdRef.current) continue;
          next.set(id, {
            x: Math.max(0, Math.min(800, pos.x + (Math.random() - 0.5) * 40)),
            y: Math.max(0, Math.min(500, pos.y + (Math.random() - 0.5) * 40)),
          });
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }

  // Track local cursor.
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 800;
    const y = ((e.clientY - rect.top) / rect.height) * 500;

    // Update local cursor immediately.
    setCursors((prev) => {
      const next = new Map(prev);
      next.set(userIdRef.current, { x, y });
      return next;
    });

    // Send to server.
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor', userId: userIdRef.current, x, y }));
    }
  };

  // Send chat message.
  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg: ChatMessage = {
      userId: userIdRef.current,
      userName: myName,
      text: chatInput.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat', ...msg }));
    }
    setChatInput('');
  };

  const myColor = pickColor(userIdRef.current);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Realtime Room</h1>
          <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Durable Objects · Presence · Collaboration
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            className="room-badge"
            style={{
              background: connected ? 'var(--success)' : 'var(--text-tertiary)',
              color: '#000',
            }}
          >
            {connected ? 'Connected' : 'Offline'}
          </span>
          {!joined && connected && (
            <button type="button" className="room-btn" onClick={() => { setJoined(true); connect(); }}>
              Join Room
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1rem' }}>
        {/* Collaboration canvas */}
        <div>
          <div
            ref={canvasRef}
            onMouseMove={joined ? handleMouseMove : undefined}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '800 / 500',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12,
              overflow: 'hidden',
              cursor: joined ? 'crosshair' : 'default',
            }}
          >
            {/* Remote cursors */}
            {joined && [...cursors.entries()].map(([uid, pos]) => {
              if (uid === userIdRef.current) return null;
              const user = users.find((u) => u.id === uid);
              const color = user?.color ?? '#7C8BA0';
              const name = user?.name ?? 'Unknown';
              return (
                <div
                  key={uid}
                  style={{
                    position: 'absolute',
                    left: `${(pos.x / 800) * 100}%`,
                    top: `${(pos.y / 500) * 100}%`,
                    transform: 'translate(-2px, -2px)',
                    transition: 'left 0.1s, top 0.1s',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <path d="M2 2 L18 10 L10 12 L8 18 Z" fill={color} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  </svg>
                  <span
                    style={{
                      display: 'inline-block',
                      marginLeft: 12,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: color,
                      color: '#000',
                      fontSize: 10,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                </div>
              );
            })}

            {/* My cursor */}
            {joined && cursors.has(userIdRef.current) && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(cursors.get(userIdRef.current)!.x / 800) * 100}%`,
                  top: `${(cursors.get(userIdRef.current)!.y / 500) * 100}%`,
                  transform: 'translate(-2px, -2px)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M2 2 L18 10 L10 12 L8 18 Z" fill={myColor} stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
                </svg>
              </div>
            )}

            {/* Empty state */}
            {!joined && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  Click "Join Room" to enter the collaboration space.
                </p>
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="room-card" style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Chat</h3>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: '0.75rem' }}>
              {messages.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>No messages yet.</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ color: pickColor(msg.userId), fontWeight: 600 }}>{msg.userName}:</span>{' '}
                    <span style={{ color: 'var(--text-primary)' }}>{msg.text}</span>
                    <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder={joined ? 'Type a message…' : 'Join the room to chat'}
                disabled={!joined}
                className="room-input"
              />
              <button type="button" className="room-btn" onClick={sendChat} disabled={!joined || !chatInput.trim()}>
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Presence sidebar */}
        <div className="room-card">
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            Presence ({joined ? users.length + 1 : users.length})
          </h3>
          <ul style={{ listStyle: 'none' }}>
            {/* Me */}
            {joined && (
              <li style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', fontSize: '0.875rem' }}>
                <span className="presence-dot" style={{ background: myColor }} />
                <span>{myName}</span>
                <span className="room-badge" style={{ marginLeft: 'auto', background: 'var(--accent-dim)', color: 'var(--accent)' }}>You</span>
              </li>
            )}
            {/* Others */}
            {users.map((u) => (
              <li key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', fontSize: '0.875rem' }}>
                <span className="presence-dot" style={{ background: u.color }} />
                <span>{u.name}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-primary)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Set <code style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--accent)' }}>NEXT_PUBLIC_WS_URL</code> to connect to a Cloudflare Durable Object.
              Without it, the room runs in simulation mode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
