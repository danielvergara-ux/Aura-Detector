'use client';

import { getTierById } from '@/lib/aura/aura-tiers';
import { SHARE_COPY } from '@/content/aura-copy';
import { formatScore } from '@/lib/utils/format';
import type { AuraScan } from '@/types/aura';

/**
 * Story-format share card, drawn entirely on the client.
 *
 * 1080×1920, generated from the score alone. The camera frame is never part of
 * it — no photo of the user is captured, drawn or uploaded anywhere.
 */

const W = 1080;
const H = 1920;

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb.split(' ').join(',')}, ${alpha})`;
}

/** Draws a rounded rect path (older Safari lacks roundRect). */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderShareCard(scan: AuraScan, siteUrl: string): Promise<Blob> {
  const tier = getTierById(scan.tierId);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  // Wait for the webfonts, otherwise the first render falls back to system.
  try {
    await document.fonts.ready;
  } catch {
    /* older browser: continue with fallbacks */
  }

  /* Background ------------------------------------------------------- */
  ctx.fillStyle = '#050509';
  ctx.fillRect(0, 0, W, H);

  const bloom = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.95);
  bloom.addColorStop(0, rgba(tier.rgb, 0.45));
  bloom.addColorStop(0.45, rgba(tier.rgb2, 0.22));
  bloom.addColorStop(1, 'rgba(5,5,9,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  // Grid floor
  ctx.strokeStyle = rgba(tier.rgb, 0.1);
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Vignette
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.72);
  vignette.addColorStop(0, 'rgba(5,5,9,0)');
  vignette.addColorStop(1, 'rgba(5,5,9,0.92)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Decorative rings behind the score
  ctx.save();
  ctx.translate(W / 2, H * 0.44);
  [420, 330, 250].forEach((radius, index) => {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(tier.rgb, 0.18 + index * 0.08);
    ctx.lineWidth = index === 2 ? 4 : 2;
    if (index === 1) ctx.setLineDash([12, 18]);
    else ctx.setLineDash([]);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();

  /* Header ----------------------------------------------------------- */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 30px Orbitron, "Space Grotesk", sans-serif';
  ctx.letterSpacing = '10px';
  ctx.fillText('AURA / SCANNER', W / 2, 150);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '700 44px "Space Grotesk", sans-serif';
  ctx.letterSpacing = '14px';
  ctx.fillText(SHARE_COPY.headline, W / 2, 470);

  /* Score ------------------------------------------------------------ */
  const scoreText = formatScore(scan.score);
  const scoreSize = scoreText.length > 5 ? 250 : scoreText.length > 4 ? 290 : 340;
  ctx.font = `900 ${scoreSize}px Orbitron, "Space Grotesk", sans-serif`;
  ctx.letterSpacing = '0px';

  ctx.shadowColor = rgba(tier.rgb, 0.85);
  ctx.shadowBlur = 90;
  const scoreGradient = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.55);
  scoreGradient.addColorStop(0, '#ffffff');
  scoreGradient.addColorStop(0.6, rgba(tier.rgb, 1));
  scoreGradient.addColorStop(1, rgba(tier.rgb2, 1));
  ctx.fillStyle = scoreGradient;
  ctx.fillText(scoreText, W / 2, H * 0.47);
  ctx.shadowBlur = 0;

  /* Tier ------------------------------------------------------------- */
  const tierLabel = `${tier.emoji} ${tier.label} ${tier.emoji}`;
  ctx.font = '700 52px Orbitron, "Space Grotesk", sans-serif';
  ctx.letterSpacing = '6px';
  const tierWidth = ctx.measureText(tierLabel).width;
  const badgeW = Math.min(W - 120, tierWidth + 90);
  roundedRect(ctx, (W - badgeW) / 2, H * 0.5 + 20, badgeW, 110, 55);
  ctx.fillStyle = rgba(tier.rgb, 0.14);
  ctx.fill();
  ctx.strokeStyle = rgba(tier.rgb, 0.55);
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(tierLabel, W / 2, H * 0.5 + 95);

  /* Phrase ----------------------------------------------------------- */
  ctx.letterSpacing = '0px';
  ctx.font = '500 46px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  const lines = wrapText(ctx, `“${scan.message}”`, W - 220);
  lines.slice(0, 3).forEach((line, index) => {
    ctx.fillText(line, W / 2, H * 0.63 + index * 62);
  });

  /* Nickname --------------------------------------------------------- */
  if (scan.nickname) {
    ctx.font = '500 34px Orbitron, "Space Grotesk", sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillStyle = rgba(tier.rgb, 0.9);
    ctx.fillText(`@${scan.nickname}`.toUpperCase(), W / 2, H * 0.73);
  }

  /* CTA + URL -------------------------------------------------------- */
  ctx.letterSpacing = '8px';
  ctx.font = '900 60px Orbitron, "Space Grotesk", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(SHARE_COPY.cta, W / 2, H * 0.845);

  const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  ctx.letterSpacing = '4px';
  ctx.font = '500 36px "Space Grotesk", sans-serif';
  ctx.fillStyle = rgba(tier.rgb, 1);
  ctx.fillText(host, W / 2, H * 0.885);

  /* Watermark / disclaimer ------------------------------------------- */
  ctx.letterSpacing = '2px';
  ctx.font = '500 24px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillText('Resultado ficticio · solo entretenimiento', W / 2, H - 70);

  // Corner brackets
  ctx.strokeStyle = rgba(tier.rgb, 0.7);
  ctx.lineWidth = 6;
  const m = 60;
  const len = 90;
  [
    [m, m, m + len, m, m, m + len],
    [W - m, m, W - m - len, m, W - m, m + len],
    [m, H - m, m + len, H - m, m, H - m - len],
    [W - m, H - m, W - m - len, H - m, W - m, H - m - len],
  ].forEach(([x, y, x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1 as number, y1 as number);
    ctx.lineTo(x as number, y as number);
    ctx.lineTo(x2 as number, y2 as number);
    ctx.stroke();
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      'image/png',
      0.95,
    );
  });
}

export function shareCardFilename(scan: AuraScan): string {
  return `aura-${scan.score}-${scan.tierId}.png`;
}
