import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '@/lib/utils/env';
import type { Database } from '@/lib/supabase/types';

/**
 * Server-side admin client. The service-role key bypasses RLS, so this module
 * is `server-only` and must never be imported from a client component.
 */
let cached: SupabaseClient<Database> | null = null;

export function getServerSupabase(): SupabaseClient<Database> | null {
  if (!hasSupabase()) return null;
  if (!cached) {
    cached = createClient<Database>(env.supabase.url as string, env.supabase.serviceRoleKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'aura-scanner/1.0' } },
    });
  }
  return cached;
}
