/**
 * League detail — official group standings (team points, mathematical elimination, ties)
 */
(function (Core) {
'use strict';

Core.DEFAULT_GROUP_POINT_RULES = { win: 3, draw: 1, loss: 0 };

Core.getGroupPointRules = function getGroupPointRules() {
    const d = window.LEAGUE_DATA || {};
    const raw = d.groupPointRules || (d.settings && d.settings.groupPointRules) || {};
    const base = Core.DEFAULT_GROUP_POINT_RULES;
    return {
        win: raw.win != null ? Number(raw.win) : base.win,
        draw: raw.draw != null ? Number(raw.draw) : base.draw,
        loss: raw.loss != null ? Number(raw.loss) : base.loss,
    };
};

Core.getGroupTieResolutions = function getGroupTieResolutions() {
    const d = window.LEAGUE_DATA || {};
    const raw = d.groupTieResolutions || (d.settings && d.settings.groupTieResolutions) || {};
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
};

Core.getGroupDefinitionsForStandings = function getGroupDefinitionsForStandings() {
    const d = window.LEAGUE_DATA || {};
    const defs = d.groupDefinitions || (d.settings && d.settings.groupDefinitions) || [];
    return (defs || []).map(function (g, i) {
        const label = String((g && (g.label || g.name)) || String.fromCharCode(65 + i)).trim()
            || String.fromCharCode(65 + i);
        const teams = Array.isArray(g && g.teams)
            ? g.teams.map(function (t) {
                return typeof t === 'string' ? t.trim() : String((t && t.name) || '').trim();
            }).filter(Boolean)
            : [];
        const qualifyCount = g && g.qualifyCount != null
            ? Math.max(0, parseInt(g.qualifyCount, 10) || 0)
            : 2;
        return { label: label, teams: teams, qualifyCount: qualifyCount };
    }).filter(function (g) { return g.teams.length; });
};

Core.getGroupFixturesList = function getGroupFixturesList() {
    const d = window.LEAGUE_DATA || {};
    return d.groupFixtures || (d.settings && d.settings.groupFixtures) || [];
};

Core.emptyGroupTeamRow = function emptyGroupTeamRow(name) {
    return {
        name: name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
        remaining: 0,
        status: 'alive',
        statusLabel: '',
        rank: 0,
    };
};

Core.applyGroupMatchResult = function applyGroupMatchResult(rowA, rowB, goalsA, goalsB, rules) {
    rowA.played += 1;
    rowB.played += 1;
    rowA.gf += goalsA;
    rowA.ga += goalsB;
    rowB.gf += goalsB;
    rowB.ga += goalsA;
    if (goalsA > goalsB) {
        rowA.won += 1;
        rowB.lost += 1;
        rowA.pts += rules.win;
        rowB.pts += rules.loss;
    } else if (goalsA < goalsB) {
        rowB.won += 1;
        rowA.lost += 1;
        rowB.pts += rules.win;
        rowA.pts += rules.loss;
    } else {
        rowA.drawn += 1;
        rowB.drawn += 1;
        rowA.pts += rules.draw;
        rowB.pts += rules.draw;
    }
};

Core.getFinishedGroupMatchMap = function getFinishedGroupMatchMap() {
    const map = {};
    const finished = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.finishedMatches) || [];
    finished.forEach(function (m) {
        if (!m || !Core.isGroupMatchId(m.id)) return;
        if (m.status !== 'finished') return;
        map[m.id] = m;
    });
    return map;
};

/**
 * Official group standings per group.
 * Ranking by points only (no auto GD/H2H tie-break). Boundary ties need admin confirmation.
 * @returns {{ groups: Array, eliminatedTeamNames: string[] }}
 */
Core.calculateGroupStandings = function calculateGroupStandings() {
    const rules = Core.getGroupPointRules();
    const resolutions = Core.getGroupTieResolutions();
    const defs = Core.getGroupDefinitionsForStandings();
    const fixtures = Core.getGroupFixturesList();
    const finishedMap = Core.getFinishedGroupMatchMap();
    const teamsMeta = {};
    ((window.LEAGUE_DATA && window.LEAGUE_DATA.teams) || []).forEach(function (t) {
        if (t && t.name) teamsMeta[t.name] = t;
    });

    const eliminatedTeamNames = [];
    const groups = defs.map(function (def) {
        const byName = {};
        def.teams.forEach(function (name) {
            byName[name] = Core.emptyGroupTeamRow(name);
        });

        const groupFixtures = [];
        fixtures.forEach(function (f, index) {
            const gLabel = String((f && f.group) || '').trim();
            if (gLabel && gLabel !== def.label) return;
            const a = String((f && (f.a || f.teamA)) || '').trim();
            const b = String((f && (f.b || f.teamB)) || '').trim();
            if (!a || !b) return;
            if (!byName[a] || !byName[b]) return;
            const matchId = f.id || ('group-' + index);
            groupFixtures.push({ id: matchId, a: a, b: b, index: index });
        });

        // Fallback: if fixtures omit group label, infer from team membership only when both in group
        if (!groupFixtures.length) {
            fixtures.forEach(function (f, index) {
                const a = String((f && (f.a || f.teamA)) || '').trim();
                const b = String((f && (f.b || f.teamB)) || '').trim();
                if (!a || !b || !byName[a] || !byName[b]) return;
                groupFixtures.push({ id: f.id || ('group-' + index), a: a, b: b, index: index });
            });
        }

        const remainingByTeam = {};
        def.teams.forEach(function (n) { remainingByTeam[n] = 0; });

        groupFixtures.forEach(function (fx) {
            const match = finishedMap[fx.id];
            if (match) {
                const parts = Core.getMatchScoreParts(match);
                const goalsA = parts.ft[0] + parts.et[0];
                const goalsB = parts.ft[1] + parts.et[1];
                Core.applyGroupMatchResult(byName[fx.a], byName[fx.b], goalsA, goalsB, rules);
            } else {
                remainingByTeam[fx.a] += 1;
                remainingByTeam[fx.b] += 1;
            }
        });

        const rows = def.teams.map(function (name) {
            const row = byName[name];
            row.remaining = remainingByTeam[name] || 0;
            row.gd = row.gf - row.ga;
            const meta = teamsMeta[name];
            row.flag = meta && meta.flag ? String(meta.flag).toLowerCase() : '';
            return row;
        });

        // Rank by points desc; equal points share the same provisional band (stable by name)
        rows.sort(function (a, b) {
            if (b.pts !== a.pts) return b.pts - a.pts;
            return a.name.localeCompare(b.name);
        });

        const qualifyCount = Math.min(def.qualifyCount, rows.length);
        const winPts = Number(rules.win) || 0;

        // Mathematical elimination: Y is locked above X if Y.pts > X.pts + win * X.remaining
        rows.forEach(function (row) {
            let lockedAbove = 0;
            rows.forEach(function (other) {
                if (other.name === row.name) return;
                if (other.pts > row.pts + winPts * row.remaining) lockedAbove += 1;
            });
            row._lockedAbove = lockedAbove;
            row._mathEliminated = lockedAbove >= qualifyCount;
        });

        // Option 1: qualified / tie-waiting only after every match in this group is finished.
        const unfinishedCount = groupFixtures.filter(function (fx) { return !finishedMap[fx.id]; }).length;
        const groupComplete = groupFixtures.length > 0 && unfinishedCount === 0;

        // Boundary tie: equal points straddling the qualify cutoff (only once group is complete)
        const ptsAtCutoff = qualifyCount > 0 && rows[qualifyCount - 1]
            ? rows[qualifyCount - 1].pts
            : null;
        const boundaryTied = [];
        if (groupComplete && ptsAtCutoff != null && qualifyCount > 0) {
            const tiedAtPts = rows.filter(function (r) { return r.pts === ptsAtCutoff; });
            if (tiedAtPts.length > 1) {
                const firstIdx = rows.findIndex(function (r) { return r.pts === ptsAtCutoff; });
                const lastIdx = firstIdx + tiedAtPts.length - 1;
                if (firstIdx < qualifyCount && lastIdx >= qualifyCount) {
                    tiedAtPts.forEach(function (r) { boundaryTied.push(r.name); });
                }
            }
        }

        const resolutionOrder = Array.isArray(resolutions[def.label])
            ? resolutions[def.label].map(function (n) { return String(n || '').trim(); }).filter(Boolean)
            : [];
        const resolutionComplete = boundaryTied.length > 0
            && boundaryTied.every(function (n) { return resolutionOrder.indexOf(n) >= 0; })
            && resolutionOrder.filter(function (n) { return boundaryTied.indexOf(n) >= 0; }).length === boundaryTied.length;

        // Apply resolution order among boundary-tied teams for final ranking
        if (resolutionComplete) {
            const orderIndex = {};
            resolutionOrder.forEach(function (n, i) { orderIndex[n] = i; });
            rows.sort(function (a, b) {
                if (b.pts !== a.pts) return b.pts - a.pts;
                const ai = orderIndex[a.name];
                const bi = orderIndex[b.name];
                if (ai != null && bi != null) return ai - bi;
                if (ai != null) return -1;
                if (bi != null) return 1;
                return a.name.localeCompare(b.name);
            });
        }

        rows.forEach(function (row, idx) {
            row.rank = idx + 1;
            const inBoundary = boundaryTied.indexOf(row.name) >= 0;
            // Mathematical elimination can still show mid-group
            if (row._mathEliminated && !inBoundary) {
                row.status = 'eliminated';
                row.statusLabel = 'Eliminated';
                eliminatedTeamNames.push(row.name);
                return;
            }
            if (!groupComplete) {
                row.status = 'alive';
                row.statusLabel = '';
                return;
            }
            if (inBoundary) {
                if (resolutionComplete) {
                    if (row.rank > qualifyCount) {
                        row.status = 'eliminated';
                        row.statusLabel = 'tie, confirmed · Eliminated';
                        eliminatedTeamNames.push(row.name);
                    } else {
                        row.status = 'qualified';
                        row.statusLabel = 'tie, confirmed · Qualified';
                    }
                } else {
                    row.status = 'tie-waiting';
                    row.statusLabel = 'tie, waiting for confirmation';
                }
                return;
            }
            if (row.rank <= qualifyCount && qualifyCount > 0) {
                row.status = 'qualified';
                row.statusLabel = 'Qualified';
            } else if (row.rank > qualifyCount) {
                row.status = 'eliminated';
                row.statusLabel = 'Eliminated';
                eliminatedTeamNames.push(row.name);
            } else {
                row.status = 'alive';
                row.statusLabel = '';
            }
        });

        return {
            label: def.label,
            qualifyCount: qualifyCount,
            groupComplete: groupComplete,
            teams: rows,
            boundaryTied: boundaryTied,
            resolutionComplete: resolutionComplete,
            hasBoundaryTie: boundaryTied.length > 0,
        };
    });

    return { groups: groups, eliminatedTeamNames: eliminatedTeamNames };
};

Core.getMathematicallyEliminatedGroupTeams = function getMathematicallyEliminatedGroupTeams() {
    const result = Core.calculateGroupStandings();
    return result.eliminatedTeamNames || [];
};

Core.buildGroupStandingsHtml = function buildGroupStandingsHtml() {
    const result = Core.calculateGroupStandings();
    if (!result.groups.length) return '';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function flagHtml(row) {
        if (!row.flag) return '<span class="group-standings-flag-spacer" aria-hidden="true"></span>';
        const src = typeof Core.countryFlagSrc === 'function'
            ? Core.countryFlagSrc(row.flag)
            : ('https://flagcdn.com/w40/' + row.flag + '.png');
        return '<span class="flag-wave group-standings-flag-wave">' +
            '<img src="' + esc(src) + '" alt="" decoding="async">' +
            '</span>';
    }

    return result.groups.map(function (g) {
        const rows = g.teams.map(function (row) {
            const badge = row.statusLabel
                ? '<span class="group-standings-badge group-standings-badge--' + esc(row.status) + '">' +
                    esc(row.statusLabel) + '</span>'
                : '';
            return '<tr class="group-standings-row status-' + esc(row.status) + '">' +
                '<td class="gs-rank">' + row.rank + '</td>' +
                '<td class="gs-team">' + flagHtml(row) + '<span class="gs-team-name">' + esc(row.name) + '</span>' +
                badge + '</td>' +
                '<td class="gs-num">' + row.played + '</td>' +
                '<td class="gs-num">' + row.won + '</td>' +
                '<td class="gs-num">' + row.drawn + '</td>' +
                '<td class="gs-num">' + row.lost + '</td>' +
                '<td class="gs-num">' + (row.gd > 0 ? '+' : '') + row.gd + '</td>' +
                '<td class="gs-num gs-pts"><strong>' + row.pts + '</strong></td>' +
                '</tr>';
        }).join('');

        return '<div class="group-standings-card" data-group="' + esc(g.label) + '">' +
            '<h3 class="group-standings-title">Group ' + esc(g.label) +
            ' <span class="group-standings-qualify-hint">Top ' + g.qualifyCount + ' advance</span></h3>' +
            '<div class="group-standings-table-wrap"><table class="group-standings-table">' +
            '<thead><tr>' +
            '<th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }).join('');
};

Core.renderGroupStandings = function renderGroupStandings() {
    const root = document.getElementById('group-standings-root');
    if (!root) return;
    const d = window.LEAGUE_DATA || {};
    if (!d.includeGroupStage) {
        root.innerHTML = '';
        root.hidden = true;
        return;
    }
    const html = Core.buildGroupStandingsHtml();
    if (!html) {
        root.innerHTML = '';
        root.hidden = true;
        return;
    }
    root.hidden = false;
    root.innerHTML = html;
};

})(window.ArisanLeagueApp = window.ArisanLeagueApp || {});
