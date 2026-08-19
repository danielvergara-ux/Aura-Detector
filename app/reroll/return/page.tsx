import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PaymentStatusScreen } from '@/components/payments/PaymentStatus';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirmando pago',
  robots: { index: false, follow: false },
};

/** Where Mercado Pago sends the user back. Proof of nothing — we verify server-side. */
export default async function RerollReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; return?: string }>;
}) {
  const params = await searchParams;
  const paymentId = params.payment;
  if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) redirect('/');

  // Only same-origin paths are accepted, so the redirect cannot be weaponised.
  const raw = params.return ?? '/scan';
  const returnPath = /^\/[a-zA-Z0-9/_-]*$/.test(raw) ? raw : '/scan';

  return <PaymentStatusScreen paymentId={paymentId} returnPath={returnPath} />;
}
