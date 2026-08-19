import { describe, expect, it } from 'vitest';
import {
  AURA_EASTER_EGGS,
  findEasterEgg,
  pickEasterEgg,
} from '@/lib/aura/aura-easter-eggs';
import { determineAuraTier } from '@/lib/aura/aura-tiers';

describe('easter eggs', () => {
  it('has unique scores', () => {
    const scores = AURA_EASTER_EGGS.map((egg) => egg.score);
    expect(new Set(scores).size).toBe(scores.length);
  });

  it('has unique ids and positive weights', () => {
    const ids = AURA_EASTER_EGGS.map((egg) => egg.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const egg of AURA_EASTER_EGGS) expect(egg.weight).toBeGreaterThan(0);
  });

  it('includes the documented values', () => {
    for (const score of [0, 69, 420, 666, 777, 999, 1000]) {
      expect(findEasterEgg(score)).toBeDefined();
    }
  });

  it('returns undefined for ordinary scores', () => {
    expect(findEasterEgg(543)).toBeUndefined();
    expect(findEasterEgg(-77)).toBeUndefined();
  });

  it('lands inside a valid tier for every egg', () => {
    for (const egg of AURA_EASTER_EGGS) {
      expect(determineAuraTier(egg.score)).toBeDefined();
    }
  });

  it('picks proportionally to weight', () => {
    // First egg starts the weighted sweep, last one ends it.
    expect(pickEasterEgg(() => 0).id).toBe(AURA_EASTER_EGGS[0]!.id);
    expect(pickEasterEgg(() => 0.999999).id).toBe(
      AURA_EASTER_EGGS[AURA_EASTER_EGGS.length - 1]!.id,
    );
  });

  it('never picks outside the list', () => {
    for (let i = 0; i < 200; i += 1) {
      const egg = pickEasterEgg(() => i / 200);
      expect(AURA_EASTER_EGGS).toContain(egg);
    }
  });
});
