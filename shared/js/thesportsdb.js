/**
 * TheSportsDB lookups — free tier key "3" for development.
 * https://www.thesportsdb.com/api.php
 *
 * Free player search returns 1 result; club/player use curated catalogs +
 * query expansion for contains-friendly autocomplete. League uses curated list
 * + lookupleague.php for icons.
 */
window.ArisanTheSportsDB = (function () {
    const API_KEY = '3';
    const BASE = 'https://www.thesportsdb.com/api/v1/json/' + API_KEY;

    const CURATED_LEAGUES = [
        { id: '4429', name: 'FIFA World Cup', aliases: ['world cup', 'wc', 'fifa wc'] },
        { id: '4503', name: 'FIFA Club World Cup', aliases: ['club world cup', 'cwc'] },
        { id: '4502', name: 'UEFA European Championships', aliases: ['euros', 'uefa euro', 'european championship'] },
        { id: '4480', name: 'UEFA Champions League', aliases: ['ucl', 'champions league'] },
        { id: '4481', name: 'UEFA Europa League', aliases: ['uel', 'europa league'] },
        { id: '4512', name: 'UEFA Super Cup', aliases: ['super cup europe'] },
        { id: '4501', name: 'Copa Libertadores', aliases: ['libertadores'] },
        { id: '4328', name: 'English Premier League', aliases: ['epl', 'premier league'] },
        { id: '4329', name: 'English League Championship', aliases: ['efl championship', 'championship'] },
        { id: '4500', name: 'Copa Argentina', aliases: ['argentina cup'] },
        { id: '4511', name: 'Supercopa de Espana', aliases: ['spanish super cup'] },
        { id: '4505', name: 'International Champions Cup', aliases: ['icc'] },
        { id: '5819', name: 'Finalissima', aliases: ['artemio franchi'] },
    ];

    /** Popular clubs for local contains matching (API searchteams is not substring-friendly). */
    const CURATED_CLUBS = [
        'Manchester United', 'Manchester City', 'Liverpool', 'Chelsea', 'Arsenal', 'Tottenham Hotspur',
        'Newcastle United', 'Aston Villa', 'West Ham United', 'Brighton & Hove Albion', 'Nottingham Forest',
        'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Real Sociedad',
        'Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig',
        'Juventus', 'Inter Milan', 'AC Milan', 'Napoli', 'AS Roma', 'Lazio',
        'Paris Saint Germain', 'Marseille', 'Monaco', 'Lyon',
        'Ajax', 'PSV', 'Feyenoord', 'Benfica', 'Porto', 'Sporting CP',
        'Inter Miami', 'LA Galaxy', 'New York City FC',
        'Persib', 'Persija', 'Arema', 'Persebaya', 'Bali United',
        'Al Hilal', 'Al Nassr', 'Al Ahli',
    ];

    /** Popular players for local contains matching when API is too strict. */
    const CURATED_PLAYERS = [
        'Lionel Messi', 'Cristiano Ronaldo', 'Ronaldo Nazário', 'Kylian Mbappe', 'Erling Haaland', 'Lamine Yamal',
        'Vinicius Junior', 'Jude Bellingham', 'Kevin De Bruyne', 'Mohamed Salah', 'Harry Kane',
        'Robert Lewandowski', 'Pedri', 'Gavi', 'Phil Foden', 'Bukayo Saka', 'Cole Palmer',
        'Rodri', 'Declan Rice', 'Martin Odegaard', 'Bruno Fernandes', 'Son Heung-min',
        'Emiliano Martinez', 'Alisson', 'Thibaut Courtois', 'Ederson', 'Manuel Neuer',
        'Unai Simon', 'Nico Williams', 'Inaki Williams', 'Nicolas Gaitan',
        'Antoine Griezmann', 'Neymar', 'Karim Benzema', 'Lautaro Martinez', 'Victor Osimhen',
        'Jamal Musiala', 'Florian Wirtz', 'Kai Havertz', 'Raphinha', 'Ousmane Dembele',
        'Federico Valverde', 'Rodrygo', 'Eduardo Camavinga', 'Aurelien Tchouameni',
        'Ronaldinho', 'Rivaldo', 'Romário', 'Kaká',
    ];

    /**
     * Profiles for players missing/weak in TheSportsDB free search
     * (e.g. Ronaldo Nazário is not returned by searchplayers.php).
     */
    const CURATED_PLAYER_PROFILES = {
        'Ronaldo Nazário': {
            aliases: [
                'Ronaldo Luís Nazário', 'Ronaldo Luis Nazario', 'Ronaldo Nazario',
                'Ronaldo Nazario de Lima', 'Ronaldo Luís Nazário de Lima',
                'Luis Nazario', 'Luís Nazário', 'R9', 'Il Fenomeno', 'O Fenomeno',
            ],
            nationality: 'Brazil',
            team: '_Retired Soccer',
        },
        'Cristiano Ronaldo': {
            aliases: ['CR7', 'Cristiano'],
            nationality: 'Portugal',
        },
        'Lionel Messi': {
            aliases: ['Leo Messi', 'Messi'],
            nationality: 'Argentina',
        },
        'Ronaldinho': {
            aliases: ['Ronaldinho Gaúcho', 'Ronaldinho Gaucho'],
            nationality: 'Brazil',
        },
        'Romário': {
            aliases: ['Romario'],
            nationality: 'Brazil',
        },
        'Kaká': {
            aliases: ['Kaka', 'Ricardo Kaka'],
            nationality: 'Brazil',
        },
    };

    /**
     * TheSportsDB player search is picky on short queries ("nico" → only Nicolas Gaitan).
     * Expand nicknames / prefixes to full names for contains-friendly results.
     */
    const PLAYER_QUERY_EXPANSIONS = {
        nico: ['Nico Williams', 'Nicolas Gaitan', 'Nico Paz'],
        williams: ['Nico Williams', 'Inaki Williams'],
        messi: ['Lionel Messi'],
        ronaldo: ['Cristiano Ronaldo', 'Ronaldo Nazário'],
        nazario: ['Ronaldo Nazário'],
        'nazário': ['Ronaldo Nazário'],
        fenomeno: ['Ronaldo Nazário'],
        r9: ['Ronaldo Nazário'],
        cristiano: ['Cristiano Ronaldo'],
        cr7: ['Cristiano Ronaldo'],
        mbappe: ['Kylian Mbappe'],
        haaland: ['Erling Haaland'],
        yamal: ['Lamine Yamal'],
        vini: ['Vinicius Junior'],
        vinicius: ['Vinicius Junior'],
        salah: ['Mohamed Salah'],
        neymar: ['Neymar'],
        unai: ['Unai Simon'],
        simon: ['Unai Simon'],
        courtois: ['Thibaut Courtois'],
        alisson: ['Alisson'],
        ederson: ['Ederson'],
        bellingham: ['Jude Bellingham'],
        foden: ['Phil Foden'],
        saka: ['Bukayo Saka'],
        palmer: ['Cole Palmer'],
        odegaard: ['Martin Odegaard'],
        'de bruyne': ['Kevin De Bruyne'],
        kdb: ['Kevin De Bruyne'],
        ronaldinho: ['Ronaldinho'],
        rivaldo: ['Rivaldo'],
        romario: ['Romário'],
        kaka: ['Kaká'],
    };

    const CLUB_QUERY_EXPANSIONS = {
        manchester: ['Manchester United', 'Manchester City'],
        'man u': ['Manchester United'],
        'man united': ['Manchester United'],
        'man city': ['Manchester City'],
        city: ['Manchester City', 'New York City FC'],
        united: ['Manchester United', 'Newcastle United', 'West Ham United', 'Bali United', 'Leeds United'],
        inter: ['Inter Milan', 'Inter Miami'],
        milan: ['AC Milan', 'Inter Milan'],
        madrid: ['Real Madrid', 'Atletico Madrid'],
        barcelona: ['Barcelona'],
        bayern: ['Bayern Munich'],
        psg: ['Paris Saint Germain'],
        'paris saint': ['Paris Saint Germain'],
        liverpool: ['Liverpool'],
        chelsea: ['Chelsea'],
        arsenal: ['Arsenal'],
        tottenham: ['Tottenham Hotspur'],
        spurs: ['Tottenham Hotspur'],
        juventus: ['Juventus'],
        ajax: ['Ajax'],
        dortmund: ['Borussia Dortmund'],
        leverkusen: ['Bayer Leverkusen'],
        newcastle: ['Newcastle United'],
        brighton: ['Brighton & Hove Albion'],
        west: ['West Ham United'],
        nottingham: ['Nottingham Forest'],
        persib: ['Persib'],
        persija: ['Persija'],
        arema: ['Arema'],
    };

    function asArray(value) {
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
    }

    function normalizeText(s) {
        return String(s || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Unai Simón → unai simon
    }

    /** Shared contains scoring: exact > startsWith > word contains > substring contains. */
    function scoreContainsMatch(query, texts) {
        const q = normalizeText(query);
        if (!q) return 0;
        const list = (Array.isArray(texts) ? texts : [texts])
            .map(normalizeText)
            .filter(Boolean);
        if (!list.length) return 0;

        let best = 0;
        list.forEach(text => {
            if (text === q) best = Math.max(best, 100);
            else if (text.startsWith(q)) best = Math.max(best, 90);
            else if (new RegExp('(?:^|\\s|[-./])' + escapeRegExp(q) + '(?:$|\\s|[-./])').test(text)) {
                best = Math.max(best, 80);
            } else if (text.includes(q)) best = Math.max(best, 70);
            else if (q.includes(text) && text.length >= 3) best = Math.max(best, 40);
        });
        return best;
    }

    function escapeRegExp(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function tokenizeName(s) {
        return normalizeText(s)
            .split(/[^a-z0-9]+/)
            .filter(t => t.length >= 2);
    }

    /**
     * Match multi-word queries like "Ronaldo Luís Nazário" to "Ronaldo Nazário"
     * (TheSportsDB / curated names often omit middle names).
     */
    function scoreTokenOverlap(query, name) {
        const qTokens = tokenizeName(query);
        const nTokens = tokenizeName(name);
        if (!qTokens.length || !nTokens.length) return 0;

        const tokenHit = (a, b) => a === b
            || (a.length >= 3 && b.startsWith(a))
            || (b.length >= 3 && a.startsWith(b));

        const qHits = qTokens.filter(qt => nTokens.some(nt => tokenHit(qt, nt)));
        const nHits = nTokens.filter(nt => qTokens.some(qt => tokenHit(qt, nt)));
        if (!qHits.length) return 0;

        if (nHits.length === nTokens.length && nTokens.length >= 2) return 92;
        if (qHits.length === qTokens.length) return 95;
        if (qHits.length >= 2 && qHits.length >= Math.ceil(qTokens.length * 0.6)) return 78;
        if (qTokens.length === 1 && qHits.length === 1) return 70;
        if (qHits.length === 1 && qHits[0].length >= 5) return 55;
        return 0;
    }

    function textMatchesQuery(text, query) {
        return scoreContainsMatch(query, text) > 0 || scoreTokenOverlap(query, text) > 0;
    }

    function textContainsQuery(text, query) {
        return scoreContainsMatch(query, text) > 0;
    }

    function curatedProfileForName(name) {
        const key = Object.keys(CURATED_PLAYER_PROFILES).find(
            n => normalizeText(n) === normalizeText(name)
        );
        return key ? Object.assign({ name: key }, CURATED_PLAYER_PROFILES[key]) : null;
    }

    function pickPlayerCutout(player) {
        if (!player) return '';
        return (player.strCutout || '').trim();
    }

    function pickPlayerPreviewThumb(player) {
        if (!player) return '';
        return (player.strCutout || player.strThumb || player.strRender || '').trim();
    }

    function isTransparentPlayerImageUrl(url) {
        const s = String(url || '').trim();
        if (!s) return false;
        return /\/cutout\//i.test(s) || /removebg|transparent/i.test(s);
    }

    /**
     * Multiply-blend only for TheSportsDB white-bg thumbs (helps them sit on dark UI).
     * Studio photos (black/green bg, Transfermarkt, FAM, etc.) must stay unblended.
     */
    function shouldApplyOpaquePlayerBlend(url) {
        const s = String(url || '').trim();
        if (!s || isTransparentPlayerImageUrl(s)) return false;
        return /thesportsdb\.com/i.test(s) && /\/preview\/|\/thumb\//i.test(s);
    }

    function applyPlayerImgBlend(img, url) {
        if (!img) return;
        img.classList.toggle('player-img-opaque-bg', shouldApplyOpaquePlayerBlend(url));
    }

    function scorePlayerMatch(query, player) {
        const name = player.strPlayer || player.name || '';
        const team = player.strTeam || player.team || '';
        let score = Math.max(
            scoreContainsMatch(query, [name, team]),
            scoreTokenOverlap(query, name)
        );
        const profile = curatedProfileForName(name);
        if (profile && Array.isArray(profile.aliases)) {
            profile.aliases.forEach(alias => {
                score = Math.max(
                    score,
                    scoreContainsMatch(query, alias),
                    scoreTokenOverlap(query, alias)
                );
            });
        }
        const rel = parseFloat(player.relevance);
        if (score > 0 && Number.isFinite(rel)) score += Math.min(rel, 10) / 100;
        return score;
    }

    async function fetchPlayerList(name) {
        const q = String(name || '').trim();
        if (q.length < 2) return [];

        const res = await fetch(BASE + '/searchplayers.php?p=' + encodeURIComponent(q));
        if (!res.ok) throw new Error('TheSportsDB HTTP ' + res.status);

        const data = await res.json();
        return asArray(data && data.player);
    }

    function mapPlayerRow(player, fallbackName) {
        const cutout = pickPlayerCutout(player);
        return {
            id: player.idPlayer || '',
            name: player.strPlayer || fallbackName || '',
            img: cutout,
            hasCutout: !!cutout,
            previewThumb: pickPlayerPreviewThumb(player),
            team: player.strTeam || '',
            nationality: player.strNationality || '',
        };
    }

    function playerExpansionQueries(query) {
        const q = normalizeText(query);
        const out = new Set();

        Object.keys(PLAYER_QUERY_EXPANSIONS).forEach(key => {
            const names = PLAYER_QUERY_EXPANSIONS[key];
            if (textMatchesQuery(key, q) || textMatchesQuery(q, key)) {
                names.forEach(name => out.add(name));
            }
            names.forEach(name => {
                if (textMatchesQuery(name, q)) out.add(name);
            });
        });

        CURATED_PLAYERS.forEach(name => {
            if (textMatchesQuery(name, q)) out.add(name);
        });

        Object.keys(CURATED_PLAYER_PROFILES).forEach(name => {
            const profile = CURATED_PLAYER_PROFILES[name];
            if (textMatchesQuery(name, q)) out.add(name);
            (profile.aliases || []).forEach(alias => {
                if (textMatchesQuery(alias, q) || textMatchesQuery(q, alias)) out.add(name);
            });
        });

        return [...out];
    }

    function curatedPlayerStub(fullName) {
        const profile = curatedProfileForName(fullName) || {};
        return {
            idPlayer: 'curated:' + fullName,
            strPlayer: fullName,
            strTeam: profile.team || '',
            strNationality: profile.nationality || '',
            strSport: 'Soccer',
            strCutout: profile.cutout || '',
            strThumb: profile.thumb || '',
        };
    }

    async function searchPlayers(name, limit) {
        const q = String(name || '').trim();
        if (q.length < 2) return [];

        const expansions = playerExpansionQueries(q);
        const queries = [q, ...expansions.filter(x => normalizeText(x) !== normalizeText(q))];

        const chunks = await Promise.all(queries.map(async query => {
            try {
                return await fetchPlayerList(query);
            } catch (e) {
                return [];
            }
        }));

        expansions.forEach(fullName => {
            chunks.push([curatedPlayerStub(fullName)]);
        });

        const byKey = new Map();
        chunks.flat().forEach(player => {
            if (!player) return;
            const sport = String(player.strSport || '').toLowerCase();
            if (sport && sport !== 'soccer' && sport !== 'football') return;

            const key = String(player.idPlayer || '') || normalizeText(player.strPlayer);
            if (!key) return;
            const score = scorePlayerMatch(q, player);
            if (score <= 0) return;
            const prev = byKey.get(key);
            if (!prev || score > prev._score) {
                byKey.set(key, Object.assign({ _score: score }, player));
            }
        });

        const max = limit || 8;
        const ranked = [...byKey.values()]
            .sort((a, b) => (b._score - a._score) || String(a.strPlayer).localeCompare(String(b.strPlayer)));

        const byName = new Map();
        ranked.forEach(player => {
            const key = normalizeText(player.strPlayer);
            const prev = byName.get(key);
            if (!prev) {
                byName.set(key, player);
                return;
            }
            const prevCurated = String(prev.idPlayer || '').startsWith('curated:');
            const curCurated = String(player.idPlayer || '').startsWith('curated:');
            const prevCutout = !!(prev.strCutout || '').trim();
            const curCutout = !!(player.strCutout || '').trim();
            if (prevCurated && !curCurated) byName.set(key, player);
            else if (!prevCutout && curCutout) byName.set(key, player);
            else if ((player._score || 0) > (prev._score || 0)) byName.set(key, player);
        });

        return [...byName.values()]
            .sort((a, b) => {
                const scoreDiff = (b._score || 0) - (a._score || 0);
                // Prefer stronger name match over cutout availability
                if (Math.abs(scoreDiff) >= 8) return scoreDiff;
                const cutA = !!(a.strCutout || '').trim() ? 1 : 0;
                const cutB = !!(b.strCutout || '').trim() ? 1 : 0;
                if (cutA !== cutB) return cutB - cutA;
                const freeA = /free agent/i.test(a.strTeam || '') ? 1 : 0;
                const freeB = /free agent/i.test(b.strTeam || '') ? 1 : 0;
                if (freeA !== freeB) return freeA - freeB;
                return scoreDiff || String(a.strPlayer).localeCompare(String(b.strPlayer));
            })
            .slice(0, max)
            .map(p => {
                const row = mapPlayerRow(p, q);
                const profile = curatedProfileForName(row.name);
                if (profile) {
                    if (!row.nationality && profile.nationality) row.nationality = profile.nationality;
                    if (!row.team && profile.team) row.team = profile.team;
                    if (!row.img && profile.cutout) {
                        row.img = profile.cutout;
                        row.hasCutout = true;
                    }
                    if (!row.previewThumb && (profile.cutout || profile.thumb)) {
                        row.previewThumb = profile.cutout || profile.thumb;
                    }
                }
                return row;
            })
            .filter(p => p.name && textMatchesQuery(p.name, q));
    }

    async function searchPlayer(name) {
        try {
            const direct = await fetchPlayerList(name);
            const soccer = direct.filter(p => {
                const sport = String(p.strSport || '').toLowerCase();
                return !sport || sport === 'soccer' || sport === 'football';
            });
            const best = soccer
                .filter(p => textMatchesQuery(p.strPlayer || '', name)
                    || normalizeText(p.strPlayer) === normalizeText(name))
                .sort((a, b) => {
                    const scoreDiff = scorePlayerMatch(name, b) - scorePlayerMatch(name, a);
                    if (scoreDiff) return scoreDiff;
                    const ca = !!(a.strCutout || '').trim() ? 1 : 0;
                    const cb = !!(b.strCutout || '').trim() ? 1 : 0;
                    return cb - ca;
                })[0];
            if (best) {
                const row = mapPlayerRow(best, name);
                const profile = curatedProfileForName(row.name);
                if (profile && !row.nationality) row.nationality = profile.nationality || '';
                return row;
            }
        } catch (e) {}

        const players = await searchPlayers(name, 5);
        const exact = players.find(p => normalizeText(p.name) === normalizeText(name));
        const aliased = players.find(p => {
            const profile = curatedProfileForName(p.name);
            if (!profile) return false;
            if (normalizeText(profile.name) === normalizeText(name)) return true;
            return (profile.aliases || []).some(a => normalizeText(a) === normalizeText(name)
                || textMatchesQuery(a, name));
        });
        return exact || aliased || players[0] || null;
    }

    function isDefunctTeam(team) {
        const league = String(team && team.strLeague || '').toLowerCase();
        return league.includes('defunct');
    }

    function isNoLeagueTeam(team) {
        const league = String(team && team.strLeague || '').trim();
        return !league || league.startsWith('_') || /^_?no league/i.test(league);
    }

    function pickClubBadge(team) {
        if (!team) return '';
        return (team.strBadge || team.strLogo || '').trim();
    }

    function pickClubPreviewThumb(team) {
        if (!team) return '';
        return (team.strBadge || team.strLogo || team.strBanner || '').trim();
    }

    function scoreTeamMatch(query, team) {
        const name = team.strTeam || team.name || '';
        const alt = team.strTeamAlternate || '';
        const short = team.strTeamShort || '';
        let score = scoreContainsMatch(query, [name, short].concat(
            String(alt).split(',').map(s => s.trim())
        ));
        if (score > 0 && isDefunctTeam(team)) score = Math.max(1, score - 50);
        else if (score > 0 && isNoLeagueTeam(team)) score = Math.max(1, score - 15);
        return score;
    }

    function expansionQueriesFor(query) {
        const q = normalizeText(query);
        const out = new Set();

        Object.keys(CLUB_QUERY_EXPANSIONS).forEach(key => {
            const names = CLUB_QUERY_EXPANSIONS[key];
            if (textContainsQuery(key, q) || textContainsQuery(q, key)) {
                names.forEach(name => out.add(name));
            }
            names.forEach(name => {
                if (textContainsQuery(name, q)) out.add(name);
            });
        });

        CURATED_CLUBS.forEach(name => {
            if (textContainsQuery(name, q)) out.add(name);
        });

        return [...out];
    }

    async function fetchTeamsByQuery(query) {
        const res = await fetch(BASE + '/searchteams.php?t=' + encodeURIComponent(query));
        if (!res.ok) throw new Error('TheSportsDB HTTP ' + res.status);
        const data = await res.json();
        return asArray(data && data.teams);
    }

    function mapClubRow(team, fallbackName) {
        const badge = pickClubBadge(team);
        return {
            id: team.idTeam || '',
            name: team.strTeam || fallbackName || '',
            badge,
            previewThumb: pickClubPreviewThumb(team),
            hasBadge: !!badge,
            country: team.strCountry || '',
            league: team.strLeague || '',
            defunct: isDefunctTeam(team),
        };
    }

    async function searchTeams(name, limit) {
        const q = String(name || '').trim();
        if (q.length < 2) return [];

        const expansions = expansionQueriesFor(q);
        const queries = [q, ...expansions.filter(x => normalizeText(x) !== normalizeText(q))];

        const chunks = await Promise.all(queries.map(async query => {
            try {
                return await fetchTeamsByQuery(query);
            } catch (e) {
                return [];
            }
        }));

        // Keep curated contains hits even if API returns nothing for that exact query
        expansions.forEach(fullName => {
            chunks.push([{
                idTeam: 'curated:' + fullName,
                strTeam: fullName,
                strTeamAlternate: '',
                strTeamShort: '',
                strBadge: '',
                strLogo: '',
                strCountry: '',
                strLeague: '',
            }]);
        });

        const byId = new Map();
        chunks.flat().forEach(team => {
            if (!team) return;
            const id = String(team.idTeam || '') || normalizeText(team.strTeam);
            if (!id) return;
            const score = scoreTeamMatch(q, team);
            if (score <= 0) return;
            const prev = byId.get(id);
            // Prefer real API rows (with badge) over curated placeholders
            const preferNew = !prev
                || score > prev._score
                || (score === prev._score && pickClubBadge(team) && !pickClubBadge(prev));
            if (preferNew) {
                byId.set(id, Object.assign({ _score: score }, team));
            }
        });

        // Prefer API team with same name over curated placeholder
        const byName = new Map();
        [...byId.values()].forEach(team => {
            const key = normalizeText(team.strTeam);
            const prev = byName.get(key);
            const isCurated = String(team.idTeam || '').startsWith('curated:');
            if (!prev) {
                byName.set(key, team);
                return;
            }
            const prevCurated = String(prev.idTeam || '').startsWith('curated:');
            if (prevCurated && !isCurated) byName.set(key, team);
            else if (!prevCurated && isCurated) return;
            else if ((team._score || 0) > (prev._score || 0)) byName.set(key, team);
        });

        const max = limit || 8;
        const ranked = [...byName.values()]
            .sort((a, b) => {
                // Defunct last; no-league after normal leagues; then score
                const rankA = isDefunctTeam(a) ? 2 : (isNoLeagueTeam(a) ? 1 : 0);
                const rankB = isDefunctTeam(b) ? 2 : (isNoLeagueTeam(b) ? 1 : 0);
                if (rankA !== rankB) return rankA - rankB;
                return (b._score || 0) - (a._score || 0)
                    || String(a.strTeam).localeCompare(String(b.strTeam));
            });

        // Hide only true defunct teams when better matches exist
        const nonDefunct = ranked.filter(t => !isDefunctTeam(t));
        const chosen = (nonDefunct.length ? nonDefunct : ranked).slice(0, max);

        return chosen
            .map(t => mapClubRow(t, q))
            .filter(t => t.name && textContainsQuery(t.name, q));
    }

    async function searchTeam(name) {
        const teams = await searchTeams(name, 1);
        const best = teams[0];
        if (!best) return null;
        // If curated placeholder without badge, try one more targeted API lookup
        if (!best.badge && best.name) {
            try {
                const rows = await fetchTeamsByQuery(best.name);
                const exact = rows.find(t => normalizeText(t.strTeam) === normalizeText(best.name))
                    || rows.find(t => textContainsQuery(t.strTeam, best.name));
                if (exact) {
                    const mapped = mapClubRow(exact, best.name);
                    if (mapped.badge) return mapped;
                }
            } catch (e) {}
        }
        if (!best.badge) return best;
        return best;
    }

    function pickLeagueIcon(league) {
        if (!league) return '';
        return (league.strTrophy || league.strBadge || league.strLogo || '').trim();
    }

    function pickLeaguePreviewThumb(league) {
        if (!league) return '';
        return (league.strBadge || league.strLogo || league.strTrophy || '').trim();
    }

    function parseYearFromSeason(season) {
        const s = String(season || '').trim();
        if (!s) return null;
        const years = s.match(/\d{4}/g);
        if (!years || !years.length) return null;
        return parseInt(years[years.length - 1], 10);
    }

    function scoreLeagueMatch(query, row) {
        return scoreContainsMatch(query, [row.name].concat(row.aliases || []));
    }

    function searchLeagues(query, limit) {
        const q = String(query || '').trim();
        if (q.length < 2) return [];
        const max = limit || 8;
        return CURATED_LEAGUES
            .map(row => ({
                id: row.id,
                name: row.name,
                score: scoreLeagueMatch(q, row),
            }))
            .filter(row => row.score > 0)
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            .slice(0, max);
    }

    async function lookupLeague(id) {
        const leagueId = String(id || '').trim();
        if (!leagueId) return null;

        const res = await fetch(BASE + '/lookupleague.php?id=' + encodeURIComponent(leagueId));
        if (!res.ok) throw new Error('TheSportsDB HTTP ' + res.status);

        const data = await res.json();
        const league = data && data.leagues;
        if (!league || !league.idLeague) return null;

        const icon = pickLeagueIcon(league);
        return {
            id: league.idLeague,
            name: league.strLeague || '',
            country: league.strCountry || '',
            sport: league.strSport || '',
            season: league.strCurrentSeason || '',
            year: parseYearFromSeason(league.strCurrentSeason),
            icon,
            badge: (league.strBadge || '').trim(),
            logo: (league.strLogo || '').trim(),
            trophy: (league.strTrophy || '').trim(),
            previewThumb: pickLeaguePreviewThumb(league),
            hasIcon: !!icon,
        };
    }

    async function searchLeaguesDetailed(query, limit) {
        return searchLeagues(query, limit);
    }

    return {
        searchPlayer,
        searchPlayers,
        searchTeam,
        searchTeams,
        pickPlayerCutout,
        pickPlayerPreviewThumb,
        pickClubBadge,
        isTransparentPlayerImageUrl,
        applyPlayerImgBlend,
        searchLeagues,
        searchLeaguesDetailed,
        lookupLeague,
        pickLeagueIcon,
        scoreContainsMatch,
        CURATED_LEAGUES,
        CURATED_CLUBS,
        CURATED_PLAYERS,
    };
})();
