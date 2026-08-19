import 'server-only';

import { countRateEvents, recordRateEvent } from '@/lib/supabase/repository';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the window is guaranteed to have room again. */
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Namespaced key, e.g. `scan:session:<id>` or `scan:ip:<hash>`. */
  key: string;
  limit: number;
  windowMinutes: number;
}

/**
 * Sliding-window counter backed by the repository (Postgres in production,
 * an in-process array in local dev).
 *
 * Deliberately simple: the goal is to blunt scripted abuse and accidental
 * loops, not to build a distributed quota system. It fails OPEN — a database
 * hiccup must not take the whole experience down.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowMinutes } = options;
  try {
    const used = await countRateEvents(key, windowMinutes);
    const allowed = used < limit;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - used - (allowed ? 1 : 0)),
      retryAfterSeconds: allowed ? 0 : windowMinutes * 60,
    };
  } catch {
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Records one hit against a bucket. Never throws. */
export async function consumeRateLimit(key: string): Promise<void> {
  try {
    await recordRateEvent(key);
  } catch {
    // Counting is best-effort; losing one event is preferable to a 500.
  }
}
