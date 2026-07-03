-- Bucket publik untuk admin-config.json
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arisan-config', 'arisan-config', true, 1048576, array['application/json'])
on conflict (id) do update set public = true;

drop policy if exists "arisan_config_public_read" on storage.objects;
create policy "arisan_config_public_read"
on storage.objects for select
to public
using (bucket_id = 'arisan-config');

-- Mini project: anon boleh upload/update (tanpa Edge Function / PIN server)
drop policy if exists "arisan_config_anon_insert" on storage.objects;
create policy "arisan_config_anon_insert"
on storage.objects for insert
to anon
with check (bucket_id = 'arisan-config');

drop policy if exists "arisan_config_anon_update" on storage.objects;
create policy "arisan_config_anon_update"
on storage.objects for update
to anon
using (bucket_id = 'arisan-config');
