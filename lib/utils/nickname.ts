import { AURA_CONFIG } from '@/lib/aura/aura-config';
import { NICKNAME_PARTS } from '@/content/aura-copy';
import type { RandomSource } from '@/types/aura';

/**
 * Nicknames are the only user-authored strings in the product, so they get
 * the strictest treatment: allowlist charset, hard length cap, no markup.
 */

export function generateNickname(random: RandomSource = Math.random): string {
  const { adjectives, nouns } = NICKNAME_PARTS;
  const adjective = adjectives[Math.floor(random() * adjectives.length)] as string;
  const noun = nouns[Math.floor(random() * nouns.length)] as string;
  const digits = String(Math.floor(random() * 900) + 100);
  return `${adjective}_${noun}${digits}`.slice(0, AURA_CONFIG.nickname.maxLength);
}

/**
 * Returns a safe nickname, or null when the input cannot be salvaged.
 * Strips everything outside the allowlist rather than rejecting outright,
 * so a stray emoji does not block the user.
 */
export function sanitizeNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const stripped = input
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, AURA_CONFIG.nickname.maxLength);
  if (stripped.length < AURA_CONFIG.nickname.minLength) return null;
  if (!AURA_CONFIG.nickname.pattern.test(stripped)) return null;
  return stripped;
}
