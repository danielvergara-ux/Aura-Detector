import { fail, logServerError, ok } from '@/lib/api/http';
import { loadScan } from '@/lib/aura/scan-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/scan/:id — public read of a single result (no personal data). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const scan = await loadScan(id);
    if (!scan) return fail('not_found', 404);
    return ok({ scan });
  } catch (error) {
    logServerError('scan:get', error);
    return fail('server_error', 500);
  }
}
