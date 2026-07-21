/**
 * Supabase Postgres client for Arisan template (communities → leagues).
 * Tidak memakai Storage JSON.
 *
 * Set window.LEAGUE_CONTEXT = { communitySlug, leagueSlug, assetBase } sebelum fetch.
 * Biasanya lewat shared/js/league-context.js + URL
 *   /league/?community=…&league=…
 * assetBase: path ke communities/{slug}/assets/.
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

    function resolveAssetBase(ctx) {
        const raw = (ctx && ctx.assetBase) || '';
        if (/^https?:\/\//i.test(raw)) return raw.replace(/\/?$/, '/');
        // Prefer absolute /communities/{slug}/assets/ so ../../assets does not break
        // when the league URL has no trailing slash (…/wc-2026 vs …/wc-2026/).
        if (typeof location !== 'undefined' && ctx && ctx.communitySlug) {
            const path = location.pathname || '';
            const idx = path.indexOf('/communities/');
            const root = idx >= 0 ? path.slice(0, idx) : '';
            return root + '/communities/' + encodeURIComponent(ctx.communitySlug) + '/assets/';
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
        mainQuest: { win: 3, draw: 1, loss: 0 },
        sideQuest: {
            champion: 10, runnerup: 5, third: 3,
            goldenBoot: 5, goldenGlove: 5, totalGoal: 5,
        },
    };

    function normalizeSettings(raw) {
        const s = raw && typeof raw === 'object' ? raw : {};
        const pc = s.pointConfig || {};
        return {
            competitionType: s.competitionType === 'club' ? 'club' : 'country',
            includeThirdPlace: s.includeThirdPlace !== false,
            twoLegKnockout: !!s.twoLegKnockout,
            pointConfig: {
                mainQuest: Object.assign({}, DEFAULT_POINT_CONFIG.mainQuest, pc.mainQuest || {}),
                sideQuest: Object.assign({}, DEFAULT_POINT_CONFIG.sideQuest, pc.sideQuest || {}),
            },
            teamOrder: Array.isArray(s.teamOrder) ? s.teamOrder : [],
            matchSchedule: (s.matchSchedule && typeof s.matchSchedule === 'object') ? s.matchSchedule : {},
            scheduleStartDate: s.scheduleStartDate || '',
            scheduleKickoff: s.scheduleKickoff || '19:00',
            iconImageUrl: s.iconImageUrl || '',
            trophyImageUrl: s.trophyImageUrl || '',
            ballImageUrl: s.ballImageUrl || '',
            backgroundMusicUrl: s.backgroundMusicUrl || '',
        };
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

    function deriveFromParticipantPicks(participants, teams) {
        const teamSupporters = {};
        const sideQuestPodium = { champion: {}, runnerup: {}, third: {} };
        const goldenBootMap = {};
        const goldenGloveMap = {};
        const totalGoalData = [];

        const flagForTeam = (teamName) => {
            const t = (teams || []).find(x => x.name === teamName);
            return t && t.flag ? t.flag : '';
        };

        (participants || []).forEach(p => {
            const picks = p.picks || {};
            const pots = (picks.mainQuest && picks.mainQuest.pots) || [];
            pots.forEach(pot => {
                (pot.teams || []).forEach(teamName => {
                    if (!teamName) return;
                    if (!teamSupporters[teamName]) teamSupporters[teamName] = [];
                    if (!teamSupporters[teamName].includes(p.name)) teamSupporters[teamName].push(p.name);
                });
            });

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

        return {
            teamSupporters,
            sideQuestPodium,
            goldenBoot: Object.values(goldenBootMap),
            goldenGlove: Object.values(goldenGloveMap),
            totalGoalData,
        };
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
        let sideQuestPodium;
        let totalGoalData;
        let derivedAwards = null;

        if (hasParticipantPicks(bundle.participants)) {
            const derived = deriveFromParticipantPicks(bundle.participants, teams);
            teamSupporters = derived.teamSupporters;
            sideQuestPodium = derived.sideQuestPodium;
            totalGoalData = derived.totalGoalData;
            derivedAwards = { goldenBoot: derived.goldenBoot, goldenGlove: derived.goldenGlove };
        } else {
            teamSupporters = legacyTeamSupporters(bundle);
            sideQuestPodium = legacySideQuestPodium(bundle);
            totalGoalData = [];
            (bundle.participants || []).forEach(p => {
                if (p.total_goal_prediction != null) {
                    totalGoalData.push({ name: p.name, goal: p.total_goal_prediction });
                }
            });
        }

        const participantsMainQuest = (bundle.participants || []).map(p => {
            const picks = (p.picks && p.picks.mainQuest)
                ? p.picks
                : picksFromLegacy(p.name, bundle);
            const pots = (picks.mainQuest && picks.mainQuest.pots) || [{ teams: ['', ''] }];
            return {
                name: p.name,
                pots: pots.map(pot => {
                    const t = pot.teams || [];
                    return [t[0] || '', t[1] || ''];
                }),
            };
        });

        return {
            teamSupporters,
            participantAvatars,
            participantColors,
            totalGoalData,
            sideQuestPodium,
            participantsMainQuest,
            teams,
            settings,
            pointConfig: settings.pointConfig,
            competitionType: settings.competitionType,
            includeThirdPlace: settings.includeThirdPlace,
            twoLegKnockout: settings.twoLegKnockout,
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
        const settings = normalizeSettings({
            competitionType: setup.competitionType,
            includeThirdPlace: setup.includeThirdPlace,
            twoLegKnockout: setup.twoLegKnockout,
            pointConfig: setup.pointConfig,
            teamOrder: (setup.teams || []).map(t => t.name.trim()).filter(Boolean),
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

        const existingTeams = await rest('GET', 'teams?select=id&league_id=eq.' + leagueId) || [];
        if (existingTeams.length) {
            const teamIds = existingTeams.map(t => t.id).join(',');
            await rest('DELETE', 'team_supporters?team_id=in.(' + teamIds + ')', undefined, 'return=minimal');
        }
        await rest('DELETE', 'teams?league_id=eq.' + leagueId, undefined, 'return=minimal');
        await rest('DELETE', 'participants?league_id=eq.' + leagueId, undefined, 'return=minimal');
        await rest('DELETE', 'side_quests?league_id=eq.' + leagueId, undefined, 'return=minimal');
        await rest('DELETE', 'awards?league_id=eq.' + leagueId, undefined, 'return=minimal');

        const participantRows = (setup.participants || []).map((p, i) => ({
            league_id: leagueId,
            name: p.name.trim(),
            avatar_path: p.avatar_path || null,
            color: p.color || null,
            sort_order: i + 1,
            total_goal_prediction: (p.picks && p.picks.sideQuest && p.picks.sideQuest.totalGoal != null)
                ? p.picks.sideQuest.totalGoal
                : (p.total_goal_prediction != null ? p.total_goal_prediction : null),
            picks: p.picks || {},
        }));

        let insertedParticipants = [];
        if (participantRows.length) {
            insertedParticipants = await rest('POST', 'participants', participantRows) || [];
        }
        const participantIdByName = {};
        insertedParticipants.forEach(p => { participantIdByName[p.name] = p.id; });

        const teamRows = (setup.teams || []).map(t => ({
            league_id: leagueId,
            name: t.name.trim(),
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
            setup.teams || []
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
        derived.goldenBoot.forEach((a, i) => {
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
        derived.goldenGlove.forEach((a, i) => {
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

    function picksFromLegacy(participantName, bundle) {
        const picks = {
            mainQuest: { pots: [{ teams: ['', ''] }] },
            sideQuest: {
                champion: '', runnerup: '', third: '',
                goldenBoot: { player_name: '', img: '', team: '' },
                goldenGlove: { player_name: '', img: '', team: '' },
                totalGoal: null,
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
            picks.mainQuest.pots = [];
            for (let i = 0; i < supportedTeams.length; i += 2) {
                picks.mainQuest.pots.push({
                    teams: [supportedTeams[i] || '', supportedTeams[i + 1] || ''],
                });
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

        const teams = orderTeamsBySettings(
            (bundle.teams || []).map(t => ({
                name: t.name,
                flag: t.flag || '',
            })),
            settings.teamOrder
        );

        return {
            competitionType: settings.competitionType,
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
            participants: (bundle.participants || []).map((p, i) => ({
                name: p.name,
                avatar_path: p.avatar_path || '',
                color: p.color || '#3498db',
                picks: usePicks && p.picks && Object.keys(p.picks).length
                    ? p.picks
                    : picksFromLegacy(p.name, bundle),
            })),
            teams,
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
        bundleToAdminConfig,
        bundleToLeagueData,
        bundleToSetupForm,
    };
})();
