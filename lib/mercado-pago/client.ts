import 'server-only';

import { env, hasMercadoPago } from '@/lib/utils/env';
import type { PaymentStatus } from '@/types/aura';

/**
 * Minimal Mercado Pago REST client.
 *
 * Written against the HTTP API directly instead of the SDK: fewer moving
 * parts, no bundled transitive deps, and full control over the idempotency
 * header — which is the thing that actually protects us from double charges.
 *
 * The access token is read here and NOWHERE else. This module is server-only.
 */

const API = 'https://api.mercadopago.com';

export interface CreatePreferenceInput {
  /** Our internal payment id. Travels as external_reference. */
  paymentId: string;
  title: string;
  price: number;
  currency: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
}

export interface PreferenceResult {
  id: string;
  initPoint: string;
  sandboxInitPoint: string | null;
}

export interface MercadoPagoPayment {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
}

class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'MercadoPagoError';
  }
}

function accessToken(): string {
  const token = env.mercadoPago.accessToken;
  if (!token) throw new MercadoPagoError('Mercado Pago is not configured', 500);
  return token;
}

async function request<T>(path: string, init: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const { idempotencyKey, ...rest } = init;
  const response = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      ...(rest.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    // Deliberately does not log the token or the full request.
    throw new MercadoPagoError(
      `Mercado Pago ${path} failed (${response.status}): ${body.slice(0, 300)}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/**
 * Creates a Checkout Pro preference.
 *
 * The price comes from server config, never from the request body, and the
 * idempotency key is our own payment id, so a retried request reuses the same
 * preference rather than creating a second one.
 */
export async function createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
  const data = await request<{
    id: string;
    init_point: string;
    sandbox_init_point?: string;
  }>('/checkout/preferences', {
    method: 'POST',
    idempotencyKey: input.paymentId,
    body: JSON.stringify({
      items: [
        {
          id: 'aura-reroll',
          title: input.title,
          description: 'Un intento adicional en Aura Scanner (entretenimiento).',
          quantity: 1,
          unit_price: input.price,
          currency_id: input.currency,
        },
      ],
      external_reference: input.paymentId,
      notification_url: input.notificationUrl,
      statement_descriptor: 'AURASCANNER',
      binary_mode: true,
      back_urls: {
        success: input.successUrl,
        failure: input.failureUrl,
        pending: input.pendingUrl,
      },
      auto_return: 'approved',
      expires: false,
    }),
  });

  return {
    id: data.id,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point ?? null,
  };
}

/** Authoritative payment state, fetched from Mercado Pago. */
export async function fetchPayment(providerPaymentId: string): Promise<MercadoPagoPayment> {
  const data = await request<{
    id: number | string;
    status: string;
    status_detail?: string;
    external_reference?: string;
    transaction_amount?: number;
    currency_id?: string;
  }>(`/v1/payments/${encodeURIComponent(providerPaymentId)}`, { method: 'GET' });

  return {
    id: String(data.id),
    status: data.status,
    statusDetail: data.status_detail ?? null,
    externalReference: data.external_reference ?? null,
    transactionAmount: data.transaction_amount ?? null,
    currencyId: data.currency_id ?? null,
  };
}

/** Resolves the payments attached to a merchant order (used by some webhooks). */
export async function fetchMerchantOrder(orderId: string): Promise<{ paymentIds: string[]; externalReference: string | null }> {
  const data = await request<{
    external_reference?: string;
    payments?: { id: number | string }[];
  }>(`/merchant_orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  return {
    paymentIds: (data.payments ?? []).map((p) => String(p.id)),
    externalReference: data.external_reference ?? null,
  };
}

/**
 * Finds payments by our own external reference.
 *
 * Used to reconcile when a webhook is late or unreachable (localhost, for
 * example). It is a *pull* check against the provider, so it is just as
 * authoritative as the webhook path.
 */
export async function searchPaymentsByExternalReference(
  externalReference: string,
): Promise<MercadoPagoPayment[]> {
  const data = await request<{
    results?: {
      id: number | string;
      status: string;
      status_detail?: string;
      external_reference?: string;
      transaction_amount?: number;
      currency_id?: string;
    }[];
  }>(`/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`, {
    method: 'GET',
  });

  return (data.results ?? []).map((p) => ({
    id: String(p.id),
    status: p.status,
    statusDetail: p.status_detail ?? null,
    externalReference: p.external_reference ?? null,
    transactionAmount: p.transaction_amount ?? null,
    currencyId: p.currency_id ?? null,
  }));
}

/** Maps provider vocabulary onto our own status enum. */
export function mapPaymentStatus(providerStatus: string): PaymentStatus {
  switch (providerStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    case 'pending':
    case 'in_process':
    case 'authorized':
    case 'in_mediation':
    default:
      return 'pending';
  }
}

export { hasMercadoPago, MercadoPagoError };
