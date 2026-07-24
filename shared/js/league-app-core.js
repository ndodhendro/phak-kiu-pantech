/**
 * League detail — shared core (state + helpers)
 * Split from bracket-app.js — shared ArisanLeagueApp core.
 */
(function (Core) {
'use strict';

Core.splitLegacyScoreString = function splitLegacyScoreString(scoreStr) {
    const text = String(scoreStr ?? '').trim();
    const m = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
    if (m) {
        return { ft: parseInt(m[1], 10), et: parseInt(m[2], 10) };
    }
    const n = parseInt(text, 10);
    return { ft: Number.isNaN(n) ? 0 : n, et: 0 };
};
Core.getMatchScoreParts = function getMatchScoreParts(match) {
    const scores = match?.scores;
    if (scores && typeof scores === 'object' && !Array.isArray(scores)) {
        const toNum = v => {
            const n = parseInt(String(v ?? ''), 10);
            return Number.isNaN(n) ? 0 : Math.max(0, n);
        };
        return {
            ft: [toNum(scores.ft?.[0]), toNum(scores.ft?.[1])],
            et: [toNum(scores.et?.[0]), toNum(scores.et?.[1])],
        };
    }
    const legacy0 = Core.splitLegacyScoreString(scores?.[0]);
    const legacy1 = Core.splitLegacyScoreString(scores?.[1]);
    return {
        ft: [legacy0.ft, legacy1.ft],
        et: [legacy0.et, legacy1.et],
    };
};
Core.formatScoreForDisplay = function formatScoreForDisplay(ft, et, showExtraTimeFormat) {
    const fullTime = Math.max(0, parseInt(ft, 10) || 0);
    const extraTime = Math.max(0, parseInt(et, 10) || 0);
    if (showExtraTimeFormat || extraTime > 0) {
        return fullTime + ' (' + extraTime + ')';
    }
    return String(fullTime);
};
Core.resolveFinishedWinnerIndex = function resolveFinishedWinnerIndex(match) {
    const explicit = parseInt(match?.winner, 10);
    if (explicit === 0 || explicit === 1) return explicit;

    // Fallback: tentukan pemenang dari skor jika admin lupa pilih winner.
    const parts = Core.getMatchScoreParts(match);
    const total0 = parts.ft[0] + parts.et[0];
    const total1 = parts.ft[1] + parts.et[1];
    if (total0 > total1) return 0;
    if (total1 > total0) return 1;
    return null;
};
Core.bracketLinesResizeTimer = null;

// Main Quest supporter data: team name -> array of supporters

// Union map (group + KO) for bracket panels / goal stats; stage maps for W/D/L

Core.teamSupporters = {
    'Portugal': ['Davin'],
    'Argentina': ['Davin', 'Ndod', 'Khuang', 'Marten', 'Cham', 'Willy'],
    'United States': ['Davin'],
    'Colombia': ['Davin', 'Khuang', 'Marten', 'Cham'],
    'Norway': ['Davin', 'Ndod', 'Khuang', 'Marten', 'Cham', 'Willy'],
    'Canada': ['Davin', 'Khuang'],
    'Algeria': ['Davin', 'Khuang'],
    'DR Congo': ['Davin', 'Ndod'],
    'France': ['Ndod', 'Cham', 'Willy'],
    'Morocco': ['Ndod', 'Cham', 'Wesly'],
    'Croatia': ['Ndod'],
    'Senegal': ['Ndod', 'Marten', 'Cham', 'Willy', 'Wesly'],
    'South Africa': ['Ndod', 'Willy'],
    'Spain': ['Khuang', 'Marten', 'Wesly'],
    'Belgium': ['Khuang', 'Willy'],
    'Bosnia and Herzegovina': ['Khuang', 'Wesly'],
    'Japan': ['Marten', 'Willy', 'Wesly'],
    'Ghana': ['Marten', 'Cham'],
    'Austria': ['Marten', 'Cham'],
    'Cape Verde': ['Willy'],
    'Brazil': ['Wesly'],
    'Sweden': ['Wesly'],
    'Paraguay': ['Wesly'],
};

Core.teamSupportersGroup = Object.assign({}, Core.teamSupporters);

Core.teamSupportersKnockout = Object.assign({}, Core.teamSupporters);

Core.pointConfig = {
    mainQuestMode: 'fixed',
    mainQuest: { win: 3, draw: 1, loss: 0 },
    teamPoints: {},
    sideQuest: { champion: 10, runnerup: 5, third: 3, goldenBoot: 5, goldenGlove: 5, totalGoal: 5, scorePredict: 5 },
    sideQuestShare: {
        champion: true, runnerup: true, third: true,
        goldenBoot: true, goldenGlove: true, totalGoal: true, scorePredict: true,
    },
};

Core.includeGroupStage = false;

Core.includeKnockoutStage = true;

Core.includeThirdPlace = true;

Core.competitionType = 'country';

Core.twoLegKnockout = false;

Core.isGroupMatchId = function isGroupMatchId(matchId) {
    return String(matchId || '').startsWith('group-');
};
Core.isKnockoutMatchup = function isKnockoutMatchup(matchup) {
    const matchId = matchup?.dataset?.matchId || '';
    return !Core.isGroupMatchId(matchId);
};
Core.getWdlMatchupSelector = function getWdlMatchupSelector() {
    const parts = [];
    if (Core.includeGroupStage) parts.push('.group-stage .matchup.finished');
    if (Core.includeKnockoutStage) parts.push('.bracket .matchup.finished');
    return parts.join(', ');
};
Core.forEachWdlMatchup = function forEachWdlMatchup(callback) {
    const selector = Core.getWdlMatchupSelector();
    if (!selector) return;
    document.querySelectorAll(selector).forEach(matchup => {
        if (Core.includeKnockoutStage && Core.isKnockoutMatchup(matchup) && Core.isThirdPlaceMatchup(matchup)) return;
        callback(matchup);
    });
};
Core.forEachGoalStatMatchup = function forEachGoalStatMatchup(callback) {
    if (Core.includeGroupStage) {
        document.querySelectorAll('.group-stage .matchup.finished').forEach(callback);
    }
    if (Core.includeKnockoutStage) {
        document.querySelectorAll('.bracket .matchup.finished').forEach(callback);
    }
};
Core.isTwoLegKnockout = function isTwoLegKnockout() {
    return !!Core.twoLegKnockout || !!(window.LEAGUE_DATA && window.LEAGUE_DATA.twoLegKnockout);
};
Core.getTieElement = function getTieElement(tieId) {
    return document.querySelector('.matchup-tie[data-tie-id="' + tieId + '"]');
};
Core.getTieLeg1 = function getTieLeg1(tieEl) {
    if (!tieEl) return null;
    return tieEl.querySelector('.matchup[data-match-id$="-leg1"]') || tieEl.querySelector('.matchup');
};
Core.isTieResolved = function isTieResolved(tieId) {
    if (!Core.isTwoLegKnockout() || typeof ArisanBracket === 'undefined') return false;
    const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
    return result.legsComplete && result.winnerIdx !== null;
};
Core.isFinalResolved = function isFinalResolved() {
    if (Core.isTwoLegKnockout()) return Core.isTieResolved('final-0');
    const m = document.querySelector('[data-match-id="final-0"]');
    return !!(m && m.classList.contains('finished'));
};
Core.isThirdPlaceResolved = function isThirdPlaceResolved() {
    if (Core.isTwoLegKnockout()) return Core.isTieResolved('third-0');
    const m = document.querySelector('[data-match-id="third-0"]');
    return !!(m && m.classList.contains('finished'));
};
Core.getRoundBracketUnits = function getRoundBracketUnits(roundEl) {
    if (!roundEl) return [];
    const roots = [
        ...roundEl.querySelectorAll(':scope > .round-matches'),
        ...roundEl.querySelectorAll(':scope > .final-match-row > .round-matches'),
    ];
    const ties = [];
    const matchups = [];
    roots.forEach(root => {
        root.querySelectorAll(':scope > .matchup-tie').forEach(el => ties.push(el));
        root.querySelectorAll(':scope > .matchup').forEach(el => matchups.push(el));
    });
    return ties.length ? ties : matchups;
};
Core.defaultAvatar = 'https://img.icons8.com/ios-filled/50/6b7280/user-male-circle.png';

// Fallback lokal; diganti dari LEAGUE_DATA.participantAvatars saat sync DB.

Core.participantAvatars = {};

Core.applyParticipantAvatar = function applyParticipantAvatar(img, name) {
    if (!img) return;
    const src = Core.participantAvatars[name] || Core.defaultAvatar;
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.alt = name || img.alt || '';
    img.onerror = function () {
        if (this.dataset.avatarFallback === '1') return;
        this.dataset.avatarFallback = '1';
        this.src = Core.defaultAvatar;
    };
    img.src = src;
};
Core.getInitials = function getInitials(name) {
    return name.substring(0, 3).toUpperCase();
};
Core.formatSupportersLabel = function formatSupportersLabel(count) {
    const n = Math.max(0, Number(count) || 0);
    return n === 1 ? 'Supporter (1)' : ('Supporters (' + n + ')');
};
Core.createPanelSlideInner = function createPanelSlideInner() {
    const inner = document.createElement('div');
    inner.className = 'panel-slide-inner';
    return inner;
};
Core.createSupportersDrop = function createSupportersDrop(btn, panel) {
    const drop = document.createElement('div');
    drop.className = 'supporters-drop';
    drop.appendChild(btn);
    drop.appendChild(panel);
    return drop;
};
Core.appendSupporterItems = function appendSupporterItems(inner, supporters) {
    (supporters || []).forEach(s => {
        const item = document.createElement('div');
        item.className = 'supporter-item';
        const img = document.createElement('img');
        img.className = 'supporter-avatar';
        Core.applyParticipantAvatar(img, s);
        const label = document.createElement('span');
        label.className = 'supporter-name';
        label.textContent = Core.getInitials(s);
        item.appendChild(img);
        item.appendChild(label);
        inner.appendChild(item);
    });
};
Core.ensureSupportersPanelFilled = function ensureSupportersPanelFilled(panel, supporters) {
    if (!panel || panel.dataset.filled === '1') return;
    panel.dataset.filled = '1';
    let inner = panel.querySelector(':scope > .panel-slide-inner');
    if (!inner) {
        inner = Core.createPanelSlideInner();
        panel.appendChild(inner);
    } else {
        inner.replaceChildren();
    }
    Core.appendSupporterItems(inner, supporters);
};
Core.toggleSlidePanel = function toggleSlidePanel(panel, wantOpen) {
    const open = wantOpen == null ? !panel.classList.contains('show') : !!wantOpen;
    panel.classList.toggle('show', open);
    return open;
};
/** Keep the toggle label fixed on screen while the list expands/collapses downward. */

Core.pinElementScreenY = function pinElementScreenY(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') {
        return function () {};
    }
    const y0 = el.getBoundingClientRect().top;
    let raf = 0;
    let active = true;
    const tick = function () {
        if (!active) return;
        const y1 = el.getBoundingClientRect().top;
        const delta = y1 - y0;
        if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, delta);
        }
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return function stopPin() {
        active = false;
        if (raf) cancelAnimationFrame(raf);
        const y1 = el.getBoundingClientRect().top;
        const delta = y1 - y0;
        if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
    };
};
Core.afterPanelSlide = function afterPanelSlide(panel, callback) {
    if (typeof callback !== 'function') return;
    let done = false;
    const finish = function () {
        if (done) return;
        done = true;
        panel.removeEventListener('transitionend', onEnd);
        callback();
    };
    const onEnd = function (e) {
        if (e.target !== panel) return;
        if (e.propertyName && e.propertyName !== 'grid-template-rows') return;
        finish();
    };
    panel.addEventListener('transitionend', onEnd);
    setTimeout(finish, 360);
};
Core.bindSupportersToggle = function bindSupportersToggle(btn, panel, count, afterToggle, fillOnOpen) {
    const closedLabel = Core.formatSupportersLabel(count);
    btn.textContent = closedLabel;
    btn.onclick = function(e) {
        if (e) e.stopPropagation();
        if (panel.dataset.slideBusy === '1') return;
        panel.dataset.slideBusy = '1';
        const willOpen = !panel.classList.contains('show');
        if (willOpen && typeof fillOnOpen === 'function') fillOnOpen();
        const stopPin = Core.pinElementScreenY(btn);
        const isVisible = Core.toggleSlidePanel(panel);
        btn.textContent = isVisible ? 'Hide' : closedLabel;
        Core.afterPanelSlide(panel, function () {
            stopPin();
            panel.dataset.slideBusy = '';
            if (typeof afterToggle === 'function') afterToggle(isVisible);
        });
    };
};
Core.scorePredictions = {};

