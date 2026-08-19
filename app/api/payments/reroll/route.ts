import { fail, logServerError, ok, parseBody } from '@/lib/api/http';
import { rerollCheckoutSchema } from '@/lib/api/schemas';
import { AURA_CONFIG } from '@/lib/aura/aura-config';
import { createPreference, hasMercadoPago } from '@/lib/mercado-pago/client';
import { checkRateLimit, consumeRateLimit } from '@/lib/security/rate-limit';
import { getOrCreateSession } from '@/lib/security/session';
import { createPayment, setPaymentPreference } from '@/lib/supabase/repository';
import { absoluteUrl, env } from '@/lib/utils/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/reroll — starts a checkout for one reroll.
 *
 * Security posture:
 *  - The amount and currency come from server config. The request body cannot
 *    influence the price in any way.
 *  - Our own payment id is used as the Mercado Pago idempotency key and as
 *    `external_reference`, which is what lets the webhook find the row again.
 *  - Creating a checkout grants nothing. Credits are only minted by the
 *    webhook, after the payment is verified against the provider API.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, rerollCheckoutSchema);
  if (!body) return fail('bad_request', 400);

  try {
    const { session } = await getOrCreateSession();

    const key = `checkout:session:${session.id}`;
    const limit = await checkRateLimit({ key, limit: 10, windowMinutes: 60 });
    if (!limit.allowed) {
      return fail('rate_limited', 429, { retryAfterSeconds: limit.retryAfterSeconds });
    }
    await consumeRateLimit(key);

    const paymentId = globalThis.crypto.randomUUID();
    const amount = AURA_CONFIG.reroll.price;
    const currency = AURA_CONFIG.reroll.currency;

    await createPayment({
      id: paymentId,
      sessionId: session.id,
      amount,
      currency,
      preferenceId: null,
    });

    const returnPath = body.returnPath ?? '/scan';

    // Local/dev fallback: without credentials there is no provider to talk to,
    // so the app routes to an explicit mock screen instead of half-working.
    if (!hasMercadoPago()) {
      if (env.isProduction) return fail('payment_unavailable', 503);
      return ok({
        mock: true,
        paymentId,
        checkoutUrl: `/reroll/mock?payment=${paymentId}&return=${encodeURIComponent(returnPath)}`,
      });
    }

    const preference = await createPreference({
      paymentId,
      title: 'Aura Reroll — alterar el destino',
      price: amount,
      currency,
      successUrl: absoluteUrl(`/reroll/return?payment=${paymentId}&status=success&return=${encodeURIComponent(returnPath)}`),
      failureUrl: absoluteUrl(`/reroll/return?payment=${paymentId}&status=failure&return=${encodeURIComponent(returnPath)}`),
      pendingUrl: absoluteUrl(`/reroll/return?payment=${paymentId}&status=pending&return=${encodeURIComponent(returnPath)}`),
      notificationUrl: absoluteUrl('/api/mercado-pago/webhook'),
    });

    await setPaymentPreference(paymentId, preference.id);

    return ok({
      mock: false,
      paymentId,
      checkoutUrl: env.isProduction
        ? preference.initPoint
        : preference.sandboxInitPoint ?? preference.initPoint,
    });
  } catch (error) {
    logServerError('payments:reroll', error);
    return fail('server_error', 500);
  }
}
