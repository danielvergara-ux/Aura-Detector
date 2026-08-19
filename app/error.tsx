'use client';

import { useEffect } from 'react';
import { ERROR_COPY } from '@/content/aura-copy';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the digest only — never the message, which may echo request data.
    console.error('[aura:render]', error.digest ?? 'unknown');
  }, [error]);

  return (
    <main className="flex min-h-screen-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="font-display text-5xl font-black chromatic">💀</span>
      <h1 className="font-display text-lg font-bold uppercase tracking-wide">
        {ERROR_COPY.server.title}
      </h1>
      <p className="max-w-xs text-sm text-muted">{ERROR_COPY.server.body}</p>
      <button type="button" onClick={reset} className="btn-primary">
        {ERROR_COPY.server.action}
      </button>
    </main>
  );
}
