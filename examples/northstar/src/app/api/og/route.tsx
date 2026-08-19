/**
 * Dynamic Open Graph image — /api/og?title=…&subtitle=…
 *
 * Rendered by @vercel/og (Satori) into a 1200×630 PNG so every page can
 * declare a unique social card via metadata. The layout is deliberately
 * spare: monogram, title, accent bar — recognisable rather than ornamental.
 *
 * Northstar's OG card uses a warm amber accent on a deep navy gradient,
 * matching the site's brand identity.
 */
import { ImageResponse } from '@vercel/og';
import { type NextRequest, NextResponse } from 'next/server';

const SITE_NAME = 'Northstar';
const ACCENT = '#d4a052';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? SITE_NAME;
  const subtitle = searchParams.get('subtitle') ?? 'Field reports from the edge of human reach';

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
          background: 'linear-gradient(135deg, #0b0d14 0%, #12141f 50%, #0b0d14 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top: monogram + site name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${ACCENT}, #8a6a2e)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            N
          </div>
          <span style={{ fontSize: '28px', fontWeight: 600, color: '#e6e4dc' }}>{SITE_NAME}</span>
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
          <div style={{ fontSize: '28px', color: '#9b988e', fontWeight: 400 }}>{subtitle}</div>
        </div>

        {/* Bottom: accent bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              flex: 1,
              height: '2px',
              background: `linear-gradient(90deg, ${ACCENT}, transparent)`,
            }}
          />
          <span style={{ fontSize: '20px', color: '#5e5c54' }}>substrate</span>
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
