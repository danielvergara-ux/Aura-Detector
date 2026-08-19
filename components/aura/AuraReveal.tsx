'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AuraParticles } from '@/components/aura/AuraParticles';
import { AuraFlash, AuraShockwave } from '@/components/aura/AuraShockwave';
import { AuraScoreBoard } from '@/components/aura/AuraScoreBoard';
import { AuraShareCard } from '@/components/aura/AuraShareCard';
import { AuraVersus } from '@/components/aura/AuraVersus';
import { NicknameEditor } from '@/components/leaderboard/NicknameEditor';
import { RerollButton } from '@/components/payments/RerollButton';
import { useAchievements } from '@/components/providers/AchievementProvider';
import { useSound } from '@/components/providers/SoundProvider';
import { DisclaimerBadge } from '@/components/ui/primitives';
import { achievementsForScan, bumpScanCount } from '@/lib/achievements';
import { AURA_CLIENT_CONFIG } from '@/lib/aura/aura-config';
import { getTierById, isLegendaryTier } from '@/lib/aura/aura-tiers';
import { applyAuraTheme, eggVars, tierVars } from '@/lib/aura/aura-theme';
import { findEasterEgg } from '@/lib/aura/aura-easter-eggs';
import { SHARE_COPY } from '@/content/aura-copy';
import { track } from '@/lib/analytics';
import { formatScore } from '@/lib/utils/format';
import type { AuraScan } from '@/types/aura';

// Only paid for when someone actually breaks 1000.
const LegendaryAuraReveal = dynamic(
  () => import('@/components/aura/LegendaryAuraReveal').then((m) => m.LegendaryAuraReveal),
  { ssr: false },
);

interface AuraRevealProps {
  scan: AuraScan;
  /** Play the full reveal choreography (fresh scan) or show it settled (shared link). */
  animate?: boolean;
  /** Free rescan: sends the user back through the camera flow. */
  onRescan?: () => void;
  /**
   * Paid reroll: receives the already-generated scan. Must NOT restart the
   * camera — the credit is spent and this result is the one the user paid for.
   * When omitted, the button navigates to /result/<id>?fresh=1 instead.
   */
  onRerolled?: (scan: AuraScan) => void;
  rescanLabel?: string;
}

/**
 * The result screen — the thing people screenshot.
 *
 * Animation budget scales with tier intensity: a 12 gets a shrug, a 1000 gets
 * a separate component. Reduced motion strips the shake, the flash and most of
 * the particles while keeping the information intact.
 */
