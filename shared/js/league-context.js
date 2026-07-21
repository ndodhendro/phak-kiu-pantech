/**
 * Shared league routing for GitHub Pages / static hosting.
 * Prefer query params: /league/?community=…&league=…
 * Admin: /league/admin/?community=…&league=… (trailing slash — avoids serve stripping ?… on admin.html redirect)
 * Legacy path /communities/{c}/leagues/{l}/ still resolves for redirects.
 */
window.ArisanLeagueContext = (function () {
    const SESSION_COMMUNITY_KEY = 'arisan_league_community';
    const SESSION_LEAGUE_KEY = 'arisan_league_slug';

    function appRoot() {
        const path = location.pathname || '';
        let idx = path.indexOf('/league/admin.html');
        if (idx >= 0) return path.slice(0, idx);
        idx = path.indexOf('/league/admin');
        if (idx >= 0) return path.slice(0, idx);
        idx = path.indexOf('/league/');
        if (idx >= 0) return path.slice(0, idx);
        if (/\/league$/i.test(path)) return path.replace(/\/league$/i, '');
        idx = path.indexOf('/communities/');
        if (idx >= 0) return path.slice(0, idx);
        idx = path.indexOf('/admin/');
        if (idx >= 0) return path.slice(0, idx);
        if (/\/admin\.html$/i.test(path)) return path.replace(/\/admin\.html$/i, '');
        // GitHub Pages project site: /repo-name/ or /repo-name/index.html (localhost: / or /index.html)
        if (/\/index\.html$/i.test(path)) {
            const base = path.replace(/\/index\.html$/i, '');
            return base === '/' ? '' : base;
        }
        if (path.endsWith('/') && path.length > 1) return path.slice(0, -1);
        return '';
    }

    /** Site index URL — respects GitHub Pages subpath (e.g. /phak-kiu-pantech/). */
    function siteIndexUrl(query) {
        const q = query ? (query.startsWith('?') ? query : '?' + query) : '';
        return (appRoot() || '') + '/' + q;
    }

    /** Any path under the app root — e.g. appUrl('admin/setup.html?new=league'). */
    function appUrl(relativePath) {
        const raw = String(relativePath || '').trim();
        if (!raw) return siteIndexUrl();
        if (raw.startsWith('?')) return siteIndexUrl(raw.slice(1));
        return (appRoot() || '') + '/' + raw.replace(/^\//, '');
    }

    function fromQuery() {
        const q = new URLSearchParams(location.search || '');
        const communitySlug = (q.get('community') || q.get('c') || '').trim();
        const leagueSlug = (q.get('league') || q.get('l') || '').trim();
        if (!communitySlug || !leagueSlug) return null;
        return { communitySlug, leagueSlug };
    }

    function fromPath() {
        const m = (location.pathname || '').match(/\/communities\/([^/]+)\/leagues\/([^/]+)/);
        if (!m) return null;
        return {
            communitySlug: decodeURIComponent(m[1]),
            leagueSlug: decodeURIComponent(m[2]),
        };
    }

    function fromSessionStorage() {
        try {
            const communitySlug = (sessionStorage.getItem(SESSION_COMMUNITY_KEY) || '').trim();
            const leagueSlug = (sessionStorage.getItem(SESSION_LEAGUE_KEY) || '').trim();
            if (!communitySlug || !leagueSlug) return null;
            return { communitySlug, leagueSlug };
        } catch (e) {
            return null;
        }
    }

    function persistContext(parts) {
        if (!parts || !parts.communitySlug || !parts.leagueSlug) return;
        try {
            sessionStorage.setItem(SESSION_COMMUNITY_KEY, parts.communitySlug);
            sessionStorage.setItem(SESSION_LEAGUE_KEY, parts.leagueSlug);
        } catch (e) {}
    }

    function communityAssetBase(communitySlug) {
        if (window.ArisanDB && typeof ArisanDB.communityAssetBase === 'function') {
            return ArisanDB.communityAssetBase(communitySlug);
        }
        return '';
    }

    function buildContext(parts) {
        if (!parts || !parts.communitySlug || !parts.leagueSlug) return null;
        const root = appRoot();
        return {
            communitySlug: parts.communitySlug,
            leagueSlug: parts.leagueSlug,
            appRoot: root,
            assetBase: communityAssetBase(parts.communitySlug),
        };
    }

    function resolve() {
        const fromQ = fromQuery();
        const fromP = fromQ ? null : fromPath();
        const parts = fromQ || fromP || fromSessionStorage();
        if (fromQ || fromP) persistContext(parts);
        return buildContext(parts);
    }

    function apply() {
        const ctx = resolve();
        window.LEAGUE_CONTEXT = ctx;
        return ctx;
    }

    function leagueUrl(communitySlug, leagueSlug) {
        return appUrl('league/?community=' + encodeURIComponent(communitySlug) +
            '&league=' + encodeURIComponent(leagueSlug));
    }

    function adminUrl(communitySlug, leagueSlug) {
        return appUrl('league/admin/?community=' + encodeURIComponent(communitySlug) +
            '&league=' + encodeURIComponent(leagueSlug));
    }

    function homeUrl(communitySlug) {
        const q = communitySlug
            ? 'picker=1&community=' + encodeURIComponent(communitySlug)
            : 'picker=1';
        return siteIndexUrl(q);
    }

    return {
        appRoot,
        siteIndexUrl,
        appUrl,
        resolve,
        apply,
        leagueUrl,
        adminUrl,
        homeUrl,
        persistContext,
    };
})();
