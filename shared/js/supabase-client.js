/**
 * Supabase Postgres client for Arisan template (communities → leagues).
 * Tidak memakai Storage JSON.
 *
 * Set window.LEAGUE_CONTEXT = { communitySlug, leagueSlug, assetBase } sebelum fetch.
 * Biasanya lewat shared/js/league-context.js + URL
 *   /league/?community=…&league=…
 * assetBase: optional override; default = Supabase Storage communities/{slug}/assets/.
 */
window.ARISAN_SUPABASE = {
    url: 'https://owexnrdvmragupmquwzr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZXhucmR2bXJhZ3VwbXF1d3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjYxNDAsImV4cCI6MjA5ODY0MjE0MH0.ykhaVTmZoQR0461t22mnIkcQtGCTWGYcK9mN9HQ_KCA',
};

window.ArisanDB = (function () {
    function cfg() {
        return window.ARISAN_SUPABASE || {};
    }

    function isConfigured() {
        const c = cfg();
        return !!(c.url && c.anonKey
            && !c.url.includes('YOUR_PROJECT')
            && !c.anonKey.includes('YOUR_ANON'));
    }

    function headers(extra) {
        const c = cfg();
        return Object.assign({
            apikey: c.anonKey,
            Authorization: 'Bearer ' + c.anonKey,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        }, extra || {});
    }

    async function rest(method, path, body, prefer) {
        const c = cfg();
        const url = c.url.replace(/\/$/, '') + '/rest/v1/' + path;
        const opts = {
            method,
            headers: headers(prefer ? { Prefer: prefer } : null),
            cache: 'no-store',
        };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.error || ('HTTP ' + res.status));
        }
        if (res.status === 204) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    function getContext() {
        const ctx = window.LEAGUE_CONTEXT || {};
        if (!ctx.communitySlug || !ctx.leagueSlug) {
            throw new Error('LEAGUE_CONTEXT.communitySlug / leagueSlug must be set');
        }
        return ctx;
    }

    const STORAGE_BUCKET = 'arisan-config';

    function communityAssetBase(communitySlug) {
        const c = cfg();
        const base = (c.url || '').replace(/\/$/, '');
        if (!base || !communitySlug) return '';
        return base + '/storage/v1/object/public/' + STORAGE_BUCKET + '/communities/'
            + encodeURIComponent(communitySlug) + '/assets/';
    }

    function resolveAssetBase(ctx) {
        const raw = (ctx && ctx.assetBase) || '';
        if (/^https?:\/\//i.test(raw)) return raw.replace(/\/?$/, '/');
        if (ctx && ctx.communitySlug) {
            const storage = communityAssetBase(ctx.communitySlug);
            if (storage) return storage;
        }
        return String(raw).replace(/\/?$/, '/');
    }

    function resolveAsset(pathOrUrl, assetBase) {
        if (pathOrUrl == null) return '';
        const s = String(pathOrUrl).trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s)) return s;
        if (/^\/\//.test(s)) return 'https:' + s;
        if (/^(data|blob):/i.test(s)) return s;
        const base = (assetBase || '').replace(/\/?$/, '/');
        return base + s.replace(/^\//, '');
    }

    async function resolveLeagueId(communitySlug, leagueSlug) {
        const leagues = await rest(
            'GET',
            'leagues?select=id,slug,title,year,timezone,last_updated,settings,communities!inner(slug,name)'
            + '&slug=eq.' + encodeURIComponent(leagueSlug)
            + '&communities.slug=eq.' + encodeURIComponent(communitySlug)
            + '&limit=1'
        );
        if (!leagues || !leagues.length) {
            throw new Error('League not found: ' + communitySlug + '/' + leagueSlug);
        }
        return leagues[0];
    }

    async function fetchLeagueBundle(communitySlug, leagueSlug) {
        const league = await resolveLeagueId(communitySlug, leagueSlug);
        const leagueId = league.id;
        const q = 'league_id=eq.' + leagueId;

        const [participants, teams, matches, awards, sideQuests] = await Promise.all([
            rest('GET', 'participants?select=*&' + q + '&order=sort_order.asc'),
            rest('GET', 'teams?select=id,name,flag&' + q + '&order=name.asc'),
            rest('GET', 'matches?select=*&' + q),
            rest('GET', 'awards?select=*&' + q + '&order=kind.asc,rank.asc'),
            rest('GET', 'side_quests?select=*&' + q),
        ]);

        let supporterRows = [];
        if (teams && teams.length) {
            const ids = teams.map(t => t.id).join(',');
            supporterRows = await rest(
                'GET',
                'team_supporters?select=team_id,participants(name)&team_id=in.(' + ids + ')'
            ) || [];
        }

        // Attach supporters by team_id
        const byTeam = {};
        (supporterRows || []).forEach(row => {
            if (!byTeam[row.team_id]) byTeam[row.team_id] = [];
            if (row.participants && row.participants.name) {
                byTeam[row.team_id].push({
                    participants: { name: row.participants.name },
                });
            }
        });
        const teamsWithSupporters = (teams || []).map(t => Object.assign({}, t, {
            team_supporters: byTeam[t.id] || [],
        }));

        const settings = normalizeSettings(league.settings);
        const orderedTeams = orderTeamsBySettings(teamsWithSupporters, settings.teamOrder);

        return {
            community: league.communities,
            league: {
                id: league.id,
                slug: league.slug,
                title: league.title,
                year: league.year,
                timezone: league.timezone,
                lastUpdated: league.last_updated,
                settings: settings,
            },
            participants: participants || [],
            teams: orderedTeams,
            matches: matches || [],
            awards: awards || [],
            sideQuests: sideQuests || [],
        };
    }

    function bundleToAdminConfig(bundle, assetBase) {
        const finishedMatches = (bundle.matches || [])
            .filter(m => m.status)
            .map(m => ({
                id: m.match_key,
                label: m.label || '',
                status: m.status,
                scores: m.scores,
                winner: m.winner,
            }));

        const mapAward = (a) => {
            const row = {
                name: a.player_name,
                img: resolveAsset(a.img, assetBase),
                supporters: a.supporters || [],
                eliminated: !!a.eliminated,
                winner: !!a.winner,
            };
            if (a.goals != null) row.goals = a.goals;
            if (a.country) row.country = a.country;
            if (a.flag) row.flag = a.flag;
            return row;
        };

        const mapDerivedAward = (a) => mapAward(a);

        function overlayAwardState(candidates, dbAwards, kind) {
            const byName = {};
            (dbAwards || []).filter(x => x.kind === kind).forEach(x => {
                byName[x.player_name.toLowerCase()] = x;
            });
            candidates.forEach(c => {
                const db = byName[(c.name || '').toLowerCase()];
                if (!db) return;
                if (db.goals != null) c.goals = db.goals;
                c.eliminated = !!db.eliminated;
                c.winner = !!db.winner;
                if (db.img) c.img = resolveAsset(db.img, assetBase);
            });
        }

        let goldenBoot;
        let goldenGlove;
        if (hasParticipantPicks(bundle.participants)) {
            const derived = deriveFromParticipantPicks(bundle.participants, bundle.teams || []);
            goldenBoot = derived.goldenBoot.map(mapDerivedAward);
            goldenGlove = derived.goldenGlove.map(mapDerivedAward);
            overlayAwardState(goldenBoot, bundle.awards, 'golden_boot');
            overlayAwardState(goldenGlove, bundle.awards, 'golden_glove');
        } else {
            goldenBoot = (bundle.awards || []).filter(a => a.kind === 'golden_boot').map(mapAward);
            goldenGlove = (bundle.awards || []).filter(a => a.kind === 'golden_glove').map(mapAward);
        }

        return {
            lastUpdated: bundle.league.lastUpdated || '',
            finishedMatches,
            goldenBoot,
            goldenGlove,
        };
    }

    const DEFAULT_POINT_CONFIG = {
        mainQuestMode: 'fixed',
        mainQuest: { win: 3, draw: 1, loss: 0 },
        teamPoints: {},
        sideQuest: {
            champion: 10, runnerup: 5, third: 3,
            goldenBoot: 5, goldenGlove: 5, totalGoal: 5, scorePredict: 5,
        },
        sideQuestShare: {
            champion: true, runnerup: true, third: true,
            goldenBoot: true, goldenGlove: true, totalGoal: true, scorePredict: true,
        },
    };

    function normalizeTeamPointRow(raw, mainQuestDefaults) {
        const r = raw && typeof raw === 'object' ? raw : {};
        const mq = mainQuestDefaults || DEFAULT_POINT_CONFIG.mainQuest;
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

    function normalizeTeamPointsMap(raw, mainQuestDefaults) {
        const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const out = {};
        Object.keys(src).forEach(name => {
            const key = String(name || '').trim();
            if (!key) return;
            out[key] = normalizeTeamPointRow(src[name], mainQuestDefaults);
        });
        return out;
    }

    function normalizePointConfig(raw) {
        const pc = raw && typeof raw === 'object' ? raw : {};
        const mainQuest = Object.assign({}, DEFAULT_POINT_CONFIG.mainQuest, pc.mainQuest || {});
        return {
            mainQuestMode: pc.mainQuestMode === 'fifa' ? 'fifa' : 'fixed',
            mainQuest,
            teamPoints: normalizeTeamPointsMap(pc.teamPoints, mainQuest),
            sideQuest: Object.assign({}, DEFAULT_POINT_CONFIG.sideQuest, pc.sideQuest || {}),
            sideQuestShare: Object.assign(
                {},
                DEFAULT_POINT_CONFIG.sideQuestShare,
                pc.sideQuestShare || {}
            ),
        };
    }

    function normalizeSettings(raw) {
        const s = raw && typeof raw === 'object' ? raw : {};
        return {
            competitionType: s.competitionType === 'club' ? 'club' : 'country',
            includeGroupStage: !!s.includeGroupStage,
            includeKnockoutStage: s.includeKnockoutStage !== false,
            includeThirdPlace: s.includeThirdPlace !== false,
            twoLegKnockout: !!s.twoLegKnockout,
            pointConfig: normalizePointConfig(s.pointConfig),
            groupPointRules: normalizeGroupPointRules(s.groupPointRules),
            groupTieResolutions: normalizeGroupTieResolutions(s.groupTieResolutions),
            teamOrder: Array.isArray(s.teamOrder) ? s.teamOrder : [],
            knockoutSeeds: normalizeKnockoutSeeds(s.knockoutSeeds),
            groupDefinitions: normalizeGroupDefinitions(s.groupDefinitions),
            groupFixtures: normalizeGroupFixtures(s.groupFixtures),
            knockoutFixtures: Array.isArray(s.knockoutFixtures) ? normalizeGroupFixtures(s.knockoutFixtures) : [],
            matchIdCounter: Math.max(0, parseInt(s.matchIdCounter, 10) || 0),
            matchSchedule: (s.matchSchedule && typeof s.matchSchedule === 'object') ? s.matchSchedule : {},
            fixtureSideSwaps: normalizeFixtureSideSwaps(s.fixtureSideSwaps),
            scheduleStartDate: s.scheduleStartDate || '',
            scheduleKickoff: s.scheduleKickoff || '19:00',
            iconImageUrl: s.iconImageUrl || '',
            trophyImageUrl: s.trophyImageUrl || '',
            ballImageUrl: s.ballImageUrl || '',
            backgroundMusicUrl: s.backgroundMusicUrl || '',
        };
    }

    function normalizeFixtureSideSwaps(raw) {
        const out = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
        Object.keys(raw).forEach(id => {
            const key = String(id || '').trim();
            if (key && raw[id]) out[key] = true;
        });
        return out;
    }

    function applyFixtureSideSwapsToGroupFixtures(fixtures, swaps) {
        const map = normalizeFixtureSideSwaps(swaps);
        return (fixtures || []).map((f, i) => {
            const key = f.id || ('group-' + i);
            if (!map[key] && !map['group-' + i]) return f;
            return Object.assign({}, f, { a: f.b, b: f.a });
        });
    }

    function normalizeKnockoutSeeds(raw) {
        if (!Array.isArray(raw)) return [];
        return raw.map(t => {
            if (typeof t === 'string') {
                const name = t.trim();
                return { name: (!name || name.toUpperCase() === 'TBD') ? '' : name, flag: '' };
            }
            const name = String((t && t.name) || '').trim();
            return {
                name: (!name || name.toUpperCase() === 'TBD') ? '' : name,
                flag: (t && t.flag) || '',
            };
        });
    }

    function normalizeGroupPointRules(raw) {
        const r = raw && typeof raw === 'object' ? raw : {};
        const toN = (v, d) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : d;
        };
        return {
            win: toN(r.win, 3),
            draw: toN(r.draw, 1),
            loss: toN(r.loss, 0),
        };
    }

    function normalizeGroupTieResolutions(raw) {
        const out = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
        Object.keys(raw).forEach(label => {
            const key = String(label || '').trim();
            if (!key) return;
            const list = Array.isArray(raw[label]) ? raw[label] : [];
            out[key] = list.map(n => String(n || '').trim()).filter(Boolean);
        });
        return out;
    }

    function normalizeGroupDefinitions(raw) {
        if (!Array.isArray(raw)) return [];
        return raw.map((g, i) => {
            const qualifyRaw = g && g.qualifyCount;
            const qualifyCount = qualifyRaw != null ? Math.max(0, parseInt(qualifyRaw, 10) || 0) : 2;
            return {
                label: String((g && (g.label || g.name)) || String.fromCharCode(65 + i)).trim() || String.fromCharCode(65 + i),
                teams: Array.isArray(g && g.teams)
                    ? g.teams.map(t => {
                        if (typeof t === 'string') return t.trim();
                        return String((t && t.name) || '').trim();
                    }).filter(Boolean)
                    : [],
                qualifyCount: qualifyCount || 2,
            };
        }).filter(g => g.teams.length);
    }

    function normalizeGroupFixtures(raw) {
        if (!Array.isArray(raw)) return [];
        return raw.map(f => {
            const row = {
                a: String((f && (f.a || f.teamA || f[0])) || '').trim(),
                b: String((f && (f.b || f.teamB || f[1])) || '').trim(),
                group: String((f && (f.group || f.groupLabel)) || '').trim(),
            };
            const id = String((f && f.id) || '').trim();
            if (id) row.id = id;
            const round = String((f && (f.round || f.roundLabel)) || '').trim();
            if (round) row.round = round;
            return row;
        }).filter(f => f.a || f.b || f.id || f.round);
    }

    /**
     * Restore bracket pair order from settings.teamOrder.
     * Teams are fetched alphabetically from DB; without this, Match 1/2 pairs scramble on load.
     */
    function orderTeamsBySettings(teams, teamOrder) {
        const list = teams || [];
        if (!Array.isArray(teamOrder) || !teamOrder.length || !list.length) return list;

        const byName = new Map();
        list.forEach(t => {
            if (t && t.name && !byName.has(t.name)) byName.set(t.name, t);
        });

        const ordered = [];
        const used = new Set();
        teamOrder.forEach(name => {
            const key = String(name || '').trim();
            if (!key || used.has(key) || !byName.has(key)) return;
            ordered.push(byName.get(key));
            used.add(key);
        });
        list.forEach(t => {
            if (t && t.name && !used.has(t.name)) ordered.push(t);
        });
        return ordered;
    }

    function ensureMainQuestPotList(pots) {
        if (!Array.isArray(pots) || !pots.length) return [{ teams: ['', ''] }];
        return pots.map((pot) => {
            const t = (pot && pot.teams) || [];
            return { teams: [t[0] || '', t[1] || ''] };
        });
    }

    function normalizeMainQuestPicks(mq, opts) {
        const options = opts || {};
        const raw = mq && typeof mq === 'object' ? mq : {};
        if (raw.group || raw.knockout) {
            return {
                group: { pots: ensureMainQuestPotList(raw.group && raw.group.pots) },
                knockout: { pots: ensureMainQuestPotList(raw.knockout && raw.knockout.pots) },
            };
        }
        const legacy = ensureMainQuestPotList(raw.pots);
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

    function potsToTeamPairs(pots) {
        return ensureMainQuestPotList(pots).map((pot) => {
            const t = pot.teams || [];
            return [t[0] || '', t[1] || ''];
        });
    }

    function addSupportersFromPots(map, pots, participantName) {
        (pots || []).forEach((pot) => {
            (pot.teams || []).forEach((teamName) => {
                if (!teamName) return;
                if (!map[teamName]) map[teamName] = [];
                if (!map[teamName].includes(participantName)) map[teamName].push(participantName);
            });
        });
    }

    function mergeSupporterMaps(a, b) {
        const out = {};
        [a || {}, b || {}].forEach((src) => {
            Object.keys(src).forEach((team) => {
                if (!out[team]) out[team] = [];
                (src[team] || []).forEach((name) => {
                    if (!out[team].includes(name)) out[team].push(name);
                });
            });
        });
        return out;
    }

    function deriveFromParticipantPicks(participants, teams, stageOpts) {
        const teamSupportersGroup = {};
        const teamSupportersKnockout = {};
        const sideQuestPodium = { champion: {}, runnerup: {}, third: {} };
        const goldenBootMap = {};
        const goldenGloveMap = {};
        const totalGoalData = [];
        const opts = stageOpts || {};

        const flagForTeam = (teamName) => {
            const t = (teams || []).find(x => x.name === teamName);
            return t && t.flag ? t.flag : '';
        };

        (participants || []).forEach(p => {
            const picks = p.picks || {};
            const mq = normalizeMainQuestPicks(picks.mainQuest, opts);
            addSupportersFromPots(teamSupportersGroup, mq.group.pots, p.name);
            addSupportersFromPots(teamSupportersKnockout, mq.knockout.pots, p.name);

            const sq = picks.sideQuest || {};
            ['champion', 'runnerup', 'third'].forEach(place => {
                const teamName = sq[place];
                if (!teamName) return;
                if (!sideQuestPodium[place][teamName]) {
                    sideQuestPodium[place][teamName] = {
                        flag: flagForTeam(teamName),
                        supporters: [],
                        eliminated: false,
                    };
                }
                if (!sideQuestPodium[place][teamName].supporters.includes(p.name)) {
                    sideQuestPodium[place][teamName].supporters.push(p.name);
                }
            });

            const boot = sq.goldenBoot || {};
            if (boot.player_name && boot.player_name.trim()) {
                const key = boot.player_name.trim().toLowerCase();
                if (!goldenBootMap[key]) {
                    goldenBootMap[key] = {
                        player_name: boot.player_name.trim(),
                        img: boot.img || '',
                        country: boot.team || '',
                        flag: flagForTeam(boot.team),
                        goals: 0,
                        eliminated: false,
                        winner: false,
                        supporters: [],
                    };
                }
                goldenBootMap[key].supporters.push(p.name);
            }

            const glove = sq.goldenGlove || {};
            if (glove.player_name && glove.player_name.trim()) {
                const key = glove.player_name.trim().toLowerCase();
                if (!goldenGloveMap[key]) {
                    goldenGloveMap[key] = {
                        player_name: glove.player_name.trim(),
                        img: glove.img || '',
                        country: glove.team || '',
                        flag: flagForTeam(glove.team),
                        eliminated: false,
                        winner: false,
                        supporters: [],
                    };
                }
                goldenGloveMap[key].supporters.push(p.name);
            }

            if (sq.totalGoal != null && sq.totalGoal !== '') {
                totalGoalData.push({ name: p.name, goal: sq.totalGoal });
            } else if (p.total_goal_prediction != null) {
                totalGoalData.push({ name: p.name, goal: p.total_goal_prediction });
            }
        });

        const teamSupporters = mergeSupporterMaps(teamSupportersGroup, teamSupportersKnockout);

        return {
            teamSupporters,
            teamSupportersGroup,
            teamSupportersKnockout,
            sideQuestPodium,
            goldenBoot: Object.values(goldenBootMap),
            goldenGlove: Object.values(goldenGloveMap),
            totalGoalData,
            scorePredictions: deriveScorePredictions(participants),
        };
    }

    /** { [matchId]: [{ name, a, b }, ...] } from participant picks. */
    function deriveScorePredictions(participants) {
        const byMatch = {};
        (participants || []).forEach(p => {
            const map = (p.picks && p.picks.sideQuest && p.picks.sideQuest.scorePredict) || {};
            if (!map || typeof map !== 'object') return;
            Object.keys(map).forEach(matchId => {
                const raw = map[matchId];
                if (!raw || typeof raw !== 'object') return;
                const a = parseInt(raw.a, 10);
                const b = parseInt(raw.b, 10);
                if (Number.isNaN(a) || Number.isNaN(b)) return;
                if (!byMatch[matchId]) byMatch[matchId] = [];
                byMatch[matchId].push({
                    name: p.name,
                    a: Math.max(0, a),
                    b: Math.max(0, b),
                });
            });
        });
        return byMatch;
    }

    /** Preserve admin-entered goals / eliminated / winner when league setup is re-saved. */
    function mergeDerivedAwardsWithExisting(derivedList, existingAwards, kind) {
        const byName = {};
        (existingAwards || []).filter(a => a.kind === kind).forEach(a => {
            byName[String(a.player_name || '').toLowerCase()] = a;
        });
        return (derivedList || []).map(a => {
            const db = byName[String(a.player_name || '').toLowerCase()];
            if (!db) return { ...a };
            return {
                ...a,
                goals: db.goals != null ? db.goals : a.goals,
                eliminated: !!db.eliminated,
                winner: !!db.winner,
                img: a.img || db.img || null,
            };
        });
    }

    function legacyTeamSupporters(bundle) {
        const teamSupporters = {};
        (bundle.teams || []).forEach(t => {
            const names = (t.team_supporters || [])
                .map(s => s.participants && s.participants.name)
                .filter(Boolean);
            teamSupporters[t.name] = names;
        });
        return teamSupporters;
    }

    function legacySideQuestPodium(bundle) {
        const sideQuestPodium = { champion: {}, runnerup: {}, third: {} };
        (bundle.sideQuests || []).forEach(sq => {
            if (!sideQuestPodium[sq.place]) sideQuestPodium[sq.place] = {};
            sideQuestPodium[sq.place][sq.team_name] = {
                flag: sq.flag,
                supporters: sq.supporters || [],
                eliminated: !!sq.eliminated,
            };
        });
        return sideQuestPodium;
    }

    function hasParticipantPicks(participants) {
        return (participants || []).some(p => {
            const picks = p.picks;
            if (!picks || typeof picks !== 'object') return false;
            return Object.keys(picks).length > 0;
        });
    }

    function bundleToLeagueData(bundle, assetBase) {
        const settings = normalizeSettings(bundle.league && bundle.league.settings);
        const teams = orderTeamsBySettings(
            (bundle.teams || []).map(t => {
                let flag = t.flag || '';
                if (!flag && settings.competitionType !== 'club' && typeof window !== 'undefined' && window.ArisanCountries) {
                    flag = window.ArisanCountries.getFlagCode(t.name) || '';
                }
                return { name: t.name, flag };
            }),
            settings.teamOrder
        );

        const participantAvatars = {};
        const participantColors = {};
        (bundle.participants || []).forEach(p => {
            participantAvatars[p.name] = resolveAsset(p.avatar_path, assetBase);
            if (p.color) participantColors[p.name] = p.color;
        });

        let teamSupporters;
        let teamSupportersGroup = {};
        let teamSupportersKnockout = {};
        let sideQuestPodium;
        let totalGoalData;
        let scorePredictions = {};
        let derivedAwards = null;

        const stageOpts = {
            includeGroupStage: !!settings.includeGroupStage,
            includeKnockoutStage: settings.includeKnockoutStage !== false,
        };

        if (hasParticipantPicks(bundle.participants)) {
            const derived = deriveFromParticipantPicks(bundle.participants, teams, stageOpts);
            teamSupporters = derived.teamSupporters;
            teamSupportersGroup = derived.teamSupportersGroup || {};
            teamSupportersKnockout = derived.teamSupportersKnockout || {};
            sideQuestPodium = derived.sideQuestPodium;
            totalGoalData = derived.totalGoalData;
            scorePredictions = derived.scorePredictions || {};
            derivedAwards = { goldenBoot: derived.goldenBoot, goldenGlove: derived.goldenGlove };
        } else {
            teamSupporters = legacyTeamSupporters(bundle);
            teamSupportersGroup = Object.assign({}, teamSupporters);
            teamSupportersKnockout = Object.assign({}, teamSupporters);
            sideQuestPodium = legacySideQuestPodium(bundle);
            totalGoalData = [];
            (bundle.participants || []).forEach(p => {
                if (p.total_goal_prediction != null) {
                    totalGoalData.push({ name: p.name, goal: p.total_goal_prediction });
                }
            });
            scorePredictions = deriveScorePredictions(bundle.participants);
        }

        const participantsMainQuest = (bundle.participants || []).map(p => {
            const picks = (p.picks && p.picks.mainQuest)
                ? p.picks
                : picksFromLegacy(p.name, bundle, stageOpts);
            const mq = normalizeMainQuestPicks(picks.mainQuest, stageOpts);
            return {
                name: p.name,
                groupPots: potsToTeamPairs(mq.group.pots),
                knockoutPots: potsToTeamPairs(mq.knockout.pots),
                // legacy alias (group pots) for older consumers
                pots: potsToTeamPairs(mq.group.pots),
            };
        });

        return {
            teamSupporters,
            teamSupportersGroup,
            teamSupportersKnockout,
            participantAvatars,
            participantColors,
            totalGoalData,
            sideQuestPodium,
            scorePredictions,
            participantsMainQuest,
            teams,
            settings,
            pointConfig: settings.pointConfig,
            competitionType: settings.competitionType,
            includeGroupStage: settings.includeGroupStage,
            includeKnockoutStage: settings.includeKnockoutStage,
            includeThirdPlace: settings.includeThirdPlace,
            twoLegKnockout: settings.twoLegKnockout,
            groupDefinitions: settings.groupDefinitions || [],
            groupFixtures: settings.groupFixtures || [],
            knockoutFixtures: settings.knockoutFixtures || [],
            groupPointRules: settings.groupPointRules || { win: 3, draw: 1, loss: 0 },
            groupTieResolutions: settings.groupTieResolutions || {},
            matchIdCounter: settings.matchIdCounter || 0,
            fixtureSideSwaps: settings.fixtureSideSwaps || {},
            knockoutSeeds: settings.knockoutSeeds || [],
            derivedAwards,
            title: bundle.league.title,
            communityName: bundle.community && bundle.community.name,
            year: bundle.league.year,
            matchSchedule: settings.matchSchedule || {},
            iconImageUrl: settings.iconImageUrl || '',
            trophyImageUrl: settings.trophyImageUrl || '',
            ballImageUrl: settings.ballImageUrl || '',
            backgroundMusicUrl: settings.backgroundMusicUrl || '',
        };
    }

    async function fetchConfig() {
        const ctx = getContext();
        const bundle = await fetchLeagueBundle(ctx.communitySlug, ctx.leagueSlug);
        const assetBase = resolveAssetBase(ctx);
        window.__ARISAN_BUNDLE = bundle;
        window.LEAGUE_DATA = bundleToLeagueData(bundle, assetBase);
        return bundleToAdminConfig(bundle, assetBase);
    }

    async function saveAdminConfig(config) {
        const ctx = getContext();
        const league = await resolveLeagueId(ctx.communitySlug, ctx.leagueSlug);
        const leagueId = league.id;

        await rest('PATCH', 'leagues?id=eq.' + leagueId, {
            last_updated: config.lastUpdated || null,
        }, 'return=minimal');

        if (config.groupTieResolutions && typeof config.groupTieResolutions === 'object') {
            const current = normalizeSettings(league.settings || {});
            current.groupTieResolutions = normalizeGroupTieResolutions(config.groupTieResolutions);
            await rest('PATCH', 'leagues?id=eq.' + leagueId, {
                settings: current,
            }, 'return=minimal');
            if (window.LEAGUE_DATA) {
                window.LEAGUE_DATA.groupTieResolutions = current.groupTieResolutions;
                if (window.LEAGUE_DATA.settings) {
                    window.LEAGUE_DATA.settings.groupTieResolutions = current.groupTieResolutions;
                }
            }
        }

        // Upsert matches
        const matchRows = (config.finishedMatches || []).map(m => ({
            league_id: leagueId,
            match_key: m.id,
            label: m.label || null,
            status: m.status || null,
            scores: m.scores || null,
            winner: (m.winner === 0 || m.winner === 1) ? m.winner : null,
        }));

        if (matchRows.length) {
            await rest(
                'POST',
                'matches?on_conflict=league_id,match_key',
                matchRows,
                'resolution=merge-duplicates,return=minimal'
            );
        }

        // Replace awards
        await rest('DELETE', 'awards?league_id=eq.' + leagueId, undefined, 'return=minimal');

        const awardRows = [];
        (config.goldenBoot || []).forEach((a, i) => {
            awardRows.push({
                league_id: leagueId,
                kind: 'golden_boot',
                rank: i,
                player_name: a.name,
                img: a.img || null,
                goals: a.goals != null ? a.goals : null,
                country: a.country || null,
                flag: a.flag || null,
                eliminated: !!a.eliminated,
                winner: !!a.winner,
                supporters: a.supporters || [],
            });
        });
        (config.goldenGlove || []).forEach((a, i) => {
            awardRows.push({
                league_id: leagueId,
                kind: 'golden_glove',
                rank: i,
                player_name: a.name,
                img: a.img || null,
                goals: a.goals != null ? a.goals : null,
                country: a.country || null,
                flag: a.flag || null,
                eliminated: !!a.eliminated,
                winner: !!a.winner,
                supporters: a.supporters || [],
            });
        });
        if (awardRows.length) {
            await rest('POST', 'awards', awardRows, 'return=minimal');
        }

        return config;
    }

    async function listCommunities() {
        return rest('GET', 'communities?select=slug,name,settings&order=name.asc');
    }

    async function listLeagues(communitySlug) {
        return rest(
            'GET',
            'leagues?select=slug,title,year,created_at,communities!inner(slug)'
            + '&communities.slug=eq.' + encodeURIComponent(communitySlug)
            + '&order=created_at.desc'
        );
    }

    async function resolveCommunityId(slug) {
        const rows = await rest(
            'GET',
            'communities?select=id,slug,name,settings&slug=eq.' + encodeURIComponent(slug) + '&limit=1'
        );
        if (!rows || !rows.length) return null;
        return rows[0];
    }

    async function upsertCommunity(slug, name, settings) {
        const existing = await resolveCommunityId(slug);
        if (existing) {
            await rest('PATCH', 'communities?id=eq.' + existing.id, {
                name: name || existing.name,
                settings: settings || existing.settings || {},
            }, 'return=minimal');
            return existing.id;
        }
        const rows = await rest('POST', 'communities', {
            slug,
            name,
            settings: settings || {},
        });
        return rows[0].id;
    }

    async function upsertLeague(communitySlug, data) {
        const community = await resolveCommunityId(communitySlug);
        if (!community) throw new Error('Community not found: ' + communitySlug);

        const existing = await rest(
            'GET',
            'leagues?select=id&community_id=eq.' + community.id
            + '&slug=eq.' + encodeURIComponent(data.slug) + '&limit=1'
        );

        const payload = {
            community_id: community.id,
            slug: data.slug,
            title: data.title,
            year: data.year != null ? data.year : null,
            timezone: data.timezone || 'Asia/Jakarta',
        };
        if (data.settings) payload.settings = data.settings;

        if (existing && existing.length) {
            await rest('PATCH', 'leagues?id=eq.' + existing[0].id, payload, 'return=minimal');
            return existing[0].id;
        }
        const rows = await rest('POST', 'leagues', payload);
        return rows[0].id;
    }

    /**
     * Simpan konfigurasi awal liga: peserta, negara, supporters, awards kandidat, side quest.
     * Tidak menyentuh tabel matches (skor playoff di admin liga terpisah).
     */
    async function saveLeagueSetup(communitySlug, leagueSlug, setup) {
        const groupDefinitions = (typeof ArisanBracket !== 'undefined' && ArisanBracket.normalizeGroupDefinitions)
            ? ArisanBracket.normalizeGroupDefinitions(setup.groupDefinitions)
            : normalizeGroupDefinitions(setup.groupDefinitions);
        let groupFixtures = normalizeGroupFixtures(setup.groupFixtures);
        // Manual schedule only — never regenerate round-robin from group definitions.
        let matchIdCounter = Math.max(0, parseInt(setup.matchIdCounter, 10) || 0);
        groupFixtures = groupFixtures.map(f => {
            if (f.id) return f;
            matchIdCounter += 1;
            return Object.assign({}, f, { id: 'gmatch-' + matchIdCounter });
        });
        let knockoutFixtures = normalizeGroupFixtures(setup.knockoutFixtures).map(f => {
            if (f.id) return f;
            matchIdCounter += 1;
            return Object.assign({}, f, {
                id: 'komatch-' + matchIdCounter,
                round: f.round || '',
            });
        });
        setup.matchIdCounter = matchIdCounter;
        const fixtureSideSwaps = normalizeFixtureSideSwaps(setup.fixtureSideSwaps);
        groupFixtures = applyFixtureSideSwapsToGroupFixtures(groupFixtures, fixtureSideSwaps);

        const uniqueTeamRows = [];
        const seenTeamNames = new Set();
        function pushUniqueTeam(name, flag) {
            const n = String(name || '').trim();
            if (!n) return;
            const key = n.toLowerCase();
            if (seenTeamNames.has(key)) return;
            seenTeamNames.add(key);
            uniqueTeamRows.push({ name: n, flag: flag || null });
        }
        (setup.teams || []).forEach(t => pushUniqueTeam(t.name, t.flag));
        groupDefinitions.forEach(g => (g.teams || []).forEach(n => pushUniqueTeam(n, null)));
        groupFixtures.forEach(f => {
            pushUniqueTeam(f.a, null);
            pushUniqueTeam(f.b, null);
        });

        const settings = normalizeSettings({
            competitionType: setup.competitionType,
            includeGroupStage: setup.includeGroupStage,
            includeKnockoutStage: setup.includeKnockoutStage,
            includeThirdPlace: setup.includeThirdPlace,
            twoLegKnockout: setup.twoLegKnockout,
            pointConfig: setup.pointConfig,
            groupPointRules: setup.groupPointRules,
            groupTieResolutions: setup.groupTieResolutions,
            teamOrder: uniqueTeamRows.map(t => t.name),
            knockoutSeeds: Array.isArray(setup.knockoutSeeds)
                ? normalizeKnockoutSeeds(setup.knockoutSeeds)
                : [],
            groupDefinitions,
            groupFixtures,
            knockoutFixtures,
            matchIdCounter,
            fixtureSideSwaps,
            matchSchedule: setup.matchSchedule || {},
            scheduleStartDate: setup.scheduleStartDate || '',
            scheduleKickoff: setup.scheduleKickoff || '19:00',
            iconImageUrl: setup.iconImageUrl || '',
            trophyImageUrl: setup.trophyImageUrl || '',
            ballImageUrl: setup.ballImageUrl || '',
            backgroundMusicUrl: setup.backgroundMusicUrl || '',
        });

        const leagueId = await upsertLeague(communitySlug, {
            slug: leagueSlug,
            title: setup.league.title,
            year: setup.league.year,
            timezone: setup.league.timezone,
            settings,
        });

        const existingAwards = await rest('GET', 'awards?select=*&league_id=eq.' + leagueId) || [];

        const existingTeams = await rest('GET', 'teams?select=id&league_id=eq.' + leagueId) || [];
        if (existingTeams.length) {
            const teamIds = existingTeams.map(t => t.id).join(',');
            await rest('DELETE', 'team_supporters?team_id=in.(' + teamIds + ')', undefined, 'return=minimal');
        }
        await rest('DELETE', 'teams?league_id=eq.' + leagueId, undefined, 'return=minimal');
        await rest('DELETE', 'participants?league_id=eq.' + leagueId, undefined, 'return=minimal');
        await rest('DELETE', 'side_quests?league_id=eq.' + leagueId, undefined, 'return=minimal');
        await rest('DELETE', 'awards?league_id=eq.' + leagueId, undefined, 'return=minimal');

        const stageOpts = {
            includeGroupStage: !!setup.includeGroupStage,
            includeKnockoutStage: setup.includeKnockoutStage !== false,
        };

        const participantRows = (setup.participants || []).map((p, i) => {
            const picks = Object.assign({}, p.picks || {});
            picks.mainQuest = normalizeMainQuestPicks(picks.mainQuest, stageOpts);
            return {
                league_id: leagueId,
                name: p.name.trim(),
                avatar_path: p.avatar_path || null,
                color: p.color || null,
                sort_order: i + 1,
                total_goal_prediction: (picks.sideQuest && picks.sideQuest.totalGoal != null)
                    ? picks.sideQuest.totalGoal
                    : (p.total_goal_prediction != null ? p.total_goal_prediction : null),
                picks,
            };
        });

        let insertedParticipants = [];
        if (participantRows.length) {
            insertedParticipants = await rest('POST', 'participants', participantRows) || [];
        }
        const participantIdByName = {};
        insertedParticipants.forEach(p => { participantIdByName[p.name] = p.id; });

        const teamRows = uniqueTeamRows.map(t => ({
            league_id: leagueId,
            name: t.name,
            flag: t.flag || null,
        }));

        let insertedTeams = [];
        if (teamRows.length) {
            insertedTeams = await rest('POST', 'teams', teamRows) || [];
        }
        const teamIdByName = {};
        insertedTeams.forEach(t => { teamIdByName[t.name] = t.id; });

        const derived = deriveFromParticipantPicks(
            (setup.participants || []).map(p => ({ name: p.name.trim(), picks: p.picks })),
            setup.teams || [],
            {
                includeGroupStage: !!setup.includeGroupStage,
                includeKnockoutStage: setup.includeKnockoutStage !== false,
            }
        );

        const mergedGoldenBoot = mergeDerivedAwardsWithExisting(
            derived.goldenBoot, existingAwards, 'golden_boot'
        );
        const mergedGoldenGlove = mergeDerivedAwardsWithExisting(
            derived.goldenGlove, existingAwards, 'golden_glove'
        );

        const supporterRows = [];
        Object.entries(derived.teamSupporters).forEach(([teamName, names]) => {
            const teamId = teamIdByName[teamName];
            if (!teamId) return;
            names.forEach(name => {
                const pid = participantIdByName[name];
                if (pid) supporterRows.push({ team_id: teamId, participant_id: pid });
            });
        });
        if (supporterRows.length) {
            await rest('POST', 'team_supporters', supporterRows, 'return=minimal');
        }

        const sideRows = [];
        ['champion', 'runnerup', 'third'].forEach(place => {
            Object.entries(derived.sideQuestPodium[place] || {}).forEach(([teamName, meta]) => {
                sideRows.push({
                    league_id: leagueId,
                    place,
                    team_name: teamName,
                    flag: meta.flag || null,
                    eliminated: !!meta.eliminated,
                    supporters: meta.supporters || [],
                });
            });
        });
        if (sideRows.length) {
            await rest('POST', 'side_quests', sideRows, 'return=minimal');
        }

        const awardRows = [];
        mergedGoldenBoot.forEach((a, i) => {
            awardRows.push({
                league_id: leagueId,
                kind: 'golden_boot',
                rank: i,
                player_name: a.player_name,
                img: a.img || null,
                goals: a.goals != null ? a.goals : 0,
                country: a.country || null,
                flag: a.flag || null,
                eliminated: !!a.eliminated,
                winner: !!a.winner,
                supporters: a.supporters || [],
            });
        });
        mergedGoldenGlove.forEach((a, i) => {
            awardRows.push({
                league_id: leagueId,
                kind: 'golden_glove',
                rank: i,
                player_name: a.player_name,
                img: a.img || null,
                goals: null,
                country: a.country || null,
                flag: a.flag || null,
                eliminated: !!a.eliminated,
                winner: !!a.winner,
                supporters: a.supporters || [],
            });
        });
        if (awardRows.length) {
            await rest('POST', 'awards', awardRows, 'return=minimal');
        }

        return { leagueId };
    }

    function picksFromLegacy(participantName, bundle, stageOpts) {
        const mq = normalizeMainQuestPicks(null, stageOpts || {
            includeGroupStage: !!(bundle.league && bundle.league.settings && bundle.league.settings.includeGroupStage),
            includeKnockoutStage: !(bundle.league && bundle.league.settings && bundle.league.settings.includeKnockoutStage === false),
        });
        const picks = {
            mainQuest: mq,
            sideQuest: {
                champion: '', runnerup: '', third: '',
                goldenBoot: { player_name: '', img: '', team: '' },
                goldenGlove: { player_name: '', img: '', team: '' },
                totalGoal: null,
                scorePredict: {},
            },
        };

        const supportedTeams = [];
        (bundle.teams || []).forEach(t => {
            const names = (t.team_supporters || [])
                .map(s => s.participants && s.participants.name)
                .filter(Boolean);
            if (names.includes(participantName)) supportedTeams.push(t.name);
        });
        if (supportedTeams.length) {
            const potList = [];
            for (let i = 0; i < supportedTeams.length; i += 2) {
                potList.push({
                    teams: [supportedTeams[i] || '', supportedTeams[i + 1] || ''],
                });
            }
            const opts = stageOpts || {};
            if (opts.includeGroupStage && !opts.includeKnockoutStage) {
                picks.mainQuest.group.pots = potList;
            } else if (!opts.includeGroupStage && opts.includeKnockoutStage !== false) {
                picks.mainQuest.knockout.pots = potList;
            } else {
                picks.mainQuest.group.pots = potList;
            }
        }

        ['champion', 'runnerup', 'third'].forEach(place => {
            (bundle.sideQuests || []).forEach(sq => {
                if (sq.place === place && (sq.supporters || []).includes(participantName)) {
                    picks.sideQuest[place] = sq.team_name;
                }
            });
        });

        (bundle.awards || []).forEach(a => {
            if (!(a.supporters || []).includes(participantName)) return;
            if (a.kind === 'golden_boot') {
                picks.sideQuest.goldenBoot = {
                    player_name: a.player_name,
                    img: a.img || '',
                    team: a.country || '',
                };
            }
            if (a.kind === 'golden_glove') {
                picks.sideQuest.goldenGlove = {
                    player_name: a.player_name,
                    img: a.img || '',
                    team: a.country || '',
                };
            }
        });

        const pRow = (bundle.participants || []).find(p => p.name === participantName);
        if (pRow && pRow.total_goal_prediction != null) {
            picks.sideQuest.totalGoal = pRow.total_goal_prediction;
        }

        return picks;
    }

    function bundleToSetupForm(bundle) {
        const settings = normalizeSettings(bundle.league && bundle.league.settings);
        const usePicks = hasParticipantPicks(bundle.participants);
        const stageOpts = {
            includeGroupStage: !!settings.includeGroupStage,
            includeKnockoutStage: settings.includeKnockoutStage !== false,
        };

        const teams = orderTeamsBySettings(
            (bundle.teams || []).map(t => ({
                name: t.name,
                flag: t.flag || '',
            })),
            settings.teamOrder
        );

        return {
            competitionType: settings.competitionType,
            includeGroupStage: settings.includeGroupStage,
            includeKnockoutStage: settings.includeKnockoutStage,
            includeThirdPlace: settings.includeThirdPlace,
            twoLegKnockout: settings.twoLegKnockout,
            pointConfig: settings.pointConfig,
            matchSchedule: settings.matchSchedule || {},
            scheduleStartDate: settings.scheduleStartDate || '',
            scheduleKickoff: settings.scheduleKickoff || '19:00',
            iconImageUrl: settings.iconImageUrl || '',
            trophyImageUrl: settings.trophyImageUrl || '',
            ballImageUrl: settings.ballImageUrl || '',
            backgroundMusicUrl: settings.backgroundMusicUrl || '',
            league: {
                title: bundle.league.title,
                year: bundle.league.year,
                timezone: bundle.league.timezone || 'Asia/Jakarta',
            },
            participants: (bundle.participants || []).map((p, i) => {
                const rawPicks = usePicks && p.picks && Object.keys(p.picks).length
                    ? p.picks
                    : picksFromLegacy(p.name, bundle, stageOpts);
                const picks = Object.assign({}, rawPicks, {
                    mainQuest: normalizeMainQuestPicks(rawPicks.mainQuest, stageOpts),
                });
                return {
                    name: p.name,
                    avatar_path: p.avatar_path || '',
                    color: p.color || '#3498db',
                    picks,
                };
            }),
            teams,
            groupDefinitions: settings.groupDefinitions || [],
            groupFixtures: settings.groupFixtures || [],
            knockoutFixtures: settings.knockoutFixtures || [],
            groupPointRules: settings.groupPointRules || { win: 3, draw: 1, loss: 0 },
            groupTieResolutions: settings.groupTieResolutions || {},
            matchIdCounter: settings.matchIdCounter || 0,
            fixtureSideSwaps: settings.fixtureSideSwaps || {},
            knockoutSeeds: settings.knockoutSeeds || [],
        };
    }

    // Backward-compatible alias used by old pages
    const ArisanConfigSources = {
        isConfigured,
        fetchConfig,
        uploadConfig: saveAdminConfig,
        getPublicConfigUrl() { return null; },
    };

    window.ArisanConfigSources = ArisanConfigSources;

    return {
        isConfigured,
        fetchLeagueBundle,
        fetchConfig,
        saveAdminConfig,
        saveLeagueSetup,
        listCommunities,
        listLeagues,
        resolveCommunityId,
        upsertCommunity,
        upsertLeague,
        resolveAsset,
        communityAssetBase,
        bundleToAdminConfig,
        bundleToLeagueData,
        bundleToSetupForm,
    };
})();
