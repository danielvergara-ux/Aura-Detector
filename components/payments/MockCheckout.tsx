'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

/** Local-only checkout stand-in. See app/reroll/mock/page.tsx. */
export function MockCheckout({
  paymentId,
  returnPath,
}: {
  paymentId: string;
  returnPath: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/payments/mock-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      if (!response.ok) {
        setError('No se pudo aprobar el pago simulado.');
        return;
      }
      router.push(`/reroll/return?payment=${paymentId}&return=${encodeURIComponent(returnPath)}`);
    } catch {
      setError('No se pudo aprobar el pago simulado.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen-dvh items-center justify-center overflow-hidden px-6">
      <AmbientBackground />
      <div className="hud-panel hud-corners relative z-10 flex w-full max-w-sm flex-col items-center gap-4 px-6 py-8 text-center">
        <span className="hud-label text-aura">Modo desarrollo</span>
        <h1 className="font-display text-lg font-black uppercase tracking-wide">
          Checkout simulado
        </h1>
        <p className="text-sm text-muted">
          Mercado Pago no está configurado. Este paso reemplaza el checkout real para poder probar
          el flujo de reroll de principio a fin.
        </p>
        <button type="button" onClick={approve} disabled={busy} className="btn-primary w-full">
          {busy ? 'PROCESANDO...' : 'SIMULAR PAGO APROBADO'}
        </button>
        <button type="button" onClick={() => router.push(returnPath)} className="btn-ghost w-full">
          Cancelar
        </button>
        {error ? (
          <p className="hud-label normal-case tracking-normal text-[#ff6b81]">{error}</p>
        ) : null}
      </div>
    </main>
  );
}
