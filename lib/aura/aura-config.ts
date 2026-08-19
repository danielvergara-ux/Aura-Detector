import type { AuraRarity } from '@/types/aura';

/**
 * SINGLE SOURCE OF TRUTH for every tunable number in Aura Scanner.
 *
 * If you want to change how rare a "DIOS DEL AURA" is, how long the scanner
 * runs, how many free scans an anonymous visitor gets, or how much a reroll
 * costs — change it here. No magic numbers should live in components.
 *
 * Reminder: the score is fiction. Nothing in this file reads, measures or
 * derives anything from the person in front of the camera.
 */

export interface AuraProbabilityBucket {
  id: string;
  /** Declared rarity label for this band (drives the badge on the result). */
  rarity: AuraRarity;
  /** Inclusive. */
  min: number;
  /** Inclusive. */
  max: number;
  /** Relative weight. Weights do not need to sum to 100; they are normalized. */
  weight: number;
  /**
   * How values distribute inside the bucket.
   * - 'uniform': flat
   * - 'front':   heavily favours values near `min` (e.g. 1000 is far more
   *              likely than 9999 inside the god bucket)
   * - 'back':    favours values near `max`
   * - 'center':  favours the middle of the range
   */
  curve?: 'uniform' | 'front' | 'back' | 'center';
  /** Curve strength. Higher = more skew. Ignored for 'uniform'. */
  curvePower?: number;
}

export const AURA_CONFIG = {
  /** Total scanner runtime in ms, before the reveal. Spec target: 4–6s. */
  scanDurationMs: 5200,

  /** Cinematic phases of the fake analysis. `until` is a 0–1 progress stop. */
  scanPhases: [
    { until: 0.2, label: 'ESCANEANDO ROSTRO' },
    { until: 0.45, label: 'MIDIENDO PRESENCIA' },
    { until: 0.7, label: 'CALCULANDO AURA' },
    { until: 0.9, label: 'ANALIZANDO HISTORIAL CANON' },
    { until: 0.99, label: 'ESTO NO DEBERÍA SER POSIBLE...' },
    { until: 1, label: 'AURA ADQUIRIDA' },
  ],

  /** The progress bar visibly jams here for dramatic effect. */
  stall: { atProgress: 0.99, durationMs: 1400 },

  /** Blackout between the scan and the reveal. */
  revealBlackoutMs: 420,

  /** How long the score counter rolls up before locking in. */
  scoreCountUpMs: 1900,

  /** Extra beat before a legendary reveal starts, for the silence. */
  legendarySilenceMs: 900,

  /** Face lock: how long a face must stay in frame before the scan starts. */
  faceLockMs: 1100,

  /** If no face shows up in this window, we offer to scan anyway. */
  faceTimeoutMs: 15000,

  freeScans: {
    /** Scans per anonymous session inside the window. */
    limit: 10,
    windowMinutes: 60,
    /** Coarser IP-level cap, to blunt scripted abuse. */
    ipLimit: 60,
    ipWindowMinutes: 60,
  },

  leaderboard: {
    size: 100,
    /** Minimum score to appear at all — keeps the board interesting. */
    minScore: 1,
    /** Only the best scan per session is ranked. */
    oneEntryPerSession: true,
  },

  nickname: {
    minLength: 3,
    maxLength: 16,
    /** Letters, digits, underscore, dot, dash. No spaces, no markup. */
    pattern: /^[a-zA-Z0-9_.-]+$/,
  },

  /**
   * Probability of rolling an easter-egg value INSTEAD of a normal roll.
   * Keep this small; easter eggs are the reason people re-scan.
   */
  easterEggChance: 0.035,

  /**
   * The score distribution. Normal results are common, extremes are rare.
   * Weights are relative and normalized at runtime.
   */
  probabilities: [
    { id: 'cursed', min: -5000, max: -1000, weight: 0.05, rarity: 'mythic', curve: 'back', curvePower: 3 },
    { id: 'negative', min: -999, max: -1, weight: 2.5, rarity: 'uncommon', curve: 'back', curvePower: 2 },
    { id: 'npc', min: 0, max: 99, weight: 20, rarity: 'common', curve: 'uniform' },
    { id: 'civil', min: 100, max: 299, weight: 34, rarity: 'common', curve: 'center', curvePower: 1.4 },
    { id: 'protagonist', min: 300, max: 499, weight: 22, rarity: 'common', curve: 'uniform' },
    { id: 'main_character', min: 500, max: 749, weight: 13, rarity: 'uncommon', curve: 'front', curvePower: 1.3 },
    { id: 'legend', min: 750, max: 899, weight: 6, rarity: 'rare', curve: 'front', curvePower: 1.5 },
    { id: 'absurd', min: 900, max: 999, weight: 2, rarity: 'very_rare', curve: 'front', curvePower: 1.6 },
    { id: 'god', min: 1000, max: 9999, weight: 0.45, rarity: 'legendary', curve: 'front', curvePower: 5 },
  ] satisfies AuraProbabilityBucket[],

  /** Visual/perf budget. Particle counts get scaled by these. */
  effects: {
    /** Multiplier applied on low-end / small screens. */
    mobileParticleScale: 0.6,
    /** Hard ceiling regardless of tier. */
    maxParticles: 220,
    /** Screen shake amplitude in px at intensity 5. */
    maxShakePx: 14,
  },

  reroll: {
    /** Server-side price. NEVER trust a price coming from the client. */
    price: Number(process.env.REROLL_PRICE ?? 20),
    currency: process.env.REROLL_CURRENCY ?? 'MXN',
    /** Purely cosmetic string for the button. */
    displayPrice: process.env.NEXT_PUBLIC_REROLL_DISPLAY_PRICE ?? '$20 MXN',
    /** Credits granted per approved payment. */
    creditsPerPayment: 1,
    /** A checkout older than this is abandoned and can be re-created. */
    checkoutTtlMinutes: 30,
  },
} as const;

export type AuraConfig = typeof AURA_CONFIG;

/** Client-safe subset. Never leak server-only pricing internals to the bundle. */
export const AURA_CLIENT_CONFIG = {
  scanDurationMs: AURA_CONFIG.scanDurationMs,
  scanPhases: AURA_CONFIG.scanPhases,
  stall: AURA_CONFIG.stall,
  revealBlackoutMs: AURA_CONFIG.revealBlackoutMs,
  scoreCountUpMs: AURA_CONFIG.scoreCountUpMs,
  legendarySilenceMs: AURA_CONFIG.legendarySilenceMs,
  faceLockMs: AURA_CONFIG.faceLockMs,
  faceTimeoutMs: AURA_CONFIG.faceTimeoutMs,
  effects: AURA_CONFIG.effects,
  nickname: AURA_CONFIG.nickname,
} as const;
