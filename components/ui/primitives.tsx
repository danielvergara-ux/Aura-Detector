'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSound } from '@/components/providers/SoundProvider';
import { DISCLAIMER_SHORT, PRIVACY_SHORT } from '@/content/aura-copy';
import { cn } from '@/lib/utils/cn';
import { track } from '@/lib/analytics';

/* ------------------------------------------------------------------ */
/* Sound toggle                                                        */
/* ------------------------------------------------------------------ */

export function SoundToggle({ className }: { className?: string }) {
  const { enabled, toggle, unlock, play } = useSound();

  return (
    <button
      type="button"
      aria-label={enabled ? 'Silenciar sonido' : 'Activar sonido'}
      aria-pressed={enabled}
      onClick={async () => {
        toggle();
        await unlock();
        play('ui');
        track('sound_toggled', { enabled: !enabled });
      }}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/70 text-lg backdrop-blur transition-colors hover:border-white/25',
        className,
      )}
    >
      <span aria-hidden>{enabled ? '🔊' : '🔇'}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Disclaimers                                                         */
/* ------------------------------------------------------------------ */

export function DisclaimerBadge({ className }: { className?: string }) {
  return (
    <Link
      href="/legal"
      className={cn(
        'hud-label inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 transition-colors hover:border-white/25 hover:text-white/80',
        className,
      )}
    >
      <span aria-hidden>⚠</span>
      {DISCLAIMER_SHORT}
    </Link>
  );
}

export function PrivacyNote({ className }: { className?: string }) {
  return <p className={cn('hud-label normal-case tracking-normal', className)}>{PRIVACY_SHORT}</p>;
}

/* ------------------------------------------------------------------ */
/* Glitch text                                                         */
/* ------------------------------------------------------------------ */

export function GlitchText({
  children,
  className,
  active = true,
  as: Tag = 'span',
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  as?: 'span' | 'h1' | 'h2' | 'p';
}) {
  const reduceMotion = useReducedMotion();
  const glitching = active && !reduceMotion;

  return (
    <Tag
      className={cn('relative inline-block', glitching && 'chromatic animate-text-glitch', className)}
      data-text={typeof children === 'string' ? children : undefined}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Marquee                                                             */
/* ------------------------------------------------------------------ */

export function Marquee({ items, className }: { items: readonly string[]; className?: string }) {
  const doubled = [...items, ...items];
  return (
    <div className={cn('relative overflow-hidden', className)} aria-hidden>
      <div className="flex w-max animate-marquee-x gap-8 whitespace-nowrap">
        {doubled.map((item, index) => (
          <span key={`${item}-${index}`} className="hud-label">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error state                                                         */
/* ------------------------------------------------------------------ */

export function ErrorState({
  title,
  body,
  action,
  onAction,
  secondary,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="hud-panel hud-corners mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-8 text-center"
      role="alert"
    >
      <h2 className="font-display text-lg font-bold uppercase tracking-wide text-balance">{title}</h2>
      <p className="text-sm text-muted text-balance">{body}</p>
      <button type="button" onClick={onAction} className="btn-primary mt-2">
        {action}
      </button>
      {secondary}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Rotating loading label                                              */
/* ------------------------------------------------------------------ */

export function LoadingLabel({ labels, className }: { labels: readonly string[]; className?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % labels.length), 900);
    return () => clearInterval(id);
  }, [labels.length]);

  return (
    <span className={cn('hud-label text-aura', className)} aria-live="polite">
      {labels[index]}
    </span>
  );
}
