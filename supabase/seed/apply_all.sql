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

-- Upgrade existing DBs created before league setup v2
alter table public.leagues
    add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.participants
    add column if not exists picks jsonb not null default '{}'::jsonb;

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

-- ========== SEED ==========

-- Seed HASH PKU / WC 2026 — jalankan SETELAH 20260720_init_schema.sql
-- Generated by generate-seed.js

begin;

insert into public.communities (slug, name, settings)
values ('hash-pku', 'HASH PKU', '{}'::jsonb)
on conflict (slug) do update set name = excluded.name;

insert into public.leagues (community_id, slug, title, year, timezone, last_updated)
select c.id, 'wc-2026', 'Arisan World Cup 2026', 2026, 'Asia/Jakarta', '20 July 2026, 05:41 WIB'
from public.communities c where c.slug = 'hash-pku'
on conflict (community_id, slug) do update set
  title = excluded.title,
  year = excluded.year,
  last_updated = excluded.last_updated;

-- Clear dependent rows for re-seed
delete from public.team_supporters where team_id in (
  select t.id from public.teams t
  join public.leagues l on l.id = t.league_id
  join public.communities c on c.id = l.community_id
  where c.slug = 'hash-pku' and l.slug = 'wc-2026'
);
delete from public.teams where league_id in (
  select l.id from public.leagues l join public.communities c on c.id = l.community_id
  where c.slug = 'hash-pku' and l.slug = 'wc-2026'
);
delete from public.participants where league_id in (
  select l.id from public.leagues l join public.communities c on c.id = l.community_id
  where c.slug = 'hash-pku' and l.slug = 'wc-2026'
);
delete from public.matches where league_id in (
  select l.id from public.leagues l join public.communities c on c.id = l.community_id
  where c.slug = 'hash-pku' and l.slug = 'wc-2026'
);
delete from public.awards where league_id in (
  select l.id from public.leagues l join public.communities c on c.id = l.community_id
  where c.slug = 'hash-pku' and l.slug = 'wc-2026'
);
delete from public.side_quests where league_id in (
  select l.id from public.leagues l join public.communities c on c.id = l.community_id
  where c.slug = 'hash-pku' and l.slug = 'wc-2026'
);

insert into public.participants (league_id, name, avatar_path, color, sort_order, total_goal_prediction)
select l.id, 'Davin', 'QIU.png', '#3498db', 1, 71
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.participants (league_id, name, avatar_path, color, sort_order, total_goal_prediction)
select l.id, 'Ndod', 'NDO.jpeg', '#2ecc71', 2, 82
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.participants (league_id, name, avatar_path, color, sort_order, total_goal_prediction)
select l.id, 'Khuang', 'KHU.png', '#f1c40f', 3, 88
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.participants (league_id, name, avatar_path, color, sort_order, total_goal_prediction)
select l.id, 'Marten', 'MAR.jpg', '#9b59b6', 4, 57
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.participants (league_id, name, avatar_path, color, sort_order, total_goal_prediction)
select l.id, 'Cham', 'CHA.jpg', '#e74c3c', 5, 117
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.participants (league_id, name, avatar_path, color, sort_order, total_goal_prediction)
select l.id, 'Willy', 'WIL.png', '#e67e22', 6, 81
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.participants (league_id, name, avatar_path, color, sort_order, total_goal_prediction)
select l.id, 'Wesly', 'WES.jpg', '#00bcd4', 7, 93
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Portugal'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Argentina'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'United States'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Colombia'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Norway'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Canada'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Algeria'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'DR Congo'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'France'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Morocco'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Croatia'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Senegal'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'South Africa'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Spain'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Belgium'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Bosnia and Herzegovina'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Japan'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Ghana'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Austria'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Cape Verde'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Brazil'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Sweden'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.teams (league_id, name)
select l.id, 'Paraguay'
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Portugal';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Argentina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Argentina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Argentina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Argentina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Argentina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Argentina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'United States';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Colombia';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Colombia';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Colombia';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Colombia';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Norway';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Norway';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Norway';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Norway';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Norway';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Norway';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Canada';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Canada';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Algeria';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Algeria';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Davin'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'DR Congo';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'DR Congo';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'France';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'France';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'France';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Morocco';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Morocco';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Morocco';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Croatia';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Senegal';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Senegal';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Senegal';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Senegal';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Senegal';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Ndod'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'South Africa';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'South Africa';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Spain';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Spain';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Spain';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Belgium';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Belgium';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Khuang'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Bosnia and Herzegovina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Bosnia and Herzegovina';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Japan';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Japan';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Japan';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Ghana';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Ghana';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Marten'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Austria';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Cham'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Austria';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Willy'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Cape Verde';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Brazil';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Sweden';

