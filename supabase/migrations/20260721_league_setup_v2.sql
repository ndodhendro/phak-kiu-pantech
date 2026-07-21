-- League setup v2: configurable points, participant picks, dynamic bracket metadata

alter table public.leagues
    add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.participants
    add column if not exists picks jsonb not null default '{}'::jsonb;

-- teams.flag may store ISO code (country) or image URL (club)
