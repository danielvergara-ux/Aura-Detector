import { ImageResponse } from 'next/og';
import { bufferImageResponse, logOgFailure, ogFallbackResponse } from '@/lib/share/og';

export const runtime = 'nodejs';
// Rendered on request, never at build time: keeps `next build` independent of
// the @vercel/og runtime being loadable in the build environment.
export const dynamic = 'force-dynamic';
export const alt = 'Aura Scanner — ¿Cuánta aura tienes?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social preview for the landing page. Generated at request time, then cached. */
export default async function OpengraphImage() {
  try {
    return await bufferImageResponse(renderCard());
  } catch (error) {
    logOgFailure('landing', error);
    return ogFallbackResponse();
  }
}

function renderCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 50% 45%, #3a1d8a 0%, #120b28 45%, #050509 75%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: 12,
            opacity: 0.6,
            display: 'flex',
          }}
        >
          AURA / SCANNER
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 900,
            lineHeight: 1,
            marginTop: 24,
            textAlign: 'center',
            display: 'flex',
          }}
        >
          ¿CUÁNTA AURA TIENES?
        </div>
        <div style={{ fontSize: 34, opacity: 0.75, marginTop: 28, display: 'flex' }}>
          La cámara no miente. Probablemente.
        </div>
        <div
          style={{
            marginTop: 46,
            padding: '14px 34px',
            borderRadius: 999,
            border: '2px solid rgba(167,139,255,0.6)',
            fontSize: 26,
            letterSpacing: 6,
            display: 'flex',
          }}
        >
          ESCANEAR MI AURA
        </div>
      </div>
    ),
    size,
  );
}
