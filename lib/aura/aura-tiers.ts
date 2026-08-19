import type { AuraTier, AuraTierId } from '@/types/aura';

/**
 * Visual + narrative tiers. Ranges must be contiguous and cover the whole
 * integer line; `AURA_TIERS` is ordered from lowest to highest.
 */
export const AURA_TIERS: readonly AuraTier[] = [
  {
    id: 'negative',
    label: 'AURA NEGATIVA',
    min: -Infinity,
    max: -1,
    tagline: 'Déjalo así. Ya sufrió suficiente.',
    emoji: '💀',
    rgb: '255 61 87',
    rgb2: '92 0 24',
    intensity: 1,
    particles: 14,
  },
  {
    id: 'npc',
    label: 'NPC',
    min: 0,
    max: 99,
    tagline: 'Presencia detectada: opcional.',
    emoji: '🧍',
    rgb: '148 152 168',
    rgb2: '60 62 76',
    intensity: 0,
    particles: 10,
  },
  {
    id: 'civil',
    label: 'CIVIL',
    min: 100,
    max: 299,
    tagline: 'Existe aura. Técnicamente.',
    emoji: '🙂',
    rgb: '86 209 255',
    rgb2: '12 74 140',
    intensity: 1,
    particles: 26,
  },
  {
    id: 'protagonist',
    label: 'PROTAGONISTA',
    min: 300,
    max: 499,
    tagline: 'Bro empezó su arco argumental.',
    emoji: '🎬',
    rgb: '92 255 190',
    rgb2: '10 110 96',
    intensity: 2,
    particles: 48,
  },
  {
    id: 'main_character',
    label: 'MAIN CHARACTER',
    min: 500,
    max: 749,
    tagline: 'La cámara ya sabía quién eras.',
    emoji: '✨',
    rgb: '167 139 255',
    rgb2: '74 32 180',
    intensity: 3,
    particles: 80,
  },
  {
    id: 'legend',
    label: 'LEYENDA',
    min: 750,
    max: 899,
    tagline: 'Presencia peligrosa detectada.',
    emoji: '⚡',
    rgb: '255 196 61',
    rgb2: '168 62 0',
    intensity: 4,
    particles: 130,
  },
  {
    id: 'absurd',
    label: 'AURA ABSURDA',
    min: 900,
    max: 999,
    tagline: 'Esto empieza a ser preocupante.',
    emoji: '🔥',
    rgb: '255 106 232',
    rgb2: '120 0 140',
    intensity: 5,
    particles: 180,
  },
  {
    id: 'god',
    label: 'DIOS DEL AURA',
    min: 1000,
    max: Infinity,
    tagline: 'EL ESCÁNER NO ESTABA PREPARADO PARA TI',
    emoji: '👁️',
    rgb: '255 255 255',
    rgb2: '255 210 90',
    intensity: 5,
    particles: 220,
  },
];

const TIER_BY_ID = new Map<AuraTierId, AuraTier>(AURA_TIERS.map((t) => [t.id, t]));

export function determineAuraTier(score: number): AuraTier {
  for (const tier of AURA_TIERS) {
    if (score >= tier.min && score <= tier.max) return tier;
  }
  // Ranges are exhaustive; this is a defensive fallback only.
  return AURA_TIERS[1] as AuraTier;
}

export function getTierById(id: AuraTierId): AuraTier {
  const tier = TIER_BY_ID.get(id);
  if (!tier) throw new Error(`Unknown aura tier: ${id}`);
  return tier;
}

/** True when the result deserves the full cinematic takeover. */
export function isLegendaryTier(tier: AuraTier): boolean {
  return tier.id === 'god';
}
