'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { DisclaimerBadge, LoadingLabel } from '@/components/ui/primitives';
import { getTierById } from '@/lib/aura/aura-tiers';
import { tierVarsById } from '@/lib/aura/aura-theme';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { LOADING_LABELS } from '@/content/aura-copy';
import { formatRelativeDate, formatScore } from '@/lib/utils/format';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils/cn';
import type { LeaderboardEntry } from '@/types/aura';

/**
 * Global ranking.
 *
 * Nicknames and scores only — never a session id, never anything that could
 * identify a person. When Supabase is configured, a Realtime subscription
 * refetches the board as new scans land, so it feels alive during a spike.
 */
export function Leaderboard({ initialEntries }: { initialEntries: LeaderboardEntry[] }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [loading, setLoading] = useState(initialEntries.length === 0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { entries: LeaderboardEntry[] };
      setEntries(data.entries);
    } catch {
      // Keep whatever we already had on screen.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    track('leaderboard_view');
    if (initialEntries.length === 0) void refresh();
  }, [initialEntries.length, refresh]);

  // Live updates, when available.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('aura-leaderboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'aura_scans' }, () => {
        // Debounce: a viral moment can produce a lot of inserts per second.
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 1200);
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <main className="relative min-h-screen-dvh overflow-hidden">
      <AmbientBackground className="opacity-70" />

      <div className="relative z-10 mx-auto flex min-h-screen-dvh w-full max-w-lg flex-col gap-5 px-5 py-6 safe-top safe-bottom">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-white/60"
          >
            ← AURA<span className="text-aura">/</span>SCANNER
          </Link>
          <Link href="/scan" className="hud-label hover:text-white">
            Escanear →
          </Link>
        </header>

        <div className="text-center">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight aura-gradient-text">
            Aura Leaderboard
          </h1>
          <p className="hud-label mt-2">Los que la máquina no pudo ignorar</p>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <LoadingLabel labels={LOADING_LABELS} />
          </div>
        ) : entries.length === 0 ? (
          <div className="hud-panel hud-corners flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <p className="text-sm text-muted">
              Nadie ha registrado aura todavía. Alguien tiene que ser el primero.
            </p>
            <Link href="/scan" className="btn-primary">
              ESCANEAR MI AURA
            </Link>
          </div>
        ) : (
          <ol className="flex flex-1 flex-col gap-2">
            {entries.map((entry, index) => (
              <LeaderboardRow key={entry.scanId} entry={entry} index={index} />
            ))}
          </ol>
        )}

        <footer className="flex flex-col items-center gap-3 pb-2">
          <Link href="/scan" className="btn-primary w-full max-w-xs">
            ESCANEAR MI AURA
          </Link>
          <DisclaimerBadge />
        </footer>
      </div>
    </main>
  );
}

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const tier = getTierById(entry.tierId);
  const podium = entry.rank <= 3;

  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.5) }}
      style={tierVarsById(entry.tierId)}
      className={cn(
        'relative flex items-center gap-3 rounded-2xl border px-4 py-3',
        podium ? 'border-aura/40 bg-surface/80 shadow-aura' : 'border-line bg-surface/50',
      )}
    >
      <span
        className={cn(
          'font-display tabular w-9 shrink-0 text-center text-sm font-black',
          podium ? 'aura-text' : 'text-muted',
        )}
      >
        {entry.rank}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold tracking-wide">{entry.nickname}</p>
        <p className="hud-label truncate">
          {tier.emoji} {tier.label} · {formatRelativeDate(entry.createdAt)}
        </p>
      </div>

      <Link
        href={`/result/${entry.scanId}`}
        className="font-display tabular shrink-0 text-lg font-black aura-text"
        aria-label={`Ver resultado de ${entry.nickname}: ${entry.score} de aura`}
      >
        {formatScore(entry.score)}
      </Link>
    </motion.li>
  );
}
