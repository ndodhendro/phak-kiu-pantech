window.ADMIN_CONFIG = null;

async function loadAdminConfig() {
    try {
        localStorage.removeItem('arisan_admin_config');
    } catch (e) {}
    return ArisanConfigSources.fetchConfig();
}

const DEFAULT_LEAGUE_ICON_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT41kl1nnX-tqBQiGHVikOIDViXDZXRRulNdKFAK6c1eQ&s=10';
const DEFAULT_PARTICIPANT_AVATAR =
    'https://img.icons8.com/ios-filled/50/6b7280/user-male-circle.png';

function resolveParticipantAvatarUrl(avatars, name) {
    const src = avatars && name != null ? String(avatars[name] || '').trim() : '';
    return src || DEFAULT_PARTICIPANT_AVATAR;
}

function participantAvatarImgHtml(src, name, className) {
    const fallback = DEFAULT_PARTICIPANT_AVATAR.replace(/'/g, "\\'");
    return '<img src="' + escHtml(src) + '" alt="' + escHtml(name) +
        '" class="' + escHtml(className) +
        '" referrerpolicy="no-referrer" decoding="async"' +
        " onerror=\"if(this.dataset.fb)return;this.dataset.fb='1';this.src='" + fallback + "'\">";
}

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

function preloadImage(url) {
    return new Promise(resolve => {
        const raw = String(url || '').trim();
        if (!raw) {
            resolve();
            return;
        }
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = raw;
    });
}

async function preloadLeagueBrandingImages() {
    const seen = new Set();
    const urls = [getLeagueIconUrl(), getLeagueTrophyUrl(), getLeagueBallUrl()].filter(url => {
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
    });
    await Promise.all(urls.map(preloadImage));
}

function revealSplashBranding() {
    const overlay = document.getElementById('splash-overlay');
    if (overlay) {
        overlay.classList.remove('splash-pending');
        overlay.classList.add('splash-ready');
    }
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) enterBtn.disabled = false;
}

async function prepareSplashBranding() {
    await preloadLeagueBrandingImages();
    applyBrandingFromLeagueData();
    scheduleFitSplashTitle();
    revealSplashBranding();
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

let splashTitleFitResizeBound = false;

function fitSplashTitle() {
    const title = document.querySelector('.splash-title');
    const text = title && title.querySelector('.splash-title-text');
    const content = document.querySelector('.splash-content');
    if (!title || !content) return;

    title.style.fontSize = '';
    const maxWidth = content.clientWidth;
    if (!maxWidth) return;

    const measureEl = text || title;
    const maxFont = 28.8;
    const minFont = 9;
    let size = maxFont;

    title.style.fontSize = size + 'px';
    while (measureEl.scrollWidth > maxWidth && size > minFont) {
        size -= 0.5;
        title.style.fontSize = size + 'px';
    }
}

function scheduleFitSplashTitle() {
    requestAnimationFrame(function () {
        fitSplashTitle();
        requestAnimationFrame(fitSplashTitle);
    });
}

function bindSplashTitleFit() {
    scheduleFitSplashTitle();
    document.querySelectorAll('.splash-title-trophy').forEach(function (img) {
        if (img.complete) return;
        img.addEventListener('load', scheduleFitSplashTitle, { once: true });
    });
    if (splashTitleFitResizeBound) return;
    splashTitleFitResizeBound = true;
    let resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(scheduleFitSplashTitle, 100);
    });
}

function applyBrandingFromLeagueData() {
    applyIconBranding();
    applyTrophyBranding();
    applyBallBranding();

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
                '<span class="splash-title-text">' + escHtml(label) + '</span>';
            bindSplashTitleFit();
        }
        const splashSub = document.querySelector('.splash-subtitle');
        if (splashSub && d.communityName) splashSub.textContent = d.communityName;
    }
    applyBackgroundMusicFromLeagueData();
}

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function hasAnyMainQuestPotPick(rows, potKey) {
    const key = potKey || 'pots';
    return (rows || []).some(row =>
        (row[key] || row.pots || []).some(pot =>
            (Array.isArray(pot) ? pot : []).some(name => String(name || '').trim())
        )
    );
}

