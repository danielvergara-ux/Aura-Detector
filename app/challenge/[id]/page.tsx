import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChallengeScreen } from '@/components/aura/ChallengeScreen';
import { loadScan } from '@/lib/aura/scan-service';
import { getTierById } from '@/lib/aura/aura-tiers';
import { SHARE_COPY } from '@/content/aura-copy';
import { absoluteUrl } from '@/lib/utils/env';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const scan = await loadScan(id).catch(() => null);
  if (!scan) return { title: 'Reto no encontrado' };

  const title = SHARE_COPY.challengeTitle(scan.nickname ?? 'Alguien', scan.score);
  const description = `${SHARE_COPY.challengeSubtitle} ${getTierById(scan.tierId).label}.`;

  return {
    title,
    description,
    alternates: { canonical: `/challenge/${scan.id}` },
    openGraph: { title, description, url: absoluteUrl(`/challenge/${scan.id}`) },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await loadScan(id).catch(() => null);
  if (!scan) notFound();

  return <ChallengeScreen scan={scan} />;
}
