-- Aura Scanner — initial schema
--
-- Design notes:
--  * No personal data. No images. No biometric data. Ever.
--  * Anonymous sessions are identified by an opaque random string that lives
--    in an httpOnly cookie.
--  * RLS is ON everywhere and NO policies are granted to `anon`. The browser
--    can only read the public `leaderboard` view. All writes go through the
--    server with the service-role key.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  anonymous_id  text not null unique,
  nickname      text,
  created_at    timestamptz not null default now(),
  constraint sessions_nickname_format
    check (nickname is null or nickname ~ '^[a-zA-Z0-9_.-]{3,16}$')
);

create index if not exists sessions_created_at_idx on public.sessions (created_at desc);

-- ---------------------------------------------------------------------------
-- aura_scans
-- ---------------------------------------------------------------------------
create table if not exists public.aura_scans (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions (id) on delete cascade,
  score             integer not null,
  tier              text not null check (tier in (
                      'negative','npc','civil','protagonist',
                      'main_character','legend','absurd','god')),
  rarity            text not null check (rarity in (
                      'common','uncommon','rare','very_rare','legendary','mythic')),
  message           text not null,
  easter_egg_id     text,
  is_paid_reroll    boolean not null default false,
  -- When the scan was started from a challenge link, this points at the
  -- scan being challenged.
  challenge_scan_id uuid references public.aura_scans (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists aura_scans_session_idx on public.aura_scans (session_id, created_at desc);
create index if not exists aura_scans_score_idx on public.aura_scans (score desc, created_at asc);
create index if not exists aura_scans_created_idx on public.aura_scans (created_at desc);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                     uuid primary key,
  session_id             uuid not null references public.sessions (id) on delete cascade,
  provider               text not null default 'mercado_pago',
  -- Provider ids are unique so a replayed webhook cannot create a second row.
  provider_payment_id    text unique,
  provider_preference_id text,
  amount                 numeric(12,2) not null check (amount > 0),
  currency               text not null,
  status                 text not null default 'pending'
                           check (status in ('pending','approved','rejected','cancelled','refunded')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists payments_session_idx on public.payments (session_id, created_at desc);
create index if not exists payments_status_idx on public.payments (status);

-- ---------------------------------------------------------------------------
-- reroll_credits
-- ---------------------------------------------------------------------------
-- One row per approved payment. `payment_id` is UNIQUE, which is what makes
-- credit granting idempotent under duplicate webhook deliveries.
create table if not exists public.reroll_credits (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  payment_id  uuid not null unique references public.payments (id) on delete cascade,
  total       integer not null default 1 check (total > 0),
  consumed    integer not null default 0 check (consumed >= 0),
  created_at  timestamptz not null default now(),
  constraint reroll_credits_not_overspent check (consumed <= total)
);

create index if not exists reroll_credits_session_idx
  on public.reroll_credits (session_id)
  where consumed < total;

-- ---------------------------------------------------------------------------
-- rate_events — anti-abuse counters
-- ---------------------------------------------------------------------------
-- `bucket_key` is either `scan:session:<uuid>` or `scan:ip:<sha256-truncated>`.
-- The raw IP is never stored.
create table if not exists public.rate_events (
  id         bigserial primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_events_bucket_idx on public.rate_events (bucket_key, created_at desc);

-- ---------------------------------------------------------------------------
-- leaderboard view — best scan per session
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard as
select
  s.id          as scan_id,
  s.score       as score,
  s.tier        as tier,
  s.created_at  as created_at,
  coalesce(ses.nickname, 'anon') as nickname
from (
  select distinct on (session_id) id, session_id, score, tier, created_at
  from public.aura_scans
  where score >= 1
  order by session_id, score desc, created_at asc
) s
join public.sessions ses on ses.id = s.session_id
order by s.score desc, s.created_at asc
limit 100;

-- ---------------------------------------------------------------------------
-- Atomic reroll consumption
-- ---------------------------------------------------------------------------
-- Locks a single credit row and increments it in one statement, so two
-- concurrent requests can never spend the same credit.
create or replace function public.consume_reroll_credit(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.reroll_credits
     set consumed = consumed + 1
   where id = (
     select id
       from public.reroll_credits
      where session_id = p_session_id
        and consumed < total
      order by created_at asc
      for update skip locked
      limit 1
   )
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- Housekeeping for the counters table.
create or replace function public.prune_rate_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_events where created_at < now() - interval '24 hours';
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.sessions       enable row level security;
alter table public.aura_scans     enable row level security;
alter table public.payments       enable row level security;
alter table public.reroll_credits enable row level security;
alter table public.rate_events    enable row level security;

-- No policies are created for `anon` or `authenticated`: with RLS enabled and
-- zero policies, those roles can read and write nothing. The server uses the
-- service-role key, which bypasses RLS by design.

-- The public leaderboard is the single readable surface for the browser.
-- The view runs with the definer's rights, so it can read the tables above
-- without opening them up directly.
grant select on public.leaderboard to anon, authenticated;

revoke all on function public.consume_reroll_credit(uuid) from public, anon, authenticated;
revoke all on function public.prune_rate_events() from public, anon, authenticated;
grant execute on function public.consume_reroll_credit(uuid) to service_role;
grant execute on function public.prune_rate_events() to service_role;

-- Optional: schedule pruning if pg_cron is available in your project.
-- select cron.schedule('prune-aura-rate-events', '17 * * * *', $$select public.prune_rate_events()$$);
