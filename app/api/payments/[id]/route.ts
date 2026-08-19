import { fail, logServerError, ok } from '@/lib/api/http';
import {
  hasMercadoPago,
  mapPaymentStatus,
  searchPaymentsByExternalReference,
} from '@/lib/mercado-pago/client';
import { getOrCreateSession } from '@/lib/security/session';
import {
  getPaymentById,
  getRerollCredits,
  grantRerollCredit,
  updatePaymentStatus,
} from '@/lib/supabase/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/:id — payment status for the owning session.
 *
 * Two things worth noting:
 *  - Ownership is enforced. A payment id alone is not enough to read it, so
 *    ids cannot be enumerated for information.
 *  - When the row is still pending we RECONCILE by asking Mercado Pago
 *    directly. `success_url` is never trusted; this pull check is what makes
 *    the flow correct even if a webhook was delayed or never delivered.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const { session } = await getOrCreateSession();
    const payment = await getPaymentById(id);

    // Same response for "missing" and "not yours": no enumeration signal.
    if (!payment || payment.session_id !== session.id) return fail('not_found', 404);

    let status = payment.status;

    if (status === 'pending' && hasMercadoPago()) {
      const remote = await searchPaymentsByExternalReference(payment.id);
      const match = remote.find((p) => p.status === 'approved') ?? remote[0];
      if (match) {
        const amountOk =
          match.transactionAmount == null ||
          Math.abs(match.transactionAmount - Number(payment.amount)) <= 0.009;
        const resolved = amountOk ? mapPaymentStatus(match.status) : 'rejected';
        await updatePaymentStatus(payment.id, resolved, match.id);
        if (resolved === 'approved') {
          await grantRerollCredit(payment.id, payment.session_id);
        }
        status = resolved;
      }
    }

    const credits = await getRerollCredits(session.id);
    return ok({ paymentId: payment.id, status, credits });
  } catch (error) {
    logServerError('payments:status', error);
    return fail('server_error', 500);
  }
}
