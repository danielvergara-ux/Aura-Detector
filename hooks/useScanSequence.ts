'use client';

import { useEffect, useRef, useState } from 'react';
import { AURA_CLIENT_CONFIG } from '@/lib/aura/aura-config';

export interface ScanSequenceState {
  /** 0..1 */
  progress: number;
  phaseLabel: string;
  phaseIndex: number;
  /** True while the bar is deliberately jammed near the end. */
  stalled: boolean;
  done: boolean;
}

/**
 * The pacing of the fake analysis.
 *
 * Shape: a slightly uneven climb to 99%, a hard stall ("esto no debería ser
 * posible..."), then a snap to 100%. The unevenness matters — a perfectly
 * linear bar reads as a loading spinner, not as a machine struggling.
 */
export function useScanSequence(active: boolean, onComplete?: () => void): ScanSequenceState {
  const [state, setState] = useState<ScanSequenceState>({
    progress: 0,
    phaseLabel: AURA_CLIENT_CONFIG.scanPhases[0]?.label ?? '',
    phaseIndex: 0,
    stalled: false,
    done: false,
  });
  const completedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    completedRef.current = false;

    const total = AURA_CLIENT_CONFIG.scanDurationMs;
    const stallMs = AURA_CLIENT_CONFIG.stall.durationMs;
    const stallAt = AURA_CLIENT_CONFIG.stall.atProgress;
    const climbMs = Math.max(600, total - stallMs);

    let raf = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;

      let progress: number;
      let stalled = false;

      if (elapsed < climbMs) {
        const t = elapsed / climbMs;
        // Ease-out with a small stutter so it never feels mechanical.
        const eased = 1 - Math.pow(1 - t, 1.7);
        const stutter = Math.sin(t * 22) * 0.006;
        progress = Math.min(stallAt, eased * stallAt + stutter);
      } else if (elapsed < climbMs + stallMs) {
        progress = stallAt;
        stalled = true;
      } else {
        progress = 1;
      }

      const phases = AURA_CLIENT_CONFIG.scanPhases;
      let phaseIndex = phases.findIndex((phase) => progress <= phase.until);
      if (phaseIndex < 0) phaseIndex = phases.length - 1;

      const done = progress >= 1;
      setState({
        progress,
        phaseLabel: phases[phaseIndex]?.label ?? '',
        phaseIndex,
        stalled,
        done,
      });

      if (done) {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `onComplete` is intentionally not a dependency: the sequence must not
    // restart if the parent re-creates the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return state;
}
