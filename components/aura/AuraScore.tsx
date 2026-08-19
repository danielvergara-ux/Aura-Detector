'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { AURA_CLIENT_CONFIG } from '@/lib/aura/aura-config';
import { useSound } from '@/components/providers/SoundProvider';
import { formatScore } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface ScoreCounterProps {
  target: number;
  /** Delay before the count-up starts, in ms. */
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  onSettled?: () => void;
}

/**
 * The number climbing to its final value.
 *
 * Never reveal the score outright — the climb IS the payoff. It decelerates
 * hard at the end so the last few digits crawl, and each step ticks.
 */
export function ScoreCounter({ target, delay = 0, className, style, onSettled }: ScoreCounterProps) {
  const [value, setValue] = useState(0);
  const [settled, setSettled] = useState(false);
  const { play } = useSound();
  const reduceMotion = useReducedMotion();
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
    setSettled(false);

    if (reduceMotion) {
      // No strobing digits: show the result, keep the announcement.
      setValue(target);
      setSettled(true);
      onSettled?.();
      return;
    }

    let raf = 0;
    let startedAt = 0;
    let lastTickValue = 0;
    const duration = AURA_CLIENT_CONFIG.scoreCountUpMs;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt - delay;

      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const t = Math.min(1, elapsed / duration);
      // Ease-out-expo: fast start, long crawl at the end.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      // A little noise early on, damped to zero as it settles.
      const jitter = (1 - t) * (Math.random() - 0.5) * Math.abs(target) * 0.06;
      const next = Math.round(target * eased + jitter);
      setValue(next);

      if (Math.abs(next - lastTickValue) > Math.max(1, Math.abs(target) / 28)) {
        lastTickValue = next;
        play('tick');
      }

      if (t >= 1) {
        setValue(target);
        if (!settledRef.current) {
          settledRef.current = true;
          setSettled(true);
          onSettled?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, delay, reduceMotion]);

  return (
    <span
      className={cn(
        'font-display tabular block leading-[0.85] transition-transform duration-300',
        settled ? 'scale-100' : 'scale-[0.97]',
        className,
      )}
      style={style}
      aria-live="polite"
      aria-atomic
    >
      {formatScore(value)}
    </span>
  );
}
