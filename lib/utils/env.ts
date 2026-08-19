/**
 * Environment access, in one place.
 *
 * Rules enforced here:
 *  - Secrets are read lazily and NEVER exported to the client bundle.
 *  - Missing integrations degrade gracefully instead of crashing the app,
 *    so `npm run dev` works with an empty .env.
 *
 * Values are read through getters rather than snapshotted at import time, so
 * a variable that appears later (tests, edge cases in serverless cold starts)
 * is still picked up.
 */

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Throws only when the feature that needs it is actually used. */
export function required(name: string): string {
  const value = optional(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  get appUrl(): string {
    const explicit = optional('NEXT_PUBLIC_APP_URL');
    if (explicit) return explicit;
    const vercel = optional('VERCEL_URL');
    if (vercel) return `https://${vercel}`;
    return 'http://localhost:3000';
  },

  supabase: {
    get url() {
      return optional('NEXT_PUBLIC_SUPABASE_URL');
    },
    get anonKey() {
      return optional('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    },
    get serviceRoleKey() {
      return optional('SUPABASE_SERVICE_ROLE_KEY');
    },
  },

  mercadoPago: {
    get accessToken() {
      return optional('MERCADO_PAGO_ACCESS_TOKEN');
    },
    get publicKey() {
      return optional('NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY');
    },
    get webhookSecret() {
      return optional('MERCADO_PAGO_WEBHOOK_SECRET');
    },
  },

  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
} as const;

/** True when Supabase is wired up; otherwise the in-memory store takes over. */
export function hasSupabase(): boolean {
  return Boolean(env.supabase.url && env.supabase.serviceRoleKey);
}

/** True when real checkouts can be created. */
export function hasMercadoPago(): boolean {
  return Boolean(env.mercadoPago.accessToken);
}

/** Absolute URL builder that works locally, on preview and in production. */
export function absoluteUrl(path: string): string {
  const base = env.appUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
