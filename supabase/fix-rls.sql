-- Jalankan di Supabase Dashboard → SQL Editor (fix error RLS upload)
-- Copy semua baris ini → Run

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arisan-config', 'arisan-config', true, 1048576, array['application/json'])
on conflict (id) do update set public = true;

drop policy if exists "arisan_config_public_read" on storage.objects;
drop policy if exists "arisan_config_anon_insert" on storage.objects;
drop policy if exists "arisan_config_anon_update" on storage.objects;
drop policy if exists "arisan_config_anon_select" on storage.objects;
drop policy if exists "arisan_config_anon_delete" on storage.objects;
drop policy if exists "arisan_config_anon_all" on storage.objects;

create policy "arisan_config_public_read"
on storage.objects for select
to public
using (bucket_id = 'arisan-config');

create policy "arisan_config_anon_insert"
on storage.objects for insert
to anon
with check (bucket_id = 'arisan-config');

create policy "arisan_config_anon_select"
on storage.objects for select
to anon
using (bucket_id = 'arisan-config');

create policy "arisan_config_anon_update"
on storage.objects for update
to anon
using (bucket_id = 'arisan-config')
with check (bucket_id = 'arisan-config');

create policy "arisan_config_anon_delete"
on storage.objects for delete
to anon
using (bucket_id = 'arisan-config');
