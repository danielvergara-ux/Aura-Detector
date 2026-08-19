'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AURA_CLIENT_CONFIG } from '@/lib/aura/aura-config';
import { AuraParticles } from '@/components/aura/AuraParticles';
import { AuraShockwave } from '@/components/aura/AuraShockwave';
import { useSound } from '@/components/providers/SoundProvider';
import { formatScore } from '@/lib/utils/format';
import type { AuraTier } from '@/types/aura';

/**
 * The 1000+ takeover.
 *
 * Structure: darkness, a beat of silence, the number arriving slowly, then
 * everything at once. It is a separate component from the normal reveal
 * because it should never cost anything on a scan that does not need it —
 * the parent lazy-loads it.
 */
export function LegendaryAuraReveal({
  score,
  tier,
  onDone,
}: {
  score: number;
  tier: AuraTier;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<'silence' | 'arrival' | 'impact'>('silence');
  const { play } = useSound();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const silence = AURA_CLIENT_CONFIG.legendarySilenceMs;
    const timers = [
      setTimeout(() => {
        setStage('arrival');
        play('legendary');
      }, silence),
      setTimeout(() => setStage('impact'), silence + 2200),
      setTimeout(onDone, silence + 4200),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {stage !== 'silence' ? (
        <>
          <AuraParticles
            tier={tier}
            mode="burst"
            density={stage === 'impact' ? 1.4 : 0.6}
            className="absolute inset-0 h-full w-full"
          />
          <AuraShockwave count={4} intensity={5} delay={0.1} />
          {/* Rays */}
          {!reduceMotion
            ? Array.from({ length: 12 }).map((_, index) => (
                <motion.span
                  key={index}
                  className="absolute left-1/2 top-1/2 h-[140vmax] w-[2px] origin-center"
                  style={{
                    background:
                      'linear-gradient(to bottom, transparent, rgb(var(--aura-rgb) / 0.55), transparent)',
                    transform: `translate(-50%,-50%) rotate(${index * 15}deg)`,
                  }}
                  initial={{ opacity: 0, scaleY: 0.2 }}
                  animate={{ opacity: [0, 0.9, 0.25], scaleY: 1 }}
                  transition={{ duration: 2.4, delay: 0.15 + index * 0.03 }}
                />
              ))
            : null}
        </>
      ) : null}

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <motion.span
          className="hud-label mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: stage === 'silence' ? [0, 0.7, 0] : 0.7 }}
          transition={{ duration: 1.6, repeat: stage === 'silence' ? Infinity : 0 }}
        >
          {stage === 'silence' ? 'el escáner dejó de responder' : 'lectura fuera de rango'}
        </motion.span>

        {stage !== 'silence' ? (
          <motion.span
            className="font-display tabular block font-black leading-[0.85] aura-gradient-text"
            style={{ fontSize: 'clamp(4rem, 26vw, 12rem)' }}
            initial={{ opacity: 0, scale: 0.6, filter: 'blur(24px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {formatScore(score)}
          </motion.span>
        ) : null}

        {stage === 'impact' ? (
          <motion.p
            className="mt-6 max-w-xs font-display text-base font-black uppercase leading-tight tracking-[0.14em] text-white text-balance"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            EL ESCÁNER NO ESTABA PREPARADO PARA TI
          </motion.p>
        ) : null}
      </div>
    </motion.div>
  );
}

export default LegendaryAuraReveal;
