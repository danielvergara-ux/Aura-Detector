import { AURA_CONFIG, type AuraProbabilityBucket } from '@/lib/aura/aura-config';
import { determineAuraTier } from '@/lib/aura/aura-tiers';
import { findEasterEgg, pickEasterEgg } from '@/lib/aura/aura-easter-eggs';
import { getAuraMessage } from '@/content/aura-copy';
import type { AuraRarity, AuraResult, RandomSource } from '@/types/aura';

/**
 * The aura engine.
 *
 * IMPORTANT — read before changing anything here:
 * The score is generated from a weighted random distribution and NOTHING else.
 * It never consumes camera data, face landmarks, or any attribute of the person
 * being "scanned". The face detector exists purely to drive the on-screen
 * theatre. Keep it that way.
 */

const BUCKETS = AURA_CONFIG.probabilities as readonly AuraProbabilityBucket[];
const TOTAL_WEIGHT = BUCKETS.reduce((sum, b) => sum + b.weight, 0);

/** Cryptographically-seeded random source, used on the server. */
export const secureRandom: RandomSource = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  // 2**32 keeps the result in [0, 1).
  return (buf[0] as number) / 4294967296;
};

/** Shapes a uniform [0,1) sample according to a bucket's curve. */
function shape(u: number, bucket: AuraProbabilityBucket): number {
  const power = bucket.curvePower ?? 2;
  switch (bucket.curve) {
    case 'front':
      return Math.pow(u, power);
    case 'back':
      return 1 - Math.pow(1 - u, power);
    case 'center': {
      // Average of two samples derived from u, biased toward the middle.
      const centered = 0.5 + (u - 0.5) / power;
      return Math.min(0.999999, Math.max(0, centered));
    }
    case 'uniform':
    default:
      return u;
  }
}

/** Picks the band the score will fall into. */
export function pickBucket(random: RandomSource): AuraProbabilityBucket {
  let ticket = random() * TOTAL_WEIGHT;
  for (const bucket of BUCKETS) {
    ticket -= bucket.weight;
    if (ticket < 0) return bucket;
  }
  return BUCKETS[BUCKETS.length - 1] as AuraProbabilityBucket;
}

/**
 * Generates a score. Common results are common; extremes are rare.
 * Easter-egg values can be rolled instead, with `AURA_CONFIG.easterEggChance`.
 */
export function generateAuraScore(random: RandomSource = secureRandom): number {
  if (random() < AURA_CONFIG.easterEggChance) {
    return pickEasterEgg(random).score;
  }
  const bucket = pickBucket(random);
  const span = bucket.max - bucket.min;
  const offset = Math.floor(shape(random(), bucket) * (span + 1));
  return bucket.min + Math.min(offset, span);
}

/** Rarity comes from the band the score belongs to, not from its magnitude. */
export function determineAuraRarity(score: number): AuraRarity {
  const egg = findEasterEgg(score);
  const bucket = BUCKETS.find((b) => score >= b.min && score <= b.max);
  const base: AuraRarity = bucket?.rarity ?? 'common';
  if (!egg) return base;
  // Landing exactly on an easter egg is always at least "rare".
  const order: AuraRarity[] = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'mythic'];
  return order.indexOf(base) >= order.indexOf('rare') ? base : 'rare';
}

/** Full result: score + tier + rarity + flavour text + optional easter egg. */
export function generateAuraResult(random: RandomSource = secureRandom): AuraResult {
  const score = generateAuraScore(random);
  return buildAuraResult(score, random);
}

/** Rebuilds a result from a known score (used when reading from the database). */
export function buildAuraResult(score: number, random: RandomSource = secureRandom): AuraResult {
  const tier = determineAuraTier(score);
  const rarity = determineAuraRarity(score);
  const easterEgg = findEasterEgg(score);
  const message = easterEgg?.message ?? getAuraMessage(tier.id, random);
  return { score, tier, rarity, message, easterEgg };
}

/** Analytical probability of each band. Exposed for tests and docs. */
export function bucketProbabilities(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of BUCKETS) out[b.id] = b.weight / TOTAL_WEIGHT;
  return out;
}

export { findEasterEgg, determineAuraTier, getAuraMessage };
