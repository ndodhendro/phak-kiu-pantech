# Setup Supabase — Deploy Config 1 Klik

Tanpa Edge Function, tanpa CLI, tanpa PIN di server. Semua lewat **Dashboard + browser**.

## 1. Buat project Supabase

1. [supabase.com](https://supabase.com) → New project
2. Catat **Project URL** dan **anon public key** (Settings → API)

## 2. Isi `supabase-public.js`

```javascript
window.ARISAN_SUPABASE = {
    url: 'https://XXXX.supabase.co',
    anonKey: 'eyJhbGci...',
    bucket: 'arisan-config',
    configFile: 'admin-config.json',
};
```

## 3. Buat bucket (SQL Editor)

Dashboard → **SQL Editor** → jalankan isi file:

`supabase/migrations/20260703100000_storage_bucket.sql`

## 4. Upload website ke GitHub Pages

- `supabase-public.js`
- `admin.html`
- `index.html`

## Alur harian

1. Edit data di admin (PIN di browser tetap ada untuk buka panel)
2. Klik **Deploy ke Supabase**
3. Website baca config terbaru langsung — tidak perlu GitHub Actions

## Catatan

Mini project: siapa pun yang punya **anon key** (terlihat di `supabase-public.js`) bisa upload config. Itu sengaja disederhanakan.
