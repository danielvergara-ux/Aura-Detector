'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  getAchievement,
  loadUnlocked,
  persistUnlocked,
  type Achievement,
} from '@/lib/achievements';

interface AchievementContextValue {
  unlocked: string[];
  all: readonly Achievement[];
  /** Unlocks ids and queues a popup for the newly earned ones. */
  unlock: (ids: string[]) => void;
}

const AchievementContext = createContext<AchievementContextValue | null>(null);

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [queue, setQueue] = useState<Achievement[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUnlocked(loadUnlocked());
  }, []);

  const unlock = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setUnlocked((previous) => {
      const fresh = ids.filter((id) => !previous.includes(id));
      if (fresh.length === 0) return previous;
      const next = [...previous, ...fresh];
      persistUnlocked(next);
      const popups = fresh
        .map((id) => getAchievement(id))
        .filter((a): a is Achievement => Boolean(a));
      setQueue((current) => [...current, ...popups]);
      return next;
    });
  }, []);

  // Show one popup at a time so a triple unlock does not cover the reveal.
  useEffect(() => {
    if (queue.length === 0) return;
    timer.current = setTimeout(() => setQueue((current) => current.slice(1)), 3400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [queue]);

  const value = useMemo<AchievementContextValue>(
    () => ({ unlocked, all: ACHIEVEMENTS, unlock }),
    [unlocked, unlock],
  );

  const current = queue[0];

  return (
    <AchievementContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center safe-top"
        aria-live="polite"
      >
        <AnimatePresence>
          {current ? (
            <motion.div
              key={current.id}
              initial={{ y: -60, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="hud-panel hud-corners mx-3 mt-2 flex items-center gap-3 px-4 py-3 shadow-aura"
            >
              <span className="text-2xl" aria-hidden>
                {current.emoji}
              </span>
              <span className="min-w-0">
                <span className="hud-label block text-aura">Logro desbloqueado</span>
                <span className="block font-display text-sm font-bold tracking-wide">
                  {current.title}
                </span>
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AchievementContext.Provider>
  );
}

export function useAchievements(): AchievementContextValue {
  const context = useContext(AchievementContext);
  if (!context) throw new Error('useAchievements must be used inside <AchievementProvider>');
  return context;
}
