import 'server-only';

import { AURA_CONFIG } from '@/lib/aura/aura-config';
import { generateAuraResult } from '@/lib/aura/aura-engine';
import { checkRateLimit, consumeRateLimit } from '@/lib/security/rate-limit';
import { getClientKey, getOrCreateSession } from '@/lib/security/session';
import {
  consumeRerollCredit,
  getScanById,
  insertScan,
  setSessionNickname,
} from '@/lib/supabase/repository';
import { generateNickname } from '@/lib/utils/nickname';
import type { AuraScan, ChallengeSummary } from '@/types/aura';
import type { ScanWithNickname } from '@/lib/supabase/repository';

/**
 * Server-side scan orchestration.
 *
 * The score is created HERE and only here. The client cannot propose, hint at
 * or influence the number — it only asks for one.
 */

export type ScanFailure =
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; reason: 'no_credits' }
  | { ok: false; reason: 'challenge_not_found' };

export type ScanSuccess = { ok: true; scan: AuraScan };

export interface PerformScanInput {
  challengeId?: string | undefined;
  useReroll: boolean;
}

export function toAuraScan(row: ScanWithNickname, challenge?: ChallengeSummary | null): AuraScan {
  return {
    id: row.id,
    score: row.score,
    tierId: row.tier,
    rarity: row.rarity,
    message: row.message,
    easterEggId: row.easter_egg_id,
    nickname: row.nickname,
    isPaidReroll: row.is_paid_reroll,
    createdAt: row.created_at,
    challenge: challenge ?? null,
  };
}

export async function performScan(input: PerformScanInput): Promise<ScanSuccess | ScanFailure> {
  const { session } = await getOrCreateSession();

  // A paid reroll bypasses the free-scan quota but must spend a credit.
  if (input.useReroll) {
    const consumed = await consumeRerollCredit(session.id);
    if (!consumed) return { ok: false, reason: 'no_credits' };
  } else {
    const sessionKey = `scan:session:${session.id}`;
    const sessionLimit = await checkRateLimit({
      key: sessionKey,
      limit: AURA_CONFIG.freeScans.limit,
      windowMinutes: AURA_CONFIG.freeScans.windowMinutes,
    });
    if (!sessionLimit.allowed) {
      return { ok: false, reason: 'rate_limited', retryAfterSeconds: sessionLimit.retryAfterSeconds };
    }

    const ipKey = `scan:ip:${await getClientKey()}`;
    const ipLimit = await checkRateLimit({
      key: ipKey,
      limit: AURA_CONFIG.freeScans.ipLimit,
      windowMinutes: AURA_CONFIG.freeScans.ipWindowMinutes,
    });
    if (!ipLimit.allowed) {
      return { ok: false, reason: 'rate_limited', retryAfterSeconds: ipLimit.retryAfterSeconds };
    }

    await Promise.all([consumeRateLimit(sessionKey), consumeRateLimit(ipKey)]);
  }

  let challenge: ChallengeSummary | null = null;
  if (input.challengeId) {
    const target = await getScanById(input.challengeId);
    if (!target) return { ok: false, reason: 'challenge_not_found' };
    challenge = {
      id: target.id,
      score: target.score,
      tierId: target.tier,
      nickname: target.nickname ?? 'anon',
      createdAt: target.created_at,
    };
  }

  // Anonymous players still get a name, so the leaderboard reads well.
  if (!session.nickname) {
    const nickname = generateNickname();
    await setSessionNickname(session.id, nickname);
    session.nickname = nickname;
  }

  const result = generateAuraResult();
  const row = await insertScan({
    sessionId: session.id,
    score: result.score,
    tier: result.tier.id,
    rarity: result.rarity,
    message: result.message,
    easterEggId: result.easterEgg?.id ?? null,
    isPaidReroll: input.useReroll,
    challengeScanId: challenge?.id ?? null,
  });

  return {
    ok: true,
    scan: toAuraScan({ ...row, nickname: session.nickname }, challenge),
  };
}

/** Fetches a stored scan plus the challenge it was answering, if any. */
export async function loadScan(id: string): Promise<AuraScan | null> {
  const row = await getScanById(id);
  if (!row) return null;

  let challenge: ChallengeSummary | null = null;
  if (row.challenge_scan_id) {
    const target = await getScanById(row.challenge_scan_id);
    if (target) {
      challenge = {
        id: target.id,
        score: target.score,
        tierId: target.tier,
        nickname: target.nickname ?? 'anon',
        createdAt: target.created_at,
      };
    }
  }
  return toAuraScan(row, challenge);
}
