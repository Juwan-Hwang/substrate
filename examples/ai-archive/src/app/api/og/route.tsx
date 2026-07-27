/**
 * `/api/og` — dynamic Open Graph image (Edge runtime).
 *
 * Renders a 1200×630 card with @vercel/og (Satori). Used by the layout
 * metadata as the default `og:image`, and by individual surfaces via
 * `?title=…&subtitle=…`.
 */
import { ImageResponse } from '@vercel/og';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? 'AI Archive';
  const subtitle = searchParams.get('subtitle') ?? 'Hybrid search + RAG';
  const accent = '#6366f1';

  try {
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #07080c 0%, #0e1018 55%, #07080c 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: `linear-gradient(135deg, ${accent}, #22d3ee)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            A
          </div>
          <span style={{ fontSize: '28px', fontWeight: 600, color: '#e7e9f2' }}>AI Archive</span>
        </div>

        {/* Title + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              fontSize: title.length > 38 ? '52px' : '68px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '28px', color: '#a7adc2', fontWeight: 400 }}>{subtitle}</div>
        </div>

        {/* Tag row + accent bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {['Hybrid Search', 'RAG', 'Citations'].map((t) => (
            <span
              key={t}
              style={{
                fontSize: '20px',
                color: '#c7d2fe',
                padding: '6px 16px',
                borderRadius: '999px',
                background: 'rgba(99, 102, 241, 0.16)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
              }}
            >
              {t}
            </span>
          ))}
          <div
            style={{
              flex: 1,
              height: '2px',
              background: `linear-gradient(90deg, ${accent}, transparent)`,
            }}
          />
        </div>
      </div>,
      { width: 1200, height: 630 },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to generate OG image' }, { status: 500 });
  }
}
