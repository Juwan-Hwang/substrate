/**
 * Dynamic Open Graph image — /api/og?title=…&subtitle=…
 *
 * Rendered by @vercel/og (Satori) into a 1200×630 PNG so every page can
 * declare a unique social card via metadata. The layout is deliberately
 * spare: monogram, title, accent bar — recognisable rather than ornamental.
 *
 * Note: Next.js 16's `cacheComponents` (PPR) is incompatible with the Edge
 * runtime on route handlers, so this route runs on the Node.js runtime.
 * The image is still generated dynamically per request and cached at the
 * edge via Next.js' built-in CDN caching.
 */
import { ImageResponse } from '@vercel/og';
import { type NextRequest, NextResponse } from 'next/server';

const SITE_NAME = 'Minimal Site';
const ACCENT = '#7C8BA0';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? SITE_NAME;
  const subtitle = searchParams.get('subtitle') ?? 'A static content site on substrate';

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
          background: 'linear-gradient(135deg, #0a0a0c 0%, #131316 50%, #0a0a0c 100%)',
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
              background: `linear-gradient(135deg, ${ACCENT}, #4a5568)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            M
          </div>
          <span style={{ fontSize: '28px', fontWeight: 600, color: '#e8e8ea' }}>{SITE_NAME}</span>
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
          <div style={{ fontSize: '28px', color: '#999', fontWeight: 400 }}>{subtitle}</div>
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
          <span style={{ fontSize: '20px', color: '#666' }}>substrate</span>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (_err) {
    return NextResponse.json({ error: 'Failed to generate OG image' }, { status: 500 });
  }
}
