import { fail, logServerError, ok, parseBody } from '@/lib/api/http';
import { hasMercadoPago } from '@/lib/mercado-pago/client';
import { getOrCreateSession } from '@/lib/security/session';
import { getPaymentById, grantRerollCredit, updatePaymentStatus } from '@/lib/supabase/repository';
import { env } from '@/lib/utils/env';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ paymentId: z.string().uuid() });

/**
 * POST /api/payments/mock-approve — local development only.
 *
 * Lets the reroll flow be exercised end to end without Mercado Pago
 * credentials. Hard-disabled in production AND whenever real credentials are
 * present, so it can never become a free-credit backdoor.
 */
export async function POST(request: Request) {
  if (env.isProduction || hasMercadoPago()) return fail('not_found', 404);

  const body = await parseBody(request, schema);
  if (!body) return fail('bad_request', 400);

  try {
    const { session } = await getOrCreateSession();
    const payment = await getPaymentById(body.paymentId);
    if (!payment || payment.session_id !== session.id) return fail('not_found', 404);

    if (payment.status !== 'approved') {
      await updatePaymentStatus(payment.id, 'approved', `mock-${payment.id}`);
      await grantRerollCredit(payment.id, payment.session_id);
    }
    return ok({ status: 'approved' });
  } catch (error) {
    logServerError('payments:mock', error);
    return fail('server_error', 500);
  }
}
