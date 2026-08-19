import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeRerollCredit,
  createPayment,
  ensureSession,
  getRerollCredits,
  grantRerollCredit,
  updatePaymentStatus,
} from '@/lib/supabase/repository';
import { memoryDb } from '@/lib/supabase/memory-store';

/**
 * Credit accounting, against the in-memory backend.
 *
 * The Supabase backend enforces the same invariants in SQL:
 *  - reroll_credits.payment_id is UNIQUE (grant idempotency)
 *  - consume_reroll_credit() updates with a row lock (single spend)
 * See supabase/migrations/0001_init.sql.
 */

function resetDb() {
  const db = memoryDb();
  db.sessions.clear();
  db.scans.clear();
  db.payments.clear();
  db.credits.clear();
  db.rateEvents = [];
}

async function makeSessionWithPayment() {
  const session = await ensureSession(`anon-${crypto.randomUUID()}`);
  const payment = await createPayment({
    id: crypto.randomUUID(),
    sessionId: session.id,
    amount: 20,
    currency: 'MXN',
    preferenceId: 'pref-1',
  });
  return { session, payment };
}

describe('reroll credits', () => {
  beforeEach(resetDb);

  it('grants exactly one credit per approved payment', async () => {
    const { session, payment } = await makeSessionWithPayment();
    await updatePaymentStatus(payment.id, 'approved', 'mp-1');
    await grantRerollCredit(payment.id, session.id);

    const credits = await getRerollCredits(session.id);
    expect(credits.total).toBe(1);
    expect(credits.available).toBe(1);
  });

  it('is idempotent: a replayed grant does not mint a second credit', async () => {
    const { session, payment } = await makeSessionWithPayment();
    await grantRerollCredit(payment.id, session.id);
    await grantRerollCredit(payment.id, session.id);
    await grantRerollCredit(payment.id, session.id);

    const credits = await getRerollCredits(session.id);
    expect(credits.total).toBe(1);
    expect(credits.available).toBe(1);
  });

  it('consumes a credit exactly once', async () => {
    const { session, payment } = await makeSessionWithPayment();
    await grantRerollCredit(payment.id, session.id);

    expect(await consumeRerollCredit(session.id)).toBe(true);
    expect(await consumeRerollCredit(session.id)).toBe(false);

    const credits = await getRerollCredits(session.id);
    expect(credits.consumed).toBe(1);
    expect(credits.available).toBe(0);
  });

  it('does not let concurrent requests spend the same credit twice', async () => {
    const { session, payment } = await makeSessionWithPayment();
    await grantRerollCredit(payment.id, session.id);

    const results = await Promise.all([
      consumeRerollCredit(session.id),
      consumeRerollCredit(session.id),
      consumeRerollCredit(session.id),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await getRerollCredits(session.id)).consumed).toBe(1);
  });

  it('refuses to spend when there is nothing to spend', async () => {
    const session = await ensureSession('anon-empty');
    expect(await consumeRerollCredit(session.id)).toBe(false);
  });

  it('keeps credits scoped to their own session', async () => {
    const a = await makeSessionWithPayment();
    const b = await ensureSession('anon-other');
    await grantRerollCredit(a.payment.id, a.session.id);

    expect(await consumeRerollCredit(b.id)).toBe(false);
    expect((await getRerollCredits(a.session.id)).available).toBe(1);
  });

  it('accumulates credits across multiple payments', async () => {
    const session = await ensureSession('anon-multi');
    for (let i = 0; i < 3; i += 1) {
      const payment = await createPayment({
        id: crypto.randomUUID(),
        sessionId: session.id,
        amount: 20,
        currency: 'MXN',
        preferenceId: null,
      });
      await grantRerollCredit(payment.id, session.id);
    }

    expect((await getRerollCredits(session.id)).available).toBe(3);
    expect(await consumeRerollCredit(session.id)).toBe(true);
    expect((await getRerollCredits(session.id)).available).toBe(2);
  });
});
