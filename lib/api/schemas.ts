import { z } from 'zod';
import { AURA_CONFIG } from '@/lib/aura/aura-config';

/** Request contracts. Anything not described here is rejected. */

export const scanRequestSchema = z.object({
  /** Scan id being challenged, when the user arrived from a challenge link. */
  challengeId: z.string().uuid().optional(),
  /** Spend one paid reroll credit instead of a free scan. */
  useReroll: z.boolean().optional().default(false),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

export const nicknameSchema = z.object({
  nickname: z
    .string()
    .min(AURA_CONFIG.nickname.minLength)
    .max(AURA_CONFIG.nickname.maxLength)
    .regex(AURA_CONFIG.nickname.pattern),
});

export const rerollCheckoutSchema = z.object({
  /** Where to send the user back after checkout. Path only, same-origin. */
  returnPath: z
    .string()
    .max(200)
    .regex(/^\/[a-zA-Z0-9/_-]*$/, 'must be a same-origin path')
    .optional(),
});
