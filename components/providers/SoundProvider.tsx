'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  playSound,
  startScannerLoop,
  stopAllLoops,
  unlockAudio,
  type SoundName,
} from '@/lib/audio/sound-engine';

interface SoundContextValue {
  enabled: boolean;
  toggle: () => void;
  /** Plays a one-shot, respecting the mute preference. */
  play: (name: SoundName) => void;
  /** Starts the scanner hum. Returns a no-op handle when muted. */
  startScanner: () => { setProgress: (p: number) => void; stop: () => void };
  /** Call from a user gesture before the first sound. */
  unlock: () => Promise<void>;
}

const SoundContext = createContext<SoundContextValue | null>(null);
const STORAGE_KEY = 'aura:sound';

export function SoundProvider({ children }: { children: React.ReactNode }) {
  // Default ON: the reveal is half the product. Muting is one tap away.
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setEnabled(stored === '1');
    } catch {
      // Private mode / storage disabled — keep the default.
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (!next) stopAllLoops();
      else void unlockAudio();
      return next;
    });
  }, []);

  const play = useCallback(
    (name: SoundName) => {
      if (!enabled) return;
      playSound(name);
    },
    [enabled],
  );

  const startScanner = useCallback(() => {
    if (!enabled) return { setProgress: () => {}, stop: () => {} };
    return startScannerLoop();
  }, [enabled]);

  const unlock = useCallback(async () => {
    if (!enabled) return;
    await unlockAudio();
  }, [enabled]);

  useEffect(() => () => stopAllLoops(), []);

  const value = useMemo<SoundContextValue>(
    () => ({ enabled, toggle, play, startScanner, unlock }),
    [enabled, toggle, play, startScanner, unlock],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);
  if (!context) throw new Error('useSound must be used inside <SoundProvider>');
  return context;
}
