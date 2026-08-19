import type { AuraScan } from '@/types/aura';

/**
 * Achievements live entirely in the browser (localStorage).
 *
 * They are a reason to re-scan, not a source of truth, so there is no need to
 * involve the server — and keeping them local means one less thing tied to an
 * identity.
 */

export interface Achievement {
  id: string;
  title: string;
  hint: string;
  emoji: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'npc_supremo', title: 'NPC SUPREMO', hint: 'Obtén menos de 10 de aura.', emoji: '🧍' },
  { id: 'nice', title: 'NICE', hint: 'Obtén exactamente 69.', emoji: '😏' },
  { id: 'void', title: 'AURA CERO', hint: 'Obtén exactamente 0.', emoji: '🕳️' },
  { id: 'main_character', title: 'MAIN CHARACTER', hint: 'Supera los 500.', emoji: '✨' },
  { id: 'absolute_cinema', title: 'ABSOLUTE CINEMA', hint: 'Obtén exactamente 777.', emoji: '🎬' },
  { id: 'the_chosen_one', title: 'THE CHOSEN ONE', hint: 'Supera los 1000.', emoji: '👁️' },
  { id: 'bro_paid', title: 'BRO PAID FOR AURA', hint: 'Realiza un reroll pagado.', emoji: '💸' },
  { id: 'challenger', title: 'RETADOR', hint: 'Responde el reto de alguien.', emoji: '⚔️' },
  { id: 'thief', title: 'ROBASTE EL PROTAGONISMO', hint: 'Gana un reto.', emoji: '🏆' },
  { id: 'grinder', title: 'AURA GRINDER', hint: 'Escanea 5 veces.', emoji: '🔁' },
  { id: 'cursed', title: 'NÚMEROS ROJOS', hint: 'Obtén aura negativa.', emoji: '💀' },
];

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENT_BY_ID.get(id);
}

const STORAGE_KEY = 'aura:achievements';
const SCAN_COUNT_KEY = 'aura:scan-count';

export function loadUnlocked(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function persistUnlocked(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* storage unavailable — achievements are cosmetic */
  }
}

export function bumpScanCount(): number {
  try {
    const next = Number(window.localStorage.getItem(SCAN_COUNT_KEY) ?? '0') + 1;
    window.localStorage.setItem(SCAN_COUNT_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

/** Which achievements a given result earns. Pure, so it is easy to test. */
export function achievementsForScan(scan: AuraScan, scanCount: number): string[] {
  const earned: string[] = [];
  if (scan.score < 10 && scan.score >= 0) earned.push('npc_supremo');
  if (scan.score < 0) earned.push('cursed');
  if (scan.score === 0) earned.push('void');
  if (scan.score === 69) earned.push('nice');
  if (scan.score === 777) earned.push('absolute_cinema');
  if (scan.score > 500) earned.push('main_character');
  if (scan.score > 1000) earned.push('the_chosen_one');
  if (scan.isPaidReroll) earned.push('bro_paid');
  if (scan.challenge) {
    earned.push('challenger');
    if (scan.score > scan.challenge.score) earned.push('thief');
  }
  if (scanCount >= 5) earned.push('grinder');
  return earned;
}
