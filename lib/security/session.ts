import 'server-only';

import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { ensureSession } from '@/lib/supabase/repository';
import type { SessionRow } from '@/lib/supabase/types';
import { env } from '@/lib/utils/env';

/**
 * Anonymous identity.
 *
 * No sign-up, no email, no fingerprinting. A random opaque id lives in an
 * httpOnly cookie; the server maps it to a session row. Because the cookie is
 * httpOnly, page scripts (and anything injected into them) cannot read it.
 *
 * Supabase Auth can later be layered on top by attaching a user_id to the same
 * session row — the rest of the app does not need to change.
 */

export const SESSION_COOKIE = 'aura_sid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function newAnonymousId(): string {
  return randomBytes(32).toString('base64url');
}

/** Reads the anonymous id from the request, or mints a fresh one. */
export async function getOrCreateSession(): Promise<{ session: SessionRow; isNew: boolean }> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  const anonymousId = existing && existing.length >= 16 ? existing : newAnonymousId();
  const session = await ensureSession(anonymousId);

  if (anonymousId !== existing) {
    // Route handlers and server actions may write cookies; RSC render cannot.
    try {
      store.set({
        name: SESSION_COOKIE,
        value: anonymousId,
        httpOnly: true,
        sameSite: 'lax',
        secure: env.isProduction,
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      });
    } catch {
      // Read-only cookie context (server component render). The caller will
      // get a session anyway; the cookie is set on the next mutating request.
    }
  }

  return { session, isNew: anonymousId !== existing };
}

/** Session lookup that never creates anything — for read-only render paths. */
export async function getExistingSession(): Promise<SessionRow | null> {
  const store = await cookies();
  const anonymousId = store.get(SESSION_COOKIE)?.value;
  if (!anonymousId) return null;
  return ensureSession(anonymousId);
}

/**
 * Pseudonymous client key for coarse rate limiting.
 *
 * The raw IP is never stored: it is salted with a server-side secret and
 * truncated. It cannot be reversed and is not used for anything except
 * counting requests in a time window.
 */
export async function getClientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    headerList.get('cf-connecting-ip') ||
    'unknown';
  const salt = env.supabase.serviceRoleKey ?? 'aura-scanner-local-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
