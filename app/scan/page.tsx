import type { Metadata } from 'next';
import { AuraScanner } from '@/components/aura/AuraScanner';

export const metadata: Metadata = {
  title: 'Escaneando aura',
  description: 'Mantén la cara dentro del círculo. La máquina está juzgándote.',
  robots: { index: false, follow: true },
};

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { challenge } = await searchParams;
  // Only a well-formed uuid is ever forwarded to the API.
  const challengeId =
    challenge && /^[0-9a-f-]{36}$/i.test(challenge) ? challenge : undefined;

  return <AuraScanner challengeId={challengeId} />;
}
