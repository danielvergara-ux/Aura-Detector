import { describe, expect, it } from 'vitest';
import { generateNickname, sanitizeNickname } from '@/lib/utils/nickname';
import { AURA_CONFIG } from '@/lib/aura/aura-config';
import { achievementsForScan } from '@/lib/achievements';
import type { AuraScan } from '@/types/aura';

describe('sanitizeNickname', () => {
  it('accepts plain nicknames', () => {
    expect(sanitizeNickname('sigma_alejandro')).toBe('sigma_alejandro');
    expect(sanitizeNickname('npc.final-boss')).toBe('npc.final-boss');
  });

  it('strips markup and script payloads', () => {
    // Stripped, then truncated to the configured max length.
    expect(sanitizeNickname('<script>alert(1)</script>')).toBe('scriptalert1scri');
    expect(sanitizeNickname('bro"onerror=x')).toBe('broonerrorx');
    expect(sanitizeNickname('a<img src=x>')).toBe('aimgsrcx');
  });

  it('rejects anything too short after stripping', () => {
    expect(sanitizeNickname('💀💀💀')).toBeNull();
    expect(sanitizeNickname('ab')).toBeNull();
    expect(sanitizeNickname('   ')).toBeNull();
  });

  it('caps the length', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeNickname(long)?.length).toBe(AURA_CONFIG.nickname.maxLength);
  });

  it('rejects non-strings', () => {
    expect(sanitizeNickname(42)).toBeNull();
    expect(sanitizeNickname(null)).toBeNull();
    expect(sanitizeNickname({ toString: () => 'hacker' })).toBeNull();
  });
});

describe('generateNickname', () => {
  it('always produces a value that passes sanitisation', () => {
    for (let i = 0; i < 300; i += 1) {
      const nickname = generateNickname();
      expect(sanitizeNickname(nickname)).toBe(nickname);
      expect(nickname.length).toBeLessThanOrEqual(AURA_CONFIG.nickname.maxLength);
    }
  });
});

describe('achievementsForScan', () => {
  const base: AuraScan = {
    id: 'scan',
    score: 250,
    tierId: 'civil',
    rarity: 'common',
    message: 'test',
    easterEggId: null,
    nickname: 'tester',
    isPaidReroll: false,
    createdAt: new Date().toISOString(),
    challenge: null,
  };

  it('awards the low-score achievement', () => {
    expect(achievementsForScan({ ...base, score: 4 }, 1)).toContain('npc_supremo');
  });

  it('awards cinema on exactly 777', () => {
    expect(achievementsForScan({ ...base, score: 777 }, 1)).toContain('absolute_cinema');
    expect(achievementsForScan({ ...base, score: 776 }, 1)).not.toContain('absolute_cinema');
  });

  it('awards the paid-reroll achievement only when paid', () => {
    expect(achievementsForScan({ ...base, isPaidReroll: true }, 1)).toContain('bro_paid');
    expect(achievementsForScan(base, 1)).not.toContain('bro_paid');
  });

  it('awards the challenge win only when the score is higher', () => {
    const challenge = { id: 'c', score: 500, tierId: 'main_character' as const, nickname: 'dani', createdAt: '' };
    expect(achievementsForScan({ ...base, score: 600, challenge }, 1)).toContain('thief');
    expect(achievementsForScan({ ...base, score: 400, challenge }, 1)).not.toContain('thief');
    expect(achievementsForScan({ ...base, score: 400, challenge }, 1)).toContain('challenger');
  });

  it('awards the grinder achievement after five scans', () => {
    expect(achievementsForScan(base, 5)).toContain('grinder');
    expect(achievementsForScan(base, 4)).not.toContain('grinder');
  });
});
