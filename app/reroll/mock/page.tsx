import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MockCheckout } from '@/components/payments/MockCheckout';
import { hasMercadoPago } from '@/lib/utils/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout simulado',
  robots: { index: false, follow: false },
};

/**
 * Stand-in for Checkout Pro when the project has no Mercado Pago credentials.
 * Exists so the reroll flow can be exercised locally; unreachable in
 * production and whenever real credentials are configured.
 */
export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; return?: string }>;
}) {
  if (process.env.NODE_ENV === 'production' || hasMercadoPago()) notFound();

  const params = await searchParams;
  const paymentId = params.payment;
  if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) notFound();

  const raw = params.return ?? '/scan';
  const returnPath = /^\/[a-zA-Z0-9/_-]*$/.test(raw) ? raw : '/scan';

  return <MockCheckout paymentId={paymentId} returnPath={returnPath} />;
}