Core.TOURNAMENT_YEAR = 2026;

Core.TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

Core.GLOW_RHYTHM_MS = 2500;

// Live dimulai 15 menit sebelum kickoff, berakhir 3 jam setelah kickoff

Core.LIVE_PREMATCH_MS = 15 * 60 * 1000;

Core.LIVE_MATCH_DURATION_MS = 180 * 60 * 1000;

Core.LIVE_STREAM_URL = 'https://lee22.0i52waitxcy8needs.cfd/id';

Core.MONTH_INDEX = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    // legacy Indonesian
    januari: 0, februari: 1, maret: 2, mei: 4, juni: 5,
    juli: 6, agustus: 7, oktober: 9, desember: 11,
};

// Soon progress bar: slide when the match card enters the viewport

Core.soonSlideWatchVisible = new WeakMap();

Core.soonSlideWatchToEl = new WeakMap();

Core.soonSlideObserver = null;

/** True once server time has passed third-place or final kickoff (from matchSchedule). */

Core.TBD_FLAG_SRC = 'https://img.icons8.com/ios-filled/50/6b7280/shield.png';

Core.getTeamDataFromElement = function getTeamDataFromElement(teamEl) {
    const nameEl = teamEl.querySelector('.team-name');
    const flagImg = teamEl.querySelector('.team-flag img');
    if (!nameEl || !flagImg) return null;

    return {
        name: nameEl.textContent.trim(),
        flagSrc: flagImg.getAttribute('src'),
        flagAlt: flagImg.getAttribute('alt') || '',
    };
};
Core.getMatchupWinner = function getMatchupWinner(matchup) {
    if (!matchup.classList.contains('finished')) return null;

    let winnerEl = matchup.querySelector(':scope > .team.winner');

    if (!winnerEl) {
        const matchId = matchup.dataset.matchId;
        const match = (window.ADMIN_CONFIG?.finishedMatches || []).find(m => m.id === matchId);
        const winnerIdx = typeof Core.resolveFinishedWinnerIndex === 'function'
            ? Core.resolveFinishedWinnerIndex(match)
            : null;
        if (winnerIdx === 0 || winnerIdx === 1) {
            winnerEl = matchup.querySelectorAll(':scope > .team')[winnerIdx];
        }
    }

    if (!winnerEl) return null;

    const data = Core.getTeamDataFromElement(winnerEl);
    if (!data || data.name === 'TBD') return null;
    return data;
};
Core.getMatchupLoser = function getMatchupLoser(matchup) {
    if (!matchup.classList.contains('finished')) return null;

    const teams = matchup.querySelectorAll(':scope > .team');
    let loserEl = Array.from(teams).find(teamEl => !teamEl.classList.contains('winner'));

    // Fallback: tentukan dari config bila class winner belum ada di DOM
    if (!loserEl || !Core.getTeamDataFromElement(loserEl) || Core.getTeamDataFromElement(loserEl).name === 'TBD') {
        const matchId = matchup.dataset.matchId;
        const match = (window.ADMIN_CONFIG?.finishedMatches || []).find(m => m.id === matchId);
        const winnerIdx = typeof Core.resolveFinishedWinnerIndex === 'function'
            ? Core.resolveFinishedWinnerIndex(match)
            : null;
        if (winnerIdx === 0 || winnerIdx === 1) {
            loserEl = teams[1 - winnerIdx];
        }
    }

    if (!loserEl) return null;

    const data = Core.getTeamDataFromElement(loserEl);
    if (!data || data.name === 'TBD') return null;
    return data;
};
Core.getTieWinnerTeamData = function getTieWinnerTeamData(tieEl) {
    if (!tieEl || !tieEl.classList.contains('matchup-tie')) return null;
    const tieId = tieEl.dataset.tieId;
    if (!tieId || typeof ArisanBracket === 'undefined') return null;
    const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
    if (!result.legsComplete || result.winnerIdx === null) return null;
    const leg1 = Core.getTieLeg1(tieEl);
    const teams = leg1.querySelectorAll(':scope > .team');
    const winnerEl = teams[result.winnerIdx];
    if (!winnerEl) return null;
    const data = Core.getTeamDataFromElement(winnerEl);
    if (!data || data.name === 'TBD') return null;
    return data;
};
Core.getTieLoserTeamData = function getTieLoserTeamData(tieEl) {
    if (!tieEl || !tieEl.classList.contains('matchup-tie')) return null;
    const tieId = tieEl.dataset.tieId;
    if (!tieId || typeof ArisanBracket === 'undefined') return null;
    const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
    if (!result.legsComplete || result.winnerIdx === null) return null;
    const leg1 = Core.getTieLeg1(tieEl);
    const teams = leg1.querySelectorAll(':scope > .team');
    const loserEl = teams[1 - result.winnerIdx];
    if (!loserEl) return null;
    const data = Core.getTeamDataFromElement(loserEl);
    if (!data || data.name === 'TBD') return null;
    return data;
};
Core.getBracketUnitWinner = function getBracketUnitWinner(unitEl) {
    if (unitEl.classList.contains('matchup-tie')) return Core.getTieWinnerTeamData(unitEl);
    return Core.getMatchupWinner(unitEl);
};
Core.getBracketUnitLoser = function getBracketUnitLoser(unitEl) {
    if (unitEl.classList.contains('matchup-tie')) return Core.getTieLoserTeamData(unitEl);
    return Core.getMatchupLoser(unitEl);
};
Core.setTieTeamSlots = function setTieTeamSlots(tieEl, slotIndex, teamData) {
    tieEl.querySelectorAll('.matchup').forEach(matchup => {
        const teams = matchup.querySelectorAll(':scope > .team');
        if (teams[slotIndex]) Core.setTeamSlot(teams[slotIndex], teamData);
    });
};
Core.getRoundOutputWinners = function getRoundOutputWinners(roundEl) {
    const list = [];
    if (roundEl.dataset.koByeCarrier) {
        try {
            list.push(JSON.parse(roundEl.dataset.koByeCarrier));
        } catch (e) { /* ignore */ }
    }
    Core.getRoundBracketUnits(roundEl).forEach(unit => {
        const winner = Core.getBracketUnitWinner(unit);
        if (winner) list.push(winner);
    });
    return list;
};
Core.setBracketUnitTeamSlots = function setBracketUnitTeamSlots(unitEl, teamA, teamB) {
    if (unitEl.classList.contains('matchup-tie')) {
        if (teamA) Core.setTieTeamSlots(unitEl, 0, teamA);
        if (teamB) Core.setTieTeamSlots(unitEl, 1, teamB);
        return;
    }
    const teams = unitEl.querySelectorAll(':scope > .team');
    if (teamA && teams[0]) Core.setTeamSlot(teams[0], teamA);
    if (teamB && teams[1]) Core.setTeamSlot(teams[1], teamB);
};
Core.setTeamSlot = function setTeamSlot(teamEl, teamData) {
    const flagEl = teamEl.querySelector('.team-flag');
    const nameEl = teamEl.querySelector('.team-name');
    const scoreEl = teamEl.querySelector('.team-score');
    teamEl.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());

    // Hanya ganti identitas tim. Skor/winner di-restore lewat Core.applyAdminConfig
    // setelah advance, supaya tidak hilang di babak tujuan.
    teamEl.classList.remove('winner');

    if (!teamData) {
        if (flagEl) {
            flagEl.classList.add('is-tbd');
            flagEl.innerHTML = '<img src="' + Core.TBD_FLAG_SRC + '" alt="TBD" style="opacity:0.4">';
        }
        if (nameEl) {
            nameEl.textContent = 'TBD';
            nameEl.classList.remove('confirmed');
        }
        if (scoreEl) scoreEl.remove();
        delete teamEl.dataset.supporterInjected;
        return;
    }

    if (flagEl) {
        flagEl.classList.remove('is-tbd');
        flagEl.innerHTML = '<img src="' + teamData.flagSrc + '" alt="' + teamData.flagAlt + '">';
    }
    if (nameEl) {
        nameEl.textContent = teamData.name;
    }
    if (scoreEl) scoreEl.remove();

    delete teamEl.dataset.supporterInjected;
};
Core.DEFAULT_TROPHY_URL = 'https://png.pngtree.com/png-vector/20250923/ourmid/pngtree-the-fifa-world-cup-trophy-png-image_17551611.webp';

