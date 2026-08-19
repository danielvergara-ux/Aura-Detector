'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { AuraTierBadge } from '@/components/aura/AuraTierBadge';
import { DisclaimerBadge, SoundToggle } from '@/components/ui/primitives';
import { useSound } from '@/components/providers/SoundProvider';
import { getTierById } from '@/lib/aura/aura-tiers';
import { tierVars } from '@/lib/aura/aura-theme';
import { SHARE_COPY } from '@/content/aura-copy';
import { formatScore } from '@/lib/utils/format';
import { track } from '@/lib/analytics';
import type { AuraScan } from '@/types/aura';

/**
 * Landing for a challenge link — the highest-intent entry point in the app.
 *
 * It shows the number to beat and drops straight into the scanner. No
 * explanation, no scroll: the score IS the pitch.
 */
export function ChallengeScreen({ scan }: { scan: AuraScan }) {
  const router = useRouter();
  const { unlock, play } = useSound();
  const [leaving, setLeaving] = useState(false);
  const tier = getTierById(scan.tierId);

  useEffect(() => {
    track('challenge_accepted', { tier: scan.tierId });
    router.prefetch(`/scan?challenge=${scan.id}`);
  }, [router, scan.id, scan.tierId]);

  const accept = async () => {
    setLeaving(true);
    await unlock();
    play('ui');
    router.push(`/scan?challenge=${encodeURIComponent(scan.id)}`);
  };

  return (
    <main
      className="relative flex min-h-screen-dvh flex-col overflow-hidden"
      style={tierVars(tier)}
    >
      <AmbientBackground />

      <header className="safe-top relative z-10 flex items-center justify-between px-5 py-3">
        <Link
          href="/"
          className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-white/60"
        >
          AURA<span className="text-aura">/</span>SCANNER
        </Link>
        <SoundToggle />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="hud-label text-aura"
        >
          Te retaron
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-xs font-display text-xl font-black uppercase leading-tight tracking-tight text-balance"
        >
          {SHARE_COPY.challengeTitle(scan.nickname ?? 'Alguien', scan.score)}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
          className="relative"
        >
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgb(var(--aura-rgb) / 0.4), transparent 70%)' }}
            aria-hidden
          />
          <span
            className="font-display tabular relative block font-black leading-[0.85] aura-gradient-text"
            style={{ fontSize: 'clamp(3.5rem, 22vw, 8rem)' }}
          >
            {formatScore(scan.score)}
          </span>
        </motion.div>

        <AuraTierBadge tier={tier} rarity={scan.rarity} delay={0.25} />

        <p className="max-w-xs text-sm text-muted text-balance">{SHARE_COPY.challengeSubtitle}</p>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={accept}
            disabled={leaving}
            className="btn-primary w-full disabled:opacity-70"
          >
            {leaving ? 'INICIANDO...' : SHARE_COPY.challengeCta}
          </button>
          <Link href="/leaderboard" className="btn-ghost w-full">
            Ver ranking
          </Link>
        </div>
      </div>

      <footer className="safe-bottom relative z-10 flex justify-center px-6 pb-4">
        <DisclaimerBadge />
      </footer>
    </main>
  );
}
