/**
 * Core domain types for the Aura Scanner.
 *
 * Everything here describes a fictional, entertainment-only score.
 * No value in this file is derived from any real analysis of a person.
 */

export type AuraTierId =
  | 'negative'
  | 'npc'
  | 'civil'
  | 'protagonist'
  | 'main_character'
  | 'legend'
  | 'absurd'
  | 'god';

export type AuraRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very_rare'
  | 'legendary'
  | 'mythic';

export interface AuraTier {
  id: AuraTierId;
  /** Display name, e.g. "LEYENDA". */
  label: string;
  /** Inclusive lower bound. Use -Infinity / Infinity for open ends. */
  min: number;
  /** Inclusive upper bound. */
  max: number;
  /** Short line shown under the score. */
  tagline: string;
  emoji: string;
  /** Primary aura color as "R G B" (space separated, for CSS custom props). */
  rgb: string;
  /** Secondary/gradient color as "R G B". */
  rgb2: string;
  /** 0 = anticlimactic, 5 = reality-breaking. Drives animation budget. */
  intensity: 0 | 1 | 2 | 3 | 4 | 5;
  /** Particle count target at this tier (before device scaling). */
  particles: number;
}

export interface AuraEasterEgg {
  /** Exact score that triggers this egg. */
  score: number;
  id: string;
  title: string;
  message: string;
  /** Optional visual override applied on the reveal screen. */
  theme?: 'cursed' | 'jackpot' | 'glitch' | 'overflow' | 'void';
  /** Relative weight inside the easter-egg roll. */
  weight: number;
}

export interface AuraResult {
  score: number;
  tier: AuraTier;
  rarity: AuraRarity;
  message: string;
  easterEgg?: AuraEasterEgg;
}

/** A persisted scan, as returned by the API. */
export interface AuraScan {
  id: string;
  score: number;
  tierId: AuraTierId;
  rarity: AuraRarity;
  message: string;
  easterEggId: string | null;
  nickname: string | null;
  isPaidReroll: boolean;
  createdAt: string;
  /** Present when the scan was started from a challenge link. */
  challenge?: ChallengeSummary | null;
}

export interface ChallengeSummary {
  id: string;
  score: number;
  tierId: AuraTierId;
  nickname: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  scanId: string;
  nickname: string;
  score: number;
  tierId: AuraTierId;
  createdAt: string;
}

export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded';

export interface RerollCreditSummary {
  available: number;
  total: number;
  consumed: number;
}

/** Injectable random source, so the engine is deterministic under test. */
export type RandomSource = () => number;
