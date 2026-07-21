# Setup Supabase — Postgres (communities → leagues)

Website ini **tanpa Storage JSON**. Skor, peserta, awards, dan metadata liga hidup di **Supabase Postgres**.

## 1. Buat / buka project Supabase

1. [supabase.com](https://supabase.com) → project
2. Catat **Project URL** dan **anon public key** (Settings → API)

## 2. Isi kredensial client

Edit [`shared/js/supabase-client.js`](../shared/js/supabase-client.js):

```javascript
window.ARISAN_SUPABASE = {
    url: 'https://XXXX.supabase.co',
    anonKey: 'eyJhbGci...',
};
```

## 3–4. Schema + seed (satu kali)

Dashboard → **SQL Editor** → jalankan **salah satu**:

- Semua sekaligus: [`supabase/seed/apply_all.sql`](../supabase/seed/apply_all.sql)
- Atau terpisah:
  1. [`supabase/migrations/20260720_init_schema.sql`](../supabase/migrations/20260720_init_schema.sql)
  2. [`supabase/migrations/20260721_league_setup_v2.sql`](../supabase/migrations/20260721_league_setup_v2.sql) — wajib jika DB sudah ada dari schema lama (menambah `leagues.settings` + `participants.picks`)
  3. [`supabase/seed/seed_hash_pku_wc2026.sql`](../supabase/seed/seed_hash_pku_wc2026.sql)

Jika Save setup gagal dengan *Could not find the 'settings' column*, jalankan migrasi v2 di SQL Editor:

```sql
alter table public.leagues
    add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.participants
    add column if not exists picks jsonb not null default '{}'::jsonb;
```

Lalu di Dashboard → **Settings → API** (atau tunggu ~1 menit) agar schema cache PostgREST refresh; atau **Project Settings → API → Reload schema**.

Seed berisi HASH PKU / WC 2026 (peserta, tim, skor, awards). Regenerasi seed: `node supabase/seed/generate-seed.js`

Tabel yang dibuat: `communities`, `leagues`, `participants`, `teams`, `team_supporters`, `matches`, `awards`, `side_quests`. RLS: public read+write (root gate di browser; Match Admin terbuka tanpa PIN).

## 5. Deploy website (GitHub Pages)

Publish root repo. Struktur penting:

```text
index.html                 ← picker komunitas → liga
league/index.html          ← halaman liga (dinamis dari Supabase)
league/admin/              ← Update Match (dinamis dari Supabase)
shared/js/league-context.js
shared/js/supabase-client.js
communities/{slug}/assets/ ← avatar / asset komunitas (opsional)
```

URL liga: `/league/?community={slug}&league={liga}`  
URL admin: `/league/admin/?community={slug}&league={liga}`

Path lama `/communities/.../leagues/.../` di-redirect ke URL di atas.

## Alur harian

1. Buka Update Match dari floating nav liga, atau `league/admin/?community=…&league=…` (tanpa PIN)
2. Edit skor / Golden Boot / Golden Glove
3. **Save** → upsert ke tabel `matches` + `awards`, update `leagues.last_updated`
4. Halaman publik membaca DB langsung (tanpa commit Git)

## Tambah komunitas / liga baru

1. Buka **[admin/setup.html](../admin/setup.html)** — konfigurasi peserta, negara, awards, side quest
2. **Save Setup** → data masuk Supabase; liga langsung bisa dibuka lewat picker / URL query (tidak perlu duplikasi HTML)
3. Skor pertandingan: **Update Match** di `league/admin/?community=…&league=…`

Asset komunitas (avatar lokal, dll.) tetap di `communities/{slug}/assets/` bila dipakai.

## Catatan keamanan

Anon key terlihat di client; siapa pun yang tahu URL API bisa menulis ke tabel. Cocok untuk arisan internal. Untuk produksi lebih ketat, ganti RLS + auth Supabase.
