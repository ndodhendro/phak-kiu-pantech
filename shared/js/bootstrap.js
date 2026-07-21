window.ADMIN_CONFIG = null;

async function loadAdminConfig() {
    try {
        localStorage.removeItem('arisan_admin_config');
    } catch (e) {}
    return ArisanConfigSources.fetchConfig();
}

const DEFAULT_LEAGUE_ICON_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT41kl1nnX-tqBQiGHVikOIDViXDZXRRulNdKFAK6c1eQ&s=10';

function getLeagueIconUrl() {
    const d = window.LEAGUE_DATA;
    const icon = d && d.iconImageUrl;
    if (icon && /^https?:\/\//i.test(String(icon).trim())) return String(icon).trim();
    const legacy = d && d.trophyImageUrl;
    if (legacy && /^https?:\/\//i.test(String(legacy).trim())) return String(legacy).trim();
    return DEFAULT_LEAGUE_ICON_URL;
}

function getLeagueTrophyUrl() {
    const d = window.LEAGUE_DATA;
    const url = d && d.trophyImageUrl;
    if (url && /^https?:\/\//i.test(String(url).trim())) return String(url).trim();
    if (typeof ArisanBracket !== 'undefined' && ArisanBracket.DEFAULT_TROPHY_IMG) {
        return ArisanBracket.DEFAULT_TROPHY_IMG;
    }
    return 'https://png.pngtree.com/png-vector/20250923/ourmid/pngtree-the-fifa-world-cup-trophy-png-image_17551611.webp';
}

const DEFAULT_LEAGUE_BALL_URL = 'https://png.pngtree.com/png-vector/20260610/ourmid/pngtree-vibrant-trionda-soccer-football-official-fifa-world-cup-2026-design-png-image_19512258.webp';

function getLeagueBallUrl() {
    const d = window.LEAGUE_DATA;
    const url = d && d.ballImageUrl;
    if (url && /^https?:\/\//i.test(String(url).trim())) return String(url).trim();
    return DEFAULT_LEAGUE_BALL_URL;
}

function applyIconBranding() {
    const iconUrl = getLeagueIconUrl();
    document.querySelectorAll('[data-league-icon]').forEach(img => {
        img.src = iconUrl;
    });
}

function applyTrophyBranding() {
    const trophyUrl = getLeagueTrophyUrl();
    document.querySelectorAll('[data-league-trophy]').forEach(img => {
        img.src = trophyUrl;
    });
    document.querySelectorAll('.round-trophy img').forEach(img => {
        img.src = trophyUrl;
    });
}

function applyBallBranding() {
    const ballUrl = getLeagueBallUrl();
    document.querySelectorAll('[data-league-ball]').forEach(img => {
        img.src = ballUrl;
    });
}

function applyBackgroundMusicFromLeagueData() {
    const audio = document.getElementById('bg-music');
    if (!audio) return;
    const d = window.LEAGUE_DATA;
    const url = d && d.backgroundMusicUrl && String(d.backgroundMusicUrl).trim();
    if (!url || !/^https?:\/\//i.test(url)) return;

    const wasPlaying = !audio.paused && !audio.ended;
    const current = (audio.currentSrc || audio.src || '').trim();
    if (current === url) return;

    audio.querySelectorAll('source').forEach(s => s.remove());
    audio.src = url;
    audio.load();
    if (wasPlaying) {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    }
}

function getLeagueTitleLabel(d) {
    if (!d || !d.title) return '';
    const year = d.year != null && d.year !== '' ? String(d.year).trim() : '';
    return year ? (d.title + ' ' + year) : d.title;
}

function applyBrandingFromLeagueData() {
    const d = window.LEAGUE_DATA;
    if (!d) return;
    const pageTitle = [getLeagueTitleLabel(d) || d.title, d.communityName].filter(Boolean).join(' ');
    if (pageTitle) {
        document.title = pageTitle;
        const h1 = document.querySelector('.header h1, header h1');
        if (h1 && d.title) {
            h1.textContent = getLeagueTitleLabel(d);
        }
        const headerCommunity = document.querySelector('.header-community');
        if (headerCommunity) {
            headerCommunity.textContent = d.communityName || '';
        }
        const splashTitle = document.querySelector('.splash-title');
        if (splashTitle && d.title) {
            const label = getLeagueTitleLabel(d);
            const trophyUrl = getLeagueTrophyUrl();
            const trophyImg =
                '<img class="splash-title-trophy" src="' + escHtml(trophyUrl) +
                '" alt="" data-league-trophy decoding="async">';
            splashTitle.innerHTML =
                trophyImg +
                '<span class="splash-title-text">' + escHtml(label) + '</span>' +
                trophyImg;
        }
        const splashSub = document.querySelector('.splash-subtitle');
        if (splashSub && d.communityName) splashSub.textContent = d.communityName;
    }
    applyIconBranding();
    applyTrophyBranding();
    applyBallBranding();
    applyBackgroundMusicFromLeagueData();
}

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildMainQuestTableFromParticipants() {
    const d = window.LEAGUE_DATA;
    const wrapper = document.getElementById('main-quest-table-root');
    if (!d || !wrapper) return;

    const rows = d.participantsMainQuest || [];
    if (!rows.length) {
        wrapper.innerHTML = '<p class="hint">No participant data yet.</p>';
        return;
    }

    const maxPots = Math.max(...rows.map(r => r.pots.length), 1);
    const avatars = d.participantAvatars || {};

    let thead = '<tr><th>Participant</th>';
    for (let i = 0; i < maxPots; i++) {
        const potClass = 'pot' + (i < 8 ? i + 1 : 8);
        thead += '<th class="' + potClass + '" colspan="2">Pot ' + (i + 1) + '</th>';
    }
    thead += '</tr>';

    const tbody = rows.map((row) => {
        let tr = '<tr>';
        const avatar = avatars[row.name] || '';
        tr += '<td class="participant-cell">';
        if (avatar) {
            tr += '<img src="' + escHtml(avatar) + '" alt="' + escHtml(row.name) +
                '" class="participant-avatar" referrerpolicy="no-referrer" decoding="async">';
        }
        tr += '<span class="participant-name-battery"><span class="participant-battery-fill"></span><strong>' +
            escHtml(row.name) + '</strong></span></td>';

        for (let i = 0; i < maxPots; i++) {
            const pot = row.pots[i] || ['', ''];
            const potClass = 'pot' + (i < 8 ? i + 1 : 8) + ' ';
            tr += '<td class="' + potClass + 'mq-pot-cell">' + escHtml(pot[0]) + '</td>';
            tr += '<td class="' + potClass + 'mq-pot-cell">' + escHtml(pot[1]) + '</td>';
        }
        tr += '</tr>';
        return tr;
    }).join('');

    wrapper.innerHTML =
        '<table class="standings-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
}

function buildStandingsChartFromParticipants() {
    const d = window.LEAGUE_DATA;
    const chart = document.querySelector('.standings-section > .standings-chart');
    if (!d || !chart) return;

    const names = Object.keys(d.participantAvatars || {});
    if (!names.length) return;

    const colors = d.participantColors || {};
    chart.innerHTML = names.map(name => {
        const color = colors[name] || '#3498db';
        const avatar = d.participantAvatars[name] || '';
        return '<div class="chart-row">' +
            '<div class="chart-label">' +
            '<div class="chart-label-box podium-team-card">' +
            '<div class="podium-team-info">' +
            '<span class="chart-rank">–</span>' +
            '<span class="chart-name">' + name + '</span>' +
            '</div></div></div>' +
            '<div class="chart-bar-wrapper">' +
            '<div class="chart-bar" style="background:' + color + ';">' +
            '<span class="chart-value">0</span>' +
            (avatar ? '<img src="' + avatar + '" alt="' + name +
                '" class="chart-avatar" referrerpolicy="no-referrer" decoding="async">' : '') +
            '</div></div></div>';
    }).join('');
}

function mountDynamicBracket() {
    const root = document.getElementById('bracket-root') || document.querySelector('.bracket');
    const d = window.LEAGUE_DATA;
    if (!root || !d || !d.teams || !d.teams.length) return;
    if (typeof ArisanBracket === 'undefined') return;

    ArisanBracket.mountBracket(root, {
        teams: d.teams,
        competitionType: d.competitionType || 'country',
        includeThirdPlace: d.includeThirdPlace !== false,
        twoLegKnockout: !!d.twoLegKnockout,
        trophyImageUrl: d.trophyImageUrl || '',
    });

    if (d.matchSchedule && typeof ArisanBracket.applyMatchSchedules === 'function') {
        ArisanBracket.applyMatchSchedules(d.matchSchedule, d.year);
    }
}

function startApp() {
    mountDynamicBracket();

    if (typeof window.syncLeagueDataFromDb === 'function') {
        window.syncLeagueDataFromDb();
    }
    applyBrandingFromLeagueData();
    buildStandingsChartFromParticipants();
    buildMainQuestTableFromParticipants();

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
    if (!window.LEAGUE_CONTEXT || !window.LEAGUE_CONTEXT.communitySlug || !window.LEAGUE_CONTEXT.leagueSlug) {
        console.warn('LEAGUE_CONTEXT missing — skip league bootstrap');
        return;
    }
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