Core.DEFAULT_BALL_URL = 'https://png.pngtree.com/png-vector/20260610/ourmid/pngtree-vibrant-trionda-soccer-football-official-fifa-world-cup-2026-design-png-image_19512258.webp';

Core.FINAL_PLACE_IMAGES = {
    champion: Core.DEFAULT_TROPHY_URL,
    runnerup: '🥇',
    third: '👏',
};

Core.getTrophyImageUrl = function getTrophyImageUrl() {
    const fromData = window.LEAGUE_DATA && window.LEAGUE_DATA.trophyImageUrl;
    if (fromData && /^https?:\/\//i.test(String(fromData).trim())) return String(fromData).trim();
    if (typeof ArisanBracket !== 'undefined' && ArisanBracket.DEFAULT_TROPHY_IMG) {
        return ArisanBracket.DEFAULT_TROPHY_IMG;
    }
    return Core.DEFAULT_TROPHY_URL;
};
Core.getLeagueIconImageUrl = function getLeagueIconImageUrl() {
    if (typeof getLeagueIconUrl === 'function') return getLeagueIconUrl();
    const d = window.LEAGUE_DATA || {};
    const icon = d.iconImageUrl;
    if (icon && /^https?:\/\//i.test(String(icon).trim())) return String(icon).trim();
    const legacy = d.trophyImageUrl;
    if (legacy && /^https?:\/\//i.test(String(legacy).trim())) return String(legacy).trim();
    return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT41kl1nnX-tqBQiGHVikOIDViXDZXRRulNdKFAK6c1eQ&s=10';
};
Core.getBallImageUrl = function getBallImageUrl() {
    if (typeof getLeagueBallUrl === 'function') return getLeagueBallUrl();
    const fromData = window.LEAGUE_DATA && window.LEAGUE_DATA.ballImageUrl;
    if (fromData && /^https?:\/\//i.test(String(fromData).trim())) return String(fromData).trim();
    return Core.DEFAULT_BALL_URL;
};
Core.appendTeamPlaceBadge = function appendTeamPlaceBadge(teamEl, srcOrEmoji, alt, variant) {
    if (!teamEl) return;
    const slot = document.createElement('span');
    slot.className = 'team-place-badge-slot' + (variant ? ' badge-' + variant : '');
    if (srcOrEmoji) {
        const isUrl = /^https?:\/\//i.test(String(srcOrEmoji)) || String(srcOrEmoji).indexOf('/') !== -1;
        if (isUrl) {
            const img = document.createElement('img');
            img.src = srcOrEmoji;
            img.alt = alt || '';
            img.title = alt || '';
            slot.appendChild(img);
        } else {
            const emoji = document.createElement('span');
            emoji.className = 'team-place-badge-emoji';
            emoji.textContent = srcOrEmoji;
            emoji.title = alt || '';
            emoji.setAttribute('aria-label', alt || '');
            slot.appendChild(emoji);
        }
    }
    teamEl.appendChild(slot);
};
Core.resolveMatchWinnerTeamEl = function resolveMatchWinnerTeamEl(matchup, matchId) {
    if (!matchup) return null;
    const teams = matchup.querySelectorAll(':scope > .team');
    const winnerEl = matchup.querySelector(':scope > .team.winner');
    if (winnerEl) return winnerEl;

    if (typeof Core.resolveFinishedWinnerIndex !== 'function') return null;
    const match = (window.ADMIN_CONFIG?.finishedMatches || []).find(m => m.id === matchId);
    const idx = Core.resolveFinishedWinnerIndex(match);
    return (idx === 0 || idx === 1) ? teams[idx] : null;
};
Core.pendingFinalCelebrationWinner = null;

Core.finalCelebrationActive = false;

Core.finalCelebrationRepeatTimer = null;

Core.FINAL_CELEBRATION_REPEAT_MS = 30 * 1000;

Core.getCelebrationFlagSrc = function getCelebrationFlagSrc(flagSrc) {
    if (typeof ArisanCountries !== 'undefined' && ArisanCountries.getCelebrationFlagUrl) {
        return ArisanCountries.getCelebrationFlagUrl(flagSrc) || String(flagSrc || '');
    }
    return String(flagSrc || '');
};
Core.parseFlagCodeFromSrc = function parseFlagCodeFromSrc(src) {
    if (typeof ArisanCountries !== 'undefined' && ArisanCountries.parseFlagCode) {
        return ArisanCountries.parseFlagCode(src) || null;
    }
    const m = String(src || '').match(/flagcdn\.com\/w\d+\/([a-z0-9-]+)\.png/i);
    return m ? m[1].toLowerCase() : null;
};
Core.countryFlagSrc = function countryFlagSrc(codeOrUrl, width) {
    if (typeof ArisanCountries !== 'undefined' && ArisanCountries.resolveFlagUrl) {
        return ArisanCountries.resolveFlagUrl(codeOrUrl, width);
    }
    return String(codeOrUrl || '');
};
// Contoh preview badge: buka index.html?preview-podium=1

// Side Quest Podium Data

Core.sideQuestPodium = {
    champion: {
        'Argentina': { flag: 'ar', supporters: ['Khuang', 'Willy'], eliminated: false },
        'Portugal': { flag: 'pt', supporters: ['Davin'], eliminated: false },
        'France': { flag: 'fr', supporters: ['Ndod', 'Cham'], eliminated: false },
        'Spain': { flag: 'es', supporters: ['Marten'], eliminated: false },
        'Brazil': { flag: 'br', supporters: ['Wesly'], eliminated: false }
    },
    runnerup: {
        'Argentina': { flag: 'ar', supporters: ['Cham', 'Davin', 'Ndod', 'Marten'], eliminated: false },
        'Spain': { flag: 'es', supporters: ['Khuang', 'Wesly'], eliminated: false },
        'France': { flag: 'fr', supporters: ['Willy'], eliminated: false }
    },
    third: {
        'Brazil': { flag: 'br', supporters: ['Davin', 'Marten'], eliminated: false },
        'Spain': { flag: 'es', supporters: ['Ndod'], eliminated: false },
        'France': { flag: 'fr', supporters: ['Khuang', 'Wesly'], eliminated: false },
        'Portugal': { flag: 'pt', supporters: ['Cham', 'Willy'], eliminated: false }
    }
};

// Total Goal Data (prediksi peserta — fix dari awal, tidak perlu di-update)

Core.totalGoalData = [
    { name: 'Marten', goal: 57 },
    { name: 'Davin', goal: 71 },
    { name: 'Willy', goal: 81 },
    { name: 'Ndod', goal: 82 },
    { name: 'Khuang', goal: 88 },
    { name: 'Wesly', goal: 93 },
    { name: 'Cham', goal: 117 }
];

// Negara pemain Golden Boot / Golden Glove (override via player.country + player.flag di config)

Core.PLAYER_NATIONALITY = {
    'kylian mbappe': { country: 'France', flag: 'fr' },
    'lionel messi': { country: 'Argentina', flag: 'ar' },
    'lamine yamal': { country: 'Spain', flag: 'es' },
    'emiliano martinez': { country: 'Argentina', flag: 'ar' },
    'mike maignan': { country: 'France', flag: 'fr' },
    'vozinha': { country: 'Cape Verde', flag: 'cv' },
    'unai simon': { country: 'Spain', flag: 'es' },
    'alison becker': { country: 'Brazil', flag: 'br' },
    'alisson becker': { country: 'Brazil', flag: 'br' },
};

// Smooth bar/chart sliding: ease start + ease finish (CSS --bar-ease)

// When a section enters the viewport, all bars in that section slide together.

Core.barSlideVisible = new WeakMap();

Core.barSlideSectionVisible = new WeakMap();

Core.barSlideSectionMembers = new WeakMap();

Core.barSlideElToSection = new WeakMap();

Core.barSlideObserver = null;

Core.prefersReducedMotion = function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
Core.playBarSlide = function playBarSlide(el) {
    if (!el) return;
    const prop = el.dataset.barProp || 'width';
    const value = el.dataset.barTarget;
    if (!value) return;
    if (Core.prefersReducedMotion()) {
        el.style.transition = '';
        el.style[prop] = value;
        el.dataset.barSlid = '1';
        if (el.classList.contains('total-goal-fill-v')) {
            Core.finishTotalGoalCurrentLabel(el);
        }
        return;
    }
    // Instant collapse, then ease to target
    el.style.transition = 'none';
    el.style[prop] = '0%';
    delete el.dataset.barSlid;
    if (el.classList.contains('total-goal-fill-v')) {
        Core.resetTotalGoalCurrentLabel(el);
    }
    void el.offsetWidth;
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            el.style.transition = '';
            el.style[prop] = value;
            el.dataset.barSlid = '1';
            if (el.classList.contains('total-goal-fill-v')) {
                Core.playTotalGoalCurrentLabel(el);
            }
        });
    });
};
Core.resetBarSlide = function resetBarSlide(el) {
    if (!el) return;
    const prop = el.dataset.barProp || 'width';
    // Off-screen: snap back instantly (no slide-out animation)
    el.style.transition = 'none';
    el.style[prop] = '0%';
    void el.offsetWidth;
    delete el.dataset.barSlid;
    if (el.classList.contains('total-goal-fill-v')) {
        Core.resetTotalGoalCurrentLabel(el);
    }
};
Core.getBarDurationMs = function getBarDurationMs() {
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--bar-duration')
        .trim();
    if (!raw) return 2400;
    if (raw.endsWith('ms')) return parseFloat(raw) || 2400;
    return (parseFloat(raw) || 2.4) * 1000;
};
// Approximate CSS cubic-bezier(0.45, 0, 0.55, 1)

