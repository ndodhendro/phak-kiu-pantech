-- Arisan template: communities → leagues (Postgres, bukan Storage JSON)
-- Jalankan di Supabase SQL Editor (atau via CLI migrate).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.communities (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.leagues (
    id uuid primary key default gen_random_uuid(),
    community_id uuid not null references public.communities(id) on delete cascade,
    slug text not null,
    title text not null,
    year int,
    timezone text not null default 'Asia/Jakarta',
    last_updated text,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (community_id, slug)
);

create table if not exists public.participants (
    id uuid primary key default gen_random_uuid(),
    league_id uuid not null references public.leagues(id) on delete cascade,
    name text not null,
    avatar_path text,
    color text,
    sort_order int not null default 0,
    total_goal_prediction int,
    picks jsonb not null default '{}'::jsonb,
    unique (league_id, name)
);

create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    league_id uuid not null references public.leagues(id) on delete cascade,
    name text not null,
    flag text,
    unique (league_id, name)
);

create table if not exists public.team_supporters (
    team_id uuid not null references public.teams(id) on delete cascade,
    participant_id uuid not null references public.participants(id) on delete cascade,
    primary key (team_id, participant_id)
);

create table if not exists public.matches (
    id uuid primary key default gen_random_uuid(),
    league_id uuid not null references public.leagues(id) on delete cascade,
    match_key text not null,
    label text,
    status text,
    scores jsonb,
    winner int,
    unique (league_id, match_key)
);

create table if not exists public.awards (
    id uuid primary key default gen_random_uuid(),
    league_id uuid not null references public.leagues(id) on delete cascade,
    kind text not null check (kind in ('golden_boot', 'golden_glove')),
    rank int not null default 0,
    player_name text not null,
    img text,
    goals int,
    country text,
    flag text,
    eliminated boolean not null default false,
    winner boolean not null default false,
    supporters text[] not null default '{}'::text[]
);

create table if not exists public.side_quests (
    id uuid primary key default gen_random_uuid(),
    league_id uuid not null references public.leagues(id) on delete cascade,
    place text not null check (place in ('champion', 'runnerup', 'third')),
    team_name text not null,
    flag text,
    eliminated boolean not null default false,
    supporters text[] not null default '{}'::text[],
    unique (league_id, place, team_name)
);

create index if not exists idx_leagues_community on public.leagues(community_id);
create index if not exists idx_participants_league on public.participants(league_id);
create index if not exists idx_teams_league on public.teams(league_id);
create index if not exists idx_matches_league on public.matches(league_id);
create index if not exists idx_awards_league on public.awards(league_id);

-- ---------------------------------------------------------------------------
-- RLS — public read; anon write (mini-project, sama trust model lama)
-- ---------------------------------------------------------------------------

alter table public.communities enable row level security;
alter table public.leagues enable row level security;
alter table public.participants enable row level security;
alter table public.teams enable row level security;
alter table public.team_supporters enable row level security;
alter table public.matches enable row level security;
alter table public.awards enable row level security;
alter table public.side_quests enable row level security;

drop policy if exists communities_all on public.communities;
drop policy if exists leagues_all on public.leagues;
drop policy if exists participants_all on public.participants;
drop policy if exists teams_all on public.teams;
drop policy if exists team_supporters_all on public.team_supporters;
drop policy if exists matches_all on public.matches;
drop policy if exists awards_all on public.awards;
drop policy if exists side_quests_all on public.side_quests;

create policy communities_all on public.communities for all to public using (true) with check (true);
create policy leagues_all on public.leagues for all to public using (true) with check (true);
create policy participants_all on public.participants for all to public using (true) with check (true);
create policy teams_all on public.teams for all to public using (true) with check (true);
create policy team_supporters_all on public.team_supporters for all to public using (true) with check (true);
create policy matches_all on public.matches for all to public using (true) with check (true);
create policy awards_all on public.awards for all to public using (true) with check (true);
create policy side_quests_all on public.side_quests for all to public using (true) with check (true);

-- Grant for anon / authenticated (Supabase roles)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
