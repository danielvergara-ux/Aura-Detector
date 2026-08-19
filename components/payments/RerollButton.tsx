'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '@/components/providers/SoundProvider';
import { SHARE_COPY } from '@/content/aura-copy';
import { track } from '@/lib/analytics';
import type { AuraScan, RerollCreditSummary } from '@/types/aura';

const DISPLAY_PRICE = process.env.NEXT_PUBLIC_REROLL_DISPLAY_PRICE ?? '$20 MXN';

/**
 * "Alterar el destino."
 *
 * Two states, driven entirely by server truth:
 *  - no credits → start a checkout
 *  - credits    → spend one and get a new number
 *
 * The button never decides whether a payment happened; it asks the server,
 * which asks Mercado Pago. Credits are consumed atomically server-side, so
 * hammering this button cannot produce two rolls from one payment.
 */
export function RerollButton({
  onRerolled,
  secondary,
}: {
  /** Receives the new scan. Omit to navigate to /result/<id>?fresh=1 instead. */
  onRerolled?: (scan: AuraScan) => void;
  secondary?: React.ReactNode;
}) {
  const router = useRouter();
  const { play } = useSound();
  const [credits, setCredits] = useState<RerollCreditSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { credits: RerollCreditSummary };
      setCredits(data.credits);
    } catch {
      // Offline or blocked: fall back to the checkout state.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    play('ui');
    track('reroll_clicked');
    try {
      const response = await fetch('/api/payments/reroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: window.location.pathname }),
      });
      if (!response.ok) {
        setError(
          response.status === 503
            ? 'Los pagos no están disponibles ahora mismo.'
            : 'No se pudo iniciar el pago.',
        );
        return;
      }
      const data = (await response.json()) as { checkoutUrl: string; mock: boolean };
      track('checkout_started', { mock: data.mock });
      window.location.href = data.checkoutUrl;
    } catch {
      setError('No se pudo iniciar el pago.');
    } finally {
      setBusy(false);
    }
  };

  const spendCredit = async () => {
    setBusy(true);
    setError(null);
    play('charge');
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useReroll: true }),
      });

      if (response.status === 402) {
        setError('Ese crédito ya se usó.');
        await refresh();
        return;
      }
      if (!response.ok) {
        setError('El medidor de aura falló. Intenta otra vez.');
        return;
      }

      const data = (await response.json()) as { scan: AuraScan };
      track('reroll_completed', { tier: data.scan.tierId });
      await refresh();

      if (onRerolled) onRerolled(data.scan);
      else router.push(`/result/${data.scan.id}?fresh=1`);
    } catch {
      setError('El medidor de aura falló. Intenta otra vez.');
    } finally {
      setBusy(false);
    }
  };

  const hasCredit = (credits?.available ?? 0) > 0;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {hasCredit ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full flex-col items-center gap-2"
        >
          <span className="hud-label text-aura">{SHARE_COPY.rerollPaid}</span>
          <button
            type="button"
            onClick={spendCredit}
            disabled={busy}
            className="btn-primary w-full disabled:opacity-70"
          >
            {busy ? 'ALTERANDO...' : SHARE_COPY.rerollPaidCta}
          </button>
          <span className="hud-label">
            {credits?.available} crédito{(credits?.available ?? 0) === 1 ? '' : 's'} disponible
            {(credits?.available ?? 0) === 1 ? '' : 's'}
          </span>
        </motion.div>
      ) : (
        <div className="flex w-full flex-col items-center gap-2">
          <span className="hud-label">{SHARE_COPY.rerollTitle}</span>
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy}
            className="btn-ghost w-full border-aura/40 text-white disabled:opacity-60"
          >
            {busy ? 'ABRIENDO PAGO...' : `${SHARE_COPY.rerollCta} · ${DISPLAY_PRICE}`}
          </button>
        </div>
      )}

      {secondary}

      {error ? (
        <p className="hud-label normal-case tracking-normal text-[#ff6b81]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
