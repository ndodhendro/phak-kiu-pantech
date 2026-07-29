/**
 * League detail — standings points chart
 * Split from bracket-app.js — shared ArisanLeagueApp core.
 */
(function (Core) {
'use strict';

Core.buildParticipantSupportedTeams = function buildParticipantSupportedTeams() {
    const map = {};
    Object.keys(Core.participantAvatars).forEach(name => {
        map[name] = new Set();
    });
    Object.entries(Core.teamSupporters).forEach(([teamName, supporters]) => {
        (supporters || []).forEach(participant => {
            if (map[participant]) map[participant].add(teamName);
        });
    });
    return map;
};
Core.calculateParticipantGoalStats = function calculateParticipantGoalStats() {
    const supportedTeams = Core.buildParticipantSupportedTeams();
    const stats = {};
    Object.keys(Core.participantAvatars).forEach(name => {
        stats[name] = { scored: 0, conceded: 0 };
    });

    Core.forEachGoalStatMatchup(matchup => {
        const teams = matchup.querySelectorAll(':scope > .team');
        if (teams.length !== 2) return;

        const teamData = Array.from(teams).map(teamEl => ({
            name: teamEl.querySelector('.team-name')?.textContent.trim(),
            scoreText: teamEl.querySelector('.team-score')?.textContent,
        }));

        if (!teamData[0].name || !teamData[1].name) return;
        if (teamData[0].name === 'TBD' || teamData[1].name === 'TBD') return;

        const goals0 = Core.parseTotalGoalsFromScoreText(teamData[0].scoreText);
        const goals1 = Core.parseTotalGoalsFromScoreText(teamData[1].scoreText);
        if (goals0 === null || goals1 === null) return;

        [
            { name: teamData[0].name, scored: goals0, conceded: goals1 },
            { name: teamData[1].name, scored: goals1, conceded: goals0 },
        ].forEach(({ name, scored, conceded }) => {
            Object.keys(stats).forEach(participant => {
                if (supportedTeams[participant]?.has(name)) {
                    stats[participant].scored += scored;
                    stats[participant].conceded += conceded;
                }
            });
        });
    });

    return stats;
};
Core.awardSideQuestPoints = function awardSideQuestPoints(points, winners, totalAmount, shareEqually) {
    const unique = [];
    const seen = Object.create(null);
    (winners || []).forEach(name => {
        if (!name || points[name] === undefined || seen[name]) return;
        seen[name] = true;
        unique.push(name);
    });
    if (!unique.length) return;
    const pool = Number(totalAmount) || 0;
    const each = shareEqually
        ? Core.roundStandingsPoints(pool / unique.length)
        : Core.roundStandingsPoints(pool);
    unique.forEach(name => {
        points[name] = Core.roundStandingsPoints(points[name] + each);
    });
};
Core.calculateStandingsPointsFromBracket = function calculateStandingsPointsFromBracket() {
    const points = {};
    Object.keys(Core.participantAvatars).forEach(name => {
        points[name] = 0;
    });

    Core.forEachWdlMatchup(matchup => {
        const teams = matchup.querySelectorAll(':scope > .team');
        if (teams.length !== 2) return;

        const teamData = Array.from(teams).map(teamEl => ({
            name: teamEl.querySelector('.team-name')?.textContent.trim(),
            scoreText: teamEl.querySelector('.team-score')?.textContent,
        }));

        if (!teamData[0].name || !teamData[1].name) return;
        if (teamData[0].name === 'TBD' || teamData[1].name === 'TBD') return;

        // FT only — ET/penalti tidak mempengaruhi poin Main Quest
        const score1 = Core.parseFullTimeScore(teamData[0].scoreText);
        const score2 = Core.parseFullTimeScore(teamData[1].scoreText);
        if (score1 === null || score2 === null) return;

        let team1Points;
        let team2Points;
        if (score1 > score2) {
            team1Points = Core.mainQuestOutcomePoints(teamData[0].name, 'win');
            team2Points = Core.mainQuestOutcomePoints(teamData[1].name, 'loss');
        } else if (score1 < score2) {
            team1Points = Core.mainQuestOutcomePoints(teamData[0].name, 'loss');
            team2Points = Core.mainQuestOutcomePoints(teamData[1].name, 'win');
        } else {
            team1Points = Core.mainQuestOutcomePoints(teamData[0].name, 'draw');
            team2Points = Core.mainQuestOutcomePoints(teamData[1].name, 'draw');
        }

        [
            { name: teamData[0].name, pts: team1Points },
            { name: teamData[1].name, pts: team2Points },
        ].forEach(({ name, pts }) => {
            const supportersMap = Core.isKnockoutMatchup(matchup)
                ? Core.teamSupportersKnockout
                : Core.teamSupportersGroup;
            (supportersMap[name] || []).forEach(supporter => {
                if (points[supporter] !== undefined) {
                    points[supporter] = Core.roundStandingsPoints(points[supporter] + pts);
                }
            });
        });
    });

    // Bonus Side Quest (Champion / Runner-Up / 3rd Place) — 3rd Place dari perebutan juara 3 saja
    Core.applyFinalSideQuestBonuses(points);

    // Exact score predictions — awarded as soon as each match is finished (FT)
    Core.applyScorePredictBonus(points);

    // Provisional while tournament is live (no points until scoring has started)
    Core.applyGoldenBootBonus(points);   // requires max goals > 0
    Core.applyTotalGoalBonus(points);    // requires current goal > 0

    // Golden Glove — only after Final (winner is end-of-tournament)
    if (Core.isFinalResolved()) {
        Core.applyGoldenGloveBonus(points);
    }

    return points;
};
Core.updateStandingsPoints = function updateStandingsPoints() {
    const points = Core.calculateStandingsPointsFromBracket();
    const chart = document.querySelector('#standings-points-chart')
        || document.querySelector('.standings-section .standings-chart:not(#goldenboot-chart)');
    if (!chart) return;

    chart.querySelectorAll('.chart-row').forEach(row => {
        const name = row.querySelector('.chart-name')?.textContent.trim();
        const valueEl = row.querySelector('.chart-value');
        if (name && valueEl) {
            valueEl.textContent = Core.formatStandingsPoints(points[name] ?? 0);
        }
    });
};
Core.closeParticipantAvatarPopup = function closeParticipantAvatarPopup() {
    if (Core._avatarPopupKeyHandler) {
        document.removeEventListener('keydown', Core._avatarPopupKeyHandler);
        Core._avatarPopupKeyHandler = null;
    }
    if (Core._avatarPopupEl) {
        Core._avatarPopupEl.remove();
        Core._avatarPopupEl = null;
    }
};
Core.openParticipantAvatarPopup = function openParticipantAvatarPopup(name) {
    const participant = String(name || '').trim();
    if (!participant) return;

    Core.closeParticipantAvatarPopup();

    const overlay = document.createElement('div');
    overlay.className = 'participant-avatar-popup';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', participant);

    const panel = document.createElement('div');
    panel.className = 'participant-avatar-popup-panel';

    const img = document.createElement('img');
    img.className = 'participant-avatar-popup-img';
    Core.applyParticipantAvatar(img, participant);

    const caption = document.createElement('div');
    caption.className = 'participant-avatar-popup-name';
    caption.textContent = participant;

    panel.appendChild(img);
    panel.appendChild(caption);
    overlay.appendChild(panel);

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target === panel || e.target === img || e.target === caption) {
            Core.closeParticipantAvatarPopup();
        }
    });

    Core._avatarPopupKeyHandler = function (e) {
        if (e.key === 'Escape') Core.closeParticipantAvatarPopup();
    };
    document.addEventListener('keydown', Core._avatarPopupKeyHandler);

    Core._avatarPopupEl = overlay;
    document.body.appendChild(overlay);
};
Core.bindStandingsAvatarClicks = function bindStandingsAvatarClicks() {
    const chart = document.querySelector('#standings-points-chart')
        || document.querySelector('.standings-section .standings-chart:not(#goldenboot-chart)');
    if (!chart || chart.dataset.avatarPopupBound === '1') return;
    chart.dataset.avatarPopupBound = '1';
    chart.addEventListener('click', function (e) {
        if (e.target.closest('.chart-tie-break')) return;
        const hit = e.target.closest('.chart-avatar, .chart-name, .chart-bar, .chart-bar-wrapper');
        if (!hit || !chart.contains(hit)) return;
        const row = hit.closest('.chart-row');
        if (!row) return;
        const name = row.querySelector('.chart-name')?.textContent.trim();
        if (name) Core.openParticipantAvatarPopup(name);
    });
};
Core.bindStandingsTieBreakToggles = function bindStandingsTieBreakToggles() {
    const chart = document.querySelector('#standings-points-chart')
        || document.querySelector('.standings-section .standings-chart:not(#goldenboot-chart)');
    if (!chart || chart.dataset.tieBreakBound === '1') return;
    chart.dataset.tieBreakBound = '1';
    if (!Core._standingsTieBreakOpen) Core._standingsTieBreakOpen = Object.create(null);

    chart.addEventListener('click', function (e) {
        const toggle = e.target.closest('.chart-tie-break-toggle');
        if (!toggle || !chart.contains(toggle)) return;
        e.preventDefault();
        e.stopPropagation();

        const block = toggle.closest('.chart-tie-break');
        if (!block) return;
        const panel = block.querySelector('.chart-tie-break-panel');
        if (!panel) return;

        const key = block.dataset.tieKey || '';
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
        block.classList.toggle('is-open', open);
        if (key) {
            if (open) Core._standingsTieBreakOpen[key] = true;
            else delete Core._standingsTieBreakOpen[key];
        }
    });
};
/** Insert expand/collapse tie-break notes after each group of equal-points participants. */
Core.renderStandingsTieBreakers = function renderStandingsTieBreakers(chart, rows, goalStats) {
    if (!chart) return;
    chart.querySelectorAll('.chart-tie-break').forEach(el => el.remove());
    rows.forEach(row => row.classList.remove('chart-row--tied'));

    if (!Core._standingsTieBreakOpen) Core._standingsTieBreakOpen = Object.create(null);
    const formatPts = Core.formatStandingsPoints || function (v) { return String(v); };

    let i = 0;
    while (i < rows.length) {
        let j = i + 1;
        while (j < rows.length && rows[j]._points === rows[i]._points) j++;
        if (j - i < 2) {
            i = j;
            continue;
        }

        const group = rows.slice(i, j);
        group.forEach(row => row.classList.add('chart-row--tied'));

        const pts = rows[i]._points;
        const names = group.map(r => r._name);
        const tieKey = String(pts) + ':' + names.join('|');
        const open = !!Core._standingsTieBreakOpen[tieKey];

        const block = document.createElement('div');
        block.className = 'chart-tie-break' + (open ? ' is-open' : '');
        block.dataset.tieKey = tieKey;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'chart-tie-break-toggle';
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

        const icon = document.createElement('span');
        icon.className = 'chart-tie-break-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '▸';

        const label = document.createElement('span');
        label.className = 'chart-tie-break-label';
        label.textContent = 'Points tied at ' + formatPts(pts) +
            ' · ' + group.length + ' participants · tie-break applied';

        toggle.appendChild(icon);
        toggle.appendChild(label);

        const panel = document.createElement('div');
        panel.className = 'chart-tie-break-panel';
        panel.hidden = !open;

        const rules = document.createElement('p');
        rules.className = 'chart-tie-break-rules';
        rules.textContent = 'Tie-break order: goals scored (FT+ET) → goals conceded (FT+ET) → name (A–Z). Stats from supported teams.';
        panel.appendChild(rules);

        const list = document.createElement('ul');
        list.className = 'chart-tie-break-list';

        group.forEach((row, idx) => {
            const name = row._name;
            const gs = (goalStats && goalStats[name]) || { scored: 0, conceded: 0 };
            const li = document.createElement('li');
            li.className = 'chart-tie-break-item';

            const head = document.createElement('div');
            head.className = 'chart-tie-break-item-head';

            const who = document.createElement('strong');
            who.className = 'chart-tie-break-who';
            who.textContent = name;

            const stats = document.createElement('span');
            stats.className = 'chart-tie-break-stats';
            stats.textContent = 'GF ' + gs.scored + ' · GA ' + gs.conceded;

            head.appendChild(who);
            head.appendChild(stats);
            li.appendChild(head);

            if (idx < group.length - 1) {
                const below = group[idx + 1]._name;
                const reason = Core.explainStandingsTieBreak(name, below, goalStats);
                const why = document.createElement('p');
                why.className = 'chart-tie-break-why';
                why.textContent = 'Wins tie-break vs ' + below + ' — ' + reason.label +
                    (reason.criterion === 'name'
                        ? ''
                        : ' (' + reason.winnerValue + ' vs ' + reason.loserValue + ')');
                li.appendChild(why);
            }

            list.appendChild(li);
        });

        panel.appendChild(list);
        block.appendChild(toggle);
        block.appendChild(panel);

        const lastRow = group[group.length - 1];
        if (lastRow.nextSibling) {
            chart.insertBefore(block, lastRow.nextSibling);
        } else {
            chart.appendChild(block);
        }

        i = j;
    }
};
/** Snap all standings bars to 0 when leaving the Standings tab (re-animates on re-entry). */
Core.resetStandingsChartBars = function resetStandingsChartBars() {
    const chart = document.querySelector('#standings-points-chart')
        || document.querySelector('.standings-section .standings-chart:not(#goldenboot-chart)');
    if (!chart) return;

    if (Core.barSlideSectionVisible) Core.barSlideSectionVisible.set(chart, false);

    chart.querySelectorAll('.chart-bar').forEach(function (bar) {
        if (Core.barSlideVisible) Core.barSlideVisible.set(bar, false);
        if (typeof Core.resetBarSlide === 'function') {
            Core.resetBarSlide(bar);
        } else {
            bar.style.transition = 'none';
            bar.style.width = '0%';
            delete bar.dataset.barSlid;
        }
    });
};
Core.updateStandingsChart = function updateStandingsChart() {
    Core.updateStandingsPoints();

    const chart = document.querySelector('#standings-points-chart')
        || document.querySelector('.standings-section .standings-chart:not(#goldenboot-chart)');
    if (!chart) return;
    chart.querySelectorAll('.chart-tie-break').forEach(el => el.remove());
    const rows = Array.from(chart.querySelectorAll('.chart-row'));
    
    // Get points from each row (supports decimals e.g. shared side-quest points)
    rows.forEach(row => {
        const valueEl = row.querySelector('.chart-value');
        row._points = Core.roundStandingsPoints(parseFloat(valueEl?.textContent) || 0);
        row._name = row.querySelector('.chart-name')?.textContent.trim() || '';
    });

    const goalStats = Core.calculateParticipantGoalStats();
    const pointsByName = Object.fromEntries(rows.map(r => [r._name, r._points]));

    // Sort: points desc → goals scored (FT+ET) desc → goals conceded (FT+ET) asc → name
    rows.sort((a, b) => Core.compareStandingsParticipants(a._name, b._name, pointsByName, goalStats));

    const participantColors = (window.LEAGUE_DATA && window.LEAGUE_DATA.participantColors) || {};

    rows.forEach((row, index) => {
        chart.appendChild(row);
        row.classList.remove('top-1', 'rank-1', 'rank-2', 'rank-3', 'podium-place-1', 'podium-place-2', 'podium-place-3', 'chart-row--tied');
        row.style.removeProperty('--glow-color');
        const rank = index + 1;
        const rankEl = row.querySelector('.chart-rank');
        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
        if (rankEl) rankEl.textContent = medals[rank] || String(rank);
        if (rank <= 3) {
            row.classList.add('rank-' + rank, 'podium-place-' + rank);
            const bar = row.querySelector('.chart-bar');
            const color = participantColors[row._name]
                || (bar && bar.style.background)
                || '#3498db';
            row.style.setProperty('--glow-color', color);
        }
    });

    // Calculate max points for width scaling
    const maxPoints = Math.max(...rows.map(r => r._points), 1);

    // Update widths (0 points → empty bar)
    rows.forEach(row => {
        const bar = row.querySelector('.chart-bar');
        const pct = row._points > 0
            ? Math.max((row._points / maxPoints) * 100, 8)
            : 0;
        Core.slideDimension(bar, 'width', pct + '%');
    });

    Core.renderStandingsTieBreakers(chart, rows, goalStats);
    Core.bindStandingsAvatarClicks();
    Core.bindStandingsTieBreakToggles();
    if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(chart);
};
})(window.ArisanLeagueApp);