Core.barEase = function barEase(t) {
    const clamped = Math.max(0, Math.min(1, t));
    // Sample cubic bezier Y given X via Newton refinement
    const cx = 3 * 0.45;
    const bx = 3 * (0.55 - 0.45) - cx;
    const ax = 1 - cx - bx;
    const cy = 0;
    const by = 3 * (1 - 0) - cy;
    const ay = 1 - cy - by;
    function sampleX(tt) { return ((ax * tt + bx) * tt + cx) * tt; }
    function sampleY(tt) { return ((ay * tt + by) * tt + cy) * tt; }
    function slopeX(tt) { return (3 * ax * tt + 2 * bx) * tt + cx; }
    let u = clamped;
    for (let i = 0; i < 5; i++) {
        const x = sampleX(u) - clamped;
        const d = slopeX(u);
        if (Math.abs(d) < 1e-6) break;
        u -= x / d;
    }
    return sampleY(u);
};
Core.totalGoalLabelAnims = new WeakMap();

Core.getBarSlideSectionEl = function getBarSlideSectionEl(el) {
    if (!el || !el.closest) return el;
    return el.closest('#goldenboot-chart')
        || el.closest('#total-goal-bar')
        || el.closest('.total-goal-bar-container')
        || el.closest('#main-quest-table-root')
        || el.closest('#standings-points-chart')
        || el.closest('.standings-section .standings-chart:not(#goldenboot-chart)')
        || el.closest('.standings-chart')
        || el.closest('.standings-table-wrapper')
        || el;
};
Core.playBarSlideSection = function playBarSlideSection(section) {
    const members = Core.barSlideSectionMembers.get(section);
    if (!members) return;
    members.forEach(function (el) {
        if (Core.barSlideVisible.get(el)) return;
        Core.barSlideVisible.set(el, true);
        Core.playBarSlide(el);
    });
};
Core.resetBarSlideSection = function resetBarSlideSection(section) {
    const members = Core.barSlideSectionMembers.get(section);
    if (!members) return;
    members.forEach(function (el) {
        if (!Core.barSlideVisible.get(el)) return;
        Core.barSlideVisible.set(el, false);
        Core.resetBarSlide(el);
    });
};
Core.getBarSlideObserver = function getBarSlideObserver() {
    if (Core.barSlideObserver) return Core.barSlideObserver;
    if (!('IntersectionObserver' in window)) return null;
    // Section-level: start all bars as soon as any part of the section enters the viewport
    Core.barSlideObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            const section = entry.target;
            const wasVisible = !!Core.barSlideSectionVisible.get(section);
            const show = entry.isIntersecting;
            const hide = !entry.isIntersecting;

            if (show) {
                if (!wasVisible) {
                    Core.barSlideSectionVisible.set(section, true);
                    Core.playBarSlideSection(section);
                }
            } else if (hide && wasVisible) {
                // Keep bars filled — resetting on scroll-out caused repeated layout work
                Core.barSlideSectionVisible.set(section, false);
            }
        });
    }, {
        threshold: 0,
        rootMargin: '0px',
    });
    return Core.barSlideObserver;
};
Core.observeBarSlide = function observeBarSlide(el) {
    const obs = Core.getBarSlideObserver();
    if (!obs) {
        Core.playBarSlide(el);
        return;
    }
    const section = Core.getBarSlideSectionEl(el);
    const prevSection = Core.barSlideElToSection.get(el);
    if (prevSection && prevSection !== section) {
        const prevMembers = Core.barSlideSectionMembers.get(prevSection);
        if (prevMembers) prevMembers.delete(el);
    }

    let members = Core.barSlideSectionMembers.get(section);
    if (!members) {
        members = new Set();
        Core.barSlideSectionMembers.set(section, members);
    }
    members.add(el);
    Core.barSlideElToSection.set(el, section);
    obs.observe(section);
};
Core.slideDimension = function slideDimension(el, prop, value) {
    if (!el) return;
    el.dataset.barProp = prop;
    el.dataset.barTarget = value;
    el.classList.add('bar-slide-watch');

    if (Core.prefersReducedMotion()) {
        el.style[prop] = value;
        el.dataset.barSlid = '1';
        return;
    }

    Core.observeBarSlide(el);

    const section = Core.barSlideElToSection.get(el);
    const sectionOnScreen = !!(section && Core.barSlideSectionVisible.get(section));

    if (sectionOnScreen) {
        // Section already on screen: play/replay this bar with the rest of the section feel
        Core.barSlideVisible.set(el, true);
        Core.playBarSlide(el);
    } else {
        // Section off-screen (or waiting for first observer tick): keep collapsed
        el.style.transition = 'none';
        el.style[prop] = '0%';
        delete el.dataset.barSlid;
        Core.barSlideVisible.delete(el);
        if (el.classList.contains('total-goal-fill-v')) {
            Core.resetTotalGoalCurrentLabel(el);
        }
    }
};
// Build Golden Boot Bar Chart (based on goals scored)

