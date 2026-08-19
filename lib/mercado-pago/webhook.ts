import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/utils/env';
import { fetchMerchantOrder, fetchPayment, mapPaymentStatus } from '@/lib/mercado-pago/client';
import {
  getPaymentById,
  grantRerollCredit,
  updatePaymentStatus,
} from '@/lib/supabase/repository';
import type { PaymentStatus } from '@/types/aura';

/**
 * Webhook processing.
 *
 * Two rules drive everything here:
 *   1. The notification body is UNTRUSTED. It tells us *which* payment to look
 *      at, never *what happened*. The real status always comes from a fresh
 *      GET against the Mercado Pago API.
 *   2. Processing must be idempotent. Mercado Pago retries aggressively, and a
 *      duplicate delivery must not mint a second reroll credit.
 */

export interface WebhookVerification {
  valid: boolean;
  reason?: string;
}

/**
 * Validates the `x-signature` header.
 *
 * Manifest format (per Mercado Pago docs):
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * signed with the webhook secret using HMAC-SHA256.
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): WebhookVerification {
  const secret = env.mercadoPago.webhookSecret;
  if (!secret) {
    // Without a configured secret we cannot verify. Refuse in production
    // rather than silently trusting anything that hits the endpoint.
    return env.isProduction
      ? { valid: false, reason: 'missing_webhook_secret' }
      : { valid: true, reason: 'unverified_dev' };
  }
  if (!params.signatureHeader || !params.dataId) {
    return { valid: false, reason: 'missing_signature' };
  }

  const parts = new Map<string, string>();
  for (const chunk of params.signatureHeader.split(',')) {
    const [key, value] = chunk.split('=', 2);
    if (key && value) parts.set(key.trim(), value.trim());
  }
  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  if (!ts || !v1) return { valid: false, reason: 'malformed_signature' };

  const manifest = `id:${params.dataId};request-id:${params.requestId ?? ''};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length) return { valid: false, reason: 'signature_mismatch' };
  return timingSafeEqual(a, b)
    ? { valid: true }
    : { valid: false, reason: 'signature_mismatch' };
}

export interface WebhookNotification {
  type: string | null;
  action: string | null;
  dataId: string | null;
}

/** Normalizes the several shapes Mercado Pago uses for notifications. */
export function parseNotification(body: unknown, query: URLSearchParams): WebhookNotification {
  const payload = (body ?? {}) as {
    type?: string;
    topic?: string;
    action?: string;
    data?: { id?: string | number };
    id?: string | number;
  };

  const type = payload.type ?? payload.topic ?? query.get('type') ?? query.get('topic');
  const dataId =
    payload.data?.id != null
      ? String(payload.data.id)
      : query.get('data.id') ?? (payload.id != null ? String(payload.id) : query.get('id'));

  return {
    type: type ?? null,
    action: payload.action ?? null,
    dataId: dataId ?? null,
  };
}

export type WebhookOutcome =
  | { handled: false; reason: string }
  | { handled: true; paymentId: string; status: PaymentStatus; creditGranted: boolean };

/**
 * Applies a verified notification.
 *
 * Idempotency comes from three places:
 *  - the unique constraint on `payments.provider_payment_id`
 *  - the unique constraint on `reroll_credits.payment_id`
 *  - the terminal-state guard below, which refuses to walk a payment backwards
 */
export async function processNotification(notification: WebhookNotification): Promise<WebhookOutcome> {
  if (!notification.dataId) return { handled: false, reason: 'missing_data_id' };

  const type = notification.type ?? '';
  let providerPaymentId: string | null = null;

  if (type === 'payment') {
    providerPaymentId = notification.dataId;
  } else if (type === 'merchant_order') {
    const order = await fetchMerchantOrder(notification.dataId);
    providerPaymentId = order.paymentIds.at(-1) ?? null;
    if (!providerPaymentId) return { handled: false, reason: 'order_without_payments' };
  } else {
    // Other topics (plans, subscriptions, test pings) are acknowledged and dropped.
    return { handled: false, reason: `ignored_topic:${type || 'unknown'}` };
  }

  // Source of truth: ask the provider, never trust the body.
  const remote = await fetchPayment(providerPaymentId);
  const internalId = remote.externalReference;
  if (!internalId) return { handled: false, reason: 'missing_external_reference' };

  const payment = await getPaymentById(internalId);
  if (!payment) return { handled: false, reason: 'unknown_payment' };

  const status = mapPaymentStatus(remote.status);

  // Amount tampering check: the charge must match what we created.
  if (
    remote.transactionAmount != null &&
    Math.abs(remote.transactionAmount - Number(payment.amount)) > 0.009
  ) {
    await updatePaymentStatus(payment.id, 'rejected', remote.id);
    return { handled: false, reason: 'amount_mismatch' };
  }

  const terminal: PaymentStatus[] = ['approved', 'refunded'];
  if (terminal.includes(payment.status) && payment.status === status) {
    // Duplicate delivery of an already-final state.
    return { handled: true, paymentId: payment.id, status, creditGranted: false };
  }

  await updatePaymentStatus(payment.id, status, remote.id);

  let creditGranted = false;
  if (status === 'approved') {
    // Safe to call repeatedly: reroll_credits.payment_id is UNIQUE.
    await grantRerollCredit(payment.id, payment.session_id);
    creditGranted = true;
  }

  return { handled: true, paymentId: payment.id, status, creditGranted };
}
