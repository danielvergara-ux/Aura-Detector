'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { DisclaimerBadge, Marquee, PrivacyNote, SoundToggle } from '@/components/ui/primitives';
import { useSound } from '@/components/providers/SoundProvider';
import { SCAN_TICKER } from '@/content/aura-copy';
import { track } from '@/lib/analytics';

/**
 * The 5-second pitch.
 *
 * Everything above the fold answers one question — "what happens if I press
 * that?" — and the answer is one tap away. No form, no login, no scroll needed.
 */
export function LandingScreen({ challengeId }: { challengeId?: string }) {
  const router = useRouter();
  const { unlock, play } = useSound();
  const reduceMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    track('landing_view');
    // Warm the scan route so the camera screen appears instantly on tap.
    router.prefetch('/scan');
  }, [router]);

  const start = async () => {
    if (leaving) return;
    setLeaving(true);
    // The tap is the gesture that unlocks audio for the whole session.
    await unlock();
    play('ui');
    track('scan_started', { from: challengeId ? 'challenge' : 'landing' });
    const target = challengeId ? `/scan?challenge=${encodeURIComponent(challengeId)}` : '/scan';
    router.push(target);
  };

  return (
    <main className="relative flex min-h-screen-dvh flex-col overflow-hidden">
      <AmbientBackground />

      <header className="safe-top relative z-10 flex items-center justify-between px-5 py-3">
        <span className="font-display text-xs font-bold uppercase tracking-[0.3em] text-white/70">
          AURA<span className="text-aura">/</span>SCANNER
        </span>
        <SoundToggle />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Concentric rings — the "machine" is idling, waiting for a face. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="relative h-[78vmin] w-[78vmin] max-h-[520px] max-w-[520px]">
            <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
            <div className="absolute inset-[12%] rounded-full border border-dashed border-white/10 animate-spin-slow" />
            <div className="absolute inset-[26%] rounded-full border border-aura/25 animate-spin-reverse" />
            <div className="absolute inset-[26%] rounded-full border border-aura/40 animate-pulse-ring" />
            {[0, 90, 180, 270].map((deg) => (
              <div
                key={deg}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-aura shadow-aura"
                style={{ transform: `rotate(${deg}deg) translateY(-39vmin)` }}
              />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <span className="hud-label mb-4 block text-aura">Sistema de medición no oficial</span>

          <h1 className="font-display text-[clamp(2.4rem,11vw,4.5rem)] font-black leading-[0.92] tracking-tight">
            <span className="block aura-gradient-text">¿CUÁNTA</span>
            <span className="block aura-gradient-text">AURA</span>
            <span className="block aura-gradient-text">TIENES?</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xs text-sm text-muted text-balance">
            La cámara no miente. Probablemente.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-10 flex w-full max-w-xs flex-col items-center gap-4"
        >
          <button
            type="button"
            onClick={start}
            disabled={leaving}
            className="btn-primary w-full disabled:opacity-70"
          >
            {leaving ? 'INICIANDO...' : 'ESCANEAR MI AURA'}
          </button>

          {challengeId ? (
            <p className="hud-label normal-case tracking-normal text-white/60">
              Vas a responder un reto 👀
            </p>
          ) : null}

          <Link
            href="/leaderboard"
            className="btn-ghost w-full"
            onClick={() => track('leaderboard_view', { from: 'landing' })}
          >
            Ver ranking global
          </Link>
        </motion.div>
      </div>

      <footer className="safe-bottom relative z-10 flex flex-col items-center gap-3 px-6 pb-4">
        {!reduceMotion ? (
          <Marquee items={SCAN_TICKER} className="w-full max-w-md opacity-60" />
        ) : null}
        <PrivacyNote className="text-center" />
        <DisclaimerBadge />
      </footer>
    </main>
  );
}