// Perebutan juara 3: hanya untuk Side Quest 3rd Place (bukan Main Quest / current goal)

Core.THIRD_PLACE_MATCH_ID = 'third-0';

Core.isThirdPlaceMatchup = function isThirdPlaceMatchup(matchup) {
    const id = matchup?.dataset?.matchId || '';
    return id === Core.THIRD_PLACE_MATCH_ID || id.startsWith(Core.THIRD_PLACE_MATCH_ID + '-leg');
};
// Build Total Goal Vertical Progress Bar

// Current goal = FT + ET (format "FT (ET)"). Gol penalti tidak dicatat / tidak dihitung.

Core.parseTeamScore = function parseTeamScore(scoreText) {
    const text = (scoreText || '').trim();
    if (!text) return 0;

    // Supports: 1(1), 1 (1), 1  (1), 1 ( 1 ) → FT + ET
    const extraTimeMatch = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
    if (extraTimeMatch) {
        return parseInt(extraTimeMatch[1], 10) + parseInt(extraTimeMatch[2], 10);
    }

    const score = parseInt(text, 10);
    return Number.isNaN(score) ? 0 : score;
};
// Standings points memakai skor Full Time saja (abaikan ET & penalti)

Core.parseFullTimeScore = function parseFullTimeScore(scoreText) {
    const text = (scoreText || '').trim();
    if (!text) return null;

    // Format "FT (ET)" → ambil FT saja
    const extraTimeMatch = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
    if (extraTimeMatch) {
        return parseInt(extraTimeMatch[1], 10);
    }

    const score = parseInt(text, 10);
    return Number.isNaN(score) ? null : score;
};
/** FT + ET total from bracket score display (e.g. "2 (1)" → 3). */

