/**
 * Isi URL & anon key dari Supabase Dashboard → Project Settings → API
 */
window.ARISAN_SUPABASE = {
    url: 'https://owexnrdvmragupmquwzr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZXhucmR2bXJhZ3VwbXF1d3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjYxNDAsImV4cCI6MjA5ODY0MjE0MH0.ykhaVTmZoQR0461t22mnIkcQtGCTWGYcK9mN9HQ_KCA',
    bucket: 'arisan-config',
    configFile: 'admin-config.json',
};

window.ArisanConfigSources = {
    isConfigured() {
        const c = window.ARISAN_SUPABASE;
        return !!(c.url && c.anonKey
            && !c.url.includes('YOUR_PROJECT')
            && !c.anonKey.includes('YOUR_ANON'));
    },

    getPublicConfigUrl() {
        if (!this.isConfigured()) return null;
        const c = window.ARISAN_SUPABASE;
        return c.url + '/storage/v1/object/public/' + c.bucket + '/' + c.configFile;
    },

    async fetchJsonNoCache(url) {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(url + sep + 't=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    },

    async fetchConfig() {
        const supabaseUrl = this.getPublicConfigUrl();
        if (supabaseUrl) {
            try {
                return await this.fetchJsonNoCache(supabaseUrl);
            } catch (e) {
                console.warn('Supabase config fetch failed:', e);
            }
        }
        const cdnUrl = 'https://cdn.jsdelivr.net/gh/ndodhendro/arisan-wc-2026-knockout-hash-pku@main/admin-config.json';
        try {
            return await this.fetchJsonNoCache(cdnUrl);
        } catch (e) {
            return this.fetchJsonNoCache('admin-config.json');
        }
    },

    async uploadConfig(config) {
        const c = window.ARISAN_SUPABASE;
        const objectPath = c.bucket + '/' + c.configFile;
        const res = await fetch(c.url + '/storage/v1/object/' + objectPath, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + c.anonKey,
                'apikey': c.anonKey,
                'Content-Type': 'application/json',
                'x-upsert': 'true',
            },
            body: JSON.stringify(config, null, 2),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.error || 'HTTP ' + res.status);
        }
    },
};
