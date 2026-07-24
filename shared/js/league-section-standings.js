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

    // Bonus awards lain — hanya setelah Final selesai
    if (Core.isFinalResolved()) {
        Core.applyGoldenBootBonus(points);
        Core.applyGoldenGloveBonus(points);
        Core.applyTotalGoalBonus(points);
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
Core.updateStandingsChart = function updateStandingsChart() {
    Core.updateStandingsPoints();

    const chart = document.querySelector('#standings-points-chart')
        || document.querySelector('.standings-section .standings-chart:not(#goldenboot-chart)');
    if (!chart) return;
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
        row.classList.remove('top-1', 'rank-1', 'rank-2', 'rank-3', 'podium-place-1', 'podium-place-2', 'podium-place-3');
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
    if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(chart);
};
})(window.ArisanLeagueApp);