Core.parseTotalGoalsFromScoreText = function parseTotalGoalsFromScoreText(scoreText) {
    const text = (scoreText || '').trim();
    if (!text) return null;

    const extraTimeMatch = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
    if (extraTimeMatch) {
        return parseInt(extraTimeMatch[1], 10) + parseInt(extraTimeMatch[2], 10);
    }

    const score = parseInt(text, 10);
    return Number.isNaN(score) ? null : score;
};
/** Aggregate goals for/against all teams each participant supports (FT + ET). */

Core.addPointsToSupporters = function addPointsToSupporters(points, supporters, amount) {
    (supporters || []).forEach(name => {
        if (!name || points[name] === undefined) return;
        points[name] += amount;
    });
};
Core.isSideQuestShareEnabled = function isSideQuestShareEnabled(category) {
    const share = Core.pointConfig && Core.pointConfig.sideQuestShare;
    if (!share || typeof share !== 'object') return true;
    return share[category] !== false;
};
/** Award side-quest points to correct guessers; optionally split the pool equally. */

Core.getFinishedMatchTeam = function getFinishedMatchTeam(matchId, role) {
    if (Core.isTwoLegKnockout() && typeof ArisanBracket !== 'undefined') {
        const parsed = ArisanBracket.parseMatchId(matchId);
        const tieId = parsed.leg ? parsed.tieId : matchId;
        const tieEl = Core.getTieElement(tieId);
        if (tieEl) {
            const teamData = role === 'winner'
                ? Core.getTieWinnerTeamData(tieEl)
                : Core.getTieLoserTeamData(tieEl);
            if (teamData) return teamData;
        }
    }

    const matchup = document.querySelector('[data-match-id="' + matchId + '"]');
    if (!matchup || !matchup.classList.contains('finished')) return null;
    if (role === 'winner') {
        return typeof Core.getMatchupWinner === 'function' ? Core.getMatchupWinner(matchup) : null;
    }
    return typeof Core.getMatchupLoser === 'function' ? Core.getMatchupLoser(matchup) : null;
};
Core.mainQuestOutcomePoints = function mainQuestOutcomePoints(teamName, outcome) {
    if (Core.pointConfig.mainQuestMode === 'fifa') {
        const row = Core.pointConfig.teamPoints && Core.pointConfig.teamPoints[teamName];
        if (row && row[outcome] != null) return Number(row[outcome]) || 0;
    }
    return Number(Core.pointConfig.mainQuest && Core.pointConfig.mainQuest[outcome]) || 0;
};
Core.compareStandingsParticipants = function compareStandingsParticipants(a, b, points, goalStats) {
    const diff = (points[b] ?? 0) - (points[a] ?? 0);
    if (diff !== 0) return diff;

    const gsA = goalStats[a] || { scored: 0, conceded: 0 };
    const gsB = goalStats[b] || { scored: 0, conceded: 0 };
    const scoredDiff = gsB.scored - gsA.scored;
    if (scoredDiff !== 0) return scoredDiff;

    const concededDiff = gsA.conceded - gsB.conceded;
    if (concededDiff !== 0) return concededDiff;

    return a.localeCompare(b);
};
Core.getStandingsRankOneParticipants = function getStandingsRankOneParticipants() {
    const points = Core.calculateStandingsPointsFromBracket();
    const goalStats = Core.calculateParticipantGoalStats();
    const names = Object.keys(Core.participantAvatars).slice().sort((a, b) =>
        Core.compareStandingsParticipants(a, b, points, goalStats)
    );
    return names.length ? [names[0]] : [];
};
Core.roundStandingsPoints = function roundStandingsPoints(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
};
Core.formatStandingsPoints = function formatStandingsPoints(value) {
    const n = Core.roundStandingsPoints(value);
    if (n === 0) return '0';
    return n.toFixed(2);
};
Core.isMuted = false;