export function AuraReveal({
  scan,
  animate = true,
  onRescan,
  onRerolled,
  rescanLabel,
}: AuraRevealProps) {
  const tier = getTierById(scan.tierId);
  const easterEgg = useMemo(() => findEasterEgg(scan.score), [scan.score]);
  const legendary = isLegendaryTier(tier);
  const reduceMotion = useReducedMotion();
  const { play } = useSound();
  const { unlock } = useAchievements();

  const [phase, setPhase] = useState<'blackout' | 'legendary' | 'reveal'>(
    animate ? 'blackout' : 'reveal',
  );
  const [settled, setSettled] = useState(!animate);

  // Easter eggs repaint the whole screen for the duration of the reveal.
  const palette = { ...tierVars(tier), ...(eggVars(easterEgg?.theme) ?? {}) };

  useEffect(() => {
    applyAuraTheme(tier);
  }, [tier]);

  useEffect(() => {
    unlock(achievementsForScan(scan, bumpScanCount()));
    track('scan_completed', { tier: scan.tierId, rarity: scan.rarity, paid: scan.isPaidReroll });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.id]);

  // Blackout beat, then either the legendary takeover or the normal reveal.
  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(
      () => setPhase(legendary ? 'legendary' : 'reveal'),
      AURA_CLIENT_CONFIG.revealBlackoutMs,
    );
    return () => clearTimeout(timer);
  }, [animate, legendary]);

  useEffect(() => {
    if (phase !== 'reveal' || !animate) return;
    if (easterEgg?.theme === 'jackpot') play('jackpot');
    else if (scan.score < 0 || easterEgg?.theme === 'cursed' || easterEgg?.theme === 'glitch') play('glitch');
    else if (tier.intensity <= 1) play('fail');
    else play('reveal');
  }, [phase, animate, easterEgg, scan.score, tier.intensity, play]);

  const shake = !reduceMotion && animate && tier.intensity >= 4;

  return (
    <div
      className="relative flex min-h-screen-dvh flex-col overflow-hidden bg-bg"
      style={palette}
    >
      {/* Background energy */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute left-1/2 top-[36%] h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px]"
          style={{
            background:
              'radial-gradient(circle, rgb(var(--aura-rgb) / 0.4) 0%, rgb(var(--aura-rgb-2) / 0.2) 45%, transparent 70%)',
            opacity: 0.35 + tier.intensity * 0.1,
          }}
        />
        <div className="grid-floor absolute inset-0 opacity-50" />
        <AuraParticles
          tier={tier}
          density={phase === 'reveal' ? 1 : 0.2}
          className="absolute inset-0 h-full w-full"
        />
        <div className="scanlines absolute inset-0 opacity-60" />
      </div>

      <AnimatePresence>
        {phase === 'legendary' ? (
          <LegendaryAuraReveal
            key="legendary"
            score={scan.score}
            tier={tier}
            onDone={() => setPhase('reveal')}
          />
        ) : null}
      </AnimatePresence>

      {phase === 'blackout' ? (
        <motion.div
          className="fixed inset-0 z-[65] bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden
        />
      ) : null}

      {phase === 'reveal' ? (
        <>
          <AuraFlash trigger={animate && tier.intensity >= 2} />
          <AuraShockwave intensity={tier.intensity} count={tier.intensity >= 4 ? 3 : 2} />
        </>
      ) : null}

      <motion.main
        className="relative z-10 flex flex-1 flex-col items-center justify-between gap-6 px-5 pb-6 pt-4 safe-top safe-bottom"
        animate={
          shake && !settled
            ? { x: [0, -6, 6, -4, 4, 0], y: [0, 4, -4, 3, -2, 0] }
            : { x: 0, y: 0 }
        }
        transition={{ duration: 0.6, repeat: shake && !settled ? 2 : 0 }}
      >
        <header className="flex w-full items-center justify-between">
          <Link
            href="/"
            className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-white/50"
          >
            AURA<span className="text-aura">/</span>SCANNER
          </Link>
          <Link href="/leaderboard" className="hud-label hover:text-white">
            Ranking →
          </Link>
        </header>

        <AuraScoreBoard
          scan={scan}
          tier={tier}
          animate={animate && phase === 'reveal'}
          onSettled={() => setSettled(true)}
        />

        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          {scan.challenge ? <ChallengeVerdict scan={scan} /> : null}

          <AuraShareCard scan={scan} />

          <NicknameEditor initialNickname={scan.nickname} />

          <RerollButton
            onRerolled={onRerolled}
            secondary={
              onRescan ? (
                <button type="button" onClick={onRescan} className="btn-ghost w-full">
                  {rescanLabel ?? 'Escanear otra vez'}
                </button>
              ) : (
                <Link href="/scan" className="btn-ghost w-full">
                  {rescanLabel ?? 'Escanear otra vez'}
                </Link>
              )
            }
          />

          <DisclaimerBadge className="mt-1" />
        </div>
      </motion.main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Challenge comparison                                                */
/* ------------------------------------------------------------------ */

function ChallengeVerdict({ scan }: { scan: AuraScan }) {
  if (!scan.challenge) return null;
  const delta = scan.score - scan.challenge.score;
  const verdict =
    delta === 0
      ? SHARE_COPY.tie
      : delta > 0
        ? `+${formatScore(delta)} · ${SHARE_COPY.win}`
        : SHARE_COPY.lose;

  return (
    <AuraVersus
      left={{ label: 'Tu aura', score: scan.score, tierId: scan.tierId, isSelf: true }}
      right={{
        label: scan.challenge.nickname,
        score: scan.challenge.score,
        tierId: scan.challenge.tierId,
      }}
      verdict={verdict}
    />
  );
}
