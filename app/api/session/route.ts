import { fail, logServerError, ok } from '@/lib/api/http';
import { getOrCreateSession } from '@/lib/security/session';
import { getRerollCredits } from '@/lib/supabase/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/session — the client's own view of itself.
 *
 * Returns the nickname and available reroll credits. The session id is
 * intentionally NOT returned: the browser never needs it, and not exposing it
 * keeps the cookie the single source of identity.
 */
export async function GET() {
  try {
    const { session } = await getOrCreateSession();
    const credits = await getRerollCredits(session.id);
    return ok({ nickname: session.nickname, credits });
  } catch (error) {
    logServerError('session', error);
    return fail('server_error', 500);
  }
}
