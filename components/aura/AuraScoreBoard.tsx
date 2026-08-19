'use client';

import { motion } from 'framer-motion';
import { ScoreCounter } from '@/components/aura/AuraScore';
import { AuraTierBadge } from '@/components/aura/AuraTierBadge';
import { GlitchText } from '@/components/ui/primitives';
import { findEasterEgg } from '@/lib/aura/aura-easter-eggs';
import { formatScore } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { AuraScan, AuraTier } from '@/types/aura';

/** Shared between the animated counter and the static render, so a shared
 *  result and a fresh scan show the number at exactly the same size. */
const SCORE_FONT_SIZE = 'clamp(3.5rem, 24vw, 9rem)';

/**
 * Score + tier + phrase, i.e. the part of the screen that ends up in a
 * screenshot. Easter-egg themes recolour it without changing the layout.
 */
export function AuraScoreBoard({
  scan,
  tier,
  animate,
  onSettled,
}: {
  scan: AuraScan;
  tier: AuraTier;
  animate: boolean;
  onSettled?: () => void;
}) {
  const easterEgg = findEasterEgg(scan.score);
  const glitchy =
    scan.score < 0 || easterEgg?.theme === 'cursed' || easterEgg?.theme === 'glitch' || easterEgg?.theme === 'overflow';

  return (
    <div className="relative flex flex-col items-center gap-4 text-center">
      <motion.span
        className="hud-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        Tu aura
      </motion.span>

      <div className="relative">
        {/* Halo behind the number */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[42vmin] w-[42vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{ background: 'radial-gradient(circle, rgb(var(--aura-rgb) / 0.35), transparent 70%)' }}
          aria-hidden
        />
        {animate ? (
          <ScoreCounter
            target={scan.score}
            onSettled={onSettled}
            style={{ fontSize: SCORE_FONT_SIZE }}
            className={cn('aura-gradient-text font-black', glitchy && 'chromatic')}
          />
        ) : (
          <span
            className={cn(
              'font-display tabular block font-black leading-[0.85] aura-gradient-text',
              glitchy && 'chromatic',
            )}
            style={{ fontSize: SCORE_FONT_SIZE }}
          >
            {formatScore(scan.score)}
          </span>
        )}
      </div>

      <AuraTierBadge tier={tier} rarity={scan.rarity} delay={animate ? 1.6 : 0.1} />

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animate ? 1.9 : 0.2 }}
        className="max-w-xs text-balance text-sm text-white/80"
      >
        {glitchy ? <GlitchText>{scan.message}</GlitchText> : scan.message}
      </motion.p>

      {easterEgg ? (
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: animate ? 2.1 : 0.3 }}
          className="hud-label rounded-full border border-line px-3 py-1 text-aura"
        >
          🥚 {easterEgg.title}
        </motion.span>
      ) : null}
    </div>
  );
}
