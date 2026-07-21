/**
 * Split communities/.../index.html into shared CSS/JS + thinner league shell.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const leagueDir = path.join(root, 'communities/hash-pku/leagues/wc-2026');
const indexPath = path.join(leagueDir, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
fs.writeFileSync(path.join(root, 'shared/css/app.css'), styles.join('\n\n/* --- */\n\n'), 'utf8');
console.log('CSS blocks:', styles.length);

const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log('Inline script blocks:', scripts.length, scripts.map(s => s.length));

const bootstrapIdx = scripts.length - 1;
let appJs = scripts.slice(0, bootstrapIdx).join('\n\n/* --- */\n\n');

// Allow runtime refresh from DB after fetch
appJs = appJs.replace(/const teamSupporters =/, 'let teamSupporters =');
appJs = appJs.replace(/const participantAvatars =/, 'let participantAvatars =');
appJs = appJs.replace(/const totalGoalData =/, 'let totalGoalData =');
appJs = appJs.replace(/const sideQuestPodium =/, 'let sideQuestPodium =');
appJs = appJs.replace(/const participantColors =/, 'let participantColors =');

// Expose sync helper used by bootstrap after DB fetch
appJs += `

/* --- league data sync from Supabase --- */
window.syncLeagueDataFromDb = function syncLeagueDataFromDb() {
    const d = window.LEAGUE_DATA;
    if (!d) return;
    if (d.teamSupporters) teamSupporters = d.teamSupporters;
    if (d.participantAvatars) participantAvatars = d.participantAvatars;
    if (d.totalGoalData) totalGoalData = d.totalGoalData;
    if (d.sideQuestPodium) sideQuestPodium = d.sideQuestPodium;
    if (d.participantColors) participantColors = d.participantColors;
};
`;

fs.writeFileSync(path.join(root, 'shared/js/bracket-app.js'), appJs, 'utf8');
console.log('Wrote bracket-app.js', appJs.length);

const bootstrapJs = `window.ADMIN_CONFIG = null;

async function loadAdminConfig() {
    try {
        localStorage.removeItem('arisan_admin_config');
    } catch (e) {}
    return ArisanConfigSources.fetchConfig();
}

function applyBrandingFromLeagueData() {
    const d = window.LEAGUE_DATA;
    if (!d) return;
    const title = [d.title, d.communityName].filter(Boolean).join(' ');
    if (!title) return;
    document.title = title;
    const h1 = document.querySelector('.header h1, header h1');
    if (h1) h1.textContent = title;
    const splashTitle = document.querySelector('.splash-title');
    if (splashTitle && d.title) splashTitle.textContent = d.title;
    const splashSub = document.querySelector('.splash-subtitle');
    if (splashSub && d.communityName) splashSub.textContent = d.communityName;
}

function startApp() {
    if (typeof window.syncLeagueDataFromDb === 'function') {
        window.syncLeagueDataFromDb();
    }
    applyBrandingFromLeagueData();

    if (typeof initGlowSync === 'function') initGlowSync();
    applyAdminConfig();
    advanceBracketWinners();
    updateMatchupScheduleStatus();
    markConfirmedTeamNames();
    applyFinishedMatchBadges();
    applyFinalPlacementBadges();
    applyPodiumBadgePreviewDemo();
    scheduleFinalWinnerCelebration();
    initLiveMatchupLinks();
    setInterval(updateMatchupScheduleStatus, 60 * 1000);
    setInterval(updateSoonCountdowns, 1000);

    setTimeout(drawBracketLines, 100);
    setTimeout(injectSupporters, 200);
    setTimeout(drawBracketLines, 300);

    setTimeout(function () {
        updateSideQuestEliminatedStatus();
        updateMainQuestEliminatedStatus();
        buildPodiumCards('podium-champion', sideQuestPodium.champion);
        buildPodiumCards('podium-runnerup', sideQuestPodium.runnerup);
        buildPodiumCards('podium-3rd', sideQuestPodium.third);
        buildGoldenBootChart();
        buildPlayerPodium('podium-goldenglove-container', ADMIN_CONFIG.goldenGlove || [], '🧤');
    }, 250);

    setTimeout(buildTotalGoalBar, 300);
    setTimeout(updateStandingsChart, 100);
}

(async function bootstrap() {
    try {
        window.ADMIN_CONFIG = await loadAdminConfig();
    } catch (e) {
        console.error('Config load failed:', e);
        window.ADMIN_CONFIG = {
            lastUpdated: '',
            finishedMatches: [],
            goldenBoot: [],
            goldenGlove: [],
        };
    }

    if (document.readyState === 'loading') {
        window.addEventListener('load', startApp);
    } else {
        startApp();
    }
})();
`;
fs.writeFileSync(path.join(root, 'shared/js/bootstrap.js'), bootstrapJs, 'utf8');

let body = html;
body = body.replace(/<style>[\s\S]*?<\/style>/g, '');
body = body.replace(/<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/g, '');
body = body.replace(/<script[^>]*src=["'][^"']*supabase-public\.js["'][^>]*><\/script>\s*/g, '');

if (!body.includes('shared/css/app.css')) {
  body = body.replace(
    /<\/title>/,
    `</title>\n    <link rel="stylesheet" href="../../../../shared/css/app.css">`
  );
}

body = body.replace(
  /https:\/\/github\.com\/ndodhendro\/arisan-wc-2026-knockout-hash-pku\/blob\/main\/assets\/fifa-world-cup-2026-logo\.png\?raw=true/g,
  'assets/fifa-world-cup-2026-logo.png'
);
body = body.replace(
  /https:\/\/github\.com\/ndodhendro\/arisan-wc-2026-knockout-hash-pku\/blob\/main\/assets\/([^"'?\s]+)\?raw=true/g,
  '../../assets/$1'
);

// Relative assets/ that are community-owned (avatars, music, icons)
body = body.replace(/src="assets\/([^"]+)"/g, (full, file) => {
  if (file === 'fifa-world-cup-2026-logo.png') return full;
  return `src="../../assets/${file}"`;
});
body = body.replace(
  /src="[^"]*dai-dai-shakira\.mp3"/g,
  'src="../../assets/dai-dai-shakira.mp3"'
);

const inject = `
    <script>
        window.LEAGUE_CONTEXT = {
            communitySlug: 'hash-pku',
            leagueSlug: 'wc-2026',
            assetBase: '../../assets/'
        };
    </script>
    <script src="../../../../shared/js/supabase-client.js"></script>
    <script src="../../../../shared/js/bracket-app.js"></script>
    <script src="../../../../shared/js/bootstrap.js"></script>
`;
body = body.replace('</body>', inject + '\n</body>');

fs.writeFileSync(indexPath, body, 'utf8');
console.log('Rewrote league index.html', body.length);
