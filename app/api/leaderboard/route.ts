import { fail, logServerError, ok } from '@/lib/api/http';
import { AURA_CONFIG } from '@/lib/aura/aura-config';
import { getLeaderboard } from '@/lib/supabase/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/leaderboard — top scores, nicknames only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get('limit') ?? AURA_CONFIG.leaderboard.size);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), AURA_CONFIG.leaderboard.size)
    : AURA_CONFIG.leaderboard.size;

  try {
    const entries = await getLeaderboard(limit);
    return ok(
      { entries },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } },
    );
  } catch (error) {
    logServerError('leaderboard', error);
    return fail('server_error', 500);
  }
}
