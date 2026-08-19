import type { AuraRarity, AuraTierId, PaymentStatus } from '@/types/aura';

export type SessionRow = {
  id: string;
  anonymous_id: string;
  nickname: string | null;
  created_at: string;
}

export type ScanRow = {
  id: string;
  session_id: string;
  score: number;
  tier: AuraTierId;
  rarity: AuraRarity;
  message: string;
  easter_egg_id: string | null;
  is_paid_reroll: boolean;
  challenge_scan_id: string | null;
  created_at: string;
}

export type PaymentRow = {
  id: string;
  session_id: string;
  provider: string;
  provider_payment_id: string | null;
  provider_preference_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export type RerollCreditRow = {
  id: string;
  session_id: string;
  payment_id: string;
  total: number;
  consumed: number;
  created_at: string;
}

export type LeaderboardRow = {
  scan_id: string;
  nickname: string | null;
  score: number;
  tier: AuraTierId;
  created_at: string;
}

/**
 * Minimal hand-written schema for the tables this app touches.
 * Mirrors supabase/migrations/0001_init.sql — keep both in sync.
 */
export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: SessionRow;
        Insert: Partial<SessionRow>;
        Update: Partial<SessionRow>;
        Relationships: [];
      };
      aura_scans: {
        Row: ScanRow;
        Insert: Partial<ScanRow>;
        Update: Partial<ScanRow>;
        // Declared so the typed client understands `select('*, sessions(nickname)')`.
        Relationships: [
          {
            foreignKeyName: 'aura_scans_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: PaymentRow;
        Insert: Partial<PaymentRow>;
        Update: Partial<PaymentRow>;
        Relationships: [];
      };
      reroll_credits: {
        Row: RerollCreditRow;
        Insert: Partial<RerollCreditRow>;
        Update: Partial<RerollCreditRow>;
        Relationships: [];
      };
      rate_events: {
        Row: { id: string; bucket_key: string; created_at: string };
        Insert: { bucket_key: string };
        Update: { bucket_key?: string };
        Relationships: [];
      };
    };
    Views: {
      leaderboard: { Row: LeaderboardRow; Relationships: [] };
    };
    Functions: {
      consume_reroll_credit: { Args: { p_session_id: string }; Returns: boolean };
      prune_rate_events: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
