import Link from 'next/link';
import { ERROR_COPY } from '@/content/aura-copy';

export default function NotFound() {
  return (
    <main className="flex min-h-screen-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="font-display text-6xl font-black aura-gradient-text">404</span>
      <h1 className="font-display text-lg font-bold uppercase tracking-wide">
        {ERROR_COPY.notFound.title}
      </h1>
      <p className="max-w-xs text-sm text-muted">{ERROR_COPY.notFound.body}</p>
      <Link href="/scan" className="btn-primary">
        {ERROR_COPY.notFound.action}
      </Link>
    </main>
  );
}