function buildOneMainQuestTableHtml(rows, potKey, avatars) {
    const potsList = (row) => row[potKey] || row.pots || [];
    const maxPots = Math.max(...rows.map(r => potsList(r).length), 1);

    let thead = '<tr><th>Participant</th>';
    for (let i = 0; i < maxPots; i++) {
        const potClass = 'pot' + (i < 8 ? i + 1 : 8);
        thead += '<th class="' + potClass + '" colspan="2">Pot ' + (i + 1) + '</th>';
    }
    thead += '</tr>';

    const tbody = rows.map((row) => {
        let tr = '<tr>';
        const avatar = resolveParticipantAvatarUrl(avatars, row.name);
        tr += '<td class="participant-cell">';
        tr += participantAvatarImgHtml(avatar, row.name, 'participant-avatar');
        tr += '<span class="participant-name-battery"><span class="participant-battery-fill"></span><strong>' +
            escHtml(row.name) + '</strong></span></td>';

        for (let i = 0; i < maxPots; i++) {
            const pot = potsList(row)[i] || ['', ''];
            const potClass = 'pot' + (i < 8 ? i + 1 : 8) + ' ';
            tr += '<td class="' + potClass + 'mq-pot-cell">' + escHtml(pot[0]) + '</td>';
            tr += '<td class="' + potClass + 'mq-pot-cell">' + escHtml(pot[1]) + '</td>';
        }
        tr += '</tr>';
        return tr;
    }).join('');

    return '<table class="standings-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
}

function buildMainQuestTableFromParticipants() {
    const d = window.LEAGUE_DATA;
    const wrapper = document.getElementById('main-quest-table-root');
    if (!d || !wrapper) return;

    const heading = wrapper.previousElementSibling;
    const rows = d.participantsMainQuest || [];
    const showGroup = !!d.includeGroupStage && hasAnyMainQuestPotPick(rows, 'groupPots');
    const showKnockout = d.includeKnockoutStage !== false && hasAnyMainQuestPotPick(rows, 'knockoutPots');
    // Legacy flat pots fallback when dual keys empty but old `pots` filled
    const showLegacy = !showGroup && !showKnockout && hasAnyMainQuestPotPick(rows, 'pots');
    const showTable = showGroup || showKnockout || showLegacy;

    if (!showTable) {
        wrapper.innerHTML = '';
        wrapper.classList.add('hidden');
        if (heading && heading.classList.contains('table-section-title')) {
            heading.classList.add('hidden');
        }
        const section = wrapper.closest('.league-panel');
        if (section) section.classList.add('hidden');
        return;
    }

    wrapper.classList.remove('hidden');
    if (heading && heading.classList.contains('table-section-title')) {
        heading.classList.remove('hidden');
    }
    const section = wrapper.closest('.league-panel');
    if (section) section.classList.remove('hidden');

    if (!rows.length) {
        wrapper.innerHTML = '<p class="hint">No participant data yet.</p>';
        return;
    }

    const avatars = d.participantAvatars || {};
    let html = '';
    if (showGroup) {
        html += '<div class="mq-stage-block" data-mq-stage="group" id="main-quest-group-root">' +
            '<h4 class="mq-stage-title">Group Stage</h4>' +
            buildOneMainQuestTableHtml(rows, 'groupPots', avatars) +
            '</div>';
    }
    if (showKnockout) {
        html += '<div class="mq-stage-block" data-mq-stage="knockout" id="main-quest-knockout-root">' +
            '<h4 class="mq-stage-title">Knockout Stage</h4>' +
            buildOneMainQuestTableHtml(rows, 'knockoutPots', avatars) +
            '</div>';
    }
    if (showLegacy) {
        html += '<div class="mq-stage-block" data-mq-stage="legacy" id="main-quest-group-root">' +
            buildOneMainQuestTableHtml(rows, 'pots', avatars) +
            '</div>';
    }

    wrapper.innerHTML = html;
}

