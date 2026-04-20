-- PadelCoach · esquema Supabase (ejecutar en SQL Editor del proyecto)
-- Tablas: alumnos, sessions, match_actions

create extension if not exists "pgcrypto";

create table if not exists public.alumnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

create index if not exists alumnos_nombre_idx on public.alumnos (nombre);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.alumnos (id) on delete restrict,
  student_name text not null,
  estimated_duration int not null,
  format text not null,
  deuce_type text not null,
  status text not null default 'pending',
  coach_notes text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  notes_updated_at timestamptz
);

create index if not exists sessions_created_at_idx on public.sessions (created_at desc);
create index if not exists sessions_student_id_idx on public.sessions (student_id);

create table if not exists public.match_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  shot text not null,
  result text not null,
  origin text not null,
  point_winner text not null,
  minute numeric,
  set_index int not null,
  game_index int not null,
  score text,
  created_at timestamptz not null default now()
);

create index if not exists match_actions_session_created_idx
  on public.match_actions (session_id, created_at asc);

alter table public.alumnos enable row level security;
alter table public.sessions enable row level security;
alter table public.match_actions enable row level security;

drop policy if exists "alumnos_anon_all" on public.alumnos;
drop policy if exists "sessions_anon_all" on public.sessions;
drop policy if exists "match_actions_anon_all" on public.match_actions;

create policy "alumnos_anon_all" on public.alumnos for all to anon using (true) with check (true);
create policy "sessions_anon_all" on public.sessions for all to anon using (true) with check (true);
create policy "match_actions_anon_all" on public.match_actions for all to anon using (true) with check (true);
