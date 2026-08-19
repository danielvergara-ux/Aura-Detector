'use client';

import { motion } from 'framer-motion';
import type { AuraRarity, AuraTier } from '@/types/aura';
import { cn } from '@/lib/utils/cn';

const RARITY_LABEL: Record<AuraRarity, string> = {
  common: 'COMÚN',
  uncommon: 'POCO COMÚN',
  rare: 'RARO',
  very_rare: 'MUY RARO',
  legendary: 'LEGENDARIO',
  mythic: 'MÍTICO',
};

export function AuraTierBadge({
  tier,
  rarity,
  delay = 0,
  className,
}: {
  tier: AuraTier;
  rarity?: AuraRarity;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 18 }}
      className={cn('flex flex-col items-center gap-2', className)}
    >
      <div
        className="flex items-center gap-2 rounded-full border px-4 py-2"
        style={{
          borderColor: 'rgb(var(--aura-rgb) / 0.5)',
          background:
            'linear-gradient(120deg, rgb(var(--aura-rgb) / 0.16), rgb(var(--aura-rgb-2) / 0.1))',
          boxShadow: '0 0 30px -8px rgb(var(--aura-rgb) / 0.8)',
        }}
      >
        <span aria-hidden className="text-base">
          {tier.emoji}
        </span>
        <span className="font-display text-sm font-black uppercase tracking-[0.16em] aura-text">
          {tier.label}
        </span>
        <span aria-hidden className="text-base">
          {tier.emoji}
        </span>
      </div>
      {rarity ? <span className="hud-label">{RARITY_LABEL[rarity]}</span> : null}
    </motion.div>
  );
}

export { RARITY_LABEL };
