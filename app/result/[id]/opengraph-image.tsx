import { ImageResponse } from 'next/og';
import { loadScan } from '@/lib/aura/scan-service';
import { getTierById } from '@/lib/aura/aura-tiers';
import { formatScore } from '@/lib/utils/format';
import { bufferImageResponse, logOgFailure, ogFallbackResponse } from '@/lib/share/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Resultado de Aura Scanner';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Per-result social card. This is what shows up when someone drops their
 * result link in a group chat, so it leads with the number.
 */
export default async function ResultOgImage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    return await bufferImageResponse(await renderCard(id));
  } catch (error) {
    logOgFailure('result', error);
    return ogFallbackResponse();
  }
}

async function renderCard(id: string) {
  const scan = await loadScan(id).catch(() => null);
  const tier = scan ? getTierById(scan.tierId) : null;
  const rgb = tier ? tier.rgb.split(' ').join(',') : '167,139,255';
  const rgb2 = tier ? tier.rgb2.split(' ').join(',') : '74,32,180';

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
          background: `radial-gradient(circle at 50% 42%, rgba(${rgb},0.45) 0%, rgba(${rgb2},0.35) 40%, #050509 75%)`,
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: 10, opacity: 0.6, display: 'flex' }}>
          MI AURA
        </div>
        <div
          style={{
            fontSize: scan && Math.abs(scan.score) > 999 ? 190 : 220,
            fontWeight: 900,
            lineHeight: 1,
            display: 'flex',
          }}
        >
          {scan ? formatScore(scan.score) : '???'}
        </div>
        <div
          style={{
            marginTop: 10,
            padding: '12px 30px',
            borderRadius: 999,
            border: `2px solid rgba(${rgb},0.6)`,
            background: `rgba(${rgb},0.12)`,
            fontSize: 30,
            letterSpacing: 6,
            display: 'flex',
          }}
        >
          {tier ? `${tier.emoji} ${tier.label} ${tier.emoji}` : 'AURA NO ENCONTRADA'}
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 30,
            opacity: 0.8,
            maxWidth: 900,
            textAlign: 'center',
            display: 'flex',
          }}
        >
          {scan ? `“${scan.message}”` : 'Este resultado se desvaneció.'}
        </div>
        <div style={{ marginTop: 40, fontSize: 26, letterSpacing: 8, opacity: 0.7, display: 'flex' }}>
          ¿CUÁNTA AURA TIENES?
        </div>
      </div>
    ),
    size,
  );
}
