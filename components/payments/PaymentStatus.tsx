'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { ErrorState, LoadingLabel } from '@/components/ui/primitives';
import { ERROR_COPY, LOADING_LABELS, SHARE_COPY } from '@/content/aura-copy';
import { track } from '@/lib/analytics';
import type { PaymentStatus as Status } from '@/types/aura';

/**
 * Post-checkout screen.
 *
 * The redirect back from Mercado Pago proves nothing, so this polls our own
 * API, which verifies the payment against the provider. Until the server says
 * "approved", nothing is granted and nothing is claimed on screen.
 */
export function PaymentStatusScreen({
  paymentId,
  returnPath,
}: {
  paymentId: string;
  returnPath: string;
}) {
  const [status, setStatus] = useState<Status | 'unknown'>('pending');
  const [attempts, setAttempts] = useState(0);
  const reported = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await fetch(`/api/payments/${paymentId}`, { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setStatus('unknown');
          return;
        }
        const data = (await response.json()) as { status: Status };
        if (cancelled) return;
        setStatus(data.status);

        if (data.status === 'approved') {
          if (!reported.current) {
            reported.current = true;
            track('payment_completed');
          }
          return;
        }
        if (data.status === 'pending' && attempts < 12) {
          // Back off gently: webhooks usually land within a few seconds.
          timer = setTimeout(() => setAttempts((a) => a + 1), 1500 + attempts * 400);
        }
      } catch {
        if (!cancelled) setStatus('unknown');
      }
    };

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [paymentId, attempts]);

  return (
    <main className="relative flex min-h-screen-dvh flex-col items-center justify-center overflow-hidden px-6">
      <AmbientBackground />

      <div className="relative z-10 w-full max-w-sm">
        {status === 'approved' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hud-panel hud-corners flex flex-col items-center gap-4 px-6 py-8 text-center shadow-aura"
          >
            <span className="hud-label text-aura">Pago confirmado</span>
            <h1 className="font-display text-xl font-black uppercase tracking-wide aura-gradient-text">
              {SHARE_COPY.rerollPaid}
            </h1>
            <p className="text-sm text-muted">{SHARE_COPY.rerollNote}</p>
            <Link href={returnPath} className="btn-primary mt-2 w-full">
              {SHARE_COPY.rerollPaidCta}
            </Link>
          </motion.div>
        ) : null}

        {status === 'pending' ? (
          <div className="hud-panel hud-corners flex flex-col items-center gap-4 px-6 py-10 text-center">
            <LoadingLabel labels={LOADING_LABELS} />
            <p className="text-sm text-muted">
              Confirmando el pago con el proveedor. No cierres esta pantalla.
            </p>
            {attempts >= 10 ? (
              <p className="hud-label normal-case tracking-normal">
                Está tardando más de lo normal 💀 Puedes volver y revisar en un momento.
              </p>
            ) : null}
            <Link href={returnPath} className="btn-ghost w-full">
              Volver
            </Link>
          </div>
        ) : null}

        {status === 'rejected' || status === 'cancelled' ? (
          <ErrorState
            title={ERROR_COPY.paymentRejected.title}
            body={ERROR_COPY.paymentRejected.body}
            action={ERROR_COPY.paymentRejected.action}
            onAction={() => {
              window.location.href = returnPath;
            }}
          />
        ) : null}

        {status === 'refunded' || status === 'unknown' ? (
          <ErrorState
            title={ERROR_COPY.server.title}
            body="No pudimos confirmar el estado del pago. Si se te cobró, tu crédito aparecerá solo."
            action="Volver"
            onAction={() => {
              window.location.href = returnPath;
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
