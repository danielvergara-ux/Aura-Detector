import 'server-only';

import { getServerSupabase } from '@/lib/supabase/server';
import { memoryDb } from '@/lib/supabase/memory-store';
import { AURA_CONFIG } from '@/lib/aura/aura-config';
import type { PaymentRow, RerollCreditRow, ScanRow, SessionRow } from '@/lib/supabase/types';
import type {
  AuraRarity,
  AuraTierId,
  LeaderboardEntry,
  PaymentStatus,
  RerollCreditSummary,
} from '@/types/aura';

/**
 * Every database access in the app funnels through this module.
 *
 * Two backends implement the same contract:
 *  - Supabase (production)
 *  - an in-process map store (local dev without credentials)
 */

export interface NewScan {
  sessionId: string;
  score: number;
  tier: AuraTierId;
  rarity: AuraRarity;
  message: string;
  easterEggId: string | null;
  isPaidReroll: boolean;
  challengeScanId: string | null;
}

export interface NewPayment {
  id: string;
  sessionId: string;
  amount: number;
  currency: string;
  preferenceId: string | null;
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export async function ensureSession(anonymousId: string): Promise<SessionRow> {
  const db = getServerSupabase();
  if (!db) {
    const mem = memoryDb();
    for (const session of mem.sessions.values()) {
      if (session.anonymous_id === anonymousId) return session;
    }
    const row: SessionRow = {
      id: uuid(),
      anonymous_id: anonymousId,
      nickname: null,
      created_at: nowIso(),
    };
    mem.sessions.set(row.id, row);
    return row;
  }

  const { data: existing } = await db
    .from('sessions')
    .select('*')
    .eq('anonymous_id', anonymousId)
    .maybeSingle();
  if (existing) return existing as SessionRow;

  const { data, error } = await db
    .from('sessions')
    .insert({ anonymous_id: anonymousId })
    .select('*')
    .single();
  if (error) {
    // A concurrent request may have inserted the same anonymous_id first.
    const { data: raced } = await db
      .from('sessions')
      .select('*')
      .eq('anonymous_id', anonymousId)
      .maybeSingle();
    if (raced) return raced as unknown as SessionRow;
    throw error;
  }
  return data as SessionRow;
}

export async function setSessionNickname(sessionId: string, nickname: string): Promise<void> {
  const db = getServerSupabase();
  if (!db) {
    const row = memoryDb().sessions.get(sessionId);
    if (row) row.nickname = nickname;
    return;
  }
  const { error } = await db.from('sessions').update({ nickname }).eq('id', sessionId);
  if (error) throw error;
}

export async function getSessionById(sessionId: string): Promise<SessionRow | null> {
  const db = getServerSupabase();
  if (!db) return memoryDb().sessions.get(sessionId) ?? null;
  const { data } = await db.from('sessions').select('*').eq('id', sessionId).maybeSingle();
  return (data as SessionRow | null) ?? null;
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

export async function recordRateEvent(bucketKey: string): Promise<void> {
  const db = getServerSupabase();
  if (!db) {
    memoryDb().rateEvents.push({ key: bucketKey, at: Date.now() });
    return;
  }
  await db.from('rate_events').insert({ bucket_key: bucketKey });
}

export async function countRateEvents(bucketKey: string, windowMinutes: number): Promise<number> {
  const since = Date.now() - windowMinutes * 60_000;
  const db = getServerSupabase();
  if (!db) {
    const mem = memoryDb();
    // Opportunistic prune so the array cannot grow unbounded in long dev sessions.
    if (mem.rateEvents.length > 5000) {
      mem.rateEvents = mem.rateEvents.filter((e) => e.at > Date.now() - 3_600_000);
    }
    return mem.rateEvents.filter((e) => e.key === bucketKey && e.at > since).length;
  }
  const { count } = await db
    .from('rate_events')
    .select('id', { count: 'exact', head: true })
    .eq('bucket_key', bucketKey)
    .gte('created_at', new Date(since).toISOString());
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Scans                                                               */
/* ------------------------------------------------------------------ */

export async function insertScan(scan: NewScan): Promise<ScanRow> {
  const db = getServerSupabase();
  const row: ScanRow = {
    id: uuid(),
    session_id: scan.sessionId,
    score: scan.score,
    tier: scan.tier,
    rarity: scan.rarity,
    message: scan.message,
    easter_egg_id: scan.easterEggId,
    is_paid_reroll: scan.isPaidReroll,
    challenge_scan_id: scan.challengeScanId,
    created_at: nowIso(),
  };
  if (!db) {
    memoryDb().scans.set(row.id, row);
    return row;
  }
  const { data, error } = await db
    .from('aura_scans')
    .insert({
      session_id: row.session_id,
      score: row.score,
      tier: row.tier,
      rarity: row.rarity,
      message: row.message,
      easter_egg_id: row.easter_egg_id,
      is_paid_reroll: row.is_paid_reroll,
      challenge_scan_id: row.challenge_scan_id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ScanRow;
}

export type ScanWithNickname = ScanRow & { nickname: string | null };

export async function getScanById(id: string): Promise<ScanWithNickname | null> {
  const db = getServerSupabase();
  if (!db) {
    const scan = memoryDb().scans.get(id);
    if (!scan) return null;
    const session = memoryDb().sessions.get(scan.session_id);
    return { ...scan, nickname: session?.nickname ?? null };
  }
  const { data } = await db
    .from('aura_scans')
    .select('*, sessions(nickname)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const joined = data as ScanRow & { sessions?: { nickname: string | null } | null };
  return { ...joined, nickname: joined.sessions?.nickname ?? null };
}

export async function getLeaderboard(
  limit: number = AURA_CONFIG.leaderboard.size,
): Promise<LeaderboardEntry[]> {
  const db = getServerSupabase();
  if (!db) {
    const mem = memoryDb();
    const best = new Map<string, ScanRow>();
    for (const scan of mem.scans.values()) {
      if (scan.score < AURA_CONFIG.leaderboard.minScore) continue;
      const current = best.get(scan.session_id);
      if (!current || scan.score > current.score) best.set(scan.session_id, scan);
    }
    const pool = AURA_CONFIG.leaderboard.oneEntryPerSession
      ? [...best.values()]
      : [...mem.scans.values()].filter((s) => s.score >= AURA_CONFIG.leaderboard.minScore);
    return pool
      .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
      .slice(0, limit)
      .map((scan, index) => ({
        rank: index + 1,
        scanId: scan.id,
        nickname: mem.sessions.get(scan.session_id)?.nickname ?? 'anon',
        score: scan.score,
        tierId: scan.tier,
        createdAt: scan.created_at,
      }));
  }

  // `leaderboard` is a view that already applies best-per-session + min score.
  const { data, error } = await db
    .from('leaderboard' as never)
    .select('*')
    .order('score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    scan_id: string;
    nickname: string | null;
    score: number;
    tier: AuraTierId;
    created_at: string;
  }[];
  return rows.map((row, index) => ({
    rank: index + 1,
    scanId: row.scan_id,
    nickname: row.nickname ?? 'anon',
    score: row.score,
    tierId: row.tier,
    createdAt: row.created_at,
  }));
}

export async function getBestScoreForSession(sessionId: string): Promise<number | null> {
  const db = getServerSupabase();
  if (!db) {
    let best: number | null = null;
    for (const scan of memoryDb().scans.values()) {
      if (scan.session_id === sessionId && (best === null || scan.score > best)) best = scan.score;
    }
    return best;
  }
  const { data } = await db
    .from('aura_scans')
    .select('score')
    .eq('session_id', sessionId)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { score: number } | null)?.score ?? null;
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export async function createPayment(payment: NewPayment): Promise<PaymentRow> {
  const db = getServerSupabase();
  const row: PaymentRow = {
    id: payment.id,
    session_id: payment.sessionId,
    provider: 'mercado_pago',
    provider_payment_id: null,
    provider_preference_id: payment.preferenceId,
    amount: payment.amount,
    currency: payment.currency,
    status: 'pending',
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (!db) {
    memoryDb().payments.set(row.id, row);
    return row;
  }
  const { data, error } = await db.from('payments').insert(row).select('*').single();
  if (error) throw error;
  return data as PaymentRow;
}

/** Attaches the provider preference id once checkout has been created. */
export async function setPaymentPreference(id: string, preferenceId: string): Promise<void> {
  const db = getServerSupabase();
  if (!db) {
    const row = memoryDb().payments.get(id);
    if (row) {
      row.provider_preference_id = preferenceId;
      row.updated_at = nowIso();
    }
    return;
  }
  await db
    .from('payments')
    .update({ provider_preference_id: preferenceId, updated_at: nowIso() })
    .eq('id', id);
}

export async function getPaymentById(id: string): Promise<PaymentRow | null> {
  const db = getServerSupabase();
  if (!db) return memoryDb().payments.get(id) ?? null;
  const { data } = await db.from('payments').select('*').eq('id', id).maybeSingle();
  return (data as PaymentRow | null) ?? null;
}

export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  providerPaymentId: string | null,
): Promise<PaymentRow | null> {
  const db = getServerSupabase();
  if (!db) {
    const row = memoryDb().payments.get(id);
    if (!row) return null;
    row.status = status;
    row.provider_payment_id = providerPaymentId ?? row.provider_payment_id;
    row.updated_at = nowIso();
    return row;
  }
  const { data, error } = await db
    .from('payments')
    .update({
      status,
      provider_payment_id: providerPaymentId,
      updated_at: nowIso(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentRow | null) ?? null;
}

/* ------------------------------------------------------------------ */
/* Reroll credits                                                      */
/* ------------------------------------------------------------------ */

/**
 * Grants credits for an approved payment.
 *
 * Idempotent by construction: `reroll_credits.payment_id` is UNIQUE, so a
 * duplicated webhook delivery cannot mint a second credit.
 */
export async function grantRerollCredit(
  paymentId: string,
  sessionId: string,
  total: number = AURA_CONFIG.reroll.creditsPerPayment,
): Promise<RerollCreditRow> {
  const db = getServerSupabase();
  if (!db) {
    const mem = memoryDb();
    for (const credit of mem.credits.values()) {
      if (credit.payment_id === paymentId) return credit;
    }
    const row: RerollCreditRow = {
      id: uuid(),
      session_id: sessionId,
      payment_id: paymentId,
      total,
      consumed: 0,
      created_at: nowIso(),
    };
    mem.credits.set(row.id, row);
    return row;
  }

  const { data, error } = await db
    .from('reroll_credits')
    .insert({ session_id: sessionId, payment_id: paymentId, total, consumed: 0 })
    .select('*')
    .maybeSingle();

  if (error) {
    // Unique violation on payment_id: the credit already exists.
    const { data: existing } = await db
      .from('reroll_credits')
      .select('*')
      .eq('payment_id', paymentId)
      .maybeSingle();
    if (existing) return existing as RerollCreditRow;
    throw error;
  }
  return data as RerollCreditRow;
}

export async function getRerollCredits(sessionId: string): Promise<RerollCreditSummary> {
  const db = getServerSupabase();
  if (!db) {
    let total = 0;
    let consumed = 0;
    for (const credit of memoryDb().credits.values()) {
      if (credit.session_id !== sessionId) continue;
      total += credit.total;
      consumed += credit.consumed;
    }
    return { total, consumed, available: Math.max(0, total - consumed) };
  }
  const { data } = await db
    .from('reroll_credits')
    .select('total, consumed')
    .eq('session_id', sessionId);
  const rows = (data ?? []) as { total: number; consumed: number }[];
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const consumed = rows.reduce((sum, r) => sum + r.consumed, 0);
  return { total, consumed, available: Math.max(0, total - consumed) };
}

/**
 * Consumes exactly one credit, atomically.
 *
 * On Supabase this is a single SQL function that updates with a row lock, so
 * two concurrent requests can never spend the same credit twice. In the memory
 * store the same guarantee is free: there is no await between read and write.
 */
export async function consumeRerollCredit(sessionId: string): Promise<boolean> {
  const db = getServerSupabase();
  if (!db) {
    for (const credit of memoryDb().credits.values()) {
      if (credit.session_id === sessionId && credit.consumed < credit.total) {
        credit.consumed += 1;
        return true;
      }
    }
    return false;
  }
  const { data, error } = await db.rpc('consume_reroll_credit' as never, {
    p_session_id: sessionId,
  } as never);
  if (error) throw error;
  return Boolean(data);
}
