'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Expanding rings emitted when a high result lands.
 *
 * Transform + opacity only, so it composites on the GPU and never triggers
 * layout. Suppressed entirely under reduced motion.
 */
export function AuraShockwave({
  count = 3,
  delay = 0,
  intensity = 3,
}: {
  count?: number;
  delay?: number;
  intensity?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || intensity < 2) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full border-2"
          style={{ borderColor: 'rgb(var(--aura-rgb) / 0.6)', width: '30vmin', height: '30vmin' }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 4 + intensity * 0.6, opacity: 0 }}
          transition={{
            delay: delay + index * 0.18,
            duration: 1.4,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ))}
    </div>
  );
}

/** Full-bleed flash used at the exact moment of reveal. */
export function AuraFlash({ trigger, delay = 0 }: { trigger: boolean; delay?: number }) {
  const reduceMotion = useReducedMotion();
  if (!trigger) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60] bg-white"
      initial={{ opacity: 0 }}
      // A single soft flash, never a strobe: repeated flashing is a seizure risk.
      animate={{ opacity: reduceMotion ? [0, 0.12, 0] : [0, 0.9, 0] }}
      transition={{ delay, duration: reduceMotion ? 0.4 : 0.5, times: [0, 0.12, 1] }}
      aria-hidden
    />
  );
}
