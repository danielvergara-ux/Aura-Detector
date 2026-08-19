'use client';

import { motion } from 'framer-motion';
import { getTierById } from '@/lib/aura/aura-tiers';
import { tierVarsById } from '@/lib/aura/aura-theme';
import { formatScore } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { AuraTierId } from '@/types/aura';

export interface VersusSide {
  label: string;
  score: number;
  tierId: AuraTierId;
  /** Highlights this side as "you". */
  isSelf?: boolean;
}

/**
 * Head-to-head score comparison.
 *
 * Used today by the challenge verdict. It is also the building block for the
 * planned AURA BATTLE mode (two live players, `AURA CLASH` animation, winner
 * callout) — which is why the layout is symmetric and takes both sides as
 * plain data rather than reading a scan.
 */
export function AuraVersus({
  left,
  right,
  verdict,
  className,
}: {
  left: VersusSide;
  right: VersusSide;
  verdict?: string;
  className?: string;
}) {
  const winner = left.score === right.score ? null : left.score > right.score ? 'left' : 'right';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className={cn('hud-panel hud-corners w-full px-4 py-3', className)}
    >
      <div className="flex items-center justify-between gap-3 text-center">
        <VersusColumn side={left} won={winner === 'left'} />
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted">vs</span>
        <VersusColumn side={right} won={winner === 'right'} />
      </div>

      {verdict ? (
        <p className="mt-2 text-center font-display text-xs font-bold uppercase tracking-[0.14em] aura-text">
          {verdict}
        </p>
      ) : null}
    </motion.div>
  );
}

function VersusColumn({ side, won }: { side: VersusSide; won: boolean }) {
  const tier = getTierById(side.tierId);
  return (
    <div className="min-w-0 flex-1" style={tierVarsById(side.tierId)}>
      <span className="hud-label block truncate">{side.label}</span>
      <span
        className={cn(
          'font-display tabular text-xl font-black',
          won || side.isSelf ? 'aura-text' : 'text-white/70',
        )}
      >
        {formatScore(side.score)}
      </span>
      <span className="hud-label block truncate opacity-70">
        {tier.emoji} {tier.label}
      </span>
    </div>
  );
}
