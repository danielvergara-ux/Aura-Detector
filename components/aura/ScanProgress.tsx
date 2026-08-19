'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SCAN_TICKER } from '@/content/aura-copy';
import type { ScanSequenceState } from '@/hooks/useScanSequence';
import { cn } from '@/lib/utils/cn';

/**
 * Progress readout for the analysis.
 *
 * Three layers of information, on purpose: a phase title (what the machine
 * claims to be doing), a bar (how far along), and a nonsense ticker (that it
 * is working hard). The stall state gets its own visual treatment.
 */
export function ScanProgress({ sequence }: { sequence: ScanSequenceState }) {
  const [tickerIndex, setTickerIndex] = useState(0);
  const percent = Math.round(sequence.progress * 100);

  useEffect(() => {
    const id = setInterval(() => {
      setTickerIndex((index) => (index + 1) % SCAN_TICKER.length);
    }, 780);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-2 flex items-end justify-between gap-3">
        <AnimatePresence mode="wait">
          <motion.span
            key={sequence.phaseLabel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'font-display text-xs font-bold uppercase tracking-[0.18em]',
              sequence.stalled ? 'chromatic animate-flicker text-white' : 'aura-text',
            )}
          >
            {sequence.phaseLabel}
          </motion.span>
        </AnimatePresence>

        <span
          className={cn(
            'font-display tabular text-2xl font-black leading-none',
            sequence.stalled ? 'chromatic text-white' : 'text-white',
          )}
        >
          {percent}
          <span className="text-sm text-muted">%</span>
        </span>
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, rgb(var(--aura-rgb-2)), rgb(var(--aura-rgb)))',
            boxShadow: '0 0 18px rgb(var(--aura-rgb) / 0.8)',
          }}
          animate={{ width: `${percent}%` }}
          transition={{ ease: 'linear', duration: 0.12 }}
        />
        {/* Segment ticks, so the bar reads as instrumentation. */}
        <div className="absolute inset-0 flex justify-between px-[2px]" aria-hidden>
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} className="h-full w-px bg-bg/70" />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        <AnimatePresence mode="wait">
          <motion.span
            key={tickerIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="truncate"
          >
            {SCAN_TICKER[tickerIndex]}
          </motion.span>
        </AnimatePresence>
        <span className="shrink-0 tabular opacity-60">
          {String(Math.round(sequence.progress * 4096)).padStart(4, '0')}
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        Progreso del análisis: {percent} por ciento.
      </p>
    </div>
  );
}
