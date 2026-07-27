/**
 * @vercel/og — dynamic Open Graph image generation.
 *
 * Generates OG images at /api/og?title=...&subtitle=...
 * Uses ImageResponse from @vercel/og (Satori) to render React/CSS to PNG.
 *
 * Used by:
 *  - Article pages: <meta og:image="/api/og?title=Article+Title" />
 *  - Default page: <meta og:image="/api/og" />
 */
import { ImageResponse } from '@vercel/og';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const FONT_FAMILY = 'sans-serif';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? 'Aevum';
  const subtitle = searchParams.get('subtitle') ?? 'A personal site platform';
  const accent = searchParams.get('accent') ?? '#AF52DE';

  try {
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #0a0a0c 100%)',
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${accent}, #007AFF)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            A
          </div>
          <span style={{ fontSize: '28px', fontWeight: 600, color: '#e0e0e6' }}>Aevum</span>
        </div>

        {/* Center: title + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              fontSize: title.length > 40 ? '48px' : '64px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '28px', color: '#8e8e93', fontWeight: 400 }}>{subtitle}</div>
        </div>

        {/* Bottom: accent bar + subsystem tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['Lattice', 'Crucible', 'Archive'].map((s) => (
              <span
                key={s}
                style={{
                  fontSize: '20px',
                  color: '#e0e0e6',
                  padding: '6px 16px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid rgba(255, 255, 255, 0.12)`,
                }}
              >
                {s}
              </span>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              height: '2px',
              background: `linear-gradient(90deg, ${accent}, transparent)`,
            }}
          />
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to generate OG image' }, { status: 500 });
  }
}
