-- ============================================================
-- FIX RLS upload Supabase — jalankan SEMUA di SQL Editor → Run
-- (Hapus policy lama + buat policy baru yang lebih permisif)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arisan-config', 'arisan-config', true, 5242880, null)
on conflict (id) do update set
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = null;

-- Hapus semua policy lama untuk bucket ini
drop policy if exists "arisan_config_public_read" on storage.objects;
drop policy if exists "arisan_config_anon_insert" on storage.objects;
drop policy if exists "arisan_config_anon_update" on storage.objects;
drop policy if exists "arisan_config_anon_select" on storage.objects;
drop policy if exists "arisan_config_anon_delete" on storage.objects;
drop policy if exists "arisan_config_anon_all" on storage.objects;
drop policy if exists "arisan_config_rw" on storage.objects;

-- Satu policy untuk baca + tulis (mini project iseng)
create policy "arisan_config_rw"
on storage.objects for all
to public
using (bucket_id = 'arisan-config')
with check (bucket_id = 'arisan-config');
