'use client';

import { AuraReveal } from '@/components/aura/AuraReveal';
import type { AuraScan } from '@/types/aura';

/**
 * Client wrapper for a persisted result, so the server page can stay a plain
 * async component while the reveal keeps its animations and audio hooks.
 */
export function ResultScreen({ scan, animate }: { scan: AuraScan; animate: boolean }) {
  return <AuraReveal scan={scan} animate={animate} rescanLabel="Escanear de nuevo" />;
}
