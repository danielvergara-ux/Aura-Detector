import { fail, logServerError, ok, parseBody } from '@/lib/api/http';
import { nicknameSchema } from '@/lib/api/schemas';
import { getOrCreateSession } from '@/lib/security/session';
import { setSessionNickname } from '@/lib/supabase/repository';
import { sanitizeNickname } from '@/lib/utils/nickname';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/session/nickname — optional display name for the leaderboard.
 *
 * Double-guarded: Zod validates the shape, then `sanitizeNickname` strips
 * anything outside the allowlist. Nothing user-authored reaches the database
 * without passing both.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, nicknameSchema);
  if (!body) return fail('bad_request', 400);

  const nickname = sanitizeNickname(body.nickname);
  if (!nickname) return fail('bad_request', 400);

  try {
    const { session } = await getOrCreateSession();
    await setSessionNickname(session.id, nickname);
    return ok({ nickname });
  } catch (error) {
    logServerError('nickname', error);
    return fail('server_error', 500);
  }
}
