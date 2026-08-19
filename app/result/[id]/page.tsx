import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadScan } from '@/lib/aura/scan-service';
import { getTierById } from '@/lib/aura/aura-tiers';
import { ResultScreen } from '@/components/aura/ResultScreen';
import { absoluteUrl } from '@/lib/utils/env';
import { formatScore } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const scan = await loadScan(id).catch(() => null);
  if (!scan) return { title: 'Aura no encontrada' };

  const tier = getTierById(scan.tierId);
  const title = `${formatScore(scan.score)} de aura · ${tier.label}`;
  const description = `${scan.message} ¿Cuánta aura tienes tú?`;

  return {
    title,
    description,
    alternates: { canonical: `/result/${scan.id}` },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/result/${scan.id}`),
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fresh?: string }>;
}) {
  const { id } = await params;
  const { fresh } = await searchParams;
  const scan = await loadScan(id).catch(() => null);
  if (!scan) notFound();

  // `?fresh=1` replays the full reveal (used right after a paid reroll);
  // a plain shared link shows the result already settled.
  return <ResultScreen scan={scan} animate={fresh === '1'} />;
}
