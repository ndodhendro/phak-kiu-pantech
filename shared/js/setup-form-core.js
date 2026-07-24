/**
 * League setup form — shared core (state + helpers + payload/load)
 * Auto-split from setup-form.js — uses shared ArisanSetupFormCore.
 */
(function (Core) {
'use strict';

    Core.DEFAULT_POINT_CONFIG = {
        mainQuestMode: 'fixed',
        mainQuest: { win: 3, draw: 1, loss: 0 },
        teamPoints: {},
        sideQuest: {
            champion: 10,
            runnerup: 5,
            third: 3,
            goldenBoot: 5,
            goldenGlove: 5,
            totalGoal: 5,
            scorePredict: 5,
        },
        sideQuestShare: {
            champion: true,
            runnerup: true,
            third: true,
            goldenBoot: true,
            goldenGlove: true,
            totalGoal: true,
            scorePredict: true,
        },
    };

    Core.normalizeTeamPointRow = function normalizeTeamPointRow(raw, mainQuestDefaults) {
        const r = raw && typeof raw === 'object' ? raw : {};
        const mq = mainQuestDefaults || Core.DEFAULT_POINT_CONFIG.mainQuest;
        const num = (v, fallback) => {
            const n = parseInt(v, 10);
            return Number.isNaN(n) ? fallback : Math.max(0, n);
        };
        return {
            win: num(r.win, mq.win),
            draw: num(r.draw, mq.draw),
            loss: num(r.loss, mq.loss),
        };
    }

    Core.normalizeTeamPointsMap = function normalizeTeamPointsMap(raw, mainQuestDefaults) {
        const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const out = {};
        Object.keys(src).forEach(name => {
            const key = String(name || '').trim();
            if (!key) return;
            out[key] = Core.normalizeTeamPointRow(src[name], mainQuestDefaults);
        });
        return out;
    }

    Core.normalizePointConfig = function normalizePointConfig(raw) {
        const pc = raw && typeof raw === 'object' ? raw : {};
        const mainQuest = Object.assign({}, Core.DEFAULT_POINT_CONFIG.mainQuest, pc.mainQuest || {});
        return {
            mainQuestMode: pc.mainQuestMode === 'fifa' ? 'fifa' : 'fixed',
            mainQuest,
            teamPoints: Core.normalizeTeamPointsMap(pc.teamPoints, mainQuest),
            sideQuest: Object.assign({}, Core.DEFAULT_POINT_CONFIG.sideQuest, pc.sideQuest || {}),
            sideQuestShare: Object.assign(
                {},
                Core.DEFAULT_POINT_CONFIG.sideQuestShare,
                pc.sideQuestShare || {}
            ),
        };
    }

    Core.DEFAULT_PARTICIPANT_COLORS = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
        '#e91e63', '#ff5722', '#00bcd4', '#8bc34a', '#ffc107', '#795548',
    ];

    Core.ensurePotList = function ensurePotList(pots) {
        if (!Array.isArray(pots) || !pots.length) return [{ teams: ['', ''] }];
        return pots.map((pot) => {
            const t = (pot && pot.teams) || [];
            return { teams: [t[0] || '', t[1] || ''] };
        });
    }


    Core.normalizeMainQuestPicks = function normalizeMainQuestPicks(mq, opts) {
        const options = opts || {};
        const raw = mq && typeof mq === 'object' ? mq : {};
        if (raw.group || raw.knockout) {
            return {
                group: { pots: Core.ensurePotList(raw.group && raw.group.pots) },
                knockout: { pots: Core.ensurePotList(raw.knockout && raw.knockout.pots) },
            };
        }
        const legacy = Core.ensurePotList(raw.pots);
        const empty = [{ teams: ['', ''] }];
        const hasGroup = !!options.includeGroupStage;
        const hasKo = options.includeKnockoutStage !== false;
        if (hasGroup && !hasKo) {
            return { group: { pots: legacy }, knockout: { pots: empty } };
        }
        if (!hasGroup && hasKo) {
            return { group: { pots: empty }, knockout: { pots: legacy } };
        }
        return { group: { pots: legacy }, knockout: { pots: empty } };
    }

    Core.defaultPicks = function defaultPicks(includeThirdPlace) {
        return {
            mainQuest: Core.normalizeMainQuestPicks(null, {
                includeGroupStage: Core.form && Core.form.includeGroupStage,
                includeKnockoutStage: Core.form && Core.form.includeKnockoutStage !== false,
            }),
            sideQuest: {
                champion: '',
                runnerup: '',
                third: '',
                goldenBoot: { player_name: '', img: '', team: '' },
                goldenGlove: { player_name: '', img: '', team: '' },
                totalGoal: null,
                scorePredict: {},
            },
        };
    }

    Core.ensureParticipantMainQuest = function ensureParticipantMainQuest(p) {
        if (!p.picks) p.picks = Core.defaultPicks(Core.form.includeThirdPlace);
        p.picks.mainQuest = Core.normalizeMainQuestPicks(p.picks.mainQuest, {
            includeGroupStage: Core.form.includeGroupStage,
            includeKnockoutStage: Core.form.includeKnockoutStage,
        });
        return p.picks.mainQuest;
    }

    Core.ensureScorePredictPicks = function ensureScorePredictPicks(p) {
        if (!p.picks) p.picks = Core.defaultPicks(Core.form.includeThirdPlace);
        if (!p.picks.sideQuest) p.picks.sideQuest = Core.defaultPicks(Core.form.includeThirdPlace).sideQuest;
        if (!p.picks.sideQuest.scorePredict || typeof p.picks.sideQuest.scorePredict !== 'object') {
            p.picks.sideQuest.scorePredict = {};
        }
        return p.picks.sideQuest.scorePredict;
    }

    Core.normalizeScorePredictEntry = function normalizeScorePredictEntry(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const parse = (v) => {
            if (v === '' || v == null) return null;
            const n = parseInt(v, 10);
            return Number.isNaN(n) ? null : Math.max(0, n);
        };
        const a = parse(raw.a);
        const b = parse(raw.b);
        if (a == null || b == null) return null;
        return { a, b };
    }

    Core.form = {
        competitionType: 'country',
        includeGroupStage: false,
        includeKnockoutStage: true,
        includeThirdPlace: true,
        twoLegKnockout: false,
        pointConfig: Core.normalizePointConfig(null),
        teams: [],
        groupDefinitions: [],
        groupFixtures: [],
        participants: [],
        matchSchedule: {},
        fixtureSideSwaps: {},
        scheduleStartDate: '',
        scheduleKickoff: '19:00',
        iconImageUrl: '',
        trophyImageUrl: '',
        ballImageUrl: '',
        backgroundMusicUrl: '',
    };

    Core.participantOpenState = {};

    Core.stageOpenState = { group: true, knockout: true };

    Core.DEFAULT_CLUB_FLAG = 'https://img.icons8.com/ios-filled/50/6b7280/shield.png';

    Core.DEFAULT_PLAYER_SILHOUETTE = 'https://img.icons8.com/ios-filled/50/6b7280/user-male-circle.png';

    Core.DEFAULT_LEAGUE_ICON = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT41kl1nnX-tqBQiGHVikOIDViXDZXRRulNdKFAK6c1eQ&s=10';

    Core.DEFAULT_TROPHY_IMG = 'https://png.pngtree.com/png-vector/20250923/ourmid/pngtree-the-fifa-world-cup-trophy-png-image_17551611.webp';

    Core.DEFAULT_BALL_IMG = 'https://png.pngtree.com/png-vector/20260610/ourmid/pngtree-vibrant-trionda-soccer-football-official-fifa-world-cup-2026-design-png-image_19512258.webp';

    Core.isValidTeamCount = function isValidTeamCount(count) {
        return Number.isInteger(count) && count >= 2 && count % 2 === 0;
    }

    Core.getTeamCountHint = function getTeamCountHint() {
        if (Core.form.includeGroupStage) {
            const defs = Core.form.groupDefinitions || [];
            const unique = Core.uniqueTeamsFromGroups(defs).length;
            const fixtures = (typeof ArisanBracket !== 'undefined' && ArisanBracket.fixturesFromGroupDefinitions)
                ? ArisanBracket.fixturesFromGroupDefinitions(defs.map(g => ({
                    label: g.label,
                    teams: (g.teams || []).map(t => t.name).filter(Boolean),
                })))
                : [];
            return 'Add groups and member countries/clubs. Matches auto-generate as round-robin '
                + '(every team plays every other team in its group). Currently '
                + defs.length + ' group(s), ' + unique + ' teams, ' + fixtures.length + ' matches.';
        }
        const filled = Core.form.teams.filter(t => Core.normalizeSeedName(t.name)).length;
        const slots = Core.form.teams.length;
        return 'Add knockout bracket pairs (+ Match). TBD allowed. Currently '
            + slots + ' slot(s), ' + filled + ' named.';
    }

    Core.isTeamsSectionComplete = function isTeamsSectionComplete() {
        if (Core.form.includeGroupStage) {
            if (Core.validateGroupDefinitionsForSave(Core.form.groupDefinitions)) return false;
            if (!Core.form.includeKnockoutStage) return true;
        }
        if (!Core.form.includeKnockoutStage) return false;
        if (!Core.isValidTeamCount(Core.form.teams.length)) return false;
        // Knockout slots may be TBD (empty) — structure only needs an even slot count.
        return true;
    }

    Core.normalizeSeedName = function normalizeSeedName(name) {
        const n = String(name || '').trim();
        if (!n || n.toUpperCase() === 'TBD') return '';
        return n;
    }

    Core.validateGroupDefinitionsForSave = function validateGroupDefinitionsForSave(defs) {
        const list = defs || [];
        if (!list.length) return 'Add at least 1 group.';
        const globalSeen = new Set();
        for (let gi = 0; gi < list.length; gi++) {
            const g = list[gi];
            const label = (g.label || String.fromCharCode(65 + gi)).trim();
            const names = (g.teams || []).map(t => {
                if (typeof t === 'string') return t.trim();
                return String((t && t.name) || '').trim();
            }).filter(Boolean);
            if (names.length < 2) {
                return 'Group ' + label + ' needs at least 2 teams.';
            }
            const local = new Set();
            for (let i = 0; i < names.length; i++) {
                const key = names[i].toLowerCase();
                if (local.has(key)) return 'Duplicate team in Group ' + label + ': ' + names[i];
                if (globalSeen.has(key)) return 'Team appears in more than one group: ' + names[i];
                local.add(key);
                globalSeen.add(key);
            }
        }
        return null;
    }

    Core.validateTeamsForSave = function validateTeamsForSave(teams, opts) {
        const options = opts || {};
        if (options.includeGroupStage) {
            const gErr = Core.validateGroupDefinitionsForSave(options.groupDefinitions || Core.form.groupDefinitions);
            if (gErr) return gErr;
            if (!options.includeKnockoutStage) return null;
        }

        if (!options.includeKnockoutStage) return null;

        const list = (teams || []).map(t => ({
            name: Core.normalizeSeedName(t.name),
            flag: t.flag || '',
        }));
        if (!list.length) return 'At least 1 knockout match (2 slots) is required.';
        if (list.length % 2 !== 0) return 'Knockout team count must be even (add teams in pairs).';
        if (list.length < 2) return 'At least 1 knockout match (2 slots) is required.';

        const named = list.filter(t => t.name);
        const seen = new Set();
        const dupes = [];
        named.forEach(t => {
            const key = t.name.toLowerCase();
            if (seen.has(key)) {
                if (!dupes.includes(t.name)) dupes.push(t.name);
            } else {
                seen.add(key);
            }
        });
        if (dupes.length) {
            return 'Duplicate team names are not allowed in knockout: ' + dupes.join(', ') + '.';
        }
        return null;
    }

    Core.uniqueTeamsFromGroups = function uniqueTeamsFromGroups(defs) {
        const out = [];
        const seen = new Set();
        (defs || []).forEach(g => {
            (g.teams || []).forEach(t => {
                const name = (t.name || '').trim();
                if (!name) return;
                const key = name.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                out.push({ name, flag: t.flag || '' });
            });
        });
        return out;
    }

    Core.fixturesFromTeamPairs = function fixturesFromTeamPairs(teams) {
        const fixtures = [];
        const list = teams || [];
        for (let i = 0; i < list.length; i += 2) {
            const a = ((list[i] && list[i].name) || '').trim();
            const b = ((list[i + 1] && list[i + 1].name) || '').trim();
            if (!a && !b) continue;
            fixtures.push({ a, b });
        }
        return fixtures;
    }

    Core.teamPairsFromFixtures = function teamPairsFromFixtures(fixtures, flagByName) {
        const flags = flagByName || {};
        const pairs = [];
        (fixtures || []).forEach(f => {
            const a = String((f && f.a) || '').trim();
            const b = String((f && f.b) || '').trim();
            pairs.push(
                { name: a, flag: flags[a] || '' },
                { name: b, flag: flags[b] || '' }
            );
        });
        return pairs;
    }

    Core.uniqueTeamsFromPairs = function uniqueTeamsFromPairs(teams) {
        const out = [];
        const seen = new Set();
        (teams || []).forEach(t => {
            const name = (t.name || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ name, flag: t.flag || '' });
        });
        return out;
    }

    Core.WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    Core.MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    Core.MONTH_INDEX = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
        jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        januari: 0, februari: 1, maret: 2, mei: 4, juni: 5,
        juli: 6, agustus: 7, oktober: 9, desember: 11,
    };

    Core.definitionsForCatalog = function definitionsForCatalog() {
        return (Core.form.groupDefinitions || []).map((g, i) => ({
            label: (g.label || String.fromCharCode(65 + i)).trim(),
            teams: (g.teams || []).map(t => (t.name || '').trim()).filter(Boolean),
        }));
    }

    Core.getScheduleCatalog = function getScheduleCatalog() {
        if (typeof ArisanBracket === 'undefined' || !Core.isTeamsSectionComplete()) return [];
        const fromGroups = Core.form.includeGroupStage ? Core.uniqueTeamsFromGroups(Core.form.groupDefinitions) : [];
        const knockoutTeams = Core.form.includeKnockoutStage
            ? Core.form.teams.map(t => ({
                name: Core.normalizeSeedName(t.name),
                flag: Core.normalizeSeedName(t.name) ? (t.flag || '') : '',
            }))
            : [];
        const byKey = new Map();
        [...fromGroups, ...knockoutTeams.filter(t => t.name)].forEach(t => {
            const key = t.name.toLowerCase();
            if (!byKey.has(key)) byKey.set(key, t);
        });
        const catalogTeams = Core.form.includeKnockoutStage && knockoutTeams.length
            ? knockoutTeams
            : Array.from(byKey.values());
        const defs = Core.form.includeGroupStage ? Core.definitionsForCatalog() : [];
        const groupFixtures = (defs.length && ArisanBracket.fixturesFromGroupDefinitions)
            ? ArisanBracket.fixturesFromGroupDefinitions(defs)
            : (Core.form.groupFixtures || []);
        // Build without applying index-based swaps so team-pair keys stay stable when
        // fixture indexes shift (swaps are stored/looked up by pair key in the Core.form).
        const catalog = ArisanBracket.buildMatchCatalog({
            teams: catalogTeams,
            groupDefinitions: defs,
            groupFixtures,
            competitionType: Core.form.competitionType,
            includeGroupStage: Core.form.includeGroupStage,
            includeKnockoutStage: Core.form.includeKnockoutStage,
            includeThirdPlace: Core.form.includeThirdPlace,
            twoLegKnockout: Core.form.twoLegKnockout,
            fixtureSideSwaps: {},
        }).map(e => {
            const pk = Core.catalogPairKey(e);
            const swapped = !!(Core.form.fixtureSideSwaps && Core.form.fixtureSideSwaps[pk]);
            if (!swapped) return e;
            return Object.assign({}, e, {
                label: Core.swapVsLabel(e.label),
            });
        });
        Core.promoteLegacyIdKeysToPairKeys(catalog);
        return Core.sortScheduleCatalogForSetup(catalog);
    }

    Core.swapVsLabel = function swapVsLabel(label) {
        const raw = String(label || '');
        const m = raw.match(/^(.* — )(.+?) vs (.+?)( \(Leg [12]\))?$/);
        if (!m) return raw;
        return m[1] + m[3] + ' vs ' + m[2] + (m[4] || '');
    }


    Core.catalogPairKey = function catalogPairKey(entry) {
        if (!entry) return '';
        const a = String(entry.teamA || '').trim();
        const b = String(entry.teamB || '').trim();
        const aOk = a && a.toUpperCase() !== 'TBD';
        const bOk = b && b.toUpperCase() !== 'TBD';
        const leg = entry.leg ? Number(entry.leg) : 0;
        if (aOk && bOk) {
            const la = a.toLowerCase();
            const lb = b.toLowerCase();
            const [x, y] = la < lb ? [la, lb] : [lb, la];
            const g = String(entry.group || '').trim().toLowerCase();
            return 'teams:' + (g ? g + ':' : '') + x + '|' + y + (leg ? ':L' + leg : '');
        }
        return 'id:' + String(entry.id || '');
    }

    Core.isPairBindingKey = function isPairBindingKey(k) {
        return /^teams:/.test(String(k || '')) || /^id:/.test(String(k || ''));
    }


    Core.promoteLegacyIdKeysToPairKeys = function promoteLegacyIdKeysToPairKeys(catalog) {
        const idToPk = new Map();
        (catalog || []).forEach(e => idToPk.set(e.id, Core.catalogPairKey(e)));

        function promote(obj) {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
            let needs = false;
            Object.keys(obj).forEach(k => {
                if (!Core.isPairBindingKey(k)) needs = true;
            });
            if (!needs) return obj;

            const next = {};
            Object.keys(obj).forEach(k => {
                const val = obj[k];
                if (Core.isPairBindingKey(k)) {
                    if (!Object.prototype.hasOwnProperty.call(next, k)) next[k] = val;
                    return;
                }
                const pk = idToPk.get(k);
                if (!pk) return;
                if (!Object.prototype.hasOwnProperty.call(next, pk)) next[pk] = val;
            });
            return next;
        }

        Core.form.matchSchedule = promote(Core.form.matchSchedule);
        Core.form.fixtureSideSwaps = promote(Core.form.fixtureSideSwaps);
        Core.form.participants.forEach(p => {
            const map = Core.ensureScorePredictPicks(p);
            p.picks.sideQuest.scorePredict = promote(map);
        });
    }

    /** Project pair-keyed form maps back to match ids for DB / league page. */

    Core.projectPairBindingsToMatchIds = function projectPairBindingsToMatchIds(catalog) {
        const matchSchedule = {};
        const fixtureSideSwaps = {};
        (catalog || []).forEach(e => {
            const pk = Core.catalogPairKey(e);
            const sched = Core.form.matchSchedule && (Core.form.matchSchedule[pk] || Core.form.matchSchedule[e.id]);
            if (sched) matchSchedule[e.id] = sched;
            if (Core.form.fixtureSideSwaps && (Core.form.fixtureSideSwaps[pk] || Core.form.fixtureSideSwaps[e.id])) {
                fixtureSideSwaps[e.id] = true;
            }
        });
        return { matchSchedule, fixtureSideSwaps };
    }

    Core.scheduleTextForEntry = function scheduleTextForEntry(entry) {
        if (!entry) return '';
        const pk = Core.catalogPairKey(entry);
        return (Core.form.matchSchedule && (Core.form.matchSchedule[pk] || Core.form.matchSchedule[entry.id])) || '';
    }

    Core.resetScheduleCatalogSnapshot = function resetScheduleCatalogSnapshot() {
        // No-op: pair-key storage does not need a catalog snapshot.
    }

    Core.projectScorePredictToMatchIds = function projectScorePredictToMatchIds(catalog, scoreMap) {
        const out = {};
        const pkToId = new Map();
        (catalog || []).forEach(e => pkToId.set(Core.catalogPairKey(e), e.id));
        Object.keys(scoreMap || {}).forEach(k => {
            const val = scoreMap[k];
            if (!val) return;
            if (Core.isPairBindingKey(k)) {
                const id = pkToId.get(k);
                if (id) out[id] = val;
                return;
            }
            if ((catalog || []).some(e => e.id === k)) out[k] = val;
        });
        return out;
    }

    Core.getPayload = function getPayload() {
        Core.collectScheduleFromDom();
        Core.pruneMatchSchedule();
        Core.collectTeamPointsFromDom();
        Core.syncTeamPointsWithTeamList();
        Core.collectScorePredictionsFromDom();

        const catalog = Core.getScheduleCatalog();
        Core.pruneScorePredictionsToCatalog(catalog.map(e => Core.catalogPairKey(e)));
        const projected = Core.projectPairBindingsToMatchIds(catalog);

        const pointConfig = Core.normalizePointConfig(Core.form.pointConfig);
        if (!Core.form.includeThirdPlace) pointConfig.sideQuest.third = 0;

        let groupDefinitions = [];
        let groupFixtures = [];
        if (Core.form.includeGroupStage) {
            groupDefinitions = (Core.form.groupDefinitions || []).map((g, i) => ({
                label: (g.label || String.fromCharCode(65 + i)).trim() || String.fromCharCode(65 + i),
                teams: (g.teams || []).map(t => (t.name || '').trim()).filter(Boolean),
            })).filter(g => g.teams.length);
            groupFixtures = (typeof ArisanBracket !== 'undefined' && ArisanBracket.fixturesFromGroupDefinitions)
                ? ArisanBracket.fixturesFromGroupDefinitions(groupDefinitions)
                : [];
            const swaps = projected.fixtureSideSwaps || {};
            groupFixtures = groupFixtures.map((f, i) => {
                if (!swaps['group-' + i]) return f;
                return Object.assign({}, f, { a: f.b, b: f.a });
            });
        }

        const byKey = new Map();
        function pushTeam(t) {
            const name = Core.normalizeSeedName(t.name);
            if (!name) return;
            const key = name.toLowerCase();
            if (!byKey.has(key)) byKey.set(key, { name, flag: t.flag || '' });
            else if (t.flag && !byKey.get(key).flag) byKey.get(key).flag = t.flag;
        }
        if (Core.form.includeGroupStage) Core.uniqueTeamsFromGroups(Core.form.groupDefinitions).forEach(pushTeam);
        const knockoutSeeds = Core.form.includeKnockoutStage
            ? Core.form.teams.map(t => ({
                name: Core.normalizeSeedName(t.name),
                flag: Core.normalizeSeedName(t.name) ? (t.flag || '') : '',
            }))
            : [];
        knockoutSeeds.forEach(pushTeam);
        const teams = Array.from(byKey.values());

        return {
            competitionType: Core.form.competitionType,
            includeGroupStage: Core.form.includeGroupStage,
            includeKnockoutStage: Core.form.includeKnockoutStage,
            includeThirdPlace: Core.form.includeThirdPlace,
            twoLegKnockout: Core.form.twoLegKnockout,
            pointConfig,
            matchSchedule: projected.matchSchedule,
            fixtureSideSwaps: projected.fixtureSideSwaps,
            scheduleStartDate: Core.form.scheduleStartDate || '',
            scheduleKickoff: Core.form.scheduleKickoff || '19:00',
            iconImageUrl: Core.form.iconImageUrl || '',
            trophyImageUrl: Core.form.trophyImageUrl || '',
            ballImageUrl: Core.form.ballImageUrl || '',
            backgroundMusicUrl: Core.form.backgroundMusicUrl || '',
            teams,
            knockoutSeeds,
            groupDefinitions,
            groupFixtures,
            participants: Core.form.participants
                .filter(p => p.name && p.name.trim())
                .map((p) => {
                    const copy = Object.assign({}, p, {
                        picks: Object.assign({}, p.picks || Core.defaultPicks(Core.form.includeThirdPlace)),
                    });
                    copy.picks.mainQuest = Core.normalizeMainQuestPicks(copy.picks.mainQuest, {
                        includeGroupStage: Core.form.includeGroupStage,
                        includeKnockoutStage: Core.form.includeKnockoutStage,
                    });
                    if (copy.picks.sideQuest && copy.picks.sideQuest.scorePredict) {
                        copy.picks.sideQuest.scorePredict = Core.projectScorePredictToMatchIds(
                            catalog,
                            copy.picks.sideQuest.scorePredict
                        );
                    }
                    return copy;
                }),
        };
    }


    /** Re-render schedule + score predictions after save so newly set dates reorder. */

    /** Pull date/time values from the schedule UI into form.matchSchedule. */

    /** Parse stored schedule text → { date: YYYY-MM-DD, time: HH:mm } (WIB wall clock). */

    /** Build schedule display string: `Tue, 30 Jun, 08:00 WIB`. */

    Core.esc = function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    Core.isHttpUrl = function isHttpUrl(s) {
        return /^https?:\/\/.+/i.test(String(s || '').trim());
    }

    Core.countryFlagUrl = function countryFlagUrl(countryName) {
        if (!countryName || typeof window.ArisanCountries === 'undefined') return '';
        const previewW = ArisanCountries.FLAG_SIZE && ArisanCountries.FLAG_SIZE.preview;
        return ArisanCountries.getFlagUrl(countryName, previewW) || '';
    }

    Core.teamFlagPreviewUrl = function teamFlagPreviewUrl(teamName) {
        const name = (teamName || '').trim();
        if (!name) return '';
        if (Core.form.competitionType === 'country') return Core.countryFlagUrl(name);
        const t = Core.form.teams.find(x => x.name === name);
        if (!t || !t.flag) return '';
        const flag = String(t.flag).trim();
        if (Core.isHttpUrl(flag)) return flag;
        return '';
    }

    Core.resolveAvatarPreviewSrc = function resolveAvatarPreviewSrc(value) {
        const v = String(value || '').trim();
        if (!v) return Core.DEFAULT_PLAYER_SILHOUETTE;
        if (Core.isHttpUrl(v)) return v;
        const communitySlug = document.getElementById('community-slug')?.value;
        if (communitySlug && window.ArisanDB && typeof ArisanDB.communityAssetBase === 'function') {
            return ArisanDB.communityAssetBase(communitySlug) + v.replace(/^\//, '');
        }
        return Core.DEFAULT_PLAYER_SILHOUETTE;
    }

    Core.resolvePreviewSrc = function resolvePreviewSrc(mode, value) {
        if (mode === 'country-flag') {
            return Core.countryFlagUrl(value) || Core.DEFAULT_CLUB_FLAG;
        }
        if (mode === 'team-flag') {
            return Core.teamFlagPreviewUrl(value) || Core.DEFAULT_CLUB_FLAG;
        }
        if (mode === 'image-url') {
            return Core.isHttpUrl(value) ? String(value).trim() : Core.DEFAULT_PLAYER_SILHOUETTE;
        }
        if (mode === 'avatar-url') {
            return Core.resolveAvatarPreviewSrc(value);
        }
        if (mode === 'flag-url') {
            return Core.isHttpUrl(value) ? String(value).trim() : Core.DEFAULT_CLUB_FLAG;
        }
        if (mode === 'trophy-url') {
            return Core.isHttpUrl(value) ? String(value).trim() : Core.DEFAULT_TROPHY_IMG;
        }
        if (mode === 'icon-url') {
            return Core.isHttpUrl(value) ? String(value).trim() : Core.DEFAULT_LEAGUE_ICON;
        }
        if (mode === 'ball-url') {
            return Core.isHttpUrl(value) ? String(value).trim() : Core.DEFAULT_BALL_IMG;
        }
        return Core.DEFAULT_CLUB_FLAG;
    }

    Core.previewBlock = function previewBlock(mode, value, alt, kind) {
        const url = Core.resolvePreviewSrc(mode, value);
        return '<div class="field-preview">' +
            '<img src="' + Core.esc(url) + '" alt="' + Core.esc(alt || '') + '" class="preview-img preview-' + kind +
            '" data-preview-mode="' + Core.esc(mode) + '" referrerpolicy="no-referrer" decoding="async">' +
            '</div>';
    }

    Core.fieldWithPreview = function fieldWithPreview(controlHtml, mode, value, previewAlt, kind) {
        return '<div class="field-with-preview">' +
            '<div class="field-control">' + controlHtml + '</div>' +
            Core.previewBlock(mode, value, previewAlt, kind) +
            '</div>';
    }

    Core.labeledPreviewField = function labeledPreviewField(label, controlHtml, mode, value, previewAlt, kind) {
        return '<div class="labeled-preview-field">' +
            '<label>' + Core.esc(label) + '</label>' +
            Core.fieldWithPreview(controlHtml, mode, value, previewAlt, kind) +
            '</div>';
    }

    Core.updatePreviewForControl = function updatePreviewForControl(controlEl) {
        if (!controlEl) return;
        const wrap = controlEl.closest('.field-with-preview');
        if (!wrap) return;
        const img = wrap.querySelector('.preview-img');
        if (!img) return;

        const mode = controlEl.dataset.preview;
        const raw = String(controlEl.value || '').trim();
        const src = Core.resolvePreviewSrc(mode, raw);
        img.referrerPolicy = 'no-referrer';
        // Bust sticky error state when URL changes
        if (img.dataset.lastPreviewSrc !== src) {
            img.dataset.lastPreviewSrc = src;
            img.src = src;
        }
        img.alt = raw || Core.previewAltForMode(mode);
        // Player cutout blend is only for Golden Boot/Glove (image-url), not participant avatars.
        if (mode === 'image-url' && typeof ArisanTheSportsDB !== 'undefined') {
            ArisanTheSportsDB.applyPlayerImgBlend(img, raw || src);
        } else {
            img.classList.remove('player-img-opaque-bg');
        }
    }

    Core.previewAltForMode = function previewAltForMode(mode) {
        if (mode === 'image-url') return 'Player';
        if (mode === 'avatar-url') return 'Avatar';
        if (mode === 'flag-url') return 'Team logo';
        return 'Team';
    }

    Core.defaultPreviewForImg = function defaultPreviewForImg(img) {
        const mode = img.dataset.previewMode
            || img.closest('.field-with-preview')?.querySelector('[data-preview]')?.dataset.preview
            || 'team-flag';
        const fallback = Core.resolvePreviewSrc(mode, '');
        // Avoid infinite error loop if fallback also fails
        if (img.getAttribute('src') === fallback) return;
        img.dataset.lastPreviewSrc = fallback;
        img.src = fallback;
    }

    Core.bindPreviewControls = function bindPreviewControls(root) {
        (root || document).querySelectorAll('[data-preview]').forEach(el => {
            if (el.dataset.previewBound) return;
            el.dataset.previewBound = '1';
            const handler = () => Core.updatePreviewForControl(el);
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
            const img = el.closest('.field-with-preview')?.querySelector('.preview-img');
            if (img && !img.dataset.errorBound) {
                img.dataset.errorBound = '1';
                img.referrerPolicy = 'no-referrer';
                img.addEventListener('error', () => Core.defaultPreviewForImg(img));
            }
            Core.updatePreviewForControl(el);
        });
    }

    Core.teamNames = function teamNames() {
        const names = [];
        const seen = new Set();
        function push(n) {
            const name = (n || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            names.push(name);
        }
        if (Core.form.includeGroupStage) {
            Core.uniqueTeamsFromGroups(Core.form.groupDefinitions).forEach(t => push(t.name));
        }
        if (Core.form.includeKnockoutStage) {
            Core.form.teams.forEach(t => push(t.name));
        }
        if (!Core.form.includeGroupStage && !Core.form.includeKnockoutStage) {
            Core.form.teams.forEach(t => push(t.name));
        }
        return names;
    }

    /** Main Quest pot dropdown: hide teams already picked in this stage's other pot slots. */

    Core.teamOptions = function teamOptions(selected) {
        const names = Core.teamNames();
        let html = '<option value="">— select —</option>';
        names.forEach(n => {
            html += '<option value="' + Core.esc(n) + '"' + (n === selected ? ' selected' : '') + '>' + Core.esc(n) + '</option>';
        });
        return html;
    }

    Core.countryOptions = function countryOptions(selected, takenSet, opts) {
        const options = opts || {};
        const list = window.ArisanCountries || [];
        const taken = takenSet || new Set();
        const current = Core.normalizeSeedName(selected);
        const currentKey = current.toLowerCase();
        let html = options.allowTbd
            ? '<option value=""' + (!current ? ' selected' : '') + '>TBD</option>'
            : '<option value="">— select country —</option>';
        list.forEach(c => {
            const key = String(c.name || '').toLowerCase();
            if (key && key !== currentKey && taken.has(key)) return;
            html += '<option value="' + Core.esc(c.name) + '"' + (c.name === selected ? ' selected' : '') + '>' + Core.esc(c.name) + '</option>';
        });
        return html;
    }

    /** Update group country <select> options in place (no DOM rebuild → keep focus). */

    Core.updateCounts = function updateCounts() {
        const pc = document.getElementById('count-participants');
        const tc = document.getElementById('count-teams');
        if (pc) pc.textContent = Core.form.participants.length;
        let teamCount = 0;
        if (Core.form.includeGroupStage) teamCount += Core.uniqueTeamsFromGroups(Core.form.groupDefinitions).length;
        if (Core.form.includeKnockoutStage) {
            teamCount = Core.form.includeGroupStage
                ? Core.teamNames().length
                : Core.form.teams.filter(t => (t.name || '').trim()).length;
        } else if (!Core.form.includeGroupStage) {
            teamCount = Core.form.teams.length;
        }
        if (tc) tc.textContent = teamCount;
        Core.syncTeamsSectionUi();
    }

    Core.bgMusicPreviewApi = null;

    Core.newBlankLeague = function newBlankLeague() {
        Core.resetScheduleCatalogSnapshot();
        Core.form = {
            competitionType: 'country',
            includeGroupStage: false,
            includeKnockoutStage: true,
            includeThirdPlace: true,
            twoLegKnockout: false,
            pointConfig: Core.normalizePointConfig(null),
            teams: [],
            groupDefinitions: [],
            groupFixtures: [],
            participants: [],
            matchSchedule: {},
            fixtureSideSwaps: {},
            scheduleStartDate: '',
            scheduleKickoff: '19:00',
            iconImageUrl: '',
            trophyImageUrl: '',
            ballImageUrl: '',
            backgroundMusicUrl: '',
        };
        document.getElementById('league-title').value = '';
        document.getElementById('league-year').value = '';
        const iconInp = document.getElementById('league-icon-url');
        if (iconInp) {
            iconInp.value = '';
            Core.updatePreviewForControl(iconInp);
        }
        const trophyInp = document.getElementById('league-trophy-url');
        if (trophyInp) {
            trophyInp.value = '';
            Core.updatePreviewForControl(trophyInp);
        }
        const ballInp = document.getElementById('league-ball-url');
        if (ballInp) {
            ballInp.value = '';
            Core.updatePreviewForControl(ballInp);
        }
        const musicInp = document.getElementById('league-bg-music-url');
        if (musicInp) musicInp.value = '';
        Core.ensureInitialTeamPair();
        Core.ensureInitialParticipant();
        Core.renderAll();
        return Core.form;
    }

    Core.hydrateGroupDefinitions = function hydrateGroupDefinitions(data, flagByName) {
        const flags = flagByName || {};
        let defs = Array.isArray(data.groupDefinitions) ? data.groupDefinitions : [];
        if ((!defs || !defs.length) && Array.isArray(data.groupFixtures) && data.groupFixtures.length
            && typeof ArisanBracket !== 'undefined' && ArisanBracket.inferGroupDefinitionsFromFixtures) {
            defs = ArisanBracket.inferGroupDefinitionsFromFixtures(data.groupFixtures);
        }
        return (defs || []).map((g, i) => ({
            label: String((g && g.label) || String.fromCharCode(65 + i)).trim() || String.fromCharCode(65 + i),
            teams: (Array.isArray(g && g.teams) ? g.teams : []).map(t => {
                const name = typeof t === 'string' ? t.trim() : String((t && t.name) || '').trim();
                const flag = typeof t === 'object' && t
                    ? (t.flag || flags[name] || '')
                    : (flags[name] || '');
                return { name, flag };
            }),
        }));
    }

    Core.loadFromSetupData = function loadFromSetupData(data) {
        Core.resetScheduleCatalogSnapshot();
        Core.form.competitionType = data.competitionType || 'country';
        Core.form.includeGroupStage = !!data.includeGroupStage;
        Core.form.includeKnockoutStage = data.includeKnockoutStage !== false;
        Core.form.includeThirdPlace = data.includeThirdPlace !== false;
        Core.form.twoLegKnockout = !!data.twoLegKnockout;
        Core.form.pointConfig = Core.normalizePointConfig(data.pointConfig);
        Core.form.matchSchedule = data.matchSchedule || {};
        Core.form.fixtureSideSwaps = (data.fixtureSideSwaps && typeof data.fixtureSideSwaps === 'object')
            ? Object.assign({}, data.fixtureSideSwaps)
            : {};
        Core.form.scheduleStartDate = data.scheduleStartDate || '';
        Core.form.scheduleKickoff = data.scheduleKickoff || '19:00';
        Core.form.iconImageUrl = data.iconImageUrl || '';
        Core.form.trophyImageUrl = data.trophyImageUrl || '';
        Core.form.ballImageUrl = data.ballImageUrl || '';
        Core.form.backgroundMusicUrl = data.backgroundMusicUrl || '';
        if (!Core.form.includeThirdPlace) Core.form.pointConfig.sideQuest.third = 0;

        const fixtures = Array.isArray(data.groupFixtures) ? data.groupFixtures : [];
        Core.form.groupFixtures = fixtures.map(f => ({
            a: String((f && f.a) || '').trim(),
            b: String((f && f.b) || '').trim(),
            group: String((f && (f.group || f.groupLabel)) || '').trim(),
        }));

        const uniqueTeams = (data.teams || []).map(t => ({ name: t.name || '', flag: t.flag || '' }));
        const flagByName = {};
        uniqueTeams.forEach(t => {
            if (t.name) flagByName[t.name] = t.flag || '';
        });

        Core.form.groupDefinitions = Core.form.includeGroupStage
            ? Core.hydrateGroupDefinitions(data, flagByName)
            : [];
        if (Core.form.includeGroupStage && !Core.form.groupDefinitions.length) Core.ensureInitialGroups();

        if (Core.form.includeKnockoutStage) {
            const seeds = Array.isArray(data.knockoutSeeds) ? data.knockoutSeeds : null;
            if (seeds && seeds.length) {
                Core.form.teams = seeds.map(t => ({
                    name: Core.normalizeSeedName(typeof t === 'string' ? t : (t && t.name)),
                    flag: typeof t === 'object' && t ? (t.flag || flagByName[Core.normalizeSeedName(t.name)] || '') : '',
                }));
            } else if (Core.form.includeGroupStage) {
                // Group + knockout without saved seeds → default TBD pairs (not all group teams).
                Core.form.teams = [];
            } else {
                Core.form.teams = uniqueTeams.length ? uniqueTeams.slice() : [];
            }
            if (!Core.form.teams.length) Core.ensureInitialTeamPair();
            if (Core.form.teams.length % 2 === 1) Core.form.teams.push(Core.emptyTeam());
        } else {
            Core.form.teams = [];
        }

        Core.form.participants = (data.participants || []).map((p, i) => {
            const row = {
                name: p.name || '',
                avatar_path: p.avatar_path || '',
                color: p.color || Core.DEFAULT_PARTICIPANT_COLORS[i % Core.DEFAULT_PARTICIPANT_COLORS.length],
                picks: p.picks || Core.defaultPicks(Core.form.includeThirdPlace),
            };
            if (!row.picks.sideQuest) {
                row.picks.sideQuest = Core.defaultPicks(Core.form.includeThirdPlace).sideQuest;
            }
            if (!row.picks.sideQuest.scorePredict || typeof row.picks.sideQuest.scorePredict !== 'object') {
                row.picks.sideQuest.scorePredict = {};
            }
            row.picks.mainQuest = Core.normalizeMainQuestPicks(row.picks.mainQuest, {
                includeGroupStage: Core.form.includeGroupStage,
                includeKnockoutStage: Core.form.includeKnockoutStage,
            });
            return row;
        });
        Core.renderAll({ skipCollect: true });
        // Load league data is a user gesture — fill URL and autoplay preview.
        Core.syncBackgroundMusicFieldFromForm();
    }

})(window.ArisanSetupFormCore = window.ArisanSetupFormCore || {});
