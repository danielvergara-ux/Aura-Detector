import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * Webhook handling: signature verification, notification parsing, and the
 * idempotency guarantees around credit granting.
 *
 * The Mercado Pago client is mocked so the tests exercise OUR logic, not the
 * network. The point being verified is that the body is never trusted — the
 * handler always resolves state from the (mocked) provider API.
 */

const fetchPayment = vi.fn();
const fetchMerchantOrder = vi.fn();

vi.mock('@/lib/mercado-pago/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mercado-pago/client')>(
    '@/lib/mercado-pago/client',
  );
  return {
    ...actual,
    fetchPayment: (...args: unknown[]) => fetchPayment(...args),
    fetchMerchantOrder: (...args: unknown[]) => fetchMerchantOrder(...args),
  };
});

const {
  parseNotification,
  processNotification,
  verifyWebhookSignature,
} = await import('@/lib/mercado-pago/webhook');
const { createPayment, ensureSession, getPaymentById, getRerollCredits } = await import(
  '@/lib/supabase/repository'
);
const { memoryDb } = await import('@/lib/supabase/memory-store');

const SECRET = 'test-webhook-secret';

function signedHeader(dataId: string, requestId: string, ts = '1700000000') {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

async function seedPayment(amount = 20) {
  const session = await ensureSession(`anon-${crypto.randomUUID()}`);
  const payment = await createPayment({
    id: crypto.randomUUID(),
    sessionId: session.id,
    amount,
    currency: 'MXN',
    preferenceId: 'pref',
  });
  return { session, payment };
}

beforeEach(() => {
  const db = memoryDb();
  db.sessions.clear();
  db.payments.clear();
  db.credits.clear();
  fetchPayment.mockReset();
  fetchMerchantOrder.mockReset();
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = SECRET;
});

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed manifest', () => {
    const result = verifyWebhookSignature({
      signatureHeader: signedHeader('123', 'req-1'),
      requestId: 'req-1',
      dataId: '123',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a tampered payload id', () => {
    const result = verifyWebhookSignature({
      signatureHeader: signedHeader('123', 'req-1'),
      requestId: 'req-1',
      dataId: '999',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects a mismatched request id', () => {
    const result = verifyWebhookSignature({
      signatureHeader: signedHeader('123', 'req-1'),
      requestId: 'req-2',
      dataId: '123',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(
      verifyWebhookSignature({ signatureHeader: 'garbage', requestId: 'r', dataId: '1' }).valid,
    ).toBe(false);
    expect(
      verifyWebhookSignature({ signatureHeader: null, requestId: 'r', dataId: '1' }).valid,
    ).toBe(false);
  });
});

describe('parseNotification', () => {
  it('reads the modern body shape', () => {
    const result = parseNotification(
      { type: 'payment', action: 'payment.updated', data: { id: '42' } },
      new URLSearchParams(),
    );
    expect(result).toEqual({ type: 'payment', action: 'payment.updated', dataId: '42' });
  });

  it('falls back to query parameters (legacy IPN)', () => {
    const result = parseNotification({}, new URLSearchParams('topic=merchant_order&id=77'));
    expect(result.type).toBe('merchant_order');
    expect(result.dataId).toBe('77');
  });
});

describe('processNotification', () => {
  it('approves a payment and grants exactly one credit', async () => {
    const { session, payment } = await seedPayment();
    fetchPayment.mockResolvedValue({
      id: 'mp-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: payment.id,
      transactionAmount: 20,
      currencyId: 'MXN',
    });

    const outcome = await processNotification({ type: 'payment', action: null, dataId: 'mp-1' });

    expect(outcome).toMatchObject({ handled: true, status: 'approved', creditGranted: true });
    expect((await getRerollCredits(session.id)).available).toBe(1);
    expect((await getPaymentById(payment.id))?.status).toBe('approved');
  });

  it('is idempotent across duplicate deliveries', async () => {
    const { session, payment } = await seedPayment();
    fetchPayment.mockResolvedValue({
      id: 'mp-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: payment.id,
      transactionAmount: 20,
      currencyId: 'MXN',
    });

    await processNotification({ type: 'payment', action: null, dataId: 'mp-1' });
    await processNotification({ type: 'payment', action: null, dataId: 'mp-1' });
    await processNotification({ type: 'payment', action: null, dataId: 'mp-1' });

    expect((await getRerollCredits(session.id)).total).toBe(1);
  });

  it('rejects a payment whose amount does not match the order', async () => {
    const { session, payment } = await seedPayment(20);
    fetchPayment.mockResolvedValue({
      id: 'mp-2',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: payment.id,
      transactionAmount: 1, // tampered
      currencyId: 'MXN',
    });

    const outcome = await processNotification({ type: 'payment', action: null, dataId: 'mp-2' });

    expect(outcome).toEqual({ handled: false, reason: 'amount_mismatch' });
    expect((await getPaymentById(payment.id))?.status).toBe('rejected');
    expect((await getRerollCredits(session.id)).available).toBe(0);
  });

  it('grants nothing for a rejected payment', async () => {
    const { session, payment } = await seedPayment();
    fetchPayment.mockResolvedValue({
      id: 'mp-3',
      status: 'rejected',
      statusDetail: 'cc_rejected_other_reason',
      externalReference: payment.id,
      transactionAmount: 20,
      currencyId: 'MXN',
    });

    const outcome = await processNotification({ type: 'payment', action: null, dataId: 'mp-3' });

    expect(outcome).toMatchObject({ status: 'rejected', creditGranted: false });
    expect((await getRerollCredits(session.id)).available).toBe(0);
  });

  it('ignores an unknown external reference', async () => {
    fetchPayment.mockResolvedValue({
      id: 'mp-4',
      status: 'approved',
      statusDetail: null,
      externalReference: crypto.randomUUID(),
      transactionAmount: 20,
      currencyId: 'MXN',
    });

    const outcome = await processNotification({ type: 'payment', action: null, dataId: 'mp-4' });
    expect(outcome).toEqual({ handled: false, reason: 'unknown_payment' });
  });

  it('resolves merchant_order notifications through their payments', async () => {
    const { session, payment } = await seedPayment();
    fetchMerchantOrder.mockResolvedValue({ paymentIds: ['mp-5'], externalReference: payment.id });
    fetchPayment.mockResolvedValue({
      id: 'mp-5',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: payment.id,
      transactionAmount: 20,
      currencyId: 'MXN',
    });

    const outcome = await processNotification({
      type: 'merchant_order',
      action: null,
      dataId: 'order-1',
    });

    expect(outcome).toMatchObject({ handled: true, status: 'approved' });
    expect((await getRerollCredits(session.id)).available).toBe(1);
  });

  it('ignores unrelated topics without touching the database', async () => {
    const outcome = await processNotification({ type: 'plan', action: null, dataId: 'x' });
    expect(outcome).toEqual({ handled: false, reason: 'ignored_topic:plan' });
    expect(fetchPayment).not.toHaveBeenCalled();
  });

  it('does nothing without a data id', async () => {
    const outcome = await processNotification({ type: 'payment', action: null, dataId: null });
    expect(outcome).toEqual({ handled: false, reason: 'missing_data_id' });
  });
});
