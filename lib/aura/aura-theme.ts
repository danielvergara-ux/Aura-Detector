import { AURA_TIERS, getTierById } from '@/lib/aura/aura-tiers';
import type { AuraTier, AuraTierId } from '@/types/aura';

/**
 * Tier colors are exposed to CSS as custom properties, so a single assignment
 * repaints every gradient, glow and border in the tree without prop drilling.
 */

export function tierVars(tier: AuraTier): React.CSSProperties {
  return {
    ['--aura-rgb' as string]: tier.rgb,
    ['--aura-rgb-2' as string]: tier.rgb2,
  } as React.CSSProperties;
}

export function tierVarsById(id: AuraTierId): React.CSSProperties {
  return tierVars(getTierById(id));
}

/** Applies the tier palette globally (used during the reveal takeover). */
export function applyAuraTheme(tier: AuraTier): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--aura-rgb', tier.rgb);
  root.style.setProperty('--aura-rgb-2', tier.rgb2);
}

export function resetAuraTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const fallback = getTierById('main_character');
  root.style.setProperty('--aura-rgb', fallback.rgb);
  root.style.setProperty('--aura-rgb-2', fallback.rgb2);
}

/**
 * Easter eggs can hijack the palette for the length of the reveal.
 * Centralised here so a new egg is a data change, not a component change.
 */
const EGG_PALETTES: Record<string, { rgb: string; rgb2: string }> = {
  cursed: { rgb: '255 42 42', rgb2: '90 0 0' },
  jackpot: { rgb: '255 214 92', rgb2: '186 120 0' },
  glitch: { rgb: '0 255 214', rgb2: '0 90 120' },
  overflow: { rgb: '255 255 255', rgb2: '120 120 140' },
  void: { rgb: '120 124 140', rgb2: '20 20 28' },
};

/** Palette override for an easter-egg theme, or null when it has none. */
export function eggVars(theme: string | undefined): React.CSSProperties | null {
  if (!theme) return null;
  const palette = EGG_PALETTES[theme];
  if (!palette) return null;
  return {
    ['--aura-rgb' as string]: palette.rgb,
    ['--aura-rgb-2' as string]: palette.rgb2,
  } as React.CSSProperties;
}

export function rgbString(tier: AuraTier, alpha = 1): string {
  return `rgba(${tier.rgb.split(' ').join(',')}, ${alpha})`;
}

export { AURA_TIERS, getTierById };