function buildStandingsChartFromParticipants() {
    const d = window.LEAGUE_DATA;
    const chart = document.querySelector('#standings-points-chart')
        || document.querySelector('.standings-section .standings-chart:not(#goldenboot-chart)');
    if (!d || !chart) return;

    const names = Object.keys(d.participantAvatars || {});
    if (!names.length) return;

    const colors = d.participantColors || {};
    chart.innerHTML = names.map(name => {
        const color = colors[name] || '#3498db';
        const avatar = resolveParticipantAvatarUrl(d.participantAvatars, name);
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
            participantAvatarImgHtml(avatar, name, 'chart-avatar') +
            '</div></div>' +
            '</div>';
    }).join('');
}

function mountDynamicBracket() {
    const bracketRoot = document.getElementById('bracket-root') || document.querySelector('.bracket');
    const groupRoot = document.getElementById('group-stage-root') || document.querySelector('.group-stage');
    const d = window.LEAGUE_DATA;
    if (!d || typeof ArisanBracket === 'undefined') return;

    const hasGroup = !!d.includeGroupStage;
    const hasKnockout = d.includeKnockoutStage !== false;
    const knockoutTeams = (Array.isArray(d.knockoutSeeds) && d.knockoutSeeds.length)
        ? d.knockoutSeeds.map(t => ({
            name: t && t.name ? String(t.name).trim() : '',
            flag: (t && t.flag) || '',
        }))
        : (hasGroup ? [] : (d.teams || []));

    if (!hasGroup && !knockoutTeams.length && !(d.teams || []).length) return;

    const mountOpts = {
        teams: d.teams || [],
        competitionType: d.competitionType || 'country',
        includeThirdPlace: d.includeThirdPlace !== false,
        twoLegKnockout: !!d.twoLegKnockout,
        trophyImageUrl: d.trophyImageUrl || '',
        groupFixtures: d.groupFixtures || [],
        groupDefinitions: d.groupDefinitions || [],
        matchSchedule: d.matchSchedule || {},
        leagueYear: d.year,
    };

    if (groupRoot && hasGroup) {
        ArisanBracket.mountGroupStage(groupRoot, mountOpts);
        const hasContent = !!(groupRoot.innerHTML && groupRoot.innerHTML.trim());
        groupRoot.hidden = !hasContent;
        groupRoot.classList.toggle('is-empty', !hasContent);
    } else if (groupRoot) {
        groupRoot.innerHTML = '';
        groupRoot.hidden = true;
        groupRoot.classList.add('is-empty');
    }

    if (bracketRoot && hasKnockout) {
        if (knockoutTeams.length >= 2) {
            ArisanBracket.mountBracket(bracketRoot, Object.assign({}, mountOpts, { teams: knockoutTeams }));
        } else if (hasGroup) {
            bracketRoot.innerHTML = '<p class="bracket-error">Set knockout bracket pairs in league setup. TBD is allowed until group winners are known.</p>';
        } else if ((d.teams || []).length >= 2) {
            ArisanBracket.mountBracket(bracketRoot, mountOpts);
        } else {
            bracketRoot.innerHTML = '<p class="bracket-error">At least 2 knockout slots are required.</p>';
        }
    } else if (bracketRoot) {
        bracketRoot.innerHTML = '';
    }

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
    setTimeout(injectScorePredictions, 220);
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

    try {
        await prepareSplashBranding();
    } catch (e) {
        console.error('Splash branding failed:', e);
        applyBrandingFromLeagueData();
        scheduleFitSplashTitle();
        revealSplashBranding();
    }

    if (document.readyState === 'loading') {
        window.addEventListener('load', startApp);
    } else {
        startApp();
    }
})();
