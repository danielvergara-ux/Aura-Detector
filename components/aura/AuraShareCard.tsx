'use client';

import { useCallback, useState } from 'react';
import { renderShareCard, shareCardFilename } from '@/lib/share/share-card';
import { SHARE_COPY } from '@/content/aura-copy';
import { useSound } from '@/components/providers/SoundProvider';
import { track } from '@/lib/analytics';
import type { AuraScan } from '@/types/aura';
import { cn } from '@/lib/utils/cn';

/**
 * Share actions.
 *
 * Order matters: Web Share first (one tap into TikTok/IG/WhatsApp), then a
 * download, then a challenge link. Every path degrades — a browser without
 * `navigator.share` gets the copy-link fallback instead of a dead button.
 */
export function AuraShareCard({ scan, className }: { scan: AuraScan; className?: string }) {
  const { play } = useSound();
  const [busy, setBusy] = useState<'share' | 'download' | 'challenge' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const resultUrl = `${siteUrl}/result/${scan.id}`;
  const challengeUrl = `${siteUrl}/challenge/${scan.id}`;

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const buildFile = useCallback(async () => {
    const blob = await renderShareCard(scan, siteUrl || 'aura-scanner.app');
    return new File([blob], shareCardFilename(scan), { type: 'image/png' });
  }, [scan, siteUrl]);

  const onShare = async () => {
    setBusy('share');
    play('ui');
    try {
      const file = await buildFile();
      const shareData: ShareData = {
        title: 'Aura Scanner',
        text: `Mi aura: ${scan.score}. ${SHARE_COPY.cta}`,
        url: resultUrl,
      };

      // Not every platform accepts files; fall back to a text+url share.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(resultUrl);
        flash(SHARE_COPY.copied);
      }
      track('result_shared', { tier: scan.tierId });
    } catch (error) {
      // AbortError just means the user dismissed the sheet.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        flash('No se pudo compartir');
      }
    } finally {
      setBusy(null);
    }
  };

  const onDownload = async () => {
    setBusy('download');
    play('ui');
    try {
      const file = await buildFile();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      track('result_downloaded', { tier: scan.tierId });
    } catch {
      flash('No se pudo descargar');
    } finally {
      setBusy(null);
    }
  };

  const onChallenge = async () => {
    setBusy('challenge');
    play('ui');
    try {
      const text = `${SHARE_COPY.challengeTitle(scan.nickname ?? 'alguien', scan.score)} ${SHARE_COPY.challengeSubtitle}`;
      if (navigator.share) {
        await navigator.share({ title: 'Aura Scanner', text, url: challengeUrl });
      } else {
        await navigator.clipboard.writeText(challengeUrl);
        flash(SHARE_COPY.copied);
      }
      track('challenge_created', { tier: scan.tierId });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        flash('No se pudo crear el reto');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('relative flex w-full flex-col gap-2', className)}>
      <button type="button" onClick={onShare} disabled={busy !== null} className="btn-primary w-full">
        {busy === 'share' ? 'GENERANDO...' : 'COMPARTIR'}
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={busy !== null}
          className="btn-ghost flex-1"
        >
          {busy === 'download' ? '...' : 'Descargar'}
        </button>
        <button
          type="button"
          onClick={onChallenge}
          disabled={busy !== null}
          className="btn-ghost flex-1"
        >
          {busy === 'challenge' ? '...' : 'Retar a un amigo'}
        </button>
      </div>

      {toast ? (
        <p className="hud-label absolute -top-7 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-3 py-1 text-white">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
