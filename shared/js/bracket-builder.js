/**
 * Dynamic knockout bracket HTML from league setup data.
 */
window.ArisanBracket = (function () {
    const DEFAULT_CLUB_FLAG = 'https://img.icons8.com/ios-filled/50/6b7280/shield.png';
    const TBD_FLAG = DEFAULT_CLUB_FLAG;
    const TROPHY_IMG = 'https://png.pngtree.com/png-vector/20250923/ourmid/pngtree-the-fifa-world-cup-trophy-png-image_17551611.webp';

    function resolveTrophyImg(opts) {
        const url = opts && opts.trophyImageUrl;
        if (url && /^https?:\/\//i.test(String(url).trim())) return String(url).trim();
        return TROPHY_IMG;
    }

    const ROUND_META = [
        { count: 32, prefix: 'r32', css: 'round-r32', label: 'Round of 32' },
        { count: 16, prefix: 'r16', css: 'round-r16', label: 'Round of 16' },
        { count: 8, prefix: 'qf', css: 'round-qf', label: 'Quarter-finals' },
        { count: 4, prefix: 'sf', css: 'round-sf', label: 'Semi-finals' },
    ];

    function isPowerOfTwo(n) {
        return n > 0 && (n & (n - 1)) === 0;
    }

    /** Knockout plan for any team count ≥ 2 (handles byes when not power of 2). */
    function getFlexibleKnockoutPlan(teamCount) {
        const rounds = [];
        let entrants = teamCount;
        let idx = 0;
        while (entrants > 2) {
            const matchCount = Math.floor(entrants / 2);
            const byeCount = entrants % 2;
            rounds.push({
                prefix: 'ko-' + idx,
                css: 'round-ko',
                label: formatFlexibleRoundLabel(entrants, matchCount, idx),
                matchCount,
                byeCount,
                entrants,
                isSemifinal: matchCount === 2,
            });
            entrants = matchCount + byeCount;
            idx++;
        }
        return rounds;
    }

    function formatFlexibleRoundLabel(entrants, matchCount, idx) {
        if (matchCount === 2) return 'Semi-finals';
        if (matchCount === 4) return 'Quarter-finals';
        if (matchCount === 8) return 'Round of 16';
        if (matchCount === 16) return 'Round of 32';
        if (matchCount === 1) return 'Round ' + (idx + 1);
        return 'Round ' + (idx + 1) + ' (' + entrants + ' teams)';
    }

    function pairEntrantsForRound(entrants, byeCount) {
        const pairs = [];
        const start = byeCount ? 1 : 0;
        for (let i = start; i + 1 < entrants.length; i += 2) {
            pairs.push([entrants[i], entrants[i + 1]]);
        }
        return {
            pairs,
            byeEntrant: byeCount ? entrants[0] : null,
        };
    }

    function collectRoundWinners(pairs, roundPrefix, byeEntrant, finishedMatches, twoLeg) {
        const winners = [];
        if (byeEntrant) winners.push(byeEntrant);
        pairs.forEach(([teamA, teamB], i) => {
            const tieId = roundPrefix + '-' + i;
            const winner = resolveSlotWinner(tieId, teamA, teamB, finishedMatches, twoLeg);
            winners.push(winner || null);
        });
        return winners;
    }

    function buildFlexibleRoundHtml(round, competitionType, pairs, twoLeg) {
        let html = '<div class="round ' + round.css + '" data-bracket-chain="1"' +
            ' data-ko-round="' + esc(round.prefix) + '"' +
            ' data-ko-byes="' + round.byeCount + '"' +
            (round.isSemifinal ? ' data-semifinal-round="true"' : '') + '>' +
            '<div class="round-header">' + round.label + '</div><div class="round-matches">';
        for (let i = 0; i < round.matchCount; i++) {
            const tieId = round.prefix + '-' + i;
            const pair = pairs && pairs[i];
            html += pair
                ? buildSlotHtml(tieId, pair[0], pair[1], competitionType, twoLeg)
                : buildSlotHtml(tieId, null, null, competitionType, twoLeg);
        }
        html += '</div></div>';
        return html;
    }

    function normalizeBracketTeamList(teams) {
        return (teams || []).map(t => {
            if (!t) return { name: '', flag: '' };
            const name = String(t.name || '').trim();
            if (!name || name.toUpperCase() === 'TBD') return { name: '', flag: '' };
            return { name, flag: t.flag || '' };
        });
    }

    function simulateFlexibleKnockoutCatalog(opts) {
        const teams = normalizeBracketTeamList(opts.teams);
        const n = teams.length;
        const twoLeg = !!opts.twoLegKnockout;
        const finishedMatches = opts.finishedMatches || [];
        const plan = getFlexibleKnockoutPlan(n);
        if (!plan.length) return { catalog: [], semifinalPairs: [] };

        const catalog = [];
        const firstPairs = buildFirstRoundPairs(teams);
        let entrants = [];
        let semifinalPairs = [];
        let semifinalPrefix = null;

        plan.forEach((round, ri) => {
            const flat = [];
            if (ri === 0) {
                round.matchCount = firstPairs.length;
                for (let i = 0; i < firstPairs.length; i++) {
                    const tieId = round.prefix + '-' + i;
                    const teamA = firstPairs[i][0];
                    const teamB = firstPairs[i][1];
                    catalog.push(...catalogEntriesForTie(
                        tieId, round.label, teamA && teamA.name, teamB && teamB.name, twoLeg
                    ));
                    flat.push(resolveSlotWinner(tieId, teamA, teamB, finishedMatches, twoLeg));
                }
            } else {
                const teamEntrants = entrants.filter(Boolean);
                const { pairs, byeEntrant } = pairEntrantsForRound(teamEntrants, round.byeCount);
                if (round.isSemifinal) {
                    semifinalPairs = pairs.slice();
                    semifinalPrefix = round.prefix;
                }
                pairs.forEach(([teamA, teamB], i) => {
                    const tieId = round.prefix + '-' + i;
                    catalog.push(...catalogEntriesForTie(
                        tieId, round.label, teamA && teamA.name, teamB && teamB.name, twoLeg
                    ));
                });
                if (byeEntrant) flat.push(byeEntrant);
                pairs.forEach(([teamA, teamB], i) => {
                    const tieId = round.prefix + '-' + i;
                    flat.push(resolveSlotWinner(tieId, teamA, teamB, finishedMatches, twoLeg));
                });
            }
            entrants = flat;
        });

        return { catalog, semifinalPairs, semifinalPrefix, finalTeams: entrants };
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function parseMatchId(matchId) {
        const m = String(matchId || '').match(/^(.+)-leg([12])$/);
        if (m) return { tieId: m[1], leg: parseInt(m[2], 10) };
        return { tieId: matchId, leg: null };
    }

    function legMatchId(tieId, leg) {
        return tieId + '-leg' + leg;
    }

    function getMatchScorePartsFromConfig(match) {
        if (typeof getMatchScoreParts === 'function') {
            return getMatchScoreParts(match);
        }
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
        return { ft: [0, 0], et: [0, 0] };
    }

    function resolveFinishedWinnerIndexLocal(match) {
        if (typeof resolveFinishedWinnerIndex === 'function') {
            return resolveFinishedWinnerIndex(match);
        }
        const parts = getMatchScorePartsFromConfig(match);
        const total0 = parts.ft[0] + parts.et[0];
        const total1 = parts.ft[1] + parts.et[1];
        if (total0 > total1) return 0;
        if (total1 > total0) return 1;
        return null;
    }

    /**
     * Aggregate winner for a two-leg tie. Uses sum of (FT+ET) per leg.
     */
    function resolveTieWinner(tieId, finishedMatches) {
        const matches = finishedMatches || [];
        const leg1 = matches.find(m => m.id === legMatchId(tieId, 1));
        const leg2 = matches.find(m => m.id === legMatchId(tieId, 2));
        const leg1Done = leg1 && (leg1.status || 'finished') === 'finished';
        const leg2Done = leg2 && (leg2.status || 'finished') === 'finished';

        let agg0 = 0;
        let agg1 = 0;

        [leg1, leg2].forEach(leg => {
            if (!leg || (leg.status || 'finished') !== 'finished') return;
            const parts = getMatchScorePartsFromConfig(leg);
            agg0 += parts.ft[0] + parts.et[0];
            agg1 += parts.ft[1] + parts.et[1];
        });

        let winnerIdx = null;
        if (leg1Done && leg2Done) {
            if (agg0 > agg1) winnerIdx = 0;
            else if (agg1 > agg0) winnerIdx = 1;
        }

        return {
            tieId,
            agg0,
            agg1,
            winnerIdx,
            legsComplete: leg1Done && leg2Done,
            leg1Done,
            leg2Done,
        };
    }

    function resolveTeamFlagUrl(team, competitionType) {
        if (!team) return TBD_FLAG;
        const flag = team.flag || '';
        if (competitionType === 'club') {
            if (/^https?:\/\//i.test(flag)) return flag;
            if (flag) return flag;
            return DEFAULT_CLUB_FLAG;
        }
        if (typeof ArisanCountries !== 'undefined') {
            const url = ArisanCountries.resolveFlagUrl(flag) || ArisanCountries.getFlagUrl(team.name);
            if (url) return url;
        }
        if (/^https?:\/\//i.test(flag)) return flag;
        return TBD_FLAG;
    }

    function teamCellHtml(team, competitionType) {
        if (!team || !team.name) {
            return '<div class="team">' +
                '<span class="team-flag is-tbd"><img src="' + TBD_FLAG + '" alt="TBD" style="opacity:0.4"></span>' +
                '<span class="team-name">TBD</span></div>';
        }
        const url = resolveTeamFlagUrl(team, competitionType);
        const alt = esc(team.name).slice(0, 3).toUpperCase();
        return '<div class="team">' +
            '<span class="team-flag"><img src="' + esc(url) + '" alt="' + alt + '"></span>' +
            '<span class="team-name">' + esc(team.name) + '</span></div>';
    }

    function matchupHtml(matchId, teamA, teamB, competitionType, legLabel) {
        const legHint = legLabel
            ? '<div class="matchup-leg-label">' + esc(legLabel) + '</div>'
            : '';
        return '<div class="matchup tbd" data-match-id="' + esc(matchId) + '">' +
            legHint +
            '<div class="matchup-date"></div>' +
            teamCellHtml(teamA, competitionType) +
            teamCellHtml(teamB, competitionType) +
            '</div>';
    }

    function tbdMatchupHtml(matchId, legLabel) {
        return matchupHtml(matchId, null, null, 'country', legLabel);
    }

    function tieHtml(tieId, teamA, teamB, competitionType) {
        return '<div class="matchup-tie" data-tie-id="' + esc(tieId) + '">' +
            matchupHtml(legMatchId(tieId, 1), teamA, teamB, competitionType, 'Leg 1') +
            matchupHtml(legMatchId(tieId, 2), teamA, teamB, competitionType, 'Leg 2') +
            '<div class="tie-aggregate">Total: <span class="tie-aggregate-score">—</span></div>' +
            '</div>';
    }

    function buildSlotHtml(tieId, teamA, teamB, competitionType, twoLeg) {
        if (twoLeg) {
            if (teamA && teamB) return tieHtml(tieId, teamA, teamB, competitionType);
            return '<div class="matchup-tie" data-tie-id="' + esc(tieId) + '">' +
                tbdMatchupHtml(legMatchId(tieId, 1), 'Leg 1') +
                tbdMatchupHtml(legMatchId(tieId, 2), 'Leg 2') +
                '<div class="tie-aggregate">Total: <span class="tie-aggregate-score">—</span></div></div>';
        }
        if (teamA && teamB) return matchupHtml(tieId, teamA, teamB, competitionType);
        return tbdMatchupHtml(tieId);
    }

    function getRoundPlan(teamCount) {
        const start = ROUND_META.find(r => r.count === teamCount);
        if (!start) return null;
        const idx = ROUND_META.indexOf(start);
        return ROUND_META.slice(idx);
    }

    function buildRoundHtml(round, matchCount, competitionType, teamsByMatch, twoLeg) {
        let html = '<div class="round ' + round.css + '" data-bracket-chain="1">' +
            '<div class="round-header">' + round.label + '</div><div class="round-matches">';
        for (let i = 0; i < matchCount; i++) {
            const tieId = round.prefix + '-' + i;
            const pair = teamsByMatch && teamsByMatch[i];
            html += pair
                ? buildSlotHtml(tieId, pair[0], pair[1], competitionType, twoLeg)
                : buildSlotHtml(tieId, null, null, competitionType, twoLeg);
        }
        html += '</div></div>';
        return html;
    }

    function buildFirstRoundPairs(teams) {
        const pairs = [];
        for (let i = 0; i < teams.length; i += 2) {
            pairs.push([teams[i] || null, teams[i + 1] || null]);
        }
        return pairs;
    }

    function catalogEntriesForTie(tieId, roundLabel, teamA, teamB, twoLeg) {
        const a = teamA || 'TBD';
        const b = teamB || 'TBD';
        if (!twoLeg) {
            return [{ id: tieId, label: roundLabel + ' — ' + a + ' vs ' + b }];
        }
        return [
            { id: legMatchId(tieId, 1), tieId, leg: 1, label: roundLabel + ' — ' + a + ' vs ' + b + ' (Leg 1)' },
            { id: legMatchId(tieId, 2), tieId, leg: 2, label: roundLabel + ' — ' + b + ' vs ' + a + ' (Leg 2)' },
        ];
    }

    function buildBracketHtml(opts) {
        const teams = normalizeBracketTeamList(opts.teams);
        const n = teams.length;
        const competitionType = opts.competitionType || 'country';
        const includeThirdPlace = opts.includeThirdPlace !== false;
        const twoLeg = !!opts.twoLegKnockout;
        const trophyImg = resolveTrophyImg(opts);

        if (n === 2) {
            const slot = buildSlotHtml('final-0', teams[0], teams[1], competitionType, twoLeg);
            return '<div class="round round-final" data-bracket-chain="1">' +
                '<div class="round-header">Final</div>' +
                '<div class="final-match-row">' +
                '<div class="round-matches">' + slot + '</div>' +
                '<div class="round-trophy"><img src="' + trophyImg + '" alt="Trophy"></div>' +
                '</div></div>';
        }

        if (!isPowerOfTwo(n)) {
            const plan = getFlexibleKnockoutPlan(n);
            const firstPairs = buildFirstRoundPairs(teams);
            let html = '';

            plan.forEach((round, ri) => {
                if (ri === 0) {
                    round.matchCount = firstPairs.length;
                    html += buildFlexibleRoundHtml(round, competitionType, firstPairs, twoLeg);
                } else {
                    html += buildFlexibleRoundHtml(round, competitionType, null, twoLeg);
                }
            });

            if (includeThirdPlace) {
                html += '<div class="round round-3rd">' +
                    '<div class="round-header">Third Place</div>' +
                    '<div class="round-matches">' +
                    buildSlotHtml('third-0', null, null, competitionType, twoLeg) +
                    '</div></div>';
            }

            html += '<div class="round round-final" data-bracket-chain="1">' +
                '<div class="round-header">Final</div>' +
                '<div class="final-match-row">' +
                '<div class="round-matches">' +
                buildSlotHtml('final-0', null, null, competitionType, twoLeg) +
                '</div>' +
                '<div class="round-trophy"><img src="' + trophyImg + '" alt="Trophy"></div>' +
                '</div></div>';
            return html;
        }

        const plan = getRoundPlan(n);
        if (!plan) {
            return '<p class="bracket-error">At least 2 teams are required. Current: ' + n + '</p>';
        }

        const firstPairs = buildFirstRoundPairs(teams);
        let html = '';

        plan.forEach((round, ri) => {
            const matchCount = round.count / 2;
            html += ri === 0
                ? buildRoundHtml(round, matchCount, competitionType, firstPairs, twoLeg)
                : buildRoundHtml(round, matchCount, competitionType, null, twoLeg);
        });

        if (includeThirdPlace) {
            html += '<div class="round round-3rd">' +
                '<div class="round-header">Third Place</div>' +
                '<div class="round-matches">' +
                buildSlotHtml('third-0', null, null, competitionType, twoLeg) +
                '</div></div>';
        }

        html += '<div class="round round-final" data-bracket-chain="1">' +
            '<div class="round-header">Final</div>' +
            '<div class="final-match-row">' +
            '<div class="round-matches">' +
            buildSlotHtml('final-0', null, null, competitionType, twoLeg) +
            '</div>' +
            '<div class="round-trophy"><img src="' + trophyImg + '" alt="Trophy"></div>' +
            '</div></div>';

        return html;
    }

    function matchByIdMap(finishedMatches) {
        const map = Object.create(null);
        (finishedMatches || []).forEach(m => {
            if (m && m.id) map[m.id] = m;
        });
        return map;
    }

    function resolveSlotWinner(tieId, teamA, teamB, finishedMatches, twoLeg) {
        if (twoLeg) {
            const result = resolveTieWinner(tieId, finishedMatches);
            if (result.winnerIdx === 0) return teamA || null;
            if (result.winnerIdx === 1) return teamB || null;
            return null;
        }
        const match = matchByIdMap(finishedMatches)[tieId];
        if (!match || (match.status || 'finished') !== 'finished') return null;
        let idx = match.winner;
        if (idx !== 0 && idx !== 1) idx = resolveFinishedWinnerIndexLocal(match);
        if (idx === 0) return teamA || null;
        if (idx === 1) return teamB || null;
        return null;
    }

    function resolveSlotLoser(tieId, teamA, teamB, finishedMatches, twoLeg) {
        const winner = resolveSlotWinner(tieId, teamA, teamB, finishedMatches, twoLeg);
        if (!winner) return null;
        if (teamA && winner === teamA) return teamB || null;
        if (teamB && winner === teamB) return teamA || null;
        return null;
    }

    /**
     * Single round-robin: every team plays every other team once.
     * n teams → n*(n-1)/2 matches.
     */
    function buildRoundRobinFixtures(teamNames, groupLabel) {
        const names = (teamNames || []).map(n => String(n || '').trim()).filter(Boolean);
        const fixtures = [];
        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                fixtures.push({
                    a: names[i],
                    b: names[j],
                    group: groupLabel ? String(groupLabel) : '',
                });
            }
        }
        return fixtures;
    }

    function normalizeGroupDefinitions(raw) {
        if (!Array.isArray(raw)) return [];
        return raw.map((g, i) => ({
            label: String((g && (g.label || g.name)) || String.fromCharCode(65 + i)).trim() || String.fromCharCode(65 + i),
            teams: Array.isArray(g && g.teams)
                ? g.teams.map(t => {
                    if (typeof t === 'string') return t.trim();
                    return String((t && t.name) || '').trim();
                }).filter(Boolean)
                : [],
        })).filter(g => g.teams.length);
    }

    function fixturesFromGroupDefinitions(defs) {
        const out = [];
        normalizeGroupDefinitions(defs).forEach(g => {
            out.push(...buildRoundRobinFixtures(g.teams, g.label));
        });
        return out;
    }

    /** Recover group membership from fixture list (connected components). */
    function inferGroupDefinitionsFromFixtures(fixtures) {
        const list = (fixtures || []).map((f, index) => ({
            index,
            explicitGroup: String((f && (f.group || f.groupLabel)) || '').trim(),
            a: String((f && (f.a || f.teamA)) || '').trim(),
            b: String((f && (f.b || f.teamB)) || '').trim(),
        })).filter(f => f.a || f.b);

        if (!list.length) return [];

        if (list.every(f => f.explicitGroup)) {
            const by = new Map();
            list.forEach(f => {
                if (!by.has(f.explicitGroup)) by.set(f.explicitGroup, new Set());
                if (f.a) by.get(f.explicitGroup).add(f.a);
                if (f.b) by.get(f.explicitGroup).add(f.b);
            });
            return Array.from(by.entries()).map(([label, set]) => ({
                label,
                teams: Array.from(set),
            }));
        }

        const parent = new Map();
        function find(x) {
            if (!parent.has(x)) parent.set(x, x);
            if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
            return parent.get(x);
        }
        function union(a, b) {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent.set(ra, rb);
        }
        list.forEach(f => {
            if (f.a && f.b) union(f.a, f.b);
            else if (f.a) find(f.a);
            else if (f.b) find(f.b);
        });

        const buckets = new Map();
        const order = [];
        list.forEach(f => {
            const root = f.a ? find(f.a) : find(f.b);
            if (!buckets.has(root)) {
                buckets.set(root, new Set());
                order.push(root);
            }
            if (f.a) buckets.get(root).add(f.a);
            if (f.b) buckets.get(root).add(f.b);
        });

        return order.map((root, i) => ({
            label: String.fromCharCode(65 + i),
            teams: Array.from(buckets.get(root)),
        }));
    }

    function resolveGroupPairs(opts) {
        const defs = normalizeGroupDefinitions(opts.groupDefinitions);
        let fixtures = Array.isArray(opts.groupFixtures) ? opts.groupFixtures : [];
        if (defs.length) {
            fixtures = fixturesFromGroupDefinitions(defs);
        }
        const teams = (opts.teams || []).filter(t => t && t.name);
        const byName = new Map();
        teams.forEach(t => {
            if (!byName.has(t.name)) byName.set(t.name, t);
        });

        if (fixtures.length) {
            return fixtures.map((f, index) => {
                const aName = String((f && (f.a || f.teamA)) || '').trim();
                const bName = String((f && (f.b || f.teamB)) || '').trim();
                const explicit = String((f && (f.group || f.groupLabel)) || '').trim();
                return {
                    index,
                    explicitGroup: explicit,
                    pair: [
                        byName.get(aName) || (aName ? { name: aName, flag: '' } : null),
                        byName.get(bName) || (bName ? { name: bName, flag: '' } : null),
                    ],
                };
            });
        }
        return buildFirstRoundPairs(teams).map((pair, index) => ({
            index,
            explicitGroup: '',
            pair,
        }));
    }

    /** Split fixtures into Group A/B/… via connected components (or explicit fixture.group). */
    function partitionGroupMatches(entries) {
        const list = entries || [];
        if (!list.length) return [];

        const allExplicit = list.every(e => e.explicitGroup);
        if (allExplicit) {
            const byGroup = new Map();
            list.forEach(e => {
                const key = e.explicitGroup;
                if (!byGroup.has(key)) byGroup.set(key, []);
                byGroup.get(key).push(e);
            });
            return Array.from(byGroup.entries())
                .map(([label, matches]) => ({ label, matches }))
                .sort((a, b) => String(a.label).localeCompare(String(b.label)));
        }

        const parent = new Map();
        function find(x) {
            if (!parent.has(x)) parent.set(x, x);
            if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
            return parent.get(x);
        }
        function union(a, b) {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent.set(ra, rb);
        }

        list.forEach(e => {
            const a = e.pair[0] && e.pair[0].name;
            const b = e.pair[1] && e.pair[1].name;
            if (a && b) union(a, b);
            else if (a) find(a);
            else if (b) find(b);
        });

        const buckets = new Map();
        const order = [];
        list.forEach(e => {
            const a = e.pair[0] && e.pair[0].name;
            const b = e.pair[1] && e.pair[1].name;
            const root = a ? find(a) : (b ? find(b) : ('orphan-' + e.index));
            if (!buckets.has(root)) {
                buckets.set(root, []);
                order.push(root);
            }
            buckets.get(root).push(e);
        });

        // Only label A/B/C when there are 2+ real groups (typical AFF / World Cup groups).
        if (order.length < 2) {
            return [{ label: '', matches: list }];
        }

        return order.map((root, i) => ({
            label: String.fromCharCode(65 + i), // A, B, C…
            matches: buckets.get(root),
        }));
    }

    function groupMatchupHtml(matchId, teamA, teamB, competitionType, groupLabel) {
        return '<div class="matchup tbd" data-match-id="' + esc(matchId) + '"' +
            (groupLabel ? ' data-group="' + esc(groupLabel) + '"' : '') + '>' +
            '<div class="matchup-date"></div>' +
            teamCellHtml(teamA, competitionType) +
            teamCellHtml(teamB, competitionType) +
            '</div>';
    }

    function scheduleTextToSortMs(text, leagueYear) {
        const raw = normalizeScheduleDisplay(text, leagueYear);
        if (!raw) return Number.POSITIVE_INFINITY;
        let m = raw.match(/^(?:\w+,\s*)?(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
        if (m) {
            const monthIndex = MONTH_INDEX[m[2].toLowerCase()];
            if (monthIndex === undefined) return Number.POSITIVE_INFINITY;
            return Date.UTC(
                leagueYear || new Date().getFullYear(),
                monthIndex,
                parseInt(m[1], 10),
                parseInt(m[3], 10) - 7,
                parseInt(m[4], 10)
            );
        }
        m = raw.match(/^(?:\w+,\s*)?(\d{1,2})\/(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
        if (m) {
            return Date.UTC(
                leagueYear || new Date().getFullYear(),
                parseInt(m[1], 10) - 1,
                parseInt(m[2], 10),
                parseInt(m[3], 10) - 7,
                parseInt(m[4], 10)
            );
        }
        return Number.POSITIVE_INFINITY;
    }

    function sortGroupEntriesBySchedule(entries, schedule, leagueYear) {
        const year = leagueYear || new Date().getFullYear();
        const sched = schedule || {};
        return (entries || []).slice().sort((a, b) => {
            const msA = scheduleTextToSortMs(sched['group-' + a.index], year);
            const msB = scheduleTextToSortMs(sched['group-' + b.index], year);
            if (msA !== msB) return msA - msB;
            return a.index - b.index;
        });
    }

    function sortGroupStageMatchupsInDom(leagueYear) {
        const year = leagueYear ||
            (window.LEAGUE_DATA && window.LEAGUE_DATA.year) ||
            new Date().getFullYear();
        document.querySelectorAll(
            '.group-column .round-matches, .round-group.group-stage-flat .group-matches-grid'
        ).forEach(container => {
            const matchups = Array.from(container.querySelectorAll(':scope > .matchup'));
            if (matchups.length < 2) return;
            matchups.sort((a, b) => {
                const da = a.querySelector('.matchup-date');
                const db = b.querySelector('.matchup-date');
                const ta = da ? (da.dataset.scheduleDate || da.textContent || '') : '';
                const tb = db ? (db.dataset.scheduleDate || db.textContent || '') : '';
                const msA = scheduleTextToSortMs(ta, year);
                const msB = scheduleTextToSortMs(tb, year);
                if (msA !== msB) return msA - msB;
                const ia = parseInt(String(a.dataset.matchId || '').replace('group-', ''), 10) || 0;
                const ib = parseInt(String(b.dataset.matchId || '').replace('group-', ''), 10) || 0;
                return ia - ib;
            });
            matchups.forEach(m => container.appendChild(m));
        });
    }

    function buildGroupMatchCatalog(opts) {
        const entries = resolveGroupPairs(opts);
        const partitions = partitionGroupMatches(entries);
        const catalog = [];
        partitions.forEach(part => {
            part.matches.forEach((entry, mi) => {
                const pair = entry.pair;
                const prefix = part.label ? ('Group ' + part.label) : 'Group';
                catalog.push({
                    id: 'group-' + entry.index,
                    label: prefix + ' — ' + (pair[0]?.name || 'TBD') + ' vs ' + (pair[1]?.name || 'TBD'),
                });
            });
        });
        // Keep catalog in original fixture order for schedule/admin stability.
        catalog.sort((a, b) => {
            const ia = parseInt(String(a.id).replace('group-', ''), 10);
            const ib = parseInt(String(b.id).replace('group-', ''), 10);
            return ia - ib;
        });
        return catalog;
    }

    function buildGroupStageHtml(opts) {
        const competitionType = opts.competitionType || 'country';
        const defs = normalizeGroupDefinitions(opts.groupDefinitions);
        const entries = resolveGroupPairs(opts);
        if (!entries.length) return '';

        const schedule = opts.matchSchedule || {};
        const year = opts.leagueYear ||
            (window.LEAGUE_DATA && window.LEAGUE_DATA.year) ||
            new Date().getFullYear();

        let partitions;
        if (defs.length >= 2) {
            // Prefer explicit setup groups so every defined group gets its own column
            partitions = defs.map((g) => {
                const teamSet = new Set(g.teams || []);
                const matches = entries.filter((e) => {
                    if (e.explicitGroup) {
                        return String(e.explicitGroup).trim().toUpperCase() === String(g.label).trim().toUpperCase();
                    }
                    const a = e.pair[0] && e.pair[0].name;
                    const b = e.pair[1] && e.pair[1].name;
                    return (a && teamSet.has(a)) || (b && teamSet.has(b));
                });
                return { label: g.label, matches: matches };
            }).filter((p) => p.matches.length);
        } else {
            partitions = partitionGroupMatches(entries);
        }

        // Stable A→B→C order when labels are letters
        partitions = partitions.slice().sort((a, b) => String(a.label).localeCompare(String(b.label)));

        const multiGroup = partitions.length > 1 && partitions.every(p => p.label);

        let html = '<div class="round round-group' + (multiGroup ? ' group-stage-board' : ' group-stage-flat') + '">';

        if (multiGroup) {
            html += '<div class="group-stage-columns">';
            partitions.forEach((part, partIndex) => {
                const tone = partIndex % 8;
                const sorted = sortGroupEntriesBySchedule(part.matches, schedule, year);
                html += '<div class="group-column group-tone-' + tone + '" data-group="' + esc(part.label) + '">' +
                    '<div class="group-column-header">Group ' + esc(part.label) + '</div>' +
                    '<div class="round-matches">';
                sorted.forEach(entry => {
                    html += groupMatchupHtml(
                        'group-' + entry.index,
                        entry.pair[0],
                        entry.pair[1],
                        competitionType,
                        part.label
                    );
                });
                html += '</div></div>';
            });
            html += '</div>';
        } else {
            html += '<div class="round-matches group-matches-grid">';
            sortGroupEntriesBySchedule(entries, schedule, year).forEach(entry => {
                html += groupMatchupHtml(
                    'group-' + entry.index,
                    entry.pair[0],
                    entry.pair[1],
                    competitionType,
                    partitions[0] && partitions[0].label ? partitions[0].label : ''
                );
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function buildKnockoutMatchCatalog(opts) {
        const teams = normalizeBracketTeamList(opts.teams);
        const n = teams.length;
        const twoLeg = !!opts.twoLegKnockout;
        const finishedMatches = opts.finishedMatches || [];

        if (n === 2) {
            return catalogEntriesForTie('final-0', 'Final', teams[0].name, teams[1].name, twoLeg);
        }

        if (!isPowerOfTwo(n)) {
            const sim = simulateFlexibleKnockoutCatalog(opts);
            const catalog = sim.catalog.slice();

            if (opts.includeThirdPlace !== false) {
                let thirdA = null;
                let thirdB = null;
                if (sim.semifinalPairs.length >= 2 && sim.semifinalPrefix) {
                    thirdA = resolveSlotLoser(
                        sim.semifinalPrefix + '-0',
                        sim.semifinalPairs[0][0], sim.semifinalPairs[0][1],
                        finishedMatches, twoLeg
                    );
                    thirdB = resolveSlotLoser(
                        sim.semifinalPrefix + '-1',
                        sim.semifinalPairs[1][0], sim.semifinalPairs[1][1],
                        finishedMatches, twoLeg
                    );
                }
                catalog.push(...catalogEntriesForTie(
                    'third-0', 'Third Place',
                    thirdA && thirdA.name, thirdB && thirdB.name, twoLeg
                ));
            }

            const ft = sim.finalTeams || [];
            catalog.push(...catalogEntriesForTie(
                'final-0', 'Final',
                ft[0] && ft[0].name, ft[1] && ft[1].name, twoLeg
            ));
            return catalog;
        }

        const plan = getRoundPlan(n);
        if (!plan) return [];

        const catalog = [];
        const firstPairs = buildFirstRoundPairs(teams);
        let prevWinners = [];
        let sfPairs = [];

        plan.forEach((round, ri) => {
            const matchCount = round.count / 2;
            const winners = new Array(matchCount).fill(null);
            const pairs = [];

            for (let i = 0; i < matchCount; i++) {
                const tieId = round.prefix + '-' + i;
                let teamA = null;
                let teamB = null;
                if (ri === 0) {
                    teamA = firstPairs[i] ? firstPairs[i][0] : null;
                    teamB = firstPairs[i] ? firstPairs[i][1] : null;
                } else {
                    teamA = prevWinners[i * 2] || null;
                    teamB = prevWinners[i * 2 + 1] || null;
                }
                pairs.push([teamA, teamB]);
                catalog.push(...catalogEntriesForTie(
                    tieId,
                    round.label,
                    teamA && teamA.name,
                    teamB && teamB.name,
                    twoLeg
                ));
                winners[i] = resolveSlotWinner(tieId, teamA, teamB, finishedMatches, twoLeg);
            }

            if (round.prefix === 'sf') sfPairs = pairs;
            prevWinners = winners;
        });

        if (opts.includeThirdPlace !== false) {
            let thirdA = null;
            let thirdB = null;
            if (sfPairs.length >= 2) {
                thirdA = resolveSlotLoser('sf-0', sfPairs[0][0], sfPairs[0][1], finishedMatches, twoLeg);
                thirdB = resolveSlotLoser('sf-1', sfPairs[1][0], sfPairs[1][1], finishedMatches, twoLeg);
            }
            catalog.push(...catalogEntriesForTie(
                'third-0',
                'Third Place',
                thirdA && thirdA.name,
                thirdB && thirdB.name,
                twoLeg
            ));
        }

        catalog.push(...catalogEntriesForTie(
            'final-0',
            'Final',
            prevWinners[0] && prevWinners[0].name,
            prevWinners[1] && prevWinners[1].name,
            twoLeg
        ));
        return catalog;
    }

    function buildMatchCatalog(opts) {
        const includeGroup = opts.includeGroupStage !== false && !!opts.includeGroupStage;
        const includeKnockout = opts.includeKnockoutStage !== false;
        const catalog = [];

        if (includeGroup) {
            catalog.push(...buildGroupMatchCatalog(opts));
        }
        if (includeKnockout) {
            catalog.push(...buildKnockoutMatchCatalog(opts));
        }
        return catalog;
    }

    function updateTieAggregates(finishedMatches) {
        document.querySelectorAll('.matchup-tie').forEach(tieEl => {
            const tieId = tieEl.dataset.tieId;
            if (!tieId) return;
            const result = resolveTieWinner(tieId, finishedMatches);
            const scoreEl = tieEl.querySelector('.tie-aggregate-score');
            if (!scoreEl) return;
            if (result.leg1Done || result.leg2Done) {
                scoreEl.textContent = result.agg0 + ' – ' + result.agg1;
            } else {
                scoreEl.textContent = '—';
            }
            tieEl.classList.toggle('tie-resolved', result.legsComplete && result.winnerIdx !== null);
        });
    }

    function mountBracket(container, opts) {
        if (!container) return;
        container.innerHTML = buildBracketHtml(opts);
    }

    function mountGroupStage(container, opts) {
        if (!container) return;
        container.innerHTML = buildGroupStageHtml(opts);
    }

    const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MONTH_INDEX = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
        jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        januari: 0, februari: 1, maret: 2, mei: 4, juni: 5,
        juli: 6, agustus: 7, oktober: 9, desember: 11,
    };

    function formatScheduleParts(year, monthIndex, day, hour, minute) {
        const wd = WEEKDAY_SHORT[new Date(Date.UTC(year, monthIndex, day)).getUTCDay()];
        return wd + ', ' + day + ' ' + MONTH_SHORT[monthIndex] + ', ' +
            String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ' WIB';
    }

    function formatScheduleWIB(ms) {
        const d = new Date(ms);
        let hour = d.getUTCHours() + 7;
        let day = d.getUTCDate();
        let month = d.getUTCMonth();
        let year = d.getUTCFullYear();
        if (hour >= 24) {
            hour -= 24;
            const nd = new Date(Date.UTC(year, month, day + 1));
            day = nd.getUTCDate();
            month = nd.getUTCMonth();
            year = nd.getUTCFullYear();
        }
        return formatScheduleParts(year, month, day, hour, d.getUTCMinutes());
    }

    /** Normalize any stored schedule string to `Tue, 30 Jun, 08:00 WIB`. */
    function normalizeScheduleDisplay(text, leagueYear) {
        const raw = String(text || '').replace(/^✅\s*/, '').trim();
        if (!raw) return '';
        const year = leagueYear || new Date().getFullYear();

        let m = raw.match(/^(?:\w+,\s*)?(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
        if (m) {
            const monthIndex = MONTH_INDEX[m[2].toLowerCase()];
            if (monthIndex === undefined) return raw;
            return formatScheduleParts(
                year,
                monthIndex,
                parseInt(m[1], 10),
                parseInt(m[3], 10),
                parseInt(m[4], 10)
            );
        }

        m = raw.match(/^(?:\w+,\s*)?(\d{1,2})\/(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
        if (m) {
            return formatScheduleParts(
                year,
                parseInt(m[1], 10) - 1,
                parseInt(m[2], 10),
                parseInt(m[3], 10),
                parseInt(m[4], 10)
            );
        }
        return raw;
    }

    function roundKeyFromMatchId(matchId) {
        const tieId = parseMatchId(matchId).tieId;
        if (tieId.startsWith('group')) return 'group';
        if (tieId.startsWith('ko-')) return tieId.split('-').slice(0, 2).join('-');
        if (tieId.startsWith('r32')) return 'r32';
        if (tieId.startsWith('r16')) return 'r16';
        if (tieId.startsWith('qf')) return 'qf';
        if (tieId.startsWith('sf')) return 'sf';
        if (tieId.startsWith('third')) return 'third';
        if (tieId.startsWith('final')) return 'final';
        return tieId.split('-')[0];
    }

    /**
     * Generate knockout schedule for all catalog matches (incl. two-leg legs & third place).
     * opts: teams, includeThirdPlace, twoLegKnockout, startMs, staggerHours, daysBetweenRounds, daysBetweenLegs
     */
    function generateMatchSchedule(opts) {
        const catalog = buildMatchCatalog(opts);
        if (!catalog.length) return {};

        const twoLeg = !!opts.twoLegKnockout;
        const staggerMs = (opts.staggerHours ?? 3) * 3600000;
        const daysBetweenRoundsMs = (opts.daysBetweenRounds ?? 3) * 86400000;
        const daysBetweenLegsMs = (opts.daysBetweenLegs ?? 4) * 86400000;
        let startMs = opts.startMs;
        if (!startMs || Number.isNaN(startMs)) {
            const year = opts.leagueYear || new Date().getFullYear();
            startMs = Date.UTC(year, 5, 1, (opts.defaultKickoffHour ?? 19) - 7, opts.defaultKickoffMinute ?? 0);
        }

        const roundGroups = [];
        let currentKey = null;
        let currentGroup = [];
        catalog.forEach(entry => {
            const key = roundKeyFromMatchId(entry.id);
            if (key !== currentKey) {
                if (currentGroup.length) roundGroups.push({ key: currentKey, entries: currentGroup.slice() });
                currentKey = key;
                currentGroup = [entry];
            } else {
                currentGroup.push(entry);
            }
        });
        if (currentGroup.length) roundGroups.push({ key: currentKey, entries: currentGroup });

        const schedule = {};
        let cursorMs = startMs;
        const leg1Times = {};

        roundGroups.forEach((group, gi) => {
            if (gi > 0) cursorMs += daysBetweenRoundsMs;

            if (twoLeg) {
                const leg1Entries = group.entries.filter(e => !e.leg || e.leg === 1);
                const leg2Entries = group.entries.filter(e => e.leg === 2);

                leg1Entries.forEach((entry, i) => {
                    if (i > 0) cursorMs += staggerMs;
                    schedule[entry.id] = formatScheduleWIB(cursorMs);
                    const tieId = entry.tieId || parseMatchId(entry.id).tieId;
                    leg1Times[tieId] = cursorMs;
                });

                let leg2Cursor = cursorMs;
                leg2Entries.forEach((entry, i) => {
                    const tieId = entry.tieId || parseMatchId(entry.id).tieId;
                    let leg2Ms = (leg1Times[tieId] || cursorMs) + daysBetweenLegsMs;
                    if (i > 0) leg2Ms = Math.max(leg2Ms, leg2Cursor + staggerMs);
                    leg2Cursor = leg2Ms;
                    schedule[entry.id] = formatScheduleWIB(leg2Ms);
                });
                cursorMs = leg2Cursor;
            } else {
                group.entries.forEach((entry, i) => {
                    if (i > 0) cursorMs += staggerMs;
                    schedule[entry.id] = formatScheduleWIB(cursorMs);
                });
            }
        });

        return schedule;
    }

    function applyMatchSchedules(schedule, leagueYear) {
        if (!schedule || typeof schedule !== 'object') return;
        const year = leagueYear ||
            (window.LEAGUE_DATA && window.LEAGUE_DATA.year) ||
            new Date().getFullYear();
        Object.keys(schedule).forEach(matchId => {
            const text = normalizeScheduleDisplay(schedule[matchId], year);
            if (!text) return;
            const matchup = document.querySelector('[data-match-id="' + matchId + '"]');
            if (!matchup) return;
            const dateEl = matchup.querySelector('.matchup-date');
            if (!dateEl) return;
            dateEl.textContent = text;
            dateEl.dataset.scheduleDate = text;
        });
        sortGroupStageMatchupsInDom(year);
    }

    function parseStartDateKickoff(startDateStr, kickoffStr, leagueYear) {
        let year = leagueYear || new Date().getFullYear();
        let monthIndex = 5;
        let day = 1;
        if (startDateStr) {
            const parts = startDateStr.split('-');
            if (parts.length === 3) {
                year = parseInt(parts[0], 10) || year;
                monthIndex = (parseInt(parts[1], 10) || 6) - 1;
                day = parseInt(parts[2], 10) || 1;
            }
        }
        let hour = 19;
        let minute = 0;
        if (kickoffStr) {
            const kp = kickoffStr.split(':');
            hour = parseInt(kp[0], 10);
            minute = parseInt(kp[1], 10);
            if (Number.isNaN(hour)) hour = 19;
            if (Number.isNaN(minute)) minute = 0;
        }
        return Date.UTC(year, monthIndex, day, hour - 7, minute);
    }

    return {
        DEFAULT_CLUB_FLAG,
        DEFAULT_TROPHY_IMG: TROPHY_IMG,
        TBD_FLAG,
        buildBracketHtml,
        buildGroupStageHtml,
        buildGroupMatchCatalog,
        buildKnockoutMatchCatalog,
        buildMatchCatalog,
        mountBracket,
        mountGroupStage,
        resolveTeamFlagUrl,
        getRoundPlan,
        getFlexibleKnockoutPlan,
        isPowerOfTwo,
        parseMatchId,
        legMatchId,
        resolveTieWinner,
        updateTieAggregates,
        catalogEntriesForTie,
        generateMatchSchedule,
        formatScheduleWIB,
        normalizeScheduleDisplay,
        applyMatchSchedules,
        sortGroupStageMatchupsInDom,
        parseStartDateKickoff,
        buildRoundRobinFixtures,
        fixturesFromGroupDefinitions,
        normalizeGroupDefinitions,
        inferGroupDefinitionsFromFixtures,
    };
})();
