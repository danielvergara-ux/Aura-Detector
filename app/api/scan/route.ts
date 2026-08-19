import { fail, logServerError, ok, parseBody } from '@/lib/api/http';
import { scanRequestSchema } from '@/lib/api/schemas';
import { performScan } from '@/lib/aura/scan-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scan — generates one aura result.
 *
 * The body only says *how* to scan (free vs. paid reroll, and which challenge
 * it answers). The score itself is produced server-side.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, scanRequestSchema);
  if (!body) return fail('bad_request', 400);

  try {
    const result = await performScan({
      challengeId: body.challengeId,
      useReroll: body.useReroll,
    });

    if (!result.ok) {
      switch (result.reason) {
        case 'rate_limited':
          return fail('rate_limited', 429, { retryAfterSeconds: result.retryAfterSeconds });
        case 'no_credits':
          return fail('no_credits', 402);
        case 'challenge_not_found':
          return fail('not_found', 404);
      }
    }

    return ok({ scan: result.scan });
  } catch (error) {
    logServerError('scan', error);
    return fail('server_error', 500);
  }
}
