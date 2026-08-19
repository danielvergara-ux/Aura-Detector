import { describe, expect, it } from 'vitest';
import {
  bucketProbabilities,
  buildAuraResult,
  determineAuraRarity,
  generateAuraResult,
  generateAuraScore,
  pickBucket,
} from '@/lib/aura/aura-engine';
import { determineAuraTier, AURA_TIERS } from '@/lib/aura/aura-tiers';
import { AURA_CONFIG } from '@/lib/aura/aura-config';
import type { RandomSource } from '@/types/aura';

/** Deterministic RNG that replays a fixed list, then repeats the last value. */
function sequence(values: number[]): RandomSource {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] as number;
}

/** Simple LCG, so distribution tests are reproducible across runs. */
function seeded(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('generateAuraScore', () => {
  it('returns an integer inside a configured band', () => {
    const random = seeded(42);
    for (let i = 0; i < 2000; i += 1) {
      const score = generateAuraScore(random);
      expect(Number.isInteger(score)).toBe(true);
      const inBand = AURA_CONFIG.probabilities.some((b) => score >= b.min && score <= b.max);
      expect(inBand).toBe(true);
    }
  });

  it('never exceeds the configured bounds', () => {
    const random = seeded(7);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 20000; i += 1) {
      const score = generateAuraScore(random);
      min = Math.min(min, score);
      max = Math.max(max, score);
    }
    expect(min).toBeGreaterThanOrEqual(-5000);
    expect(max).toBeLessThanOrEqual(9999);
  });

  it('rolls an easter-egg value when the first sample is under the threshold', () => {
    // First sample decides "is this an easter egg"; second picks which one.
    const score = generateAuraScore(sequence([0, 0]));
    expect(score).toBe(0); // first egg in the weighted list
  });

  it('skips easter eggs when the first sample is above the threshold', () => {
    const score = generateAuraScore(sequence([0.99, 0.999, 0.5]));
    expect(score).toBeGreaterThanOrEqual(1000);
  });
});

describe('probability distribution', () => {
  it('normalizes bucket weights to 1', () => {
    const total = Object.values(bucketProbabilities()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('makes ordinary results common and extremes rare', () => {
    const p = bucketProbabilities();
    expect(p.civil).toBeGreaterThan(p.legend as number);
    expect(p.legend).toBeGreaterThan(p.absurd as number);
    expect(p.absurd).toBeGreaterThan(p.god as number);
    expect(p.god).toBeGreaterThan(p.cursed as number);
    expect(p.god).toBeLessThan(0.01);
  });

  it('produces god-tier results at roughly the configured rate', () => {
    const random = seeded(1234);
    const runs = 60000;
    let gods = 0;
    for (let i = 0; i < runs; i += 1) {
      if (generateAuraScore(random) >= 1000) gods += 1;
    }
    const rate = gods / runs;
    // Easter eggs add a little mass above 1000 (1000, 1337, 9999).
    expect(rate).toBeGreaterThan(0.002);
    expect(rate).toBeLessThan(0.02);
  });

  it('keeps god-tier scores near the floor of the band', () => {
    const random = seeded(99);
    const scores: number[] = [];
    while (scores.length < 200) {
      const bucket = pickBucket(random);
      if (bucket.id !== 'god') continue;
      scores.push(generateAuraScore(seeded(scores.length + 5)));
    }
    // The 'front' curve should keep the average well below the midpoint.
    const godScores = scores.filter((s) => s >= 1000);
    if (godScores.length > 0) {
      const average = godScores.reduce((a, b) => a + b, 0) / godScores.length;
      expect(average).toBeLessThan(5500);
    }
  });
});

describe('determineAuraTier', () => {
  it('covers the whole integer line without gaps', () => {
    for (const score of [-999999, -5000, -1, 0, 99, 100, 299, 300, 499, 500, 749, 750, 899, 900, 999, 1000, 999999]) {
      expect(() => determineAuraTier(score)).not.toThrow();
      expect(determineAuraTier(score)).toBeDefined();
    }
  });

  it('maps boundary values to the documented tiers', () => {
    expect(determineAuraTier(-1).id).toBe('negative');
    expect(determineAuraTier(0).id).toBe('npc');
    expect(determineAuraTier(99).id).toBe('npc');
    expect(determineAuraTier(100).id).toBe('civil');
    expect(determineAuraTier(299).id).toBe('civil');
    expect(determineAuraTier(300).id).toBe('protagonist');
    expect(determineAuraTier(499).id).toBe('protagonist');
    expect(determineAuraTier(500).id).toBe('main_character');
    expect(determineAuraTier(749).id).toBe('main_character');
    expect(determineAuraTier(750).id).toBe('legend');
    expect(determineAuraTier(899).id).toBe('legend');
    expect(determineAuraTier(900).id).toBe('absurd');
    expect(determineAuraTier(999).id).toBe('absurd');
    expect(determineAuraTier(1000).id).toBe('god');
    expect(determineAuraTier(9999).id).toBe('god');
  });

  it('has contiguous tier ranges', () => {
    for (let i = 1; i < AURA_TIERS.length; i += 1) {
      const previous = AURA_TIERS[i - 1]!;
      const current = AURA_TIERS[i]!;
      expect(current.min).toBe(previous.max + 1);
    }
  });
});

describe('determineAuraRarity', () => {
  it('uses the band rarity declared in config', () => {
    expect(determineAuraRarity(150)).toBe('common');
    expect(determineAuraRarity(600)).toBe('uncommon');
    expect(determineAuraRarity(800)).toBe('rare');
    expect(determineAuraRarity(950)).toBe('very_rare');
    expect(determineAuraRarity(1200)).toBe('legendary');
    expect(determineAuraRarity(-2000)).toBe('mythic');
  });

  it('promotes easter-egg scores to at least rare', () => {
    // 69 sits in the 'npc' band, which is 'common' on its own.
    expect(determineAuraRarity(69)).toBe('rare');
    expect(determineAuraRarity(420)).toBe('rare');
    // Already rarer than 'rare': keep the stronger label.
    expect(determineAuraRarity(999)).toBe('very_rare');
  });
});

describe('buildAuraResult', () => {
  it('attaches the easter egg and its message', () => {
    const result = buildAuraResult(777, seeded(3));
    expect(result.easterEgg?.id).toBe('jackpot');
    expect(result.message).toBe(result.easterEgg?.message);
    expect(result.tier.id).toBe('legend');
  });

  it('falls back to a tier line when there is no easter egg', () => {
    const result = buildAuraResult(812, seeded(3));
    expect(result.easterEgg).toBeUndefined();
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('is internally consistent for random results', () => {
    const random = seeded(2024);
    for (let i = 0; i < 500; i += 1) {
      const result = generateAuraResult(random);
      expect(result.tier).toEqual(determineAuraTier(result.score));
      expect(result.rarity).toBe(determineAuraRarity(result.score));
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