Core.hasEntered = false;

Core.pausedByFocusLoss = false;

Core.audio = document.getElementById('bg-music');

// Block background scroll/gestures until Enter

// Pause flag/glow loops on cards outside the viewport

Core.animPauseObserved = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

Core.animPauseObserver = null;

Core.ANIM_PAUSE_SELECTOR = [
    '.matchup',
    '.podium-team-card',
    '.player-podium-card',
    '.goldenboot-row',
    '.chart-row',
    '.round-trophy',
    '.total-goal-marker-info',
].join(', ');

// Keep section-level pause for standings (covers rows before/while observed)

Core.syncLeagueDataFromDb = function syncLeagueDataFromDb() {
    const d = window.LEAGUE_DATA;
    if (!d) return;
    if (d.teamSupporters) Core.teamSupporters = d.teamSupporters;
    if (d.teamSupportersGroup) Core.teamSupportersGroup = d.teamSupportersGroup;
    else if (d.teamSupporters) Core.teamSupportersGroup = d.teamSupporters;
    if (d.teamSupportersKnockout) Core.teamSupportersKnockout = d.teamSupportersKnockout;
    else if (d.teamSupporters) Core.teamSupportersKnockout = d.teamSupporters;
    if (d.participantAvatars) Core.participantAvatars = d.participantAvatars;
    if (d.totalGoalData) Core.totalGoalData = d.totalGoalData;
    if (d.sideQuestPodium) Core.sideQuestPodium = d.sideQuestPodium;
    if (d.scorePredictions) Core.scorePredictions = d.scorePredictions;
    if (d.pointConfig) {
Core.pointConfig = {
    mainQuestMode: d.pointConfig.mainQuestMode === 'fifa' ? 'fifa' : 'fixed',
    mainQuest: Object.assign({}, Core.pointConfig.mainQuest, d.pointConfig.mainQuest || {}),
    teamPoints: Object.assign({}, d.pointConfig.teamPoints || {}),
    sideQuest: Object.assign({}, Core.pointConfig.sideQuest, d.pointConfig.sideQuest || {}),
    sideQuestShare: Object.assign(
        {},
        Core.pointConfig.sideQuestShare,
        d.pointConfig.sideQuestShare || {}
    ),
};
    }
    if (d.includeGroupStage != null) Core.includeGroupStage = !!d.includeGroupStage;
    if (d.includeKnockoutStage != null) Core.includeKnockoutStage = d.includeKnockoutStage !== false;
    if (d.includeThirdPlace != null) Core.includeThirdPlace = d.includeThirdPlace;
    if (d.twoLegKnockout != null) Core.twoLegKnockout = !!d.twoLegKnockout;
    if (d.competitionType) Core.competitionType = d.competitionType;
};

})(window.ArisanLeagueApp = window.ArisanLeagueApp || {});