insert into public.team_supporters (team_id, participant_id)
select t.id, p.id
from public.teams t
join public.leagues l on l.id = t.league_id
join public.communities c on c.id = l.community_id
join public.participants p on p.league_id = l.id and p.name = 'Wesly'
where c.slug = 'hash-pku' and l.slug = 'wc-2026' and t.name = 'Paraguay';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'final-0', 'Final', 'finished', '{"ft":["1","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'third-0', '3rd Place', 'finished', '{"ft":["4","6"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'sf-1', 'Semi-final — Match 2', 'finished', '{"ft":["1","2"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'sf-0', 'Semi-final — Match 1', 'finished', '{"ft":["0","2"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'qf-3', 'Quarter-final — Match 4', 'finished', '{"ft":["1","1"],"et":["0","2"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'qf-2', 'Quarter-final — Match 3', 'finished', '{"ft":["1","1"],"et":["0","1"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'qf-1', 'Quarter-final — Match 2', 'finished', '{"ft":["1","2"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'qf-0', 'Quarter-final — Match 1', 'finished', '{"ft":["0","2"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-6', 'R16 — Swiss vs Colombia', 'finished', '{"ft":["0","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-7', 'R16 — Argentina vs Egypt', 'finished', '{"ft":["3","2"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-2', 'R16 — United States vs Belgium', 'finished', '{"ft":["1","4"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-3', 'R16 — Portugal vs Spain', 'finished', '{"ft":["0","1"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-5', 'R16 — Mexico vs England', 'finished', '{"ft":["2","3"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-4', 'R16 — Brazil vs Norway', 'finished', '{"ft":["1","2"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-1', 'R16 — Paraguay vs France', 'finished', '{"ft":["0","1"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'r16-0', 'R16 — Canada vs Morocco', 'finished', '{"ft":["0","3"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-13', 'Group — Colombia vs Ghana', 'finished', '{"ft":["1","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-15', 'Group — Argentina vs Cape Verde', 'finished', '{"ft":["1","1"],"et":["2","1"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-14', 'Group — Australia vs Egypt', 'finished', '{"ft":["1","1"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-12', 'Group — Swiss vs Algeria', 'finished', '{"ft":["2","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-7', 'Group — Portugal vs Croatia', 'finished', '{"ft":["2","1"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-6', 'Group — Spain vs Austria', 'finished', '{"ft":["3","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-5', 'Group — United States vs Bosnia and Herzegovina', 'finished', '{"ft":["2","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-4', 'Group — Belgium vs Senegal', 'finished', '{"ft":["2","2"],"et":["1","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-11', 'Group — England vs DR Congo', 'finished', '{"ft":["2","1"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-10', 'Group — Mexico vs Ecuador', 'finished', '{"ft":["2","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-3', 'Group — France vs Sweden', 'finished', '{"ft":["3","0"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-9', 'Group — Ivory Coast vs Norway', 'finished', '{"ft":["1","2"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-1', 'Group — Netherlands vs Morocco', 'finished', '{"ft":["1","1"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-2', 'Group — Germany vs Paraguay', 'finished', '{"ft":["1","1"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-8', 'Group — Brazil vs Japan', 'finished', '{"ft":["2","1"],"et":["0","0"]}'::jsonb, 0
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.matches (league_id, match_key, label, status, scores, winner)
select l.id, 'group-0', 'Group — South Africa vs Canada', 'finished', '{"ft":["0","1"],"et":["0","0"]}'::jsonb, 1
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_boot', 0, 'Kylian Mbappe', 'kylian mbappe.png', 6, false, false, array['Ndod', 'Khuang', 'Cham', 'Wesly']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_boot', 1, 'Lionel Messi', 'lionel_messi-removebg-preview.png', 1, false, false, array['Davin', 'Willy']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_boot', 2, 'Lamine Yamal', 'https://img.a.transfermarkt.technology/portrait/big/937958-1773173768.jpg?lm=1', 0, false, false, array['Marten']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_glove', 0, 'Emiliano Martinez', 'https://img.a.transfermarkt.technology/portrait/big/111873-1668180824.jpg?lm=1', null, true, false, array['Ndod', 'Khuang', 'Willy']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_glove', 1, 'Mike Maignan', 'https://cdn.soccerwiki.org/images/player/68131.png', null, true, false, array['Cham']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_glove', 2, 'Vozinha', 'https://img.a.transfermarkt.technology/portrait/big/242277-1713587632.png?lm=1', null, true, false, array['Davin']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_glove', 3, 'Unai Simon', '194820-removebg-preview.png', null, false, true, array['Marten']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.awards (league_id, kind, rank, player_name, img, goals, eliminated, winner, supporters)
select l.id, 'golden_glove', 4, 'Alison Becker', 'images__2_-removebg-preview.png', null, true, false, array['Wesly']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'champion', 'Argentina', 'ar', false, array['Khuang', 'Willy']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'champion', 'Portugal', 'pt', false, array['Davin']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'champion', 'France', 'fr', false, array['Ndod', 'Cham']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'champion', 'Spain', 'es', false, array['Marten']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'champion', 'Brazil', 'br', false, array['Wesly']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'runnerup', 'Argentina', 'ar', false, array['Cham', 'Davin', 'Ndod', 'Marten']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'runnerup', 'Spain', 'es', false, array['Khuang', 'Wesly']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'runnerup', 'France', 'fr', false, array['Willy']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'third', 'Brazil', 'br', false, array['Davin', 'Marten']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'third', 'Spain', 'es', false, array['Ndod']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'third', 'France', 'fr', false, array['Khuang', 'Wesly']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

insert into public.side_quests (league_id, place, team_name, flag, eliminated, supporters)
select l.id, 'third', 'Portugal', 'pt', false, array['Cham', 'Willy']::text[]
from public.leagues l join public.communities c on c.id = l.community_id
where c.slug = 'hash-pku' and l.slug = 'wc-2026';

commit;
