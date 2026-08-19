import type { Metadata } from 'next';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import { getLeaderboard } from '@/lib/supabase/repository';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Aura Leaderboard',
  description: 'El ranking global de aura. Los que la máquina no pudo ignorar.',
  alternates: { canonical: '/leaderboard' },
};

export default async function LeaderboardPage() {
  // Server-rendered first paint, then the client keeps it live.
  const entries = await getLeaderboard().catch(() => []);
  return <Leaderboard initialEntries={entries} />;
}
