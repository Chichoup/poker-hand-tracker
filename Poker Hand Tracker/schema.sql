-- ============================================================
--  Poker Hand Tracker — Supabase schema
--  Pegá TODO este archivo en:  Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Configuración del jugador (1 fila por usuario) ----------
create table if not exists public.configs (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  name              text    default 'Jugador',
  currency          text    default 'USD',
  initial_bankroll  numeric default 0,
  goal_hours        numeric default 40,
  goal_sessions     numeric default 20,
  goal_study        numeric default 10,
  goal_hands        numeric default 200,
  usual_stake       text    default 'NL50',
  bb_sizes          jsonb   default '{"NL25":0.25,"NL50":0.5,"NL100":1,"NL200":2,"NL500":5,"1/3":3,"2/5":5,"5/10":10}'::jsonb,
  updated_at        timestamptz default now()
);

-- 2) Sesiones de juego ---------------------------------------
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  played_on       date not null,
  mode            text not null default 'Live',          -- 'Live' | 'Online'
  site            text,
  stakes          text,
  hours           numeric default 0,
  buyin           numeric default 0,
  cashout         numeric default 0,
  result          numeric generated always as (cashout - buyin) stored,
  mood            int check (mood between 1 and 5),
  study_hours     numeric default 0,
  hands_analyzed  numeric default 0,
  notes           text,
  created_at      timestamptz default now()
);

create index if not exists sessions_user_date_idx
  on public.sessions (user_id, played_on, created_at);

-- 3) Row Level Security: cada usuario solo ve lo suyo --------
alter table public.configs  enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "own config" on public.configs;
create policy "own config" on public.configs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
