/**
 * League detail — group/KO bracket interactions
 * Split from bracket-app.js — shared ArisanLeagueApp core.
 */
(function (Core) {
'use strict';

Core.applyAdminConfig = function applyAdminConfig() {
    if (!window.ADMIN_CONFIG) return;

    const lastUpdatedEl = document.querySelector('.last-updated');
    if (lastUpdatedEl && ADMIN_CONFIG.lastUpdated) {
        lastUpdatedEl.textContent = 'Last updated: ' + ADMIN_CONFIG.lastUpdated;
    }

    (ADMIN_CONFIG.finishedMatches || []).forEach(match => {
        const el = document.querySelector('[data-match-id="' + match.id + '"]');
        if (!el) return;

        const status = match.status || 'finished';
        const teams = el.querySelectorAll(':scope > .team');
        const dateEl = el.querySelector('.matchup-date');
        const scoreParts = Core.getMatchScoreParts(match);
        const hasExtraTime = scoreParts.et[0] > 0 || scoreParts.et[1] > 0;
        const displayScores = [
            Core.formatScoreForDisplay(scoreParts.ft[0], scoreParts.et[0], hasExtraTime),
            Core.formatScoreForDisplay(scoreParts.ft[1], scoreParts.et[1], hasExtraTime),
        ];

        displayScores.forEach((score, i) => {
            if (!teams[i]) return;
            let scoreEl = teams[i].querySelector('.team-score');
            if (!scoreEl) {
                scoreEl = document.createElement('span');
                scoreEl.className = 'team-score';
                teams[i].appendChild(scoreEl);
            }
            scoreEl.textContent = score;
            teams[i].classList.remove('winner');
        });

        el.classList.remove('tbd', 'today', 'live', 'waiting-admin', 'finished');
        if (typeof Core.setLiveBadge === 'function') Core.setLiveBadge(dateEl, false);
        if (typeof Core.setSoonBadge === 'function') Core.setSoonBadge(dateEl, false);
        if (typeof Core.setWaitingAdminBadge === 'function') Core.setWaitingAdminBadge(dateEl, false);

        if (status === 'finished') {
            // Hanya finished yang di-freeze dari timer schedule
            el.dataset.adminManaged = 'true';
            const winnerIdx = Core.resolveFinishedWinnerIndex(match);
            if (winnerIdx !== null && teams[winnerIdx]) {
                teams[winnerIdx].classList.add('winner');
            }
            el.classList.add('finished');
            delete el.dataset.liveUrl;
            el.removeAttribute('title');
        } else if (status === 'live') {
            // live / waiting-admin tetap bisa di-advance timer
            delete el.dataset.adminManaged;
            el.classList.add('live');
            if (typeof Core.setLiveBadge === 'function') Core.setLiveBadge(dateEl, true);
            if (typeof Core.LIVE_STREAM_URL !== 'undefined') {
                el.dataset.liveUrl = Core.LIVE_STREAM_URL;
            }
            el.title = 'Tonton live';
        } else if (status === 'waiting-admin') {
            delete el.dataset.adminManaged;
            el.classList.add('waiting-admin');
            if (typeof Core.setWaitingAdminBadge === 'function') Core.setWaitingAdminBadge(dateEl, true);
            delete el.dataset.liveUrl;
            el.removeAttribute('title');
        }
    });

    if (Core.isTwoLegKnockout() && typeof ArisanBracket !== 'undefined') {
        ArisanBracket.updateTieAggregates(ADMIN_CONFIG.finishedMatches || []);
    }

    if (typeof Core.buildTotalGoalBar === 'function') {
        Core.buildTotalGoalBar();
    }
};
Core.getBracketPoint = function getBracketPoint(el, bracket, bracketRect, edge) {
    const r = el.getBoundingClientRect();
    const x = edge === 'left'
        ? (r.left - bracketRect.left + bracket.scrollLeft)
        : (r.right - bracketRect.left + bracket.scrollLeft);
    const y = r.top + r.height / 2 - bracketRect.top + bracket.scrollTop;
    return { x: x, y: y };
};
Core.getBracketUnitLineAnchor = function getBracketUnitLineAnchor(unitEl, bracket, bracketRect) {
    return Core.getBracketPoint(unitEl, bracket, bracketRect, 'right');
};
Core.resolveBracketLineSource = function resolveBracketLineSource(prevRoundEl, units, winnerIndex) {
    const hasByeCarrier = !!prevRoundEl.dataset.koByeCarrier;
    if (hasByeCarrier && winnerIndex === 0) {
        return null;
    }
    const unitIndex = hasByeCarrier ? winnerIndex - 1 : winnerIndex;
    return units[unitIndex] || null;
};
Core.appendBracketConnectorPath = function appendBracketConnectorPath(svg, d, options) {
    const opts = options || {};
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', opts.stroke || '#444');
    path.setAttribute('stroke-width', opts.strokeWidth || '1.5');
    path.setAttribute('fill', 'none');
    if (opts.dash) path.setAttribute('stroke-dasharray', opts.dash);
    path.classList.add('bracket-line-base');
    svg.appendChild(path);
};
Core.drawByeAdvanceLine = function drawByeAdvanceLine(svg, bracket, bracketRect, sourceEl, nextRoundEl, nextUnits) {
    if (!sourceEl) return;
    const src = Core.getBracketUnitLineAnchor(sourceEl, bracket, bracketRect);
    const targetX = Core.getBracketPoint(nextRoundEl, bracket, bracketRect, 'left').x;
    let targetY;
    if (nextUnits.length) {
        const firstRect = nextUnits[0].getBoundingClientRect();
        targetY = firstRect.top - bracketRect.top + bracket.scrollTop - 6;
    } else {
        const nextRect = nextRoundEl.getBoundingClientRect();
        targetY = nextRect.top - bracketRect.top + bracket.scrollTop + nextRect.height * 0.2;
    }
    const midX = (src.x + targetX) / 2;
    Core.appendBracketConnectorPath(
        svg,
        `M${src.x},${src.y} H${midX} V${targetY} H${targetX}`,
        {
            stroke: '#666',
            dash: '4 3',
        }
    );
};
Core.drawRoundTransitionLines = function drawRoundTransitionLines(svg, bracket, bracketRect, prevRoundEl, nextRoundEl, currentUnits, nextUnits) {
    const nextBye = parseInt(nextRoundEl.dataset.koByes || '0', 10);
    const isSfToFinal = (prevRoundEl.classList.contains('round-sf') ||
        prevRoundEl.dataset.semifinalRound === 'true') &&
        nextRoundEl.classList.contains('round-final');

    for (let j = 0; j < nextUnits.length; j++) {
        const idx1 = nextBye + j * 2;
        const idx2 = nextBye + j * 2 + 1;
        const src1El = Core.resolveBracketLineSource(prevRoundEl, currentUnits, idx1);
        const src2El = Core.resolveBracketLineSource(prevRoundEl, currentUnits, idx2);
        const targetEl = nextUnits[j];
        if (!targetEl) continue;

        const target = Core.getBracketPoint(targetEl, bracket, bracketRect, 'left');
        const x3 = target.x;
        const y3 = target.y;

        const sources = [src1El, src2El].filter(Boolean);
        if (!sources.length) continue;

        const anchors = sources.map((el) => Core.getBracketUnitLineAnchor(el, bracket, bracketRect));
        let midX = (Math.max.apply(null, anchors.map((a) => a.x)) + x3) / 2;
        if (isSfToFinal) {
            const thirdRound = bracket.querySelector('.round-3rd');
            if (thirdRound) {
                const thirdRight = Core.getBracketPoint(thirdRound, bracket, bracketRect, 'right').x;
                midX = (thirdRight + x3) / 2;
            }
        }

        anchors.forEach((anchor, idx) => {
            const d = (idx === 0 || anchors.length === 1)
                ? `M${anchor.x},${anchor.y} H${midX} V${y3} H${x3}`
                : `M${anchor.x},${anchor.y} H${midX} V${y3}`;
            Core.appendBracketConnectorPath(svg, d);
        });
    }

    if (nextBye > 0 && !prevRoundEl.dataset.koByeCarrier && currentUnits[0]) {
        Core.drawByeAdvanceLine(svg, bracket, bracketRect, currentUnits[0], nextRoundEl, nextUnits);
    }
};
Core.drawBracketLines = function drawBracketLines() {
    const bracket = document.querySelector('.bracket');
    if (!bracket) return;
    // Rantai pairwise: grup → R16 → QF → SF → Final.
    // Juara 3 tidak ikut rantai (ditumpuk di bawah Final di kolom yang sama).
    const rounds = bracket.querySelectorAll('[data-bracket-chain]');

    const existingSvg = bracket.querySelector('.bracket-lines');
    if (existingSvg) existingSvg.remove();
    // Clean leftover flow markup from older builds
    bracket.querySelectorAll('.bracket-flow-ring').forEach((el) => el.remove());
    bracket.querySelectorAll('.bracket-flow-border').forEach((el) => {
        el.classList.remove('bracket-flow-border');
        delete el.dataset.flowBound;
        delete el.dataset.flowBorderEnd;
        delete el.dataset.flowKey;
    });
    bracket.querySelectorAll('.bracket-flow-trophy').forEach((el) => {
        el.classList.remove('bracket-flow-trophy', 'is-flowing');
        el.style.removeProperty('animation-delay');
    });

    bracket.style.position = 'relative';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bracket-lines');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = bracket.scrollWidth + 'px';
    svg.style.height = bracket.scrollHeight + 'px';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    svg.setAttribute('width', bracket.scrollWidth);
    svg.setAttribute('height', bracket.scrollHeight);

    const bracketRect = bracket.getBoundingClientRect();

    for (let i = 0; i < rounds.length - 1; i++) {
        const currentUnits = Core.getRoundBracketUnits(rounds[i]);
        const nextUnits = Core.getRoundBracketUnits(rounds[i + 1]);
        if (!currentUnits.length || !nextUnits.length) continue;
        Core.drawRoundTransitionLines(
            svg, bracket, bracketRect, rounds[i], rounds[i + 1], currentUnits, nextUnits
        );
    }

    // SF → Perebutan Juara 3
    const sfUnits = bracket.querySelectorAll(
        '[data-semifinal-round="true"] .matchup-tie, [data-semifinal-round="true"] .round-matches > .matchup, ' +
        '.round-sf .matchup-tie, .round-sf .round-matches > .matchup'
    );
    const thirdUnit = bracket.querySelector('.round-3rd .matchup-tie') ||
        bracket.querySelector('.round-3rd .matchup');
    if (sfUnits.length >= 2 && thirdUnit) {
        const target = Core.getBracketPoint(thirdUnit, bracket, bracketRect, 'left');
        const x3 = target.x;
        const y3 = target.y;
        const src0 = Core.getBracketUnitLineAnchor(sfUnits[0], bracket, bracketRect);
        const midX = (src0.x + x3) / 2;

        [0, 1].forEach((i, idx) => {
            const src = Core.getBracketUnitLineAnchor(sfUnits[i], bracket, bracketRect);
            const d = idx === 0
                ? `M${src.x},${src.y} H${midX} V${y3} H${x3}`
                : `M${src.x},${src.y} H${midX} V${y3}`;
            Core.appendBracketConnectorPath(svg, d);
        });
    }

    bracket.appendChild(svg);
};
Core.getSupportersMapForMatchup = function getSupportersMapForMatchup(matchup) {
    return Core.isKnockoutMatchup(matchup) ? Core.teamSupportersKnockout : Core.teamSupportersGroup;
};
Core.injectSupporters = function injectSupporters() {
    document.querySelectorAll('.bracket .matchup, .group-stage .matchup').forEach(matchup => {
        // Drop previous team-supporter rows so re-entering a view does not stack toggles.
        matchup.querySelectorAll(':scope > .supporters-drop').forEach(drop => {
            if (drop.querySelector('.score-predict-toggle')) return;
            if (drop.querySelector('.supporters-toggle')) drop.remove();
        });
        matchup.querySelectorAll(':scope > .team').forEach(teamEl => {
            delete teamEl.dataset.supporterInjected;
        });

        const supportersMap = Core.getSupportersMapForMatchup(matchup);
        const teams = matchup.querySelectorAll(':scope > .team');
        teams.forEach(teamEl => {
            const nameEl = teamEl.querySelector('.team-name');
            if (!nameEl) return;
            const teamName = nameEl.textContent.trim();
            if (teamName === 'TBD') return;

            const supporters = supportersMap[teamName] || [];
            if (supporters.length === 0) return;

            if (teamEl.dataset.supporterInjected) return;
            teamEl.dataset.supporterInjected = 'true';

            const panel = document.createElement('div');
            panel.className = 'supporters-panel';
            panel.id = 'sp-' + teamName.replace(/[^a-zA-Z0-9]/g, '') + '-' + Math.random().toString(36).substr(2, 4);
            panel.appendChild(Core.createPanelSlideInner());

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'supporters-toggle';
            Core.bindSupportersToggle(
                btn,
                panel,
                supporters.length,
                function() {
                    if (Core.isKnockoutMatchup(matchup) && typeof Core.drawBracketLines === 'function') {
                        Core.drawBracketLines();
                    }
                },
                function() {
                    Core.ensureSupportersPanelFilled(panel, supporters);
                }
            );

            teamEl.insertAdjacentElement('afterend', Core.createSupportersDrop(btn, panel));
        });
    });
};
Core.getScorePredictionsForMatch = function getScorePredictionsForMatch(matchId) {
    return (Core.scorePredictions && Core.scorePredictions[matchId]) || [];
};
Core.sortScorePredictions = function sortScorePredictions(preds, hasResult, actualA, actualB) {
    return (preds || []).slice().sort((a, b) => {
        if (hasResult) {
            const aExact = a.a === actualA && a.b === actualB;
            const bExact = b.a === actualA && b.b === actualB;
            if (aExact !== bExact) return aExact ? -1 : 1;
        }
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
            sensitivity: 'base',
        });
    });
};
Core.matchupTeamFlagSrc = function matchupTeamFlagSrc(matchup, teamIndex) {
    const teams = matchup.querySelectorAll(':scope > .team');
    const img = teams[teamIndex]?.querySelector('.team-flag img, .flag-wave img');
    if (img && img.getAttribute('src')) return img.getAttribute('src');
    const name = teams[teamIndex]?.querySelector('.team-name')?.textContent.trim();
    if (!name || name === 'TBD') return '';
    if (typeof ArisanCountries !== 'undefined' && ArisanCountries.getFlagUrl) {
        return ArisanCountries.getFlagUrl(name) || '';
    }
    return '';
};
Core.appendPredictFlag = function appendPredictFlag(container, flagSrc, teamName) {
    if (!container) return;
    const wrap = document.createElement('span');
    wrap.className = 'score-predict-flag';
    wrap.title = teamName || '';
    if (flagSrc) {
        const img = document.createElement('img');
        img.src = flagSrc;
        img.alt = teamName ? (teamName.slice(0, 3).toUpperCase()) : '';
        img.decoding = 'async';
        img.loading = 'lazy';
        wrap.appendChild(img);
    } else {
        wrap.classList.add('is-empty');
        wrap.textContent = teamName ? teamName.slice(0, 3).toUpperCase() : '—';
    }
    container.appendChild(wrap);
};
Core.fillScorePredictPanel = function fillScorePredictPanel(panel, matchup, sortedPreds, hasResult, actualA, actualB, teamA, teamB) {
    if (!panel || panel.dataset.filled === '1') return;
    panel.dataset.filled = '1';
    let inner = panel.querySelector(':scope > .panel-slide-inner');
    if (!inner) {
        inner = Core.createPanelSlideInner();
        panel.appendChild(inner);
    } else {
        inner.replaceChildren();
    }

    const flagA = Core.matchupTeamFlagSrc(matchup, 0);
    const flagB = Core.matchupTeamFlagSrc(matchup, 1);

    sortedPreds.forEach(pred => {
        const item = document.createElement('div');
        item.className = 'score-predict-item';
        const exact = hasResult && pred.a === actualA && pred.b === actualB;
        if (hasResult) item.classList.add(exact ? 'correct' : 'wrong');

        const img = document.createElement('img');
        img.className = 'score-predict-avatar';
        Core.applyParticipantAvatar(img, pred.name);

        const meta = document.createElement('div');
        meta.className = 'score-predict-meta';

        const left = document.createElement('div');
        left.className = 'score-predict-left';
        const nameEl = document.createElement('span');
        nameEl.className = 'score-predict-name';
        nameEl.textContent = pred.name;
        left.appendChild(nameEl);

        const right = document.createElement('div');
        right.className = 'score-predict-right';
        Core.appendPredictFlag(right, flagA, teamA);
        const scoreEl = document.createElement('span');
        scoreEl.className = 'score-predict-score';
        scoreEl.textContent = pred.a + ' - ' + pred.b;
        scoreEl.title = teamA + ' ' + pred.a + ' - ' + pred.b + ' ' + teamB;
        right.appendChild(scoreEl);
        Core.appendPredictFlag(right, flagB, teamB);

        if (hasResult) {
            const badge = document.createElement('span');
            badge.className = 'score-predict-badge' + (exact ? ' is-hit' : ' is-miss');
            badge.setAttribute('aria-label', exact ? 'Hit' : 'Miss');
            badge.title = exact ? 'Hit' : 'Miss';
            badge.innerHTML = exact
                ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 11.4 2.8 8l1.1-1.1 2.3 2.3 5-5.1L12.3 5.2z"/></svg>'
                : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.1 3.2 3.2 4.1 7.1 8l-3.9 3.9.9.9L8 8.9l3.9 3.9.9-.9L8.9 8l3.9-3.9-.9-.9L8 7.1z"/></svg>';
            right.appendChild(badge);
        }

        meta.appendChild(left);
        meta.appendChild(right);
        item.appendChild(img);
        item.appendChild(meta);
        inner.appendChild(item);
    });
};
Core.injectScorePredictions = function injectScorePredictions() {
    document.querySelectorAll('.bracket .matchup, .group-stage .matchup').forEach(matchup => {
        if (matchup.dataset.scorePredictInjected) return;
        const matchId = matchup.dataset.matchId;
        if (!matchId) return;
        const preds = Core.getScorePredictionsForMatch(matchId);
        if (!preds.length) return;

        matchup.dataset.scorePredictInjected = 'true';

        const teams = matchup.querySelectorAll(':scope > .team');
        const teamA = teams[0]?.querySelector('.team-name')?.textContent.trim() || 'A';
        const teamB = teams[1]?.querySelector('.team-name')?.textContent.trim() || 'B';

        let actualA = null;
        let actualB = null;
        if (matchup.classList.contains('finished') && teams.length === 2) {
            actualA = typeof Core.parseFullTimeScore === 'function'
                ? Core.parseFullTimeScore(teams[0].querySelector('.team-score')?.textContent)
                : null;
            actualB = typeof Core.parseFullTimeScore === 'function'
                ? Core.parseFullTimeScore(teams[1].querySelector('.team-score')?.textContent)
                : null;
        }
        const hasResult = actualA != null && actualB != null;
        const sortedPreds = Core.sortScorePredictions(preds, hasResult, actualA, actualB);

        const panel = document.createElement('div');
        panel.className = 'score-predict-panel';
        panel.appendChild(Core.createPanelSlideInner());

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'supporters-toggle score-predict-toggle';
        const closedLabel = 'Predictions (' + sortedPreds.length + ')';
        btn.textContent = closedLabel;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (panel.dataset.slideBusy === '1') return;
            panel.dataset.slideBusy = '1';
            const willOpen = !panel.classList.contains('show');
            if (willOpen) {
                Core.fillScorePredictPanel(
                    panel, matchup, sortedPreds, hasResult, actualA, actualB, teamA, teamB
                );
            }
            const stopPin = Core.pinElementScreenY(btn);
            const open = Core.toggleSlidePanel(panel);
            btn.textContent = open ? 'Hide' : closedLabel;
            Core.afterPanelSlide(panel, function () {
                stopPin();
                panel.dataset.slideBusy = '';
                if (Core.isKnockoutMatchup(matchup) && typeof Core.drawBracketLines === 'function') {
                    Core.drawBracketLines();
                }
            });
        });

        matchup.appendChild(Core.createSupportersDrop(btn, panel));
    });
};
Core.getTournamentYear = function getTournamentYear() {
    return (window.LEAGUE_DATA && window.LEAGUE_DATA.year) || Core.TOURNAMENT_YEAR;
};
Core.getLeagueChampionSubtitle = function getLeagueChampionSubtitle() {
    const d = window.LEAGUE_DATA || {};
    const title = d.title && String(d.title).trim();
    const year = d.year != null && d.year !== '' ? String(d.year).trim() : '';
    const parts = [];
    if (title) parts.push(title);
    if (year) parts.push(year);
    if (!parts.length) return 'Champion';
    return parts.join(' ') + ' Champion';
};
Core.makeWIBDate = function makeWIBDate(year, monthIndex, day, hour, minute) {
    return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute));
};
Core.extractMatchupDateText = function extractMatchupDateText(dateEl) {
    const text = dateEl.textContent.replace(/\s+/g, ' ').trim();
    const match = text.match(/((?:\w+,\s*)?(?:\d{1,2}\s+\w+|\d{1,2}\/\d{1,2}),?\s+\d{1,2}:\d{2}(?:\s*WIB)?)/i);
    return match ? match[1].trim() : text.replace(/^✅\s*/, '').trim();
};
Core.parseMatchupDateWIB = function parseMatchupDateWIB(dateText) {
    const text = (dateText || '').replace(/^✅\s*/, '').trim();
    if (!text) return null;

    // WIB optional — display strings omit it for brevity; timezone still treated as WIB
    let match = text.match(/^(?:\w+,\s*)?(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
    if (match) {
        const monthIndex = Core.MONTH_INDEX[match[2].toLowerCase()];
        if (monthIndex === undefined) return null;
        return Core.makeWIBDate(
            Core.getTournamentYear(),
            monthIndex,
            parseInt(match[1], 10),
            parseInt(match[3], 10),
            parseInt(match[4], 10)
        );
    }

    match = text.match(/^(?:\w+,\s*)?(\d{1,2})\/(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
    if (match) {
        return Core.makeWIBDate(
            Core.getTournamentYear(),
            parseInt(match[1], 10) - 1,
            parseInt(match[2], 10),
            parseInt(match[3], 10),
            parseInt(match[4], 10)
        );
    }

    return null;
};
Core.getOrStoreMatchDateText = function getOrStoreMatchDateText(dateEl) {
    if (!dateEl.dataset.scheduleDate) {
        dateEl.dataset.scheduleDate = Core.extractMatchupDateText(dateEl);
    }
    return dateEl.dataset.scheduleDate;
};
Core.setLiveBadge = function setLiveBadge(dateEl, show) {
    const dateText = Core.getOrStoreMatchDateText(dateEl);
    if (show) {
        if (dateEl.querySelector('.matchup-live-badge')) return;
        dateEl.innerHTML =
            '<span class="matchup-live-badge">' +
            '<span class="wave-bars"><span></span><span></span><span></span></span>' +
            'Live</span> ' + dateText;
    } else if (dateEl.querySelector('.matchup-live-badge')) {
        dateEl.textContent = dateText;
    }
};
Core.formatCountdownHMS = function formatCountdownHMS(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
};
Core.initGlowSync = function initGlowSync() {
    const negDelay = -(Date.now() % Core.GLOW_RHYTHM_MS);
    document.documentElement.style.setProperty('--glow-sync-delay', negDelay + 'ms');
};
Core.getSoonProgress = function getSoonProgress(msRemaining) {
    if (msRemaining <= Core.LIVE_PREMATCH_MS) return 1;
    if (msRemaining >= Core.TWENTY_FOUR_HOURS_MS) return 0;
    return 1 - (msRemaining - Core.LIVE_PREMATCH_MS) / (Core.TWENTY_FOUR_HOURS_MS - Core.LIVE_PREMATCH_MS);
};
Core.playSoonProgressSlide = function playSoonProgressSlide(el) {
    if (!el) return;
    const value = el.dataset.soonTarget || '0%';
    if (typeof Core.prefersReducedMotion === 'function' && Core.prefersReducedMotion()) {
        el.style.transition = 'none';
        el.style.width = value;
        return;
    }
    el.style.transition = 'none';
    el.style.width = '0%';
    void el.offsetWidth;
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            el.style.transition = '';
            el.style.width = value;
        });
    });
};
Core.resetSoonProgressSlide = function resetSoonProgressSlide(el) {
    if (!el) return;
    el.style.transition = 'none';
    el.style.width = '0%';
    void el.offsetWidth;
};
Core.getSoonSlideObserver = function getSoonSlideObserver() {
    if (Core.soonSlideObserver) return Core.soonSlideObserver;
    if (!('IntersectionObserver' in window)) return null;
    Core.soonSlideObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            const watch = entry.target;
            const el = Core.soonSlideWatchToEl.get(watch);
            const wasVisible = !!Core.soonSlideWatchVisible.get(watch);
            if (entry.isIntersecting) {
                Core.soonSlideWatchVisible.set(watch, true);
                if (!wasVisible && el) Core.playSoonProgressSlide(el);
                else if (el && el.dataset.soonTarget) {
                    el.style.transition = '';
                    el.style.width = el.dataset.soonTarget;
                }
            } else if (wasVisible) {
                Core.soonSlideWatchVisible.set(watch, false);
                if (el) Core.resetSoonProgressSlide(el);
            }
        });
    }, {
        threshold: 0,
        rootMargin: '0px',
    });
    return Core.soonSlideObserver;
};
Core.observeSoonProgressSlide = function observeSoonProgressSlide(el) {
    if (!el) return;
    const watch = el.closest('.matchup') || el;
    const obs = Core.getSoonSlideObserver();
    if (!obs) {
        el.style.width = el.dataset.soonTarget || '0%';
        return;
    }
    const prevEl = Core.soonSlideWatchToEl.get(watch);
    Core.soonSlideWatchToEl.set(watch, el);
    obs.observe(watch);

    if (Core.soonSlideWatchVisible.get(watch)) {
        // Match already on screen: slide (or re-slide if progress node was recreated)
        if (prevEl !== el) Core.playSoonProgressSlide(el);
        else {
            el.style.transition = '';
            el.style.width = el.dataset.soonTarget || '0%';
        }
    } else {
        el.style.transition = 'none';
        el.style.width = '0%';
    }
};
Core.setSoonProgressTarget = function setSoonProgressTarget(progEl, progressPct) {
    if (!progEl) return;
    const value = Math.max(0, Math.min(100, progressPct)) + '%';
    progEl.dataset.soonTarget = value;
    Core.observeSoonProgressSlide(progEl);
};
Core.setSoonBadge = function setSoonBadge(dateEl, show, msRemaining) {
    const dateText = Core.getOrStoreMatchDateText(dateEl);
    if (show) {
        const countdown = Core.formatCountdownHMS(msRemaining);
        const progressPct = Math.round(Core.getSoonProgress(msRemaining) * 100);
        const existing = dateEl.querySelector('.matchup-soon-badge');
        if (existing) {
            const cdEl = existing.querySelector('.matchup-soon-countdown');
            if (cdEl) cdEl.textContent = countdown;
            const progEl = existing.querySelector('.matchup-soon-progress');
            Core.setSoonProgressTarget(progEl, progressPct);
            return;
        }
        dateEl.innerHTML =
            '<span class="matchup-soon-badge">' +
            '<span class="matchup-soon-progress" style="width:0%"></span>' +
            '<span class="matchup-soon-badge-inner">Soon' +
            '<span class="matchup-soon-countdown">' + countdown + '</span></span></span> ' + dateText;
        const progEl = dateEl.querySelector('.matchup-soon-progress');
        Core.setSoonProgressTarget(progEl, progressPct);
    } else if (dateEl.querySelector('.matchup-soon-badge')) {
        dateEl.textContent = dateText;
    }
};
Core.updateSoonCountdowns = function updateSoonCountdowns() {
    const now = Date.now();
    let needFullUpdate = false;
    document.querySelectorAll('.bracket .matchup.today, .group-stage .matchup.today').forEach(matchup => {
        const kickoff = Number(matchup.dataset.kickoff);
        if (!kickoff) return;
        const untilKickoff = kickoff - now;
        if (untilKickoff <= Core.LIVE_PREMATCH_MS) {
            needFullUpdate = true;
            return;
        }
        const badge = matchup.querySelector('.matchup-soon-badge');
        if (!badge) return;
        const cdEl = badge.querySelector('.matchup-soon-countdown');
        if (cdEl) cdEl.textContent = Core.formatCountdownHMS(untilKickoff);
        const progEl = badge.querySelector('.matchup-soon-progress');
        Core.setSoonProgressTarget(progEl, Math.round(Core.getSoonProgress(untilKickoff) * 100));
    });
    if (needFullUpdate) Core.updateMatchupScheduleStatus();
};
Core.setWaitingAdminBadge = function setWaitingAdminBadge(dateEl, show) {
    const dateText = Core.getOrStoreMatchDateText(dateEl);
    if (show) {
        if (dateEl.querySelector('.matchup-waiting-badge')) return;
        dateEl.innerHTML =
            '<span class="matchup-waiting-badge">Pending result</span> ' + dateText;
    } else if (dateEl.querySelector('.matchup-waiting-badge')) {
        dateEl.textContent = dateText;
    }
};
Core.ensureDefaultTeamScores = function ensureDefaultTeamScores(matchup) {
    matchup.querySelectorAll('.team').forEach(teamEl => {
        const teamName = teamEl.querySelector('.team-name')?.textContent.trim();
        if (!teamName || teamName === 'TBD') return;
        if (teamEl.querySelector('.team-score')) return;

        const scoreEl = document.createElement('span');
        scoreEl.className = 'team-score';
        scoreEl.textContent = '0';
        teamEl.appendChild(scoreEl);
    });
};
Core.updateMatchupScheduleStatus = function updateMatchupScheduleStatus() {
    const now = Date.now();

    document.querySelectorAll(
        '.bracket .matchup:not(.finished):not([data-admin-managed]), ' +
        '.group-stage .matchup:not(.finished):not([data-admin-managed])'
    ).forEach(matchup => {
        const dateEl = matchup.querySelector('.matchup-date');
        if (!dateEl) return;

        const matchTime = Core.parseMatchupDateWIB(Core.getOrStoreMatchDateText(dateEl));
        if (!matchTime) return;

        const kickoff = matchTime.getTime();
        const untilKickoff = kickoff - now;

        matchup.classList.remove('tbd', 'today', 'live', 'waiting-admin');
        delete matchup.dataset.kickoff;
        Core.setLiveBadge(dateEl, false);
        Core.setSoonBadge(dateEl, false);
        Core.setWaitingAdminBadge(dateEl, false);

        if (now >= kickoff - Core.LIVE_PREMATCH_MS && now < kickoff + Core.LIVE_MATCH_DURATION_MS) {
            matchup.classList.add('live');
            Core.setLiveBadge(dateEl, true);
            Core.ensureDefaultTeamScores(matchup);
            matchup.dataset.liveUrl = Core.LIVE_STREAM_URL;
            matchup.title = 'Tonton live';
        } else if (now >= kickoff + Core.LIVE_MATCH_DURATION_MS) {
            matchup.classList.add('waiting-admin');
            Core.setWaitingAdminBadge(dateEl, true);
            Core.ensureDefaultTeamScores(matchup);
            delete matchup.dataset.liveUrl;
            matchup.removeAttribute('title');
        } else if (untilKickoff > Core.LIVE_PREMATCH_MS && untilKickoff < Core.TWENTY_FOUR_HOURS_MS) {
            matchup.classList.add('today');
            matchup.dataset.kickoff = String(kickoff);
            Core.setSoonBadge(dateEl, true, untilKickoff);
            delete matchup.dataset.liveUrl;
            matchup.removeAttribute('title');
        } else {
            matchup.classList.add('tbd');
            delete matchup.dataset.liveUrl;
            matchup.removeAttribute('title');
        }
    });

    Core.updateMainQuestEliminatedStatus();
};
Core.getScheduledKickoffFromMatchSchedule = function getScheduledKickoffFromMatchSchedule(matchId) {
    const schedule = window.LEAGUE_DATA?.matchSchedule || {};
    const text = schedule[matchId];
    if (!text) return null;
    return Core.parseMatchupDateWIB(text);
};
Core.getTieScheduledKickoffMs = function getTieScheduledKickoffMs(tieId) {
    if (Core.isTwoLegKnockout()) {
        const kickoffs = [1, 2]
            .map(leg => Core.getScheduledKickoffFromMatchSchedule(tieId + '-leg' + leg))
            .filter(Boolean)
            .map(d => d.getTime());
        return kickoffs.length ? Math.min(...kickoffs) : null;
    }
    const kickoff = Core.getScheduledKickoffFromMatchSchedule(tieId);
    return kickoff ? kickoff.getTime() : null;
};
Core.isMainQuestPodiumPhaseActive = function isMainQuestPodiumPhaseActive() {
    const kickoffs = [];
    if (window.LEAGUE_DATA?.includeThirdPlace !== false) {
        const third = Core.getTieScheduledKickoffMs('third-0');
        if (third !== null) kickoffs.push(third);
    }
    const finalKick = Core.getTieScheduledKickoffMs('final-0');
    if (finalKick !== null) kickoffs.push(finalKick);
    if (!kickoffs.length) return false;
    return Date.now() >= Math.min(...kickoffs);
};
Core.applyFinishedMatchBadges = function applyFinishedMatchBadges() {
    document.querySelectorAll(
        '.bracket .matchup.finished .matchup-date, .group-stage .matchup.finished .matchup-date'
    ).forEach(dateEl => {
        if (dateEl.querySelector('.matchup-finished-badge')) return;

        const dateText = Core.extractMatchupDateText(dateEl).replace(/^✅\s*/, '').trim();
        dateEl.dataset.scheduleDate = dateText;
        dateEl.innerHTML =
            '<span class="matchup-finished-badge">Match Finished</span> ' + dateText;
    });
};
Core.advanceKnockoutRound = function advanceKnockoutRound(prevRoundEl, nextRoundEl) {
    const prevWinners = Core.getRoundOutputWinners(prevRoundEl);
    const nextBye = parseInt(nextRoundEl.dataset.koByes || '0', 10);
    const nextUnits = Core.getRoundBracketUnits(nextRoundEl);

    if (nextBye && prevWinners[0]) {
        nextRoundEl.dataset.koByeCarrier = JSON.stringify(prevWinners[0]);
    } else {
        delete nextRoundEl.dataset.koByeCarrier;
    }

    for (let j = 0; j < nextUnits.length; j++) {
        Core.setBracketUnitTeamSlots(
            nextUnits[j],
            prevWinners[nextBye + j * 2] || null,
            prevWinners[nextBye + j * 2 + 1] || null
        );
    }
};
Core.fillNextRoundSlotsFromTies = function fillNextRoundSlotsFromTies(currentTies, nextTies) {
    for (let j = 0; j < nextTies.length; j++) {
        [j * 2, j * 2 + 1].forEach((tieIndex, slotIndex) => {
            const sourceTie = currentTies[tieIndex];
            const nextTie = nextTies[j];
            if (!sourceTie || !nextTie) return;

            const winner = Core.getTieWinnerTeamData(sourceTie);
            if (!winner) return;

            Core.setTieTeamSlots(nextTie, slotIndex, winner);
        });
    }
};
Core.fillNextRoundSlots = function fillNextRoundSlots(currentMatches, nextMatches) {
    for (let j = 0; j < nextMatches.length; j++) {
        const nextTeams = nextMatches[j].querySelectorAll(':scope > .team');
        if (nextTeams.length < 2) continue;

        [j * 2, j * 2 + 1].forEach((matchIndex, slotIndex) => {
            const sourceMatchup = currentMatches[matchIndex];
            if (!sourceMatchup) return;

            const winner = Core.getMatchupWinner(sourceMatchup);
            if (!winner) return;

            Core.setTeamSlot(nextTeams[slotIndex], winner);
        });
    }
};
Core.advanceThirdPlaceMatch = function advanceThirdPlaceMatch() {
    const bracket = document.querySelector('.bracket');
    if (!bracket) return;

    const sfUnits = bracket.querySelectorAll(
        '[data-semifinal-round="true"] .matchup-tie, [data-semifinal-round="true"] .round-matches > .matchup, ' +
        '.round-sf .matchup-tie, .round-sf .round-matches > .matchup'
    );
    const thirdTie = bracket.querySelector('.round-3rd .matchup-tie');
    const thirdMatchup = thirdTie || bracket.querySelector('.round-3rd .matchup');
    if (!thirdMatchup || sfUnits.length < 2) return;

    if (thirdTie) {
        [0, 1].forEach(index => {
            const loser = Core.getBracketUnitLoser(sfUnits[index]);
            if (!loser) return;
            Core.setTieTeamSlots(thirdTie, index, loser);
        });
        return;
    }

    const slots = thirdMatchup.querySelectorAll(':scope > .team');
    if (slots.length < 2) return;

    [0, 1].forEach(index => {
        const loser = Core.getBracketUnitLoser(sfUnits[index]);
        if (!loser) return;
        Core.setTeamSlot(slots[index], loser);
    });
};
Core.markConfirmedTeamNames = function markConfirmedTeamNames() {
    // FIX: matchup boleh berstatus .tbd (belum tanding), tapi kalau nama tim sudah
    // pasti (bukan placeholder "TBD"), teks tidak boleh tampil abu-abu.
    document.querySelectorAll('.matchup .team-name').forEach(nameEl => {
        const isPlaceholder = nameEl.textContent.trim() === 'TBD';
        nameEl.classList.toggle('confirmed', !isPlaceholder);
    });
};
Core.advanceBracketWinners = function advanceBracketWinners() {
    const bracket = document.querySelector('.bracket');
    if (!bracket) return;

    const rounds = bracket.querySelectorAll('[data-bracket-chain]');

    for (let i = 0; i < rounds.length - 1; i++) {
        const currentUnits = Core.getRoundBracketUnits(rounds[i]);
        const nextUnits = Core.getRoundBracketUnits(rounds[i + 1]);
        if (!currentUnits.length || !nextUnits.length) continue;

        const usesFlexibleKo = rounds[i].dataset.koRound || rounds[i + 1].dataset.koRound;
        if (usesFlexibleKo) {
            Core.advanceKnockoutRound(rounds[i], rounds[i + 1]);
            Core.applyAdminConfig();
            continue;
        }

        const currentAreTies = currentUnits[0].classList.contains('matchup-tie');
        const nextAreTies = nextUnits[0].classList.contains('matchup-tie');
        if (currentAreTies && nextAreTies) {
            Core.fillNextRoundSlotsFromTies(currentUnits, nextUnits);
        } else {
            Core.fillNextRoundSlots(currentUnits, nextUnits);
        }
        Core.applyAdminConfig();
    }

    Core.advanceThirdPlaceMatch();
    Core.applyAdminConfig();
    Core.applyFinalPlacementBadges();
    if (typeof Core.drawBracketLines === 'function') Core.drawBracketLines();
};
Core.applyFinalPlacementBadges = function applyFinalPlacementBadges() {
    if (Core.isTwoLegKnockout()) {
        Core.applyTiePlacementBadges('final-0', 'final');
        Core.applyTiePlacementBadges('third-0', 'third');
        return;
    }

    const finalMatch = document.querySelector('[data-match-id="final-0"]');
    if (finalMatch) {
        finalMatch.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());
        if (finalMatch.classList.contains('finished')) {
            const teams = finalMatch.querySelectorAll(':scope > .team');
            const winnerEl = Core.resolveMatchWinnerTeamEl(finalMatch, 'final-0');
            if (winnerEl) {
                const loserEl = Array.from(teams).find(teamEl => teamEl !== winnerEl);
                Core.appendTeamPlaceBadge(winnerEl, Core.getTrophyImageUrl(), 'Champion', 'champion');
                Core.appendTeamPlaceBadge(loserEl, Core.FINAL_PLACE_IMAGES.runnerup, 'Runner-Up', 'runnerup');
            }
        }
    }

    const thirdMatch = document.querySelector('[data-match-id="third-0"]');
    if (thirdMatch) {
        thirdMatch.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());
        if (thirdMatch.classList.contains('finished')) {
            const teams = thirdMatch.querySelectorAll(':scope > .team');
            const winnerEl = Core.resolveMatchWinnerTeamEl(thirdMatch, 'third-0');
            if (winnerEl) {
                const loserEl = Array.from(teams).find(teamEl => teamEl !== winnerEl);
                Core.appendTeamPlaceBadge(winnerEl, Core.FINAL_PLACE_IMAGES.third, '3rd Place', 'third');
                // Slot kosong agar skor 4th rank sejajar dengan 3rd
                Core.appendTeamPlaceBadge(loserEl, null, '', '');
            }
        }
    }
};
Core.applyTiePlacementBadges = function applyTiePlacementBadges(tieId, kind) {
    const tieEl = Core.getTieElement(tieId);
    if (!tieEl || typeof ArisanBracket === 'undefined') return;

    tieEl.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());
    const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
    if (!result.legsComplete || result.winnerIdx === null) return;

    const leg1 = Core.getTieLeg1(tieEl);
    const teams = leg1.querySelectorAll(':scope > .team');
    const winnerEl = teams[result.winnerIdx];
    const loserEl = teams[1 - result.winnerIdx];

    if (kind === 'final') {
        Core.appendTeamPlaceBadge(winnerEl, Core.getTrophyImageUrl(), 'Champion', 'champion');
        Core.appendTeamPlaceBadge(loserEl, Core.FINAL_PLACE_IMAGES.runnerup, 'Runner-Up', 'runnerup');
    } else if (kind === 'third') {
        Core.appendTeamPlaceBadge(winnerEl, Core.FINAL_PLACE_IMAGES.third, '3rd Place', 'third');
        Core.appendTeamPlaceBadge(loserEl, null, '', '');
    }
};
Core.scheduleFinalWinnerCelebration = function scheduleFinalWinnerCelebration() {
    let winner = null;
    if (Core.isTwoLegKnockout()) {
        const tieEl = Core.getTieElement('final-0');
        winner = tieEl ? Core.getTieWinnerTeamData(tieEl) : null;
    } else {
        const finalMatch = document.querySelector('[data-match-id="final-0"].finished');
        winner = finalMatch ? Core.getMatchupWinner(finalMatch) : null;
    }
    if (!winner || !winner.flagSrc) return;

    Core.pendingFinalCelebrationWinner = winner;
    if (typeof Core.hasEntered !== 'undefined' && Core.hasEntered) {
        Core.playFinalWinnerCelebration();
    }
};
Core.getWinnerCelebrationSupporters = function getWinnerCelebrationSupporters(teamName) {
    const championEntry = Core.sideQuestPodium.champion && Core.sideQuestPodium.champion[teamName];
    if (championEntry && championEntry.supporters && championEntry.supporters.length) {
        return championEntry.supporters.slice();
    }
    return (Core.teamSupporters[teamName] || []).slice();
};
Core.buildWinnerAnnouncementSupporters = function buildWinnerAnnouncementSupporters(teamName) {
    const supporters = Core.getWinnerCelebrationSupporters(teamName);
    if (!supporters.length) return null;

    const wrap = document.createElement('div');
    wrap.className = 'winner-announcement-supporters';

    supporters.forEach(function (participantName) {
        const item = document.createElement('div');
        item.className = 'winner-announcement-supporter';

        const avatar = document.createElement('img');
        avatar.className = 'winner-announcement-supporter-avatar';
        Core.applyParticipantAvatar(avatar, participantName);

        const label = document.createElement('span');
        label.className = 'winner-announcement-supporter-name';
        label.textContent = participantName;

        item.appendChild(avatar);
        item.appendChild(label);
        wrap.appendChild(item);
    });

    return wrap;
};
Core.playFinalWinnerCelebration = function playFinalWinnerCelebration() {
    if (Core.finalCelebrationActive || !Core.pendingFinalCelebrationWinner || document.hidden) return;
    Core.finalCelebrationActive = true;

    // Repeat schedule is owned by ArisanLeagueViews (session timestamp, 30s).
    if (Core.finalCelebrationRepeatTimer) {
        clearInterval(Core.finalCelebrationRepeatTimer);
        Core.finalCelebrationRepeatTimer = null;
    }

    const winner = Core.pendingFinalCelebrationWinner;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 600;
    const flagSrc = Core.getCelebrationFlagSrc(winner.flagSrc);
    const overlay = document.createElement('div');
    overlay.className = 'winner-celebration';
    overlay.setAttribute('aria-hidden', 'true');

    const announcement = document.createElement('div');
    announcement.className = 'winner-announcement';
    const title = document.createElement('strong');
    title.className = 'winner-announcement-title';

    const trophy = document.createElement('img');
    trophy.className = 'winner-announcement-trophy';
    trophy.src = Core.getTrophyImageUrl();
    trophy.alt = '';
    trophy.decoding = 'async';
    title.appendChild(trophy);

    if (flagSrc) {
        const flag = document.createElement('img');
        flag.className = 'winner-announcement-flag';
        flag.src = flagSrc;
        flag.alt = winner.name || '';
        flag.decoding = 'async';
        title.appendChild(flag);
    }

    const name = document.createElement('span');
    name.className = 'winner-announcement-name';
    name.textContent = winner.name;
    title.appendChild(name);

    const supportersEl = Core.buildWinnerAnnouncementSupporters(winner.name);

    const subtitle = document.createElement('span');
    subtitle.className = 'winner-announcement-subtitle';

    const leagueIcon = document.createElement('img');
    leagueIcon.className = 'winner-announcement-league-icon';
    leagueIcon.src = Core.getLeagueIconImageUrl();
    leagueIcon.alt = '';
    leagueIcon.decoding = 'async';

    const leagueText = document.createElement('span');
    leagueText.className = 'winner-announcement-league-text';
    leagueText.textContent = Core.getLeagueChampionSubtitle();

    subtitle.append(leagueIcon, leagueText);
    if (supportersEl) {
        announcement.append(title, supportersEl, subtitle);
    } else {
        announcement.append(title, subtitle);
    }
    overlay.appendChild(announcement);

    if (!reducedMotion) {
        const balloonCount = isMobile ? 6 : 10;
        const fragment = document.createDocumentFragment();
        const itemPattern = [
            'flag', 'participant', 'trophy', 'flag', 'ball',
            'participant', 'league-icon', 'flag', 'participant', 'flag'
        ];
        const rankOneParticipants = Core.getStandingsRankOneParticipants();
        let participantFloatIndex = 0;

        for (let i = 0; i < balloonCount; i += 1) {
            const balloon = document.createElement('div');
            balloon.className = 'winner-balloon';
            balloon.style.setProperty('--balloon-left', (6 + Math.random() * 84).toFixed(1) + '%');
            balloon.style.setProperty('--balloon-size', Math.round(48 + Math.random() * 28) + 'px');
            balloon.style.setProperty('--balloon-delay', (Math.random() * 2.8).toFixed(2) + 's');
            balloon.style.setProperty('--balloon-duration', (5.5 + Math.random() * 2).toFixed(2) + 's');
            balloon.style.setProperty('--balloon-drift', Math.round(-30 + Math.random() * 60) + 'px');
            balloon.style.setProperty('--string-tilt', Math.round(-6 + Math.random() * 12) + 'deg');

            let itemType = itemPattern[i % itemPattern.length];
            if (itemType === 'participant') {
                if (rankOneParticipants.length) {
                    balloon.classList.add('winner-floating-object', 'object-participant');
                    const floatingImage = document.createElement('img');
                    const participantName = rankOneParticipants[participantFloatIndex % rankOneParticipants.length];
                    participantFloatIndex += 1;
                    Core.applyParticipantAvatar(floatingImage, participantName);
                    balloon.appendChild(floatingImage);
                    fragment.appendChild(balloon);
                    continue;
                }
                itemType = 'flag';
            }
            if (itemType !== 'flag') {
                balloon.classList.add('winner-floating-object', 'object-' + itemType);
                const floatingImage = document.createElement('img');
                floatingImage.src = itemType === 'ball'
                    ? Core.getBallImageUrl()
                    : itemType === 'league-icon'
                        ? Core.getLeagueIconImageUrl()
                        : Core.getTrophyImageUrl();
                floatingImage.alt = '';
                floatingImage.decoding = 'async';
                balloon.appendChild(floatingImage);
                fragment.appendChild(balloon);
                continue;
            }

            const body = document.createElement('div');
            body.className = 'winner-balloon-body';
            const flag = document.createElement('img');
            flag.src = flagSrc;
            flag.alt = '';
            flag.decoding = 'async';
            body.appendChild(flag);

            const knot = document.createElement('span');
            knot.className = 'winner-balloon-knot';
            const string = document.createElement('span');
            string.className = 'winner-balloon-string';
            balloon.append(body, knot, string);
            fragment.appendChild(balloon);
        }

        overlay.appendChild(fragment);
        document.body.appendChild(overlay);
        // Fireworks only on desktop; shorter + lighter
        if (!isMobile) {
            const canvas = document.createElement('canvas');
            canvas.className = 'winner-fireworks';
            overlay.appendChild(canvas);
            Core.startWinnerFireworks(canvas, 2800);
        }
        // Balloon CSS: delay ≤2.8s, duration ≤7.5s, travel -120vh.
        // ~80% viewport height ≈ 80/120 of rise — fade FX only (no page blackout).
        const maxDelayMs = 2800;
        const maxDurMs = 7500;
        const fadeMs = 1200;
        const fadeAtMs = Math.round(maxDelayMs + maxDurMs * (80 / 120));
        const lifeMs = maxDelayMs + maxDurMs + fadeMs;
        announcement.style.setProperty('--winner-announce-out-delay', fadeAtMs + 'ms');
        announcement.style.setProperty('--winner-announce-out-duration', fadeMs + 'ms');
        window.setTimeout(function () {
            if (!overlay.isConnected) return;
            overlay.classList.add('is-fading-out');
        }, fadeAtMs);
        window.setTimeout(function () {
            overlay.remove();
            Core.finalCelebrationActive = false;
        }, lifeMs);
        return;
    }

    document.body.appendChild(overlay);
    window.setTimeout(() => {
        overlay.remove();
        Core.finalCelebrationActive = false;
    }, 4200);
};
Core.startWinnerFireworks = function startWinnerFireworks(canvas, duration) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const colors = ['#ffd700', '#ff4d6d', '#50e3c2', '#4da3ff', '#ffffff'];
    const particles = [];
    const startedAt = performance.now();
    let nextBurstAt = startedAt;
    let width = 0;
    let height = 0;
    let rafId = 0;
    let ended = false;

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        // Cap DPR agar canvas tidak terlalu berat di layar retina
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function createBurst() {
        const x = width * (0.15 + Math.random() * 0.7);
        const y = height * (0.12 + Math.random() * 0.4);
        const particleCount = width < 600 ? 8 : 12;
        const color = colors[(Math.random() * colors.length) | 0];

        for (let i = 0; i < particleCount; i += 1) {
            const angle = (Math.PI * 2 * i / particleCount) + Math.random() * 0.12;
            const speed = 1.2 + Math.random() * 3.2;
            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                color,
                size: 1.4 + Math.random() * 1.6,
            });
        }
    }

    function render(now) {
        if (ended) return;
        if (document.hidden) {
            rafId = requestAnimationFrame(render);
            return;
        }
        context.clearRect(0, 0, width, height);

        if (now < startedAt + duration && now >= nextBurstAt) {
            createBurst();
            nextBurstAt = now + 1100 + Math.random() * 900;
        }

        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.98;
            particle.vy = particle.vy * 0.98 + 0.05;
            particle.alpha -= 0.018;

            if (particle.alpha <= 0) {
                const last = particles.pop();
                if (i < particles.length) particles[i] = last;
                continue;
            }

            context.globalAlpha = particle.alpha;
            context.fillStyle = particle.color;
            context.fillRect(
                particle.x - particle.size,
                particle.y - particle.size,
                particle.size * 2,
                particle.size * 2
            );
        }
        context.globalAlpha = 1;

        if (now < startedAt + duration || particles.length) {
            rafId = requestAnimationFrame(render);
        }
    }

    function stop() {
        ended = true;
        if (rafId) cancelAnimationFrame(rafId);
    }

    resizeCanvas();
    rafId = requestAnimationFrame(render);
    window.setTimeout(stop, duration + 1500);
};
Core.applyPodiumBadgePreviewDemo = function applyPodiumBadgePreviewDemo() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview-podium') !== '1') return;

    function fillDemoMatch(matchId, team0, team1, winnerIdx, scores) {
        const matchup = document.querySelector('[data-match-id="' + matchId + '"]');
        if (!matchup) return;
        const teams = matchup.querySelectorAll(':scope > .team');
        const dateEl = matchup.querySelector('.matchup-date');
        [{ ...team0, score: scores[0] }, { ...team1, score: scores[1] }].forEach((t, i) => {
            if (!teams[i]) return;
            const flagEl = teams[i].querySelector('.team-flag');
            const nameEl = teams[i].querySelector('.team-name');
            if (flagEl) {
                flagEl.classList.remove('is-tbd');
                flagEl.innerHTML = '<img src="' + Core.countryFlagSrc(t.flag) + '" alt="' + t.alt + '">';
            }
            if (nameEl) {
                nameEl.textContent = t.name;
                nameEl.classList.add('confirmed');
            }
            let scoreEl = teams[i].querySelector('.team-score');
            if (!scoreEl) {
                scoreEl = document.createElement('span');
                scoreEl.className = 'team-score';
                teams[i].appendChild(scoreEl);
            }
            scoreEl.textContent = String(t.score);
            teams[i].classList.toggle('winner', i === winnerIdx);
        });
        matchup.classList.remove('tbd', 'today', 'live', 'waiting-admin');
        matchup.classList.add('finished');
        matchup.dataset.adminManaged = 'true';
        if (dateEl && !dateEl.querySelector('.matchup-finished-badge')) {
            const dateText = (dateEl.dataset.scheduleDate || dateEl.textContent || '').replace(/^✅\s*/, '').trim();
            dateEl.dataset.scheduleDate = dateText;
            dateEl.innerHTML = '<span class="matchup-finished-badge">Match Finished</span> ' + dateText;
        }
    }

    fillDemoMatch('third-0',
        { name: 'Argentina', flag: 'ar', alt: 'ARG' },
        { name: 'Brazil', flag: 'br', alt: 'BRA' },
        0, [2, 1]);
    fillDemoMatch('final-0',
        { name: 'Spain', flag: 'es', alt: 'ESP' },
        { name: 'France', flag: 'fr', alt: 'FRA' },
        0, [3, 1]);

    Core.applyFinalPlacementBadges();
    if (typeof Core.drawBracketLines === 'function') Core.drawBracketLines();
};
Core.initLiveMatchupLinks = function initLiveMatchupLinks() {
    const roots = [
        document.querySelector('.bracket'),
        document.querySelector('.group-stage'),
    ].filter(Boolean);
    roots.forEach(root => {
        if (root.dataset.liveLinksBound) return;
        root.dataset.liveLinksBound = 'true';
        root.addEventListener('click', (e) => {
            const matchup = e.target.closest('.matchup.live');
            if (!matchup || !root.contains(matchup)) return;
            if (e.target.closest('.supporters-toggle, .supporters-panel, .score-predict-toggle, .score-predict-panel')) return;
            window.open(matchup.dataset.liveUrl || Core.LIVE_STREAM_URL, '_blank', 'noopener,noreferrer');
        });
    });
};
})(window.ArisanLeagueApp);
