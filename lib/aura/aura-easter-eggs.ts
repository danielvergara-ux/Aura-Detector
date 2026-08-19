import type { AuraEasterEgg, RandomSource } from '@/types/aura';

/**
 * Exact scores with a hidden meaning. Rolled BEFORE the normal distribution
 * (see AURA_CONFIG.easterEggChance), so they stay genuinely surprising.
 */
export const AURA_EASTER_EGGS: readonly AuraEasterEgg[] = [
  {
    score: 0,
    id: 'void',
    title: 'AURA NO ENCONTRADA',
    message: 'El escáner buscó. No había nada. Literalmente cero.',
    theme: 'void',
    weight: 14,
  },
  {
    score: 69,
    id: 'nice',
    title: 'AURA SOSPECHOSAMENTE PERFECTA',
    message: 'Nice.',
    weight: 20,
  },
  {
    score: 404,
    id: 'not_found',
    title: 'AURA NOT FOUND',
    message: 'El servidor buscó tu presencia y devolvió 404.',
    theme: 'glitch',
    weight: 12,
  },
  {
    score: 420,
    id: 'ancestral',
    title: 'AURA ANCESTRAL DETECTADA',
    message: 'Aura relajada. Peligrosamente relajada.',
    weight: 16,
  },
  {
    score: 666,
    id: 'cursed',
    title: 'AURA MALDITA',
    message: 'El escáner se apagó solo por un segundo. No preguntes.',
    theme: 'cursed',
    weight: 10,
  },
  {
    score: 777,
    id: 'jackpot',
    title: 'ABSOLUTE CINEMA',
    message: 'Tres sietes. La máquina tragamonedas del destino te eligió.',
    theme: 'jackpot',
    weight: 8,
  },
  {
    score: 911,
    id: 'emergency',
    title: 'AURA DE EMERGENCIA',
    message: 'Se recomienda evacuar la sala. Demasiada presencia.',
    weight: 6,
  },
  {
    score: 999,
    id: 'fear',
    title: 'LA MÁQUINA TIENE MIEDO',
    message: 'Un punto más y esto se rompía. Un solo punto.',
    weight: 6,
  },
  {
    score: 1000,
    id: 'chosen',
    title: 'EVENTO LEGENDARIO',
    message: 'Mil. Exactos. Esto no pasa. Esto no debería pasar.',
    weight: 3,
  },
  {
    score: 1337,
    id: 'leet',
    title: 'AURA ELITE',
    message: 'Aura escrita en código. Nadie sabe quién la compiló.',
    weight: 3,
  },
  {
    score: 9999,
    id: 'overflow',
    title: 'ERROR: AURA FUERA DE ESCALA',
    message: 'El medidor marcó el máximo y después dejó de responder.',
    theme: 'overflow',
    weight: 1,
  },
];

const EGG_BY_SCORE = new Map<number, AuraEasterEgg>(
  AURA_EASTER_EGGS.map((egg) => [egg.score, egg]),
);

/** Returns the easter egg attached to an exact score, if any. */
export function findEasterEgg(score: number): AuraEasterEgg | undefined {
  return EGG_BY_SCORE.get(score);
}

/** Weighted pick used when the easter-egg roll succeeds. */
export function pickEasterEgg(random: RandomSource): AuraEasterEgg {
  const total = AURA_EASTER_EGGS.reduce((sum, egg) => sum + egg.weight, 0);
  let ticket = random() * total;
  for (const egg of AURA_EASTER_EGGS) {
    ticket -= egg.weight;
    if (ticket < 0) return egg;
  }
  return AURA_EASTER_EGGS[AURA_EASTER_EGGS.length - 1] as AuraEasterEgg;
}
