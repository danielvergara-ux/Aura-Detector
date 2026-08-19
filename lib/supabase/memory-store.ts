import 'server-only';

import type { PaymentRow, RerollCreditRow, ScanRow, SessionRow } from '@/lib/supabase/types';

/**
 * Development fallback used when Supabase is not configured.
 *
 * It keeps the whole experience playable with an empty `.env` (landing, scan,
 * result, leaderboard, mock reroll) without pretending to be durable: state
 * lives in the Node process and disappears on restart. Production must set
 * SUPABASE_* — see README.
 */
export interface MemoryDb {
  sessions: Map<string, SessionRow>;
  scans: Map<string, ScanRow>;
  payments: Map<string, PaymentRow>;
  credits: Map<string, RerollCreditRow>;
  rateEvents: { key: string; at: number }[];
}

const globalRef = globalThis as typeof globalThis & { __auraMemoryDb?: MemoryDb };

export function memoryDb(): MemoryDb {
  if (!globalRef.__auraMemoryDb) {
    globalRef.__auraMemoryDb = {
      sessions: new Map(),
      scans: new Map(),
      payments: new Map(),
      credits: new Map(),
      rateEvents: [],
    };
  }
  return globalRef.__auraMemoryDb;
}
