'use client';

import { useEffect, useState } from 'react';
import { AURA_CLIENT_CONFIG } from '@/lib/aura/aura-config';
import { useSound } from '@/components/providers/SoundProvider';
import { cn } from '@/lib/utils/cn';

/**
 * Optional display name for the leaderboard.
 *
 * Deliberately AFTER the result, never before the scan: a form in front of the
 * camera is the fastest way to lose someone who arrived from TikTok. The
 * server sanitises whatever arrives here; this is only a first pass so the
 * user sees the rules immediately.
 */
export function NicknameEditor({
  initialNickname,
  className,
}: {
  initialNickname: string | null;
  className?: string;
}) {
  const { play } = useSound();
  const [value, setValue] = useState(initialNickname ?? '');
  const [saved, setSaved] = useState<string | null>(initialNickname);
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setValue(initialNickname ?? '');
    setSaved(initialNickname);
  }, [initialNickname]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = value.trim();
    if (candidate.length < AURA_CLIENT_CONFIG.nickname.minLength) {
      setState('error');
      return;
    }
    setState('saving');
    try {
      const response = await fetch('/api/session/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: candidate }),
      });
      if (!response.ok) {
        setState('error');
        return;
      }
      const data = (await response.json()) as { nickname: string };
      setSaved(data.nickname);
      setValue(data.nickname);
      setState('idle');
      setOpen(false);
      play('ui');
    } catch {
      setState('error');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('hud-label transition-colors hover:text-white', className)}
      >
        {saved ? `@${saved} · cambiar nombre` : 'Ponerte un nombre en el ranking'}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className={cn('flex w-full max-w-xs flex-col gap-2', className)}>
      <label htmlFor="nickname" className="hud-label">
        Tu nombre en el ranking
      </label>
      <div className="flex gap-2">
        <input
          id="nickname"
          name="nickname"
          value={value}
          onChange={(event) => {
            // Mirror the server allowlist so invalid characters never appear.
            setValue(event.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''));
            setState('idle');
          }}
          maxLength={AURA_CLIENT_CONFIG.nickname.maxLength}
          minLength={AURA_CLIENT_CONFIG.nickname.minLength}
          autoComplete="off"
          spellCheck={false}
          placeholder="sigma_alejandro"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 font-mono text-sm text-white placeholder:text-muted/60 focus:border-aura/60 focus:outline-none"
        />
        <button type="submit" disabled={state === 'saving'} className="btn-ghost shrink-0">
          {state === 'saving' ? '...' : 'Guardar'}
        </button>
      </div>
      <p
        className={cn(
          'hud-label normal-case tracking-normal',
          state === 'error' && 'text-[#ff6b81]',
        )}
        role={state === 'error' ? 'alert' : undefined}
      >
        {state === 'error'
          ? `Entre ${AURA_CLIENT_CONFIG.nickname.minLength} y ${AURA_CLIENT_CONFIG.nickname.maxLength} caracteres: letras, números, . _ -`
          : 'Sin espacios. Nada de datos personales.'}
      </p>
    </form>
  );
}
