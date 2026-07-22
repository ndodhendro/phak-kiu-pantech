/**
 * League setup form logic (admin/setup.html).
 */
window.ArisanSetupForm = (function () {
    const DEFAULT_POINT_CONFIG = {
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

    const DEFAULT_PARTICIPANT_COLORS = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
        '#e91e63', '#ff5722', '#00bcd4', '#8bc34a', '#ffc107', '#795548',
    ];

    function defaultPicks(includeThirdPlace) {
        return {
            mainQuest: { pots: [{ teams: ['', ''] }] },
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

    function ensureScorePredictPicks(p) {
        if (!p.picks) p.picks = defaultPicks(form.includeThirdPlace);
        if (!p.picks.sideQuest) p.picks.sideQuest = defaultPicks(form.includeThirdPlace).sideQuest;
        if (!p.picks.sideQuest.scorePredict || typeof p.picks.sideQuest.scorePredict !== 'object') {
            p.picks.sideQuest.scorePredict = {};
        }
        return p.picks.sideQuest.scorePredict;
    }

    function normalizeScorePredictEntry(raw) {
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

    function emptyParticipant(index) {
        return {
            name: '',
            avatar_path: '',
            color: DEFAULT_PARTICIPANT_COLORS[index % DEFAULT_PARTICIPANT_COLORS.length],
            picks: defaultPicks(true),
        };
    }

    let form = {
        competitionType: 'country',
        includeGroupStage: false,
        includeKnockoutStage: true,
        includeThirdPlace: true,
        twoLegKnockout: false,
        pointConfig: normalizePointConfig(null),
        teams: [],
        groupDefinitions: [],
        groupFixtures: [],
        participants: [],
        matchSchedule: {},
        scheduleStartDate: '',
        scheduleKickoff: '19:00',
        iconImageUrl: '',
        trophyImageUrl: '',
        ballImageUrl: '',
        backgroundMusicUrl: '',
    };
    const participantOpenState = {};
    const stageOpenState = { group: true, knockout: true };

    function isStageOpen(key) {
        return stageOpenState[key] !== false;
    }

    function captureParticipantOpenState() {
        document.querySelectorAll('.participant-row').forEach(row => {
            participantOpenState[row.dataset.idx] = row.classList.contains('is-open');
        });
    }

    function isParticipantOpenByDefault(index) {
        return Object.prototype.hasOwnProperty.call(participantOpenState, String(index))
            ? participantOpenState[index]
            : index === 0;
    }

    function participantHeaderLabel(p, index) {
        const name = p.name && String(p.name).trim();
        return 'Participant ' + (index + 1) +
            (name ? '<span class="participant-name-label"> — ' + esc(name) + '</span>' : '');
    }

    function syncParticipantHeaderLabel(row, name) {
        const strong = row.querySelector('.participant-toggle strong');
        if (!strong) return;
        const index = +row.dataset.idx;
        const trimmed = name && String(name).trim();
        strong.innerHTML = 'Participant ' + (index + 1) +
            (trimmed ? '<span class="participant-name-label"> — ' + esc(trimmed) + '</span>' : '');
    }

    function bindParticipantCollapse(row) {
        const index = row.dataset.idx;
        const btn = row.querySelector('.participant-toggle');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const open = row.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            participantOpenState[index] = open;
        });
    }

    const DEFAULT_CLUB_FLAG = 'https://img.icons8.com/ios-filled/50/6b7280/shield.png';
    const DEFAULT_PLAYER_SILHOUETTE = 'https://img.icons8.com/ios-filled/50/6b7280/user-male-circle.png';
    const DEFAULT_LEAGUE_ICON = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT41kl1nnX-tqBQiGHVikOIDViXDZXRRulNdKFAK6c1eQ&s=10';
    const DEFAULT_TROPHY_IMG = 'https://png.pngtree.com/png-vector/20250923/ourmid/pngtree-the-fifa-world-cup-trophy-png-image_17551611.webp';
    const DEFAULT_BALL_IMG = 'https://png.pngtree.com/png-vector/20260610/ourmid/pngtree-vibrant-trionda-soccer-football-official-fifa-world-cup-2026-design-png-image_19512258.webp';

    function isValidTeamCount(count) {
        return Number.isInteger(count) && count >= 2 && count % 2 === 0;
    }

    function getTeamCountHint() {
        if (form.includeGroupStage) {
            const defs = form.groupDefinitions || [];
            const unique = uniqueTeamsFromGroups(defs).length;
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
        const filled = form.teams.filter(t => normalizeSeedName(t.name)).length;
        const slots = form.teams.length;
        return 'Add knockout bracket pairs (+ Match). TBD allowed. Currently '
            + slots + ' slot(s), ' + filled + ' named.';
    }

    function isTeamsSectionComplete() {
        if (form.includeGroupStage) {
            if (validateGroupDefinitionsForSave(form.groupDefinitions)) return false;
            if (!form.includeKnockoutStage) return true;
        }
        if (!form.includeKnockoutStage) return false;
        if (!isValidTeamCount(form.teams.length)) return false;
        // Knockout slots may be TBD (empty) — structure only needs an even slot count.
        return true;
    }

    function normalizeSeedName(name) {
        const n = String(name || '').trim();
        if (!n || n.toUpperCase() === 'TBD') return '';
        return n;
    }

    function validateGroupDefinitionsForSave(defs) {
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

    function collectTakenGroupCountries(exceptGidx, exceptTidx) {
        const taken = new Set();
        (form.groupDefinitions || []).forEach((g, gi) => {
            (g.teams || []).forEach((t, ti) => {
                if (gi === exceptGidx && ti === exceptTidx) return;
                const name = typeof t === 'string' ? t.trim() : String((t && t.name) || '').trim();
                if (name) taken.add(name.toLowerCase());
            });
        });
        return taken;
    }

    function validateTeamsForSave(teams, opts) {
        const options = opts || {};
        if (options.includeGroupStage) {
            const gErr = validateGroupDefinitionsForSave(options.groupDefinitions || form.groupDefinitions);
            if (gErr) return gErr;
            if (!options.includeKnockoutStage) return null;
        }

        if (!options.includeKnockoutStage) return null;

        const list = (teams || []).map(t => ({
            name: normalizeSeedName(t.name),
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

    function uniqueTeamsFromGroups(defs) {
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

    function emptyGroup(index) {
        return {
            label: String.fromCharCode(65 + (index || 0)),
            teams: [emptyTeam(), emptyTeam(), emptyTeam(), emptyTeam()],
        };
    }

    function ensureInitialGroups() {
        if (!form.groupDefinitions.length) {
            form.groupDefinitions.push(emptyGroup(0), emptyGroup(1));
        }
    }

    function fixturesFromTeamPairs(teams) {
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

    function teamPairsFromFixtures(fixtures, flagByName) {
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

    function uniqueTeamsFromPairs(teams) {
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

    function getDefaultScheduleKickoff() {
        return (form.scheduleKickoff || '19:00').trim() || '19:00';
    }

    function getLeagueYearFromDom() {
        const el = document.getElementById('league-year');
        const y = el ? parseInt(el.value, 10) : NaN;
        return Number.isNaN(y) ? new Date().getFullYear() : y;
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

    function definitionsForCatalog() {
        return (form.groupDefinitions || []).map((g, i) => ({
            label: (g.label || String.fromCharCode(65 + i)).trim(),
            teams: (g.teams || []).map(t => (t.name || '').trim()).filter(Boolean),
        }));
    }

    function getScheduleCatalog() {
        if (typeof ArisanBracket === 'undefined' || !isTeamsSectionComplete()) return [];
        const fromGroups = form.includeGroupStage ? uniqueTeamsFromGroups(form.groupDefinitions) : [];
        const knockoutTeams = form.includeKnockoutStage
            ? form.teams.map(t => ({
                name: normalizeSeedName(t.name),
                flag: normalizeSeedName(t.name) ? (t.flag || '') : '',
            }))
            : [];
        const byKey = new Map();
        [...fromGroups, ...knockoutTeams.filter(t => t.name)].forEach(t => {
            const key = t.name.toLowerCase();
            if (!byKey.has(key)) byKey.set(key, t);
        });
        const catalogTeams = form.includeKnockoutStage && knockoutTeams.length
            ? knockoutTeams
            : Array.from(byKey.values());
        const defs = form.includeGroupStage ? definitionsForCatalog() : [];
        const groupFixtures = (defs.length && ArisanBracket.fixturesFromGroupDefinitions)
            ? ArisanBracket.fixturesFromGroupDefinitions(defs)
            : (form.groupFixtures || []);
        const catalog = ArisanBracket.buildMatchCatalog({
            teams: catalogTeams,
            groupDefinitions: defs,
            groupFixtures,
            competitionType: form.competitionType,
            includeGroupStage: form.includeGroupStage,
            includeKnockoutStage: form.includeKnockoutStage,
            includeThirdPlace: form.includeThirdPlace,
            twoLegKnockout: form.twoLegKnockout,
        });
        return sortScheduleCatalogAscending(catalog);
    }

    /** Match 1, Match 2, … by round then index (ascending). */
    function sortScheduleCatalogAscending(catalog) {
        const roundOrder = { group: 0, r32: 1, r16: 2, qf: 3, sf: 4, third: 5, final: 6 };
        function parts(id) {
            const raw = String(id || '');
            const legM = raw.match(/^(.*)-leg([12])$/);
            const base = legM ? legM[1] : raw;
            const leg = legM ? parseInt(legM[2], 10) : 0;
            const koM = base.match(/^(ko-\d+)-(\d+)$/);
            if (koM) {
                return {
                    prefix: koM[1].toLowerCase(),
                    num: parseInt(koM[2], 10),
                    leg,
                    koRound: parseInt(koM[1].slice(3), 10),
                };
            }
            // Prefixes may include digits (r32, r16) — do not stop at first letter run.
            const m = base.match(/^([a-z]+\d*)-(\d+)$/i);
            return {
                prefix: m ? m[1].toLowerCase() : base.toLowerCase(),
                num: m ? parseInt(m[2], 10) : 0,
                leg,
            };
        }
        return (catalog || []).slice().sort((a, b) => {
            const pa = parts(a.id);
            const pb = parts(b.id);
            if (pa.koRound != null && pb.koRound != null && pa.koRound !== pb.koRound) {
                return pa.koRound - pb.koRound;
            }
            const ra = roundOrder[pa.prefix] != null ? roundOrder[pa.prefix] : (pa.prefix.startsWith('ko-') ? 50 + (pa.koRound || 0) : 99);
            const rb = roundOrder[pb.prefix] != null ? roundOrder[pb.prefix] : (pb.prefix.startsWith('ko-') ? 50 + (pb.koRound || 0) : 99);
            if (ra !== rb) return ra - rb;
            if (pa.num !== pb.num) return pa.num - pb.num;
            return pa.leg - pb.leg;
        });
    }

    /** Pull date/time values from the schedule UI into form.matchSchedule. */
    function collectScheduleFromDom() {
        const preview = document.getElementById('schedule-preview');
        if (!preview) return;
        preview.querySelectorAll('.schedule-edit-row').forEach(syncScheduleFromRow);
    }

    function pruneMatchSchedule() {
        const catalog = getScheduleCatalog();
        // Incomplete teams / empty catalog must NOT wipe schedules — that was wiping
        // playoff times whenever a team name was briefly incomplete during edit.
        if (!catalog.length) return;
        const valid = new Set(catalog.map(c => c.id));
        const next = {};
        Object.keys(form.matchSchedule || {}).forEach(id => {
            if (valid.has(id) && form.matchSchedule[id]) next[id] = form.matchSchedule[id];
        });
        form.matchSchedule = next;
    }

    /** Parse stored schedule text → { date: YYYY-MM-DD, time: HH:mm } (WIB wall clock). */
    function scheduleTextToParts(text) {
        const raw = String(text || '').replace(/^✅\s*/, '').trim();
        if (!raw) return { date: '', time: '' };

        const year = getLeagueYearFromDom();
        let day; let month; let hour; let minute;

        let m = raw.match(/^(?:\w+,\s*)?(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
        if (m) {
            const mi = MONTH_INDEX[m[2].toLowerCase()];
            if (mi === undefined) return { date: '', time: '' };
            day = parseInt(m[1], 10);
            month = mi + 1;
            hour = parseInt(m[3], 10);
            minute = parseInt(m[4], 10);
        } else {
            m = raw.match(/^(?:\w+,\s*)?(\d{1,2})\/(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
            if (!m) return { date: '', time: '' };
            // legacy month/day
            month = parseInt(m[1], 10);
            day = parseInt(m[2], 10);
            hour = parseInt(m[3], 10);
            minute = parseInt(m[4], 10);
        }

        return {
            date: year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
            time: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'),
        };
    }

    /** Build schedule display string: `Tue, 30 Jun, 08:00 WIB`. */
    function partsToScheduleText(dateStr, timeStr) {
        if (!dateStr || !timeStr) return '';
        const dm = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const tm = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
        if (!dm || !tm) return '';
        const year = parseInt(dm[1], 10);
        const month = parseInt(dm[2], 10);
        const day = parseInt(dm[3], 10);
        const hour = parseInt(tm[1], 10);
        const minute = parseInt(tm[2], 10);
        const wd = WEEKDAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
        return wd + ', ' + day + ' ' + MONTH_SHORT[month - 1] + ', ' +
            String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ' WIB';
    }

    function parseHhMm(timeStr) {
        const m = String(timeStr || '').match(/^(\d{1,2}):(\d{2})/);
        if (!m) return { hour: '19', minute: '00' };
        return {
            hour: String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0'),
            minute: String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0'),
        };
    }

    function buildTimeSelectOptions(max, selected) {
        let html = '';
        for (let i = 0; i <= max; i++) {
            const v = String(i).padStart(2, '0');
            html += '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + v + '</option>';
        }
        return html;
    }

    function scheduleTimeInputsHtml(timeValue) {
        const parts = parseHhMm(timeValue || getDefaultScheduleKickoff());
        return '<div class="schedule-time-24h" title="Kickoff WIB (24-hour)">' +
            '<select data-schedule-hour aria-label="Hour (24h)">' +
            buildTimeSelectOptions(23, parts.hour) +
            '</select>' +
            '<span class="schedule-time-sep" aria-hidden="true">:</span>' +
            '<select data-schedule-minute aria-label="Minute">' +
            buildTimeSelectOptions(59, parts.minute) +
            '</select>' +
            '</div>';
    }

    function getScheduleTimeFromRow(row) {
        const hourEl = row.querySelector('[data-schedule-hour]');
        const minuteEl = row.querySelector('[data-schedule-minute]');
        if (hourEl && minuteEl) {
            return hourEl.value + ':' + minuteEl.value;
        }
        const timeEl = row.querySelector('[data-schedule-time]');
        return (timeEl && timeEl.value ? timeEl.value.trim() : '') || getDefaultScheduleKickoff();
    }

    function syncScheduleFromRow(row) {
        const id = row && row.dataset.matchId;
        if (!id) return;
        const dateEl = row.querySelector('[data-schedule-date]');
        const dateVal = dateEl && dateEl.value ? dateEl.value.trim() : '';
        const timeVal = getScheduleTimeFromRow(row);
        const text = dateVal ? partsToScheduleText(dateVal, timeVal) : '';
        if (!form.matchSchedule) form.matchSchedule = {};
        if (text) form.matchSchedule[id] = text;
        else delete form.matchSchedule[id];
    }

    function renderScheduleSection(opts) {
        const skipCollect = !!(opts && opts.skipCollect);
        const section = document.getElementById('schedule-section');
        const preview = document.getElementById('schedule-preview');
        const complete = isTeamsSectionComplete();

        // Persist any in-progress date/time edits before rebuilding the list
        if (!skipCollect) collectScheduleFromDom();

        if (section) section.classList.toggle('hidden', !complete);
        if (!preview) return;

        if (!complete) {
            preview.innerHTML = '';
            return;
        }

        pruneMatchSchedule();
        const catalog = getScheduleCatalog();
        if (!catalog.length) {
            preview.innerHTML = '<p class="hint">Add teams to see match schedule.</p>';
            return;
        }

        const scheduleTitle = document.getElementById('schedule-section-title');
        const scheduleHint = document.getElementById('schedule-section-hint');
        if (scheduleTitle) {
            const parts = [];
            if (form.includeGroupStage) parts.push('Group Stage');
            if (form.includeKnockoutStage) parts.push('Knockout');
            scheduleTitle.textContent = parts.join(' & ') + ' Schedule';
        }
        if (scheduleHint) {
            const stageLabel = form.includeGroupStage && form.includeKnockoutStage
                ? 'group and knockout matches'
                : form.includeGroupStage ? 'group stage matches' : 'knockout matches';
            scheduleHint.textContent = 'Set kickoff date and time in 24-hour format (WIB) for each ' + stageLabel + '. Leave date blank if not scheduled yet.';
        }

        preview.innerHTML = '<ul class="schedule-preview-list">' +
            catalog.map(entry => {
                const parts = scheduleTextToParts(form.matchSchedule[entry.id] || '');
                const timeValue = parts.time || getDefaultScheduleKickoff();
                return '<li class="schedule-edit-row" data-match-id="' + esc(entry.id) + '">' +
                    '<strong>' + esc(entry.label) + '</strong>' +
                    '<div class="schedule-edit-inputs">' +
                    '<input type="date" data-schedule-date value="' + esc(parts.date) + '" aria-label="Date">' +
                    scheduleTimeInputsHtml(timeValue) +
                    '</div></li>';
            }).join('') +
            '</ul>';

        preview.querySelectorAll('.schedule-edit-row').forEach(row => {
            const onChange = () => syncScheduleFromRow(row);
            row.querySelectorAll('input, select').forEach(inp => {
                inp.addEventListener('change', onChange);
                inp.addEventListener('input', onChange);
            });
        });
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function isHttpUrl(s) {
        return /^https?:\/\/.+/i.test(String(s || '').trim());
    }

    function countryFlagUrl(countryName) {
        if (!countryName || typeof window.ArisanCountries === 'undefined') return '';
        const previewW = ArisanCountries.FLAG_SIZE && ArisanCountries.FLAG_SIZE.preview;
        return ArisanCountries.getFlagUrl(countryName, previewW) || '';
    }

    function teamFlagPreviewUrl(teamName) {
        const name = (teamName || '').trim();
        if (!name) return '';
        if (form.competitionType === 'country') return countryFlagUrl(name);
        const t = form.teams.find(x => x.name === name);
        if (!t || !t.flag) return '';
        const flag = String(t.flag).trim();
        if (isHttpUrl(flag)) return flag;
        return '';
    }

    function resolveAvatarPreviewSrc(value) {
        const v = String(value || '').trim();
        if (!v) return DEFAULT_PLAYER_SILHOUETTE;
        if (isHttpUrl(v)) return v;
        const communitySlug = document.getElementById('community-slug')?.value;
        if (communitySlug && window.ArisanDB && typeof ArisanDB.communityAssetBase === 'function') {
            return ArisanDB.communityAssetBase(communitySlug) + v.replace(/^\//, '');
        }
        return DEFAULT_PLAYER_SILHOUETTE;
    }

    function resolvePreviewSrc(mode, value) {
        if (mode === 'country-flag') {
            return countryFlagUrl(value) || DEFAULT_CLUB_FLAG;
        }
        if (mode === 'team-flag') {
            return teamFlagPreviewUrl(value) || DEFAULT_CLUB_FLAG;
        }
        if (mode === 'image-url') {
            return isHttpUrl(value) ? String(value).trim() : DEFAULT_PLAYER_SILHOUETTE;
        }
        if (mode === 'avatar-url') {
            return resolveAvatarPreviewSrc(value);
        }
        if (mode === 'flag-url') {
            return isHttpUrl(value) ? String(value).trim() : DEFAULT_CLUB_FLAG;
        }
        if (mode === 'trophy-url') {
            return isHttpUrl(value) ? String(value).trim() : DEFAULT_TROPHY_IMG;
        }
        if (mode === 'icon-url') {
            return isHttpUrl(value) ? String(value).trim() : DEFAULT_LEAGUE_ICON;
        }
        if (mode === 'ball-url') {
            return isHttpUrl(value) ? String(value).trim() : DEFAULT_BALL_IMG;
        }
        return DEFAULT_CLUB_FLAG;
    }

    function previewBlock(mode, value, alt, kind) {
        const url = resolvePreviewSrc(mode, value);
        return '<div class="field-preview">' +
            '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" class="preview-img preview-' + kind +
            '" data-preview-mode="' + esc(mode) + '" referrerpolicy="no-referrer" decoding="async">' +
            '</div>';
    }

    function fieldWithPreview(controlHtml, mode, value, previewAlt, kind) {
        return '<div class="field-with-preview">' +
            '<div class="field-control">' + controlHtml + '</div>' +
            previewBlock(mode, value, previewAlt, kind) +
            '</div>';
    }

    function labeledPreviewField(label, controlHtml, mode, value, previewAlt, kind) {
        return '<div class="labeled-preview-field">' +
            '<label>' + esc(label) + '</label>' +
            fieldWithPreview(controlHtml, mode, value, previewAlt, kind) +
            '</div>';
    }

    function updatePreviewForControl(controlEl) {
        if (!controlEl) return;
        const wrap = controlEl.closest('.field-with-preview');
        if (!wrap) return;
        const img = wrap.querySelector('.preview-img');
        if (!img) return;

        const mode = controlEl.dataset.preview;
        const raw = String(controlEl.value || '').trim();
        const src = resolvePreviewSrc(mode, raw);
        img.referrerPolicy = 'no-referrer';
        // Bust sticky error state when URL changes
        if (img.dataset.lastPreviewSrc !== src) {
            img.dataset.lastPreviewSrc = src;
            img.src = src;
        }
        img.alt = raw || previewAltForMode(mode);
        // Player cutout blend is only for Golden Boot/Glove (image-url), not participant avatars.
        if (mode === 'image-url' && typeof ArisanTheSportsDB !== 'undefined') {
            ArisanTheSportsDB.applyPlayerImgBlend(img, raw || src);
        } else {
            img.classList.remove('player-img-opaque-bg');
        }
    }

    function previewAltForMode(mode) {
        if (mode === 'image-url') return 'Player';
        if (mode === 'avatar-url') return 'Avatar';
        if (mode === 'flag-url') return 'Team logo';
        return 'Team';
    }

    function defaultPreviewForImg(img) {
        const mode = img.dataset.previewMode
            || img.closest('.field-with-preview')?.querySelector('[data-preview]')?.dataset.preview
            || 'team-flag';
        const fallback = resolvePreviewSrc(mode, '');
        // Avoid infinite error loop if fallback also fails
        if (img.getAttribute('src') === fallback) return;
        img.dataset.lastPreviewSrc = fallback;
        img.src = fallback;
    }

    function bindPreviewControls(root) {
        (root || document).querySelectorAll('[data-preview]').forEach(el => {
            if (el.dataset.previewBound) return;
            el.dataset.previewBound = '1';
            const handler = () => updatePreviewForControl(el);
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
            const img = el.closest('.field-with-preview')?.querySelector('.preview-img');
            if (img && !img.dataset.errorBound) {
                img.dataset.errorBound = '1';
                img.referrerPolicy = 'no-referrer';
                img.addEventListener('error', () => defaultPreviewForImg(img));
            }
            updatePreviewForControl(el);
        });
    }

    function teamNames() {
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
        if (form.includeGroupStage) {
            uniqueTeamsFromGroups(form.groupDefinitions).forEach(t => push(t.name));
        }
        if (form.includeKnockoutStage) {
            form.teams.forEach(t => push(t.name));
        }
        if (!form.includeGroupStage && !form.includeKnockoutStage) {
            form.teams.forEach(t => push(t.name));
        }
        return names;
    }

    function collectSelectedPotTeams(participantIndex) {
        const selected = new Set();
        const p = form.participants[participantIndex];
        if (!p) return selected;
        (p.picks?.mainQuest?.pots || []).forEach(pot => {
            (pot.teams || []).forEach(t => {
                const name = (t || '').trim();
                if (name) selected.add(name);
            });
        });
        return selected;
    }

    /** Main Quest pot dropdown: hide teams already picked in this participant's other pot slots. */
    function potTeamOptions(selectedValue, participantIndex) {
        const names = teamNames();
        const taken = collectSelectedPotTeams(participantIndex);
        const current = (selectedValue || '').trim();
        let html = '<option value="">— select —</option>';
        names.forEach(n => {
            if (n !== current && taken.has(n)) return;
            html += '<option value="' + esc(n) + '"' + (n === current ? ' selected' : '') + '>' + esc(n) + '</option>';
        });
        return html;
    }

    function teamOptions(selected) {
        const names = teamNames();
        let html = '<option value="">— select —</option>';
        names.forEach(n => {
            html += '<option value="' + esc(n) + '"' + (n === selected ? ' selected' : '') + '>' + esc(n) + '</option>';
        });
        return html;
    }

    function countryOptions(selected, takenSet, opts) {
        const options = opts || {};
        const list = window.ArisanCountries || [];
        const taken = takenSet || new Set();
        const current = normalizeSeedName(selected);
        const currentKey = current.toLowerCase();
        let html = options.allowTbd
            ? '<option value=""' + (!current ? ' selected' : '') + '>TBD</option>'
            : '<option value="">— select country —</option>';
        list.forEach(c => {
            const key = String(c.name || '').toLowerCase();
            if (key && key !== currentKey && taken.has(key)) return;
            html += '<option value="' + esc(c.name) + '"' + (c.name === selected ? ' selected' : '') + '>' + esc(c.name) + '</option>';
        });
        return html;
    }

    /** Update group country <select> options in place (no DOM rebuild → keep focus). */
    function refreshGroupCountrySelectOptions(activeSelect) {
        document.querySelectorAll('.team-pair-slot[data-gidx] select[data-f="name"]').forEach(sel => {
            const slot = sel.closest('.team-pair-slot');
            if (!slot) return;
            const gidx = +slot.dataset.gidx;
            const tidx = +slot.dataset.tidx;
            const team = getTeamRefFromSlot(slot);
            const selected = (team && team.name) || sel.value || '';
            const taken = collectTakenGroupCountries(gidx, tidx);
            const html = countryOptions(selected, taken);
            if (sel === activeSelect) {
                // Keep the open/focused select intact; only sync value if needed.
                if (sel.value !== selected) sel.value = selected;
                return;
            }
            sel.innerHTML = html;
        });
    }

    function syncTeamFlagFromCountry(team) {
        if (form.competitionType !== 'country' || !team.name) return;
        team.flag = window.ArisanCountries ? ArisanCountries.getFlagCode(team.name) : '';
    }

    function syncStageOptionVisibility() {
        const knockoutOpts = document.getElementById('knockout-stage-options');
        if (knockoutOpts) knockoutOpts.classList.toggle('hidden', !form.includeKnockoutStage);
    }

    function syncTeamsSectionUi() {
        // Per-stage hints are rendered inside Group / Knockout panels.
    }

    function updateSectionLabels() {
        const isCountry = form.competitionType === 'country';
        const title = document.getElementById('teams-section-title');
        const typeHint = document.getElementById('competition-type-hint');
        if (title) {
            if (form.includeGroupStage && !form.includeKnockoutStage) {
                title.textContent = isCountry ? '3. Groups (countries)' : '3. Groups (clubs)';
            } else if (form.includeGroupStage && form.includeKnockoutStage) {
                title.textContent = isCountry ? '3. Groups & Knockout' : '3. Groups & Knockout (Clubs)';
            } else {
                title.textContent = isCountry ? '3. Countries' : '3. Clubs';
            }
        }
        if (typeHint) {
            typeHint.textContent = isCountry
                ? 'This league uses national teams. Country flags are mapped automatically.'
                : 'This league uses clubs. Type a club name to search TheSportsDB — badge fills Club\'s flag (editable).';
        }
    }

    function updateCounts() {
        const pc = document.getElementById('count-participants');
        const tc = document.getElementById('count-teams');
        if (pc) pc.textContent = form.participants.length;
        let teamCount = 0;
        if (form.includeGroupStage) teamCount += uniqueTeamsFromGroups(form.groupDefinitions).length;
        if (form.includeKnockoutStage) {
            teamCount = form.includeGroupStage
                ? teamNames().length
                : form.teams.filter(t => (t.name || '').trim()).length;
        } else if (!form.includeGroupStage) {
            teamCount = form.teams.length;
        }
        if (tc) tc.textContent = teamCount;
        syncTeamsSectionUi();
    }

    function syncThirdPlacePointConfig() {
        if (!form.includeThirdPlace) {
            form.pointConfig.sideQuest.third = 0;
        } else if (form.pointConfig.sideQuest.third === 0) {
            form.pointConfig.sideQuest.third = DEFAULT_POINT_CONFIG.sideQuest.third;
        }

        const wrap = document.getElementById('pt-third-wrap');
        if (wrap) wrap.classList.toggle('hidden', !form.includeThirdPlace);
    }

    function syncMainQuestModeUi() {
        const mode = form.pointConfig.mainQuestMode === 'fifa' ? 'fifa' : 'fixed';
        form.pointConfig.mainQuestMode = mode;
        const fixedEl = document.getElementById('main-quest-fixed-points');
        const fifaEl = document.getElementById('main-quest-fifa-points');
        const fixedRadio = document.getElementById('mq-mode-fixed');
        const fifaRadio = document.getElementById('mq-mode-fifa');
        if (fixedRadio) fixedRadio.checked = mode === 'fixed';
        if (fifaRadio) fifaRadio.checked = mode === 'fifa';
        if (fixedEl) fixedEl.classList.toggle('hidden', mode !== 'fixed');
        if (fifaEl) fifaEl.classList.toggle('hidden', mode !== 'fifa');
    }

    function collectTeamPointsFromDom() {
        const root = document.getElementById('main-quest-team-points');
        if (!root) return;
        if (!form.pointConfig.teamPoints) form.pointConfig.teamPoints = {};
        root.querySelectorAll('tr[data-team]').forEach(row => {
            const name = row.dataset.team;
            if (!name) return;
            const num = (sel) => {
                const el = row.querySelector(sel);
                const v = el ? parseInt(el.value, 10) : NaN;
                return Number.isNaN(v) ? 0 : Math.max(0, v);
            };
            form.pointConfig.teamPoints[name] = {
                win: num('[data-tp="win"]'),
                draw: num('[data-tp="draw"]'),
                loss: num('[data-tp="loss"]'),
            };
        });
    }

    function syncTeamPointsWithTeamList() {
        const mq = form.pointConfig.mainQuest || DEFAULT_POINT_CONFIG.mainQuest;
        const prev = form.pointConfig.teamPoints || {};
        const next = {};
        teamNames().forEach(name => {
            next[name] = normalizeTeamPointRow(prev[name], mq);
        });
        form.pointConfig.teamPoints = next;
    }

    function renderMainQuestTeamPoints() {
        const root = document.getElementById('main-quest-team-points');
        if (!root) return;

        collectTeamPointsFromDom();
        syncTeamPointsWithTeamList();

        const names = teamNames();
        if (!names.length) {
            root.innerHTML = '<p class="hint">Add teams in Section 3 to configure per-team points.</p>';
            return;
        }

        const rows = names.map(name => ({
            name,
            ...(form.pointConfig.teamPoints[name] || normalizeTeamPointRow(null, form.pointConfig.mainQuest)),
        }));
        rows.sort((a, b) => a.name.localeCompare(b.name));

        root.innerHTML =
            '<div class="mq-team-points-wrap"><table class="mq-team-points-table">' +
            '<thead><tr>' +
            '<th>Team</th><th>W</th><th>D</th><th>L</th>' +
            '</tr></thead><tbody>' +
            rows.map(row =>
                '<tr data-team="' + esc(row.name) + '">' +
                '<td class="mq-team-name">' + esc(row.name) + '</td>' +
                '<td><input type="number" min="0" step="1" data-tp="win" value="' + esc(String(row.win)) + '" aria-label="Win points for ' + esc(row.name) + '"></td>' +
                '<td><input type="number" min="0" step="1" data-tp="draw" value="' + esc(String(row.draw)) + '" aria-label="Draw points for ' + esc(row.name) + '"></td>' +
                '<td><input type="number" min="0" step="1" data-tp="loss" value="' + esc(String(row.loss)) + '" aria-label="Loss points for ' + esc(row.name) + '"></td>' +
                '</tr>'
            ).join('') +
            '</tbody></table></div>';

        root.querySelectorAll('input[data-tp]').forEach(inp => {
            inp.addEventListener('change', () => collectTeamPointsFromDom());
            inp.addEventListener('input', () => collectTeamPointsFromDom());
        });
    }

    function renderPointConfig() {
        syncThirdPlacePointConfig();
        const pc = form.pointConfig = normalizePointConfig(form.pointConfig);
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const setShare = (id, checked) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!checked;
        };
        set('pt-win', pc.mainQuest.win);
        set('pt-draw', pc.mainQuest.draw);
        set('pt-loss', pc.mainQuest.loss);
        set('pt-champion', pc.sideQuest.champion);
        set('pt-runnerup', pc.sideQuest.runnerup);
        set('pt-third', pc.sideQuest.third);
        set('pt-boot', pc.sideQuest.goldenBoot);
        set('pt-glove', pc.sideQuest.goldenGlove);
        set('pt-totalgoal', pc.sideQuest.totalGoal);
        set('pt-scorepredict', pc.sideQuest.scorePredict);
        setShare('pt-share-champion', pc.sideQuestShare.champion);
        setShare('pt-share-runnerup', pc.sideQuestShare.runnerup);
        setShare('pt-share-third', pc.sideQuestShare.third);
        setShare('pt-share-boot', pc.sideQuestShare.goldenBoot);
        setShare('pt-share-glove', pc.sideQuestShare.goldenGlove);
        setShare('pt-share-totalgoal', pc.sideQuestShare.totalGoal);
        setShare('pt-share-scorepredict', pc.sideQuestShare.scorePredict);
        syncMainQuestModeUi();
        renderMainQuestTeamPoints();
    }

    function bindPointConfig() {
        const bind = (id, section, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                const v = parseInt(el.value, 10);
                form.pointConfig[section][key] = Number.isNaN(v) ? 0 : v;
            });
        };
        const bindShare = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                if (!form.pointConfig.sideQuestShare) {
                    form.pointConfig.sideQuestShare = Object.assign(
                        {},
                        DEFAULT_POINT_CONFIG.sideQuestShare
                    );
                }
                form.pointConfig.sideQuestShare[key] = !!el.checked;
            });
        };
        const bindMode = (id, mode) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                if (!el.checked) return;
                form.pointConfig.mainQuestMode = mode;
                syncMainQuestModeUi();
                if (mode === 'fifa') renderMainQuestTeamPoints();
            });
        };
        bind('pt-win', 'mainQuest', 'win');
        bind('pt-draw', 'mainQuest', 'draw');
        bind('pt-loss', 'mainQuest', 'loss');
        bind('pt-champion', 'sideQuest', 'champion');
        bind('pt-runnerup', 'sideQuest', 'runnerup');
        bind('pt-third', 'sideQuest', 'third');
        bind('pt-boot', 'sideQuest', 'goldenBoot');
        bind('pt-glove', 'sideQuest', 'goldenGlove');
        bind('pt-totalgoal', 'sideQuest', 'totalGoal');
        bind('pt-scorepredict', 'sideQuest', 'scorePredict');
        bindShare('pt-share-champion', 'champion');
        bindShare('pt-share-runnerup', 'runnerup');
        bindShare('pt-share-third', 'third');
        bindShare('pt-share-boot', 'goldenBoot');
        bindShare('pt-share-glove', 'goldenGlove');
        bindShare('pt-share-totalgoal', 'totalGoal');
        bindShare('pt-share-scorepredict', 'scorePredict');
        bindMode('mq-mode-fixed', 'fixed');
        bindMode('mq-mode-fifa', 'fifa');
    }

    function setLeagueTitleLookupStatus(state, message) {
        const statusEl = document.getElementById('league-title-lookup-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'player-lookup-status hint' + (state ? ' ' + state : '');
    }

    function hideLeagueTitleAutocomplete() {
        const list = document.getElementById('league-title-autocomplete');
        const titleInp = document.getElementById('league-title');
        if (!list) return;
        list.innerHTML = '';
        list.classList.add('hidden');
        list._leagues = null;
        if (titleInp) titleInp.setAttribute('aria-expanded', 'false');
    }

    function applyLeagueSelection(league) {
        const titleInp = document.getElementById('league-title');
        const yearInp = document.getElementById('league-year');
        const iconInp = document.getElementById('league-icon-url');
        if (!league || !titleInp) return;

        titleInp.value = league.name || titleInp.value;
        if (league.year != null && yearInp && !yearInp.value) {
            yearInp.value = String(league.year);
        }

        if (league.icon) {
            form.iconImageUrl = league.icon;
            if (iconInp) {
                iconInp.value = league.icon;
                updatePreviewForControl(iconInp);
            }
            setLeagueTitleLookupStatus('ok', 'League icon loaded from TheSportsDB.');
        } else {
            setLeagueTitleLookupStatus('warn', 'League found — enter icon URL manually.');
        }

        hideLeagueTitleAutocomplete();
    }

    function renderLeagueTitleAutocomplete(leagues, onSelect) {
        const list = document.getElementById('league-title-autocomplete');
        const titleInp = document.getElementById('league-title');
        if (!list || !titleInp) return;

        if (!leagues.length) {
            hideLeagueTitleAutocomplete();
            return;
        }

        list._leagues = leagues;
        list.innerHTML = leagues.map((lg, idx) =>
            '<button type="button" class="player-autocomplete-option' + (idx === 0 ? ' active' : '') + '" role="option" data-idx="' + idx + '">' +
            (lg.previewThumb
                ? '<img src="' + esc(lg.previewThumb) + '" alt="" class="player-autocomplete-thumb">'
                : '<span class="player-autocomplete-thumb" aria-hidden="true"></span>') +
            '<span class="player-autocomplete-text"><strong>' + esc(lg.name) + '</strong>' +
            '<small>' + esc(lg.country || 'Soccer') +
            (lg.hasIcon ? '' : ' · icon on select') +
            '</small></span></button>'
        ).join('');

        list.classList.remove('hidden');
        titleInp.setAttribute('aria-expanded', 'true');

        list.querySelectorAll('.player-autocomplete-option').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const idx = +btn.dataset.idx;
                const league = list._leagues && list._leagues[idx];
                if (league) onSelect(league);
            });
        });
    }

    async function selectLeagueById(row) {
        setLeagueTitleLookupStatus('loading', 'Loading league icon…');
        try {
            if (typeof ArisanTheSportsDB === 'undefined') {
                applyLeagueSelection({ name: row.name, icon: '', hasIcon: false });
                return;
            }
            const full = await ArisanTheSportsDB.lookupLeague(row.id);
            applyLeagueSelection(full || { name: row.name, icon: '', hasIcon: false });
        } catch (e) {
            applyLeagueSelection({ name: row.name, icon: '', hasIcon: false });
            setLeagueTitleLookupStatus('warn', 'Icon lookup failed — enter URL manually.');
        }
    }

    function bindLeagueTitleLookup() {
        const titleInp = document.getElementById('league-title');
        if (!titleInp || titleInp.dataset.lookupBound) return;
        titleInp.dataset.lookupBound = '1';

        let suggestTimer = null;
        let pickedFromList = false;

        const showSuggestions = () => {
            const q = titleInp.value.trim();
            if (q.length < 2) {
                hideLeagueTitleAutocomplete();
                setLeagueTitleLookupStatus('', '');
                return;
            }
            if (typeof ArisanTheSportsDB === 'undefined') {
                setLeagueTitleLookupStatus('warn', 'League lookup unavailable — enter title and icon manually.');
                return;
            }

            const leagues = ArisanTheSportsDB.searchLeagues(q, 8);
            if (leagues.length) {
                renderLeagueTitleAutocomplete(leagues, row => {
                    pickedFromList = true;
                    selectLeagueById(row);
                });
                setLeagueTitleLookupStatus('', leagues.length + ' league(s) found — pick one.');
            } else {
                hideLeagueTitleAutocomplete();
                setLeagueTitleLookupStatus('warn', 'Not in catalog — enter title and icon URL manually.');
            }
        };

        titleInp.addEventListener('input', () => {
            pickedFromList = false;
            clearTimeout(suggestTimer);
            suggestTimer = setTimeout(showSuggestions, 220);
        });

        titleInp.addEventListener('keydown', e => {
            const list = document.getElementById('league-title-autocomplete');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveAutocompleteOption(titleInp, 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveAutocompleteOption(titleInp, -1);
            } else if (e.key === 'Enter') {
                const active = list && !list.classList.contains('hidden')
                    ? list.querySelector('.player-autocomplete-option.active')
                    : null;
                if (active) {
                    e.preventDefault();
                    const idx = +active.dataset.idx;
                    const league = list._leagues && list._leagues[idx];
                    if (league) {
                        pickedFromList = true;
                        selectLeagueById(league);
                    }
                }
            } else if (e.key === 'Escape') {
                hideLeagueTitleAutocomplete();
            }
        });

        titleInp.addEventListener('blur', () => {
            setTimeout(() => {
                if (pickedFromList) {
                    pickedFromList = false;
                    return;
                }
                hideLeagueTitleAutocomplete();
            }, 180);
        });

        titleInp.addEventListener('focus', () => {
            if (titleInp.value.trim().length >= 2) showSuggestions();
        });
    }

    function ensureIconUrlField() {
        const wrap = document.getElementById('league-icon-url-wrap');
        if (!wrap || wrap.dataset.rendered) return;
        wrap.dataset.rendered = '1';
        wrap.innerHTML = labeledPreviewField(
            'League icon image URL',
            '<input type="text" id="league-icon-url" data-preview="icon-url" placeholder="https://...  (default: FIFA WC 2026 icon)">',
            'icon-url',
            form.iconImageUrl || '',
            'League icon',
            'icon'
        );
        const inp = document.getElementById('league-icon-url');
        if (!inp) return;
        inp.value = form.iconImageUrl || '';
        const syncIcon = () => {
            form.iconImageUrl = inp.value.trim();
            updatePreviewForControl(inp);
        };
        inp.addEventListener('input', syncIcon);
        inp.addEventListener('change', syncIcon);
        bindPreviewControls(wrap);
    }

    function ensureTrophyUrlField() {
        const wrap = document.getElementById('league-trophy-url-wrap');
        if (!wrap || wrap.dataset.rendered) return;
        wrap.dataset.rendered = '1';
        wrap.innerHTML = labeledPreviewField(
            'League trophy image URL',
            '<input type="text" id="league-trophy-url" data-preview="trophy-url" placeholder="https://... (default: FIFA WC 2026 trophy)">',
            'trophy-url',
            form.trophyImageUrl || '',
            'League trophy',
            'trophy'
        );
        const inp = document.getElementById('league-trophy-url');
        if (!inp) return;
        inp.value = form.trophyImageUrl || '';
        const syncTrophy = () => {
            form.trophyImageUrl = inp.value.trim();
            updatePreviewForControl(inp);
        };
        inp.addEventListener('input', syncTrophy);
        inp.addEventListener('change', syncTrophy);
        bindPreviewControls(wrap);
    }

    function ensureBallUrlField() {
        const wrap = document.getElementById('league-ball-url-wrap');
        if (!wrap || wrap.dataset.rendered) return;
        wrap.dataset.rendered = '1';
        wrap.innerHTML = labeledPreviewField(
            'Match ball image URL',
            '<input type="text" id="league-ball-url" data-preview="ball-url" placeholder="https://... (default: FIFA WC 2026 ball)">',
            'ball-url',
            form.ballImageUrl || '',
            'Match ball',
            'ball'
        );
        const inp = document.getElementById('league-ball-url');
        if (!inp) return;
        inp.value = form.ballImageUrl || '';
        const syncBall = () => {
            form.ballImageUrl = inp.value.trim();
            updatePreviewForControl(inp);
        };
        inp.addEventListener('input', syncBall);
        inp.addEventListener('change', syncBall);
        bindPreviewControls(wrap);
    }

    let bgMusicPreviewApi = null;

    function ensureBgMusicUrlField() {
        const inp = document.getElementById('league-bg-music-url');
        if (!inp) return;

        const statusEl = document.getElementById('league-bg-music-status');
        const audio = document.getElementById('league-bg-music-preview');
        if (audio) audio.volume = 0.5;

        if (inp.dataset.bound) {
            // Keep API in sync when field already bound (e.g. after Load league data).
            if (bgMusicPreviewApi) {
                inp.value = form.backgroundMusicUrl || '';
            }
            return;
        }
        inp.dataset.bound = '1';
        inp.value = form.backgroundMusicUrl || '';

        let previewTimer = null;
        let lastPlayedUrl = '';
        let pausedByFocusLoss = false;

        function setMusicStatus(state, message) {
            if (!statusEl) return;
            statusEl.textContent = message || '';
            statusEl.className = 'player-lookup-status hint' + (state ? ' ' + state : '');
        }

        function stopPreview() {
            if (!audio) return;
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            lastPlayedUrl = '';
            pausedByFocusLoss = false;
        }

        function playPreview(url) {
            if (!audio) return;
            const src = String(url == null ? (form.backgroundMusicUrl || '') : url).trim();
            if (!src || !isHttpUrl(src)) {
                stopPreview();
                setMusicStatus('', '');
                return false;
            }
            pausedByFocusLoss = false;
            if (src === lastPlayedUrl && !audio.paused) {
                setMusicStatus('ok', 'Playing preview…');
                return true;
            }
            lastPlayedUrl = src;
            setMusicStatus('', 'Loading…');
            audio.src = src;
            audio.load();
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    setMusicStatus('ok', 'Playing preview…');
                }).catch(() => {
                    setMusicStatus('warn', 'Could not autoplay — click the field again or check the URL / CORS.');
                });
            } else {
                setMusicStatus('ok', 'Playing preview…');
            }
            return true;
        }

        function updateMusicForPageFocus() {
            if (!audio || !lastPlayedUrl) return;

            const pageInactive = document.hidden || !document.hasFocus();

            if (pageInactive) {
                if (!audio.paused) {
                    pausedByFocusLoss = true;
                    audio.pause();
                    setMusicStatus('', 'Paused (tab inactive)…');
                }
            } else if (pausedByFocusLoss) {
                pausedByFocusLoss = false;
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.then(() => {
                        setMusicStatus('ok', 'Playing preview…');
                    }).catch(() => {
                        setMusicStatus('warn', 'Could not resume — click the field again.');
                    });
                } else {
                    setMusicStatus('ok', 'Playing preview…');
                }
            }
        }

        const sync = () => {
            const url = inp.value.trim();
            form.backgroundMusicUrl = url;
            clearTimeout(previewTimer);
            previewTimer = setTimeout(() => playPreview(url), 350);
        };

        inp.addEventListener('input', sync);
        inp.addEventListener('change', sync);
        inp.addEventListener('paste', () => {
            clearTimeout(previewTimer);
            previewTimer = setTimeout(() => {
                const url = inp.value.trim();
                form.backgroundMusicUrl = url;
                playPreview(url);
            }, 50);
        });

        audio?.addEventListener('error', () => {
            if (!form.backgroundMusicUrl) return;
            setMusicStatus('warn', 'Audio failed to load — check the URL.');
        });

        document.addEventListener('visibilitychange', updateMusicForPageFocus);
        window.addEventListener('blur', updateMusicForPageFocus);
        window.addEventListener('focus', updateMusicForPageFocus);

        bgMusicPreviewApi = {
            play: playPreview,
            stop: stopPreview,
            setStatus: setMusicStatus,
        };

        if (isHttpUrl(form.backgroundMusicUrl)) {
            // Don't autoplay on initial page load / after Load league data.
            setMusicStatus('', 'URL loaded — edit or re-paste to preview.');
        }
    }

    function syncBackgroundMusicFieldFromForm() {
        ensureBgMusicUrlField();
        const url = (form.backgroundMusicUrl || '').trim();
        const musicInp = document.getElementById('league-bg-music-url');
        if (musicInp) musicInp.value = url;
        if (!bgMusicPreviewApi) return;
        if (url && isHttpUrl(url)) {
            bgMusicPreviewApi.play(url);
        } else {
            bgMusicPreviewApi.stop();
            bgMusicPreviewApi.setStatus('', '');
        }
    }

    function renderLeagueMeta() {
        ensureIconUrlField();
        ensureTrophyUrlField();
        ensureBallUrlField();
        ensureBgMusicUrlField();
        bindLeagueTitleLookup();
        const typeEl = document.getElementById('competition-type');
        const groupEl = document.getElementById('include-group-stage');
        const knockoutEl = document.getElementById('include-knockout-stage');
        const thirdEl = document.getElementById('include-third-place');
        const twoLegEl = document.getElementById('two-leg-knockout');
        const iconInp = document.getElementById('league-icon-url');
        const trophyInp = document.getElementById('league-trophy-url');
        const ballInp = document.getElementById('league-ball-url');
        const musicInp = document.getElementById('league-bg-music-url');
        if (typeEl) typeEl.value = form.competitionType;
        if (groupEl) groupEl.checked = form.includeGroupStage;
        if (knockoutEl) knockoutEl.checked = form.includeKnockoutStage;
        if (thirdEl) thirdEl.checked = form.includeThirdPlace;
        if (twoLegEl) twoLegEl.checked = form.twoLegKnockout;
        if (iconInp && iconInp.value !== (form.iconImageUrl || '')) {
            iconInp.value = form.iconImageUrl || '';
            updatePreviewForControl(iconInp);
        }
        if (trophyInp && trophyInp.value !== (form.trophyImageUrl || '')) {
            trophyInp.value = form.trophyImageUrl || '';
            updatePreviewForControl(trophyInp);
        }
        if (ballInp && ballInp.value !== (form.ballImageUrl || '')) {
            ballInp.value = form.ballImageUrl || '';
            updatePreviewForControl(ballInp);
        }
        if (musicInp && musicInp.value !== (form.backgroundMusicUrl || '')) {
            musicInp.value = form.backgroundMusicUrl || '';
        }
        updateSectionLabels();
        syncStageOptionVisibility();
        renderPointConfig();
    }

    function renderTeamSlotHtml(t, slotKey, isCountry, slotLabel, opts) {
        const options = opts || {};
        const allowTbd = !!options.allowTbd;
        let nameField;
        if (isCountry) {
            const taken = slotKey.kind === 'group'
                ? collectTakenGroupCountries(slotKey.gidx, slotKey.tidx)
                : new Set();
            nameField = labeledPreviewField(
                allowTbd ? 'Country name (or TBD)' : 'Country name',
                '<select data-f="name" data-preview="country-flag">' +
                    countryOptions(t.name, taken, { allowTbd }) +
                '</select>',
                'country-flag',
                t.name,
                t.name,
                'flag'
            );
        } else if (allowTbd) {
            const isTbd = !normalizeSeedName(t.name);
            nameField =
                '<div class="club-name-lookup">' +
                '<label>Club name (or TBD)</label>' +
                '<select data-f="tbd-toggle" class="club-tbd-toggle">' +
                '<option value="tbd"' + (isTbd ? ' selected' : '') + '>TBD</option>' +
                '<option value="club"' + (!isTbd ? ' selected' : '') + '>Choose club…</option>' +
                '</select>' +
                '<div class="club-tbd-fields' + (isTbd ? ' hidden' : '') + '">' +
                '<div class="player-autocomplete-input-wrap">' +
                '<input type="text" data-f="name" data-club-lookup="1" value="' + esc(isTbd ? '' : t.name) +
                '" placeholder="Start typing club name…" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list">' +
                '<div class="player-autocomplete-list hidden" role="listbox"></div>' +
                '</div>' +
                '<p class="player-lookup-status hint" aria-live="polite"></p>' +
                '</div></div>';
        } else {
            nameField =
                '<div class="club-name-lookup">' +
                '<label>Club name</label>' +
                '<div class="player-autocomplete-input-wrap">' +
                '<input type="text" data-f="name" data-club-lookup="1" value="' + esc(t.name) + '" placeholder="Start typing club name…" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list">' +
                '<div class="player-autocomplete-list hidden" role="listbox"></div>' +
                '</div>' +
                '<p class="player-lookup-status hint" aria-live="polite"></p>' +
                '</div>';
        }

        const flagField = isCountry || (allowTbd && !normalizeSeedName(t.name)) ? '' :
            labeledPreviewField(
                'Club\'s flag (image URL)',
                '<input type="text" data-f="flag" data-preview="flag-url" value="' + esc(t.flag) + '" placeholder="https://...">',
                'flag-url',
                t.flag,
                'Club logo',
                'flag'
            );

        const dataAttrs = slotKey.kind === 'group'
            ? ' data-gidx="' + slotKey.gidx + '" data-tidx="' + slotKey.tidx + '"'
            : ' data-idx="' + slotKey.idx + '"';

        const removeBtn = options.showRemove
            ? '<button type="button" class="btn btn-danger btn-sm group-remove-team" data-action="remove-group-team">Remove</button>'
            : '';

        return '<div class="team-pair-slot"' + dataAttrs + '>' +
            '<div class="team-pair-slot-head">' +
            '<label class="team-pair-slot-label">' + esc(slotLabel) + '</label>' +
            removeBtn +
            '</div>' +
            nameField + flagField +
            '</div>';
    }

    function getTeamRefFromSlot(slot) {
        if (!slot) return null;
        if (slot.dataset.gidx != null) {
            const g = form.groupDefinitions[+slot.dataset.gidx];
            return g && g.teams ? g.teams[+slot.dataset.tidx] : null;
        }
        if (slot.dataset.idx != null) {
            return form.teams[+slot.dataset.idx] || null;
        }
        return null;
    }

    function stagePanelShell(key, title, bodyHtml) {
        const open = isStageOpen(key);
        return '<div class="stage-panel' + (open ? ' is-open' : '') + '" data-stage="' + key + '">' +
            '<button type="button" class="stage-panel-toggle" aria-expanded="' + (open ? 'true' : 'false') + '">' +
            '<span class="stage-panel-title">' + esc(title) + '</span>' +
            '<span class="stage-panel-icon" aria-hidden="true">▼</span>' +
            '</button>' +
            '<div class="stage-panel-body">' + bodyHtml + '</div>' +
            '</div>';
    }

    function getGroupStageHint() {
        const defs = form.groupDefinitions || [];
        const unique = uniqueTeamsFromGroups(defs).length;
        const fixtures = (typeof ArisanBracket !== 'undefined' && ArisanBracket.fixturesFromGroupDefinitions)
            ? ArisanBracket.fixturesFromGroupDefinitions(defs.map(g => ({
                label: g.label,
                teams: (g.teams || []).map(t => t.name).filter(Boolean),
            })))
            : [];
        return 'List members of each group. Matches auto-generate as round-robin. Currently '
            + defs.length + ' group(s), ' + unique + ' teams, ' + fixtures.length + ' matches.';
    }

    function getKnockoutStageHint(isCountry) {
        const filled = form.teams.filter(t => normalizeSeedName(t.name)).length;
        const slots = form.teams.length;
        return 'Opening knockout matchups (pairing order). Use TBD until group winners are known. Currently '
            + slots + ' slot(s), ' + filled + ' named '
            + (isCountry ? 'countries' : 'clubs') + '.';
    }

    function renderGroupsHtml(isCountry, entity) {
        ensureInitialGroups();
        let body = '<p class="hint">' + esc(getGroupStageHint()) + '</p>';
        form.groupDefinitions.forEach((g, gi) => {
            const label = (g.label || String.fromCharCode(65 + gi)).trim();
            const matchCount = (() => {
                const n = (g.teams || []).filter(t => (t.name || '').trim()).length;
                return n >= 2 ? (n * (n - 1)) / 2 : 0;
            })();
            body += '<div class="group-def-box row-item" data-group="' + gi + '">' +
                '<div class="row-head">' +
                '<div class="group-def-label-wrap">' +
                '<strong>Group</strong> ' +
                '<input type="text" class="group-label-input" data-g="label" maxlength="8" value="' + esc(label) + '" aria-label="Group label">' +
                '<span class="hint group-match-hint">' + matchCount + ' match(es)</span>' +
                '</div>' +
                (form.groupDefinitions.length > 1
                    ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-group">Remove group</button>'
                    : '') +
                '</div>' +
                '<div class="group-teams-grid">';
            (g.teams || []).forEach((t, ti) => {
                body += renderTeamSlotHtml(
                    t,
                    { kind: 'group', gidx: gi, tidx: ti },
                    isCountry,
                    entity + ' ' + (ti + 1),
                    { showRemove: (g.teams || []).length > 2 }
                );
            });
            body += '</div>' +
                '<button type="button" class="btn btn-secondary btn-sm" data-action="add-group-team">+ ' + esc(entity) + '</button>' +
                '</div>';
        });
        body += '<button type="button" class="btn btn-secondary btn-sm" id="btn-add-group" data-action="add-group">+ Group</button>';
        return stagePanelShell('group', 'Group Stage', body);
    }

    function renderKnockoutPairsHtml(isCountry, entity) {
        if (form.teams.length % 2 === 1) {
            form.teams.push(emptyTeam());
        }
        if (!form.teams.length) {
            form.teams.push(emptyTeam(), emptyTeam());
        }

        let body = '<p class="hint">' + esc(getKnockoutStageHint(isCountry)) + '</p>';
        for (let p = 0; p < form.teams.length; p += 2) {
            const matchNum = Math.floor(p / 2) + 1;
            const t0 = form.teams[p];
            const t1 = form.teams[p + 1];

            body += '<div class="team-pair-box row-item" data-pair="' + matchNum + '">' +
                '<div class="row-head"><strong>Match ' + matchNum + '</strong>' +
                (form.teams.length > 2
                    ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-match">Remove match</button>'
                    : '') +
                '</div>' +
                '<div class="team-pair-grid">' +
                renderTeamSlotHtml(t0, { kind: 'pair', idx: p }, isCountry, entity + ' ' + (p + 1), { allowTbd: true });

            body += '<div class="team-pair-vs" aria-hidden="true">vs</div>';
            body += renderTeamSlotHtml(t1, { kind: 'pair', idx: p + 1 }, isCountry, entity + ' ' + (p + 2), { allowTbd: true });
            body += '</div></div>';
        }
        body += '<button type="button" class="btn btn-secondary btn-sm" id="btn-add-team" data-action="add-knockout-match">'
            + (isCountry ? '+ Match (2 countries)' : '+ Match (2 clubs)')
            + '</button>';
        return stagePanelShell('knockout', 'Knockout bracket pairs', body);
    }

    function bindTeamSlotControls(el, isCountry) {
        el.querySelectorAll('.team-pair-slot').forEach(slot => {
            slot.querySelectorAll('[data-f]').forEach(inp => {
                if (inp.dataset.clubLookup === '1') return;
                const handler = (e) => {
                    const team = getTeamRefFromSlot(slot);
                    if (!team) return;
                    if (inp.dataset.f === 'tbd-toggle') {
                        if (inp.value === 'tbd') {
                            team.name = '';
                            team.flag = '';
                        }
                        renderTeams();
                        renderParticipants();
                        renderScheduleSection();
                        return;
                    }
                    team[inp.dataset.f] = inp.value;
                    if (inp.dataset.f === 'name') {
                        if (!normalizeSeedName(inp.value)) {
                            team.name = '';
                            team.flag = '';
                        } else {
                            syncTeamFlagFromCountry(team);
                        }
                    }
                    updatePreviewForControl(inp);

                    const isGroupCountrySelect = isCountry
                        && inp.dataset.f === 'name'
                        && slot.dataset.gidx != null
                        && inp.tagName === 'SELECT';

                    // While typing/jumping in <select>, only sync local state — avoid heavy re-renders.
                    if (isGroupCountrySelect && e.type === 'input') {
                        const box = slot.closest('.group-def-box');
                        const hint = box && box.querySelector('.group-match-hint');
                        if (hint) {
                            const g = form.groupDefinitions[+slot.dataset.gidx];
                            const n = (g && g.teams || []).filter(t => (t.name || '').trim()).length;
                            hint.textContent = (n >= 2 ? (n * (n - 1)) / 2 : 0) + ' match(es)';
                        }
                        syncTeamsSectionUi();
                        return;
                    }

                    if (isGroupCountrySelect && (e.type === 'change' || e.type === 'blur')) {
                        refreshGroupCountrySelectOptions(inp);
                    }

                    // Knockout country TBD/pick: refresh schedule labels.
                    if (
                        isCountry
                        && inp.dataset.f === 'name'
                        && slot.dataset.idx != null
                        && e.type === 'change'
                    ) {
                        renderScheduleSection();
                        syncTeamsSectionUi();
                        renderParticipants();
                        if (form.pointConfig.mainQuestMode === 'fifa') renderMainQuestTeamPoints();
                        return;
                    }

                    renderParticipants();
                    renderScheduleSection();
                    syncTeamsSectionUi();
                    if (inp.dataset.f === 'name' && form.pointConfig.mainQuestMode === 'fifa') {
                        renderMainQuestTeamPoints();
                    }
                    if (slot.dataset.gidx != null) {
                        const box = slot.closest('.group-def-box');
                        const hint = box && box.querySelector('.group-match-hint');
                        if (hint) {
                            const g = form.groupDefinitions[+slot.dataset.gidx];
                            const n = (g && g.teams || []).filter(t => (t.name || '').trim()).length;
                            hint.textContent = (n >= 2 ? (n * (n - 1)) / 2 : 0) + ' match(es)';
                        }
                    }
                };
                inp.addEventListener('input', handler);
                inp.addEventListener('change', handler);
                if (isCountry && inp.dataset.f === 'name' && slot.dataset.gidx != null) {
                    inp.addEventListener('blur', handler);
                }
            });
            if (!isCountry) bindClubNameLookup(slot);
        });
    }

    function renderTeams() {
        const el = document.getElementById('teams-list');
        if (!el) return;
        const isCountry = form.competitionType === 'country';
        const entity = isCountry ? 'Country' : 'Club';

        if (!form.includeGroupStage && !form.includeKnockoutStage) {
            el.innerHTML = '<p class="hint">Enable Group Stage and/or Knockout Stage above.</p>';
            updateCounts();
            renderScheduleSection();
            return;
        }

        let html = '';
        if (form.includeGroupStage) html += renderGroupsHtml(isCountry, entity);
        if (form.includeKnockoutStage) html += renderKnockoutPairsHtml(isCountry, entity);
        el.innerHTML = html || '<p class="hint">No teams yet.</p>';

        el.querySelectorAll('.group-def-box[data-group]').forEach(box => {
            const gi = +box.dataset.group;
            box.querySelector('[data-g="label"]')?.addEventListener('input', e => {
                if (!form.groupDefinitions[gi]) return;
                form.groupDefinitions[gi].label = e.target.value;
                renderScheduleSection();
            });
            box.querySelector('[data-action="remove-group"]')?.addEventListener('click', () => removeGroup(gi));
            box.querySelector('[data-action="add-group-team"]')?.addEventListener('click', () => addTeamToGroup(gi));
            box.querySelectorAll('[data-action="remove-group-team"]').forEach(btn => {
                const slot = btn.closest('.team-pair-slot[data-tidx]');
                if (!slot) return;
                btn.addEventListener('click', () => removeTeamFromGroup(gi, +slot.dataset.tidx));
            });
        });

        el.querySelectorAll('.team-pair-box[data-pair]').forEach(box => {
            const pairIdx = +box.dataset.pair - 1;
            box.querySelector('[data-action="remove-match"]')?.addEventListener('click', () => removeTeamPair(pairIdx));
        });

        el.querySelectorAll('.stage-panel[data-stage]').forEach(panel => {
            const key = panel.dataset.stage;
            panel.querySelector('.stage-panel-toggle')?.addEventListener('click', () => {
                const open = panel.classList.toggle('is-open');
                stageOpenState[key] = open;
                const btn = panel.querySelector('.stage-panel-toggle');
                if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });

        el.querySelector('[data-action="add-group"]')?.addEventListener('click', () => addGroup());
        el.querySelector('[data-action="add-knockout-match"]')?.addEventListener('click', () => addTeamPair());

        bindTeamSlotControls(el, isCountry);
        bindPreviewControls(el);
        updateCounts();
        if (form.pointConfig.mainQuestMode === 'fifa') renderMainQuestTeamPoints();
        renderScorePredictionsSection();
    }

    function setClubLookupStatus(nameInp, state, message) {
        const statusEl = nameInp.closest('.club-name-lookup')?.querySelector('.player-lookup-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'player-lookup-status hint' + (state ? ' ' + state : '');
    }

    function hideClubAutocomplete(nameInp) {
        const list = nameInp.closest('.club-name-lookup')?.querySelector('.player-autocomplete-list');
        if (!list) return;
        list.innerHTML = '';
        list.classList.add('hidden');
        list._clubs = null;
        nameInp.setAttribute('aria-expanded', 'false');
    }

    async function applyClubSelection(slot, club) {
        const nameInp = slot.querySelector('[data-f="name"]');
        const flagInp = slot.querySelector('[data-f="flag"]');
        const team = getTeamRefFromSlot(slot);
        if (!club || !nameInp || !team) return;

        let selected = club;
        if ((!selected.badge || String(selected.id || '').startsWith('curated:'))
            && typeof ArisanTheSportsDB !== 'undefined') {
            setClubLookupStatus(nameInp, 'loading', 'Loading club badge…');
            try {
                const enriched = await ArisanTheSportsDB.searchTeam(selected.name);
                if (enriched && enriched.badge) selected = enriched;
            } catch (e) {}
        }

        team.name = selected.name;
        nameInp.value = selected.name;

        if (selected.badge) {
            team.flag = selected.badge;
            if (flagInp) {
                flagInp.value = selected.badge;
                updatePreviewForControl(flagInp);
            }
            setClubLookupStatus(nameInp, 'ok', 'Club badge loaded from TheSportsDB.');
        } else {
            setClubLookupStatus(nameInp, 'warn', 'Club found — enter flag/logo URL manually.');
        }

        hideClubAutocomplete(nameInp);
        renderParticipants();
        renderScheduleSection();
        syncTeamsSectionUi();
        if (form.pointConfig.mainQuestMode === 'fifa') renderMainQuestTeamPoints();
    }

    function renderClubAutocompleteOptions(nameInp, clubs, onSelect) {
        const list = nameInp.closest('.club-name-lookup')?.querySelector('.player-autocomplete-list');
        if (!list) return;

        if (!clubs.length) {
            hideClubAutocomplete(nameInp);
            return;
        }

        list._clubs = clubs;
        list.innerHTML = clubs.map((cl, idx) =>
            '<button type="button" class="player-autocomplete-option' + (idx === 0 ? ' active' : '') + '" role="option" data-idx="' + idx + '">' +
            (cl.previewThumb
                ? '<img src="' + esc(cl.previewThumb) + '" alt="" class="player-autocomplete-thumb">'
                : '<span class="player-autocomplete-thumb" aria-hidden="true"></span>') +
            '<span class="player-autocomplete-text"><strong>' + esc(cl.name) + '</strong>' +
            '<small>' + esc([cl.league, cl.country].filter(Boolean).join(' · ')) +
            (cl.hasBadge ? '' : ' · no badge') +
            '</small></span></button>'
        ).join('');

        list.classList.remove('hidden');
        nameInp.setAttribute('aria-expanded', 'true');

        list.querySelectorAll('.player-autocomplete-option').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const idx = +btn.dataset.idx;
                const club = list._clubs && list._clubs[idx];
                if (club) onSelect(club);
            });
        });
    }

    function bindClubNameLookup(slot) {
        const nameInp = slot.querySelector('[data-f="name"][data-club-lookup]');
        if (!nameInp || nameInp.dataset.lookupBound) return;
        nameInp.dataset.lookupBound = '1';

        let suggestTimer = null;
        let lookupTimer = null;
        let suggestGen = 0;
        let pickedFromList = false;

        const onSelect = club => {
            pickedFromList = true;
            applyClubSelection(slot, club);
        };

        const fetchSuggestions = async () => {
            const name = nameInp.value.trim();
            const team = getTeamRefFromSlot(slot);
            if (team) team.name = name;

            if (name.length < 2) {
                hideClubAutocomplete(nameInp);
                setClubLookupStatus(nameInp, '', '');
                return;
            }

            if (typeof ArisanTheSportsDB === 'undefined') {
                hideClubAutocomplete(nameInp);
                setClubLookupStatus(nameInp, 'warn', 'Club lookup unavailable — enter name and flag URL manually.');
                return;
            }

            const gen = ++suggestGen;
            setClubLookupStatus(nameInp, 'loading', 'Searching TheSportsDB…');

            try {
                const clubs = await ArisanTheSportsDB.searchTeams(name, 8);
                if (gen !== suggestGen) return;

                if (clubs.length) {
                    renderClubAutocompleteOptions(nameInp, clubs, onSelect);
                    setClubLookupStatus(nameInp, '', clubs.length + ' club(s) found — pick one or keep typing.');
                } else {
                    hideClubAutocomplete(nameInp);
                    setClubLookupStatus(nameInp, 'warn', 'Not found — enter flag/logo URL manually.');
                }
            } catch (e) {
                if (gen !== suggestGen) return;
                hideClubAutocomplete(nameInp);
                setClubLookupStatus(nameInp, 'warn', 'Lookup failed — enter name and flag URL manually.');
            }
        };

        const runLookupOnBlur = async () => {
            if (pickedFromList) {
                pickedFromList = false;
                return;
            }

            const name = nameInp.value.trim();
            const team = getTeamRefFromSlot(slot);
            if (team) team.name = name;
            hideClubAutocomplete(nameInp);

            if (name.length < 2 || typeof ArisanTheSportsDB === 'undefined' || !team) return;

            try {
                const result = await ArisanTheSportsDB.searchTeam(name);
                const flagInp = slot.querySelector('[data-f="flag"]');
                if (result && result.badge) {
                    team.flag = result.badge;
                    if (flagInp) {
                        flagInp.value = result.badge;
                        updatePreviewForControl(flagInp);
                    }
                    setClubLookupStatus(nameInp, 'ok', 'Club badge loaded from TheSportsDB.');
                    renderParticipants();
                    renderScheduleSection();
                } else if (!team.flag) {
                    setClubLookupStatus(nameInp, 'warn', 'Not found — enter flag/logo URL manually.');
                }
            } catch (e) {
                setClubLookupStatus(nameInp, 'warn', 'Lookup failed — enter flag/logo URL manually.');
            }
        };

        nameInp.addEventListener('input', () => {
            pickedFromList = false;
            const team = getTeamRefFromSlot(slot);
            if (team) team.name = nameInp.value;
            clearTimeout(suggestTimer);
            clearTimeout(lookupTimer);
            suggestTimer = setTimeout(fetchSuggestions, 320);
        });

        nameInp.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveAutocompleteOption(nameInp, 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveAutocompleteOption(nameInp, -1);
            } else if (e.key === 'Enter') {
                const list = nameInp.closest('.club-name-lookup')?.querySelector('.player-autocomplete-list');
                const active = list && !list.classList.contains('hidden')
                    ? list.querySelector('.player-autocomplete-option.active')
                    : null;
                if (active) {
                    e.preventDefault();
                    const idx = +active.dataset.idx;
                    const club = list._clubs && list._clubs[idx];
                    if (club) onSelect(club);
                }
            } else if (e.key === 'Escape') {
                hideClubAutocomplete(nameInp);
            }
        });

        nameInp.addEventListener('blur', () => {
            clearTimeout(lookupTimer);
            lookupTimer = setTimeout(runLookupOnBlur, 180);
        });

        nameInp.addEventListener('focus', () => {
            if (nameInp.value.trim().length >= 2) fetchSuggestions();
        });

        nameInp.addEventListener('change', () => {
            const team = getTeamRefFromSlot(slot);
            if (team) team.name = nameInp.value.trim();
            renderParticipants();
            renderScheduleSection();
            if (form.pointConfig.mainQuestMode === 'fifa') renderMainQuestTeamPoints();
        });
    }

    function renderTeamSelectField(label, selected, participantIndex, dataAttr, optionsFn) {
        const opts = optionsFn(selected, participantIndex);
        return labeledPreviewField(
            label,
            '<select ' + dataAttr + ' data-preview="team-flag">' + opts + '</select>',
            'team-flag',
            selected,
            selected,
            'flag'
        );
    }

    function renderParticipantPots(p, pi) {
        const pots = (p.picks && p.picks.mainQuest && p.picks.mainQuest.pots) || [{ teams: ['', ''] }];
        const entity = form.competitionType === 'country' ? 'Country' : 'Club';
        return pots.map((pot, potIdx) => {
            const t0 = (pot.teams && pot.teams[0]) || '';
            const t1 = (pot.teams && pot.teams[1]) || '';
            return '<div class="sub-block" data-pot="' + potIdx + '">' +
                '<div class="row-head"><strong>Pot ' + (potIdx + 1) + '</strong>' +
                (pots.length > 1 ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-pot">Remove pot</button>' : '') +
                '</div>' +
                '<div class="grid-2">' +
                renderTeamSelectField(entity + ' A', t0, pi, 'data-f="pot-a"', potTeamOptions) +
                renderTeamSelectField(entity + ' B', t1, pi, 'data-f="pot-b"', potTeamOptions) +
                '</div></div>';
        }).join('') +
            '<button type="button" class="btn btn-secondary btn-sm" data-action="add-pot">+ Add pot</button>';
    }

    function renderSideQuestTeamSelect(label, dataAttr, selected) {
        return labeledPreviewField(
            label,
            '<select ' + dataAttr + ' data-preview="team-flag">' + teamOptions(selected) + '</select>',
            'team-flag',
            selected,
            selected,
            'flag'
        );
    }

    /** Golden Boot/Glove country/club — dropdown from Section 3 teams only. */
    function renderPlayerTeamField(kind, selected) {
        const attr = kind === 'boot' ? 'data-boot' : 'data-glove';
        const isCountry = form.competitionType === 'country';
        const label = isCountry ? 'Country' : 'Club';
        return labeledPreviewField(
            label,
            '<select ' + attr + '="team" data-preview="team-flag">' + teamOptions(selected) + '</select>',
            'team-flag',
            selected || '',
            selected || label,
            'flag'
        );
    }

    function ensureCountrySuggestionsList() {
        // Kept for any legacy free-text country fields; list mirrors Section 3 when available.
        let list = document.getElementById('arisan-country-suggestions');
        if (!list) {
            list = document.createElement('datalist');
            list.id = 'arisan-country-suggestions';
            document.body.appendChild(list);
        }
        const names = teamNames();
        if (names.length) {
            list.innerHTML = names.map(n => '<option value="' + esc(n) + '">').join('');
        } else {
            const countries = window.ArisanCountries || [];
            list.innerHTML = countries.map(c => '<option value="' + esc(c.name) + '">').join('');
        }
    }

    /**
     * Map TheSportsDB nationality/club to a Section 3 team name, or '' if not in the league.
     */
    function matchLeagueTeamLabel(candidate) {
        const raw = String(candidate || '').trim();
        if (!raw) return '';
        const names = teamNames();
        if (!names.length) return '';

        const resolved = form.competitionType === 'country'
            ? resolveFreeCountryLabel(raw)
            : raw;
        const candidates = [resolved, raw].filter(Boolean);
        for (let i = 0; i < candidates.length; i++) {
            const norm = normalizeTeamLabel(candidates[i]);
            const hit = names.find(n => normalizeTeamLabel(n) === norm);
            if (hit) return hit;
        }
        return '';
    }

    function renderPlayerNameField(kind, value) {
        const attr = kind === 'boot' ? 'data-boot' : 'data-glove';
        return '<div class="player-name-lookup">' +
            '<label>Player name</label>' +
            '<div class="player-autocomplete-input-wrap">' +
            '<input type="text" ' + attr + '="player_name" value="' + esc(value) + '" placeholder="Start typing player name…" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list">' +
            '<div class="player-autocomplete-list hidden" role="listbox"></div>' +
            '</div>' +
            '<p class="player-lookup-status hint" aria-live="polite"></p>' +
            '</div>';
    }

    function hidePlayerAutocomplete(nameInp) {
        const wrap = nameInp.closest('.player-name-lookup');
        const list = wrap?.querySelector('.player-autocomplete-list');
        if (!list) return;
        list.innerHTML = '';
        list.classList.add('hidden');
        list._players = null;
        nameInp.setAttribute('aria-expanded', 'false');
    }

    function normalizeTeamLabel(s) {
        return String(s || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Prefer a canonical ArisanCountries name when nationality is a known alias,
     * otherwise keep TheSportsDB text as-is (no league-team validation).
     */
    function resolveFreeCountryLabel(nationality) {
        const raw = String(nationality || '').trim();
        if (!raw) return '';
        const norm = normalizeTeamLabel(raw);
        const countries = window.ArisanCountries || [];
        const exact = countries.find(c => normalizeTeamLabel(c.name) === norm);
        if (exact) return exact.name;

        const NATIONALITY_ALIASES = {
            'the netherlands': 'Netherlands',
            holland: 'Netherlands',
            usa: 'United States',
            'united states of america': 'United States',
            'korea republic': 'South Korea',
            'korea dpr': 'North Korea',
            'china pr': 'China',
            "cote d'ivoire": 'Ivory Coast',
            'cote divoire': 'Ivory Coast',
            'bosnia-herzegovina': 'Bosnia and Herzegovina',
            czechia: 'Czech Republic',
            'republic of ireland': 'Ireland',
            'ireland republic': 'Ireland',
            turkiye: 'Turkey',
        };
        const aliased = NATIONALITY_ALIASES[norm];
        if (aliased) {
            const hit = countries.find(c => c.name === aliased);
            if (hit) return hit.name;
            return aliased;
        }
        return raw;
    }

    function applyPlayerTeamFromLookup(row, p, kind, player) {
        const targetKey = kind === 'boot' ? 'goldenBoot' : 'goldenGlove';
        const target = p.picks.sideQuest[targetKey];
        const teamInp = row.querySelector('[data-' + kind + '="team"]');
        if (!target || !teamInp || !player) return '';

        let candidate = '';
        if (form.competitionType === 'country') {
            candidate = player.nationality || '';
        } else {
            const club = String(player.team || '').trim();
            if (club && !/^_/i.test(club) && !/free agent/i.test(club) && !/retired/i.test(club)) {
                candidate = club;
            } else {
                candidate = player.nationality || '';
            }
        }

        const fill = matchLeagueTeamLabel(candidate);
        if (!fill) return '';

        target.team = fill;
        teamInp.value = fill;
        updatePreviewForControl(teamInp);
        return fill;
    }

    async function applyPlayerSelection(row, p, kind, player) {
        const targetKey = kind === 'boot' ? 'goldenBoot' : 'goldenGlove';
        const target = p.picks.sideQuest[targetKey];
        const nameInp = row.querySelector('[data-' + kind + '="player_name"]');
        const imgInp = row.querySelector('[data-' + kind + '="img"]');
        if (!target || !nameInp || !player) return;

        let selected = {
            name: player.name || '',
            img: player.img || '',
            id: player.id || '',
            nationality: player.nationality || '',
            team: player.team || '',
        };
        if ((!selected.img || String(selected.id || '').startsWith('curated:'))
            && typeof ArisanTheSportsDB !== 'undefined') {
            setPlayerLookupStatus(nameInp, 'loading', 'Loading player avatar…');
            try {
                const enriched = await ArisanTheSportsDB.searchPlayer(selected.name);
                if (enriched) {
                    selected = {
                        name: enriched.name || selected.name,
                        img: enriched.img || selected.img || '',
                        id: enriched.id || selected.id,
                        nationality: enriched.nationality || selected.nationality || '',
                        team: enriched.team || selected.team || '',
                    };
                }
            } catch (e) {}
        }

        target.player_name = selected.name;
        nameInp.value = selected.name;

        const filledTeam = applyPlayerTeamFromLookup(row, p, kind, selected);

        if (selected.img) {
            target.img = selected.img;
            if (imgInp) {
                imgInp.value = selected.img;
                updatePreviewForControl(imgInp);
            }
            setPlayerLookupStatus(
                nameInp,
                'ok',
                'Transparent cutout loaded from TheSportsDB.'
                    + (filledTeam
                        ? ' Country/club set to ' + filledTeam + '.'
                        : ' Pick country/club from Section 3 list.')
            );
        } else {
            setPlayerLookupStatus(
                nameInp,
                'warn',
                'No transparent cutout — enter avatar URL manually.'
                    + (filledTeam
                        ? ' Country/club set to ' + filledTeam + '.'
                        : ' Pick country/club from Section 3 list.')
            );
        }

        hidePlayerAutocomplete(nameInp);
    }

    function renderPlayerAutocompleteOptions(nameInp, players, onSelect) {
        const list = nameInp.closest('.player-name-lookup')?.querySelector('.player-autocomplete-list');
        if (!list) return;

        if (!players.length) {
            hidePlayerAutocomplete(nameInp);
            return;
        }

        list._players = players;
        list.innerHTML = players.map((pl, idx) =>
            '<button type="button" class="player-autocomplete-option' + (idx === 0 ? ' active' : '') + '" role="option" data-idx="' + idx + '">' +
            (pl.previewThumb
                ? '<img src="' + esc(pl.previewThumb) + '" alt="" class="player-autocomplete-thumb' + (pl.hasCutout ? '' : ' player-img-opaque-bg') + '">'
                : '<span class="player-autocomplete-thumb" aria-hidden="true"></span>') +
            '<span class="player-autocomplete-text"><strong>' + esc(pl.name) + '</strong>' +
            '<small>' + esc(pl.team || '') +
            (pl.nationality ? (pl.team ? ' · ' : '') + esc(pl.nationality) : '') +
            (pl.hasCutout ? '' : ' · no cutout') +
            '</small></span></button>'
        ).join('');

        list.classList.remove('hidden');
        nameInp.setAttribute('aria-expanded', 'true');

        list.querySelectorAll('.player-autocomplete-option').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const idx = +btn.dataset.idx;
                const player = list._players && list._players[idx];
                if (player) onSelect(player);
            });
        });
    }

    function setActiveAutocompleteOption(nameInp, delta) {
        const list = nameInp.closest('.player-name-lookup, .league-title-lookup, .club-name-lookup')
            ?.querySelector('.player-autocomplete-list');
        if (!list || list.classList.contains('hidden')) return null;
        const options = [...list.querySelectorAll('.player-autocomplete-option')];
        if (!options.length) return null;

        let activeIdx = options.findIndex(opt => opt.classList.contains('active'));
        if (activeIdx < 0) activeIdx = 0;
        activeIdx = (activeIdx + delta + options.length) % options.length;

        options.forEach((opt, i) => opt.classList.toggle('active', i === activeIdx));
        options[activeIdx].scrollIntoView({ block: 'nearest' });
        return (list._players && list._players[activeIdx])
            || (list._leagues && list._leagues[activeIdx])
            || (list._clubs && list._clubs[activeIdx])
            || null;
    }

    function setPlayerLookupStatus(nameInp, state, message) {
        const statusEl = nameInp.closest('.player-name-lookup')?.querySelector('.player-lookup-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'player-lookup-status hint' + (state ? ' ' + state : '');
    }

    function bindPlayerNameLookup(row, p) {
        ['boot', 'glove'].forEach(kind => {
            const targetKey = kind === 'boot' ? 'goldenBoot' : 'goldenGlove';
            const nameInp = row.querySelector('[data-' + kind + '="player_name"]');
            if (!nameInp || nameInp.dataset.lookupBound) return;
            nameInp.dataset.lookupBound = '1';

            let suggestTimer = null;
            let lookupTimer = null;
            let suggestGen = 0;
            let pickedFromList = false;

            const onSelect = player => {
                pickedFromList = true;
                applyPlayerSelection(row, p, kind, player);
            };

            const fetchSuggestions = async () => {
                const target = p.picks.sideQuest[targetKey];
                if (!target) return;

                const name = nameInp.value.trim();
                target.player_name = name;

                if (name.length < 2) {
                    hidePlayerAutocomplete(nameInp);
                    setPlayerLookupStatus(nameInp, '', '');
                    return;
                }

                if (typeof ArisanTheSportsDB === 'undefined') {
                    hidePlayerAutocomplete(nameInp);
                    setPlayerLookupStatus(nameInp, 'warn', 'Player lookup unavailable — enter name and avatar manually.');
                    return;
                }

                const gen = ++suggestGen;
                setPlayerLookupStatus(nameInp, 'loading', 'Searching TheSportsDB…');

                try {
                    const players = await ArisanTheSportsDB.searchPlayers(name, 8);
                    if (gen !== suggestGen) return;

                    if (players.length) {
                        renderPlayerAutocompleteOptions(nameInp, players, onSelect);
                        setPlayerLookupStatus(nameInp, '', players.length + ' player(s) found — pick one or keep typing.');
                    } else {
                        hidePlayerAutocomplete(nameInp);
                        setPlayerLookupStatus(nameInp, 'warn', 'Not found — enter avatar URL manually and pick country/club from Section 3.');
                    }
                } catch (e) {
                    if (gen !== suggestGen) return;
                    hidePlayerAutocomplete(nameInp);
                    setPlayerLookupStatus(nameInp, 'warn', 'Lookup failed — enter name/avatar manually and pick country/club from Section 3.');
                }
            };

            const runLookupOnBlur = async () => {
                if (pickedFromList) {
                    pickedFromList = false;
                    return;
                }

                const target = p.picks.sideQuest[targetKey];
                if (!target) return;

                const name = nameInp.value.trim();
                target.player_name = name;
                hidePlayerAutocomplete(nameInp);

                if (name.length < 2) {
                    setPlayerLookupStatus(nameInp, '', '');
                    return;
                }

                if (typeof ArisanTheSportsDB === 'undefined') return;

                try {
                    const result = await ArisanTheSportsDB.searchPlayer(name);
                    const imgInp = row.querySelector('[data-' + kind + '="img"]');
                    if (result) {
                        target.player_name = result.name || name;
                        nameInp.value = target.player_name;
                        const filledTeam = applyPlayerTeamFromLookup(row, p, kind, result);
                        if (result.img) {
                            target.img = result.img;
                            if (imgInp) {
                                imgInp.value = result.img;
                                updatePreviewForControl(imgInp);
                            }
                            setPlayerLookupStatus(
                                nameInp,
                                'ok',
                                'Transparent cutout loaded from TheSportsDB.'
                                    + (filledTeam ? ' Country/club set to ' + filledTeam + '.' : '')
                            );
                        } else if (!target.img) {
                            setPlayerLookupStatus(
                                nameInp,
                                'warn',
                                'No transparent cutout — enter avatar URL manually.'
                                    + (filledTeam ? ' Country/club set to ' + filledTeam + '.' : '')
                            );
                        } else if (filledTeam) {
                            setPlayerLookupStatus(nameInp, 'ok', 'Country/club set to ' + filledTeam + '.');
                        }
                    } else if (!target.img) {
                        setPlayerLookupStatus(nameInp, 'warn', 'No transparent cutout — enter avatar URL manually.');
                    }
                } catch (e) {
                    setPlayerLookupStatus(nameInp, 'warn', 'Lookup failed — enter avatar URL manually.');
                }
            };

            nameInp.addEventListener('input', () => {
                pickedFromList = false;
                const target = p.picks.sideQuest[targetKey];
                if (target) target.player_name = nameInp.value;
                clearTimeout(suggestTimer);
                clearTimeout(lookupTimer);
                suggestTimer = setTimeout(fetchSuggestions, 320);
            });

            nameInp.addEventListener('keydown', e => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveAutocompleteOption(nameInp, 1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveAutocompleteOption(nameInp, -1);
                } else if (e.key === 'Enter') {
                    const list = nameInp.closest('.player-name-lookup')?.querySelector('.player-autocomplete-list');
                    const active = list && !list.classList.contains('hidden')
                        ? list.querySelector('.player-autocomplete-option.active')
                        : null;
                    if (active) {
                        e.preventDefault();
                        const idx = +active.dataset.idx;
                        const player = list._players && list._players[idx];
                        if (player) onSelect(player);
                    }
                } else if (e.key === 'Escape') {
                    hidePlayerAutocomplete(nameInp);
                }
            });

            nameInp.addEventListener('blur', () => {
                clearTimeout(lookupTimer);
                lookupTimer = setTimeout(runLookupOnBlur, 180);
            });

            nameInp.addEventListener('focus', () => {
                const name = nameInp.value.trim();
                if (name.length >= 2) fetchSuggestions();
            });
        });
    }

    function renderParticipantSideQuest(p) {
        const sq = (p.picks && p.picks.sideQuest) || defaultPicks(form.includeThirdPlace).sideQuest;
        const entity = form.competitionType === 'country' ? 'Country' : 'Club';
        const thirdBlock = form.includeThirdPlace
            ? renderSideQuestTeamSelect('Third place', 'data-sq="third"', sq.third)
            : '';

        return '<div class="sub-section">' +
            '<h3 class="sub-title">Side Quest</h3>' +
            '<div class="grid-3">' +
            renderSideQuestTeamSelect('Champion', 'data-sq="champion"', sq.champion) +
            renderSideQuestTeamSelect('Runner-up', 'data-sq="runnerup"', sq.runnerup) +
            thirdBlock +
            '</div>' +
            '<p class="hint sub-hint">Golden Boot</p>' +
            '<div class="grid-3">' +
            renderPlayerNameField('boot', sq.goldenBoot?.player_name) +
            labeledPreviewField(
                'Player\'s avatar (image URL)',
                '<input type="text" data-boot="img" data-preview="image-url" value="' + esc(sq.goldenBoot?.img) + '">',
                'image-url',
                sq.goldenBoot?.img,
                sq.goldenBoot?.player_name || 'Avatar',
                'image'
            ) +
            renderPlayerTeamField('boot', sq.goldenBoot?.team) +
            '</div>' +
            '<p class="hint sub-hint">Golden Glove</p>' +
            '<div class="grid-3">' +
            renderPlayerNameField('glove', sq.goldenGlove?.player_name) +
            labeledPreviewField(
                'Player\'s avatar (image URL)',
                '<input type="text" data-glove="img" data-preview="image-url" value="' + esc(sq.goldenGlove?.img) + '">',
                'image-url',
                sq.goldenGlove?.img,
                sq.goldenGlove?.player_name || 'Avatar',
                'image'
            ) +
            renderPlayerTeamField('glove', sq.goldenGlove?.team) +
            '</div>' +
            '<div class="grid-2" style="margin-top:12px">' +
            '<div><label>Total goal prediction</label><input type="number" data-sq="totalGoal" min="0" step="1" value="' +
            (sq.totalGoal != null ? sq.totalGoal : '') + '"></div>' +
            '</div></div>';
    }

    function renderParticipants() {
        const el = document.getElementById('participants-list');
        if (!el) return;
        ensureCountrySuggestionsList();
        captureParticipantOpenState();
        collectScorePredictionsFromDom();

        el.innerHTML = form.participants.map((p, i) => {
            if (!p.picks) p.picks = defaultPicks(form.includeThirdPlace);
            ensureScorePredictPicks(p);
            const open = isParticipantOpenByDefault(i);
            return '<div class="row-item participant-row participant-collapsible' + (open ? ' is-open' : '') + '" data-idx="' + i + '">' +
                '<div class="row-head participant-toggle-wrap">' +
                '<button type="button" class="participant-toggle" aria-expanded="' + (open ? 'true' : 'false') + '">' +
                '<span class="participant-toggle-icon" aria-hidden="true">▼</span>' +
                '<strong>' + participantHeaderLabel(p, i) + '</strong>' +
                '</button>' +
                (form.participants.length > 1
                    ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-participant">Remove</button>'
                    : '') +
                '</div>' +
                '<div class="participant-body">' +
                '<div class="grid-3">' +
                '<div><label>Name</label><input type="text" data-f="name" value="' + esc(p.name) + '"></div>' +
                labeledPreviewField(
                    'Avatar (image URL)',
                    '<input type="text" data-f="avatar_path" data-preview="avatar-url" value="' + esc(p.avatar_path) + '" placeholder="https://...">',
                    'avatar-url',
                    p.avatar_path,
                    p.name || 'Avatar',
                    'avatar'
                ) +
                '<div><label>Color</label><input type="color" data-f="color" value="' + esc(p.color || DEFAULT_PARTICIPANT_COLORS[i % DEFAULT_PARTICIPANT_COLORS.length]) + '"></div>' +
                '</div>' +
                '<div class="sub-section">' +
                '<h3 class="sub-title">Main Quest</h3>' +
                renderParticipantPots(p, i) +
                '</div>' +
                renderParticipantSideQuest(p) +
                '</div>' +
                '</div>';
        }).join('');

        el.querySelectorAll('.participant-row').forEach(row => {
            const i = +row.dataset.idx;
            const p = form.participants[i];
            if (!p.picks) p.picks = defaultPicks(form.includeThirdPlace);

            bindParticipantCollapse(row);
            row.querySelector('[data-action="remove-participant"]')?.addEventListener('click', () => removeParticipant(i));
            row.querySelectorAll('[data-f]').forEach(inp => {
                inp.addEventListener('input', () => {
                    p[inp.dataset.f] = inp.value;
                    updatePreviewForControl(inp);
                    if (inp.dataset.f === 'name') syncParticipantHeaderLabel(row, inp.value);
                });
            });

            row.querySelector('[data-action="add-pot"]')?.addEventListener('click', () => {
                p.picks.mainQuest.pots.push({ teams: ['', ''] });
                renderParticipants();
            });

            row.querySelectorAll('[data-pot]').forEach(potEl => {
                const potIdx = +potEl.dataset.pot;
                potEl.querySelector('[data-action="remove-pot"]')?.addEventListener('click', () => {
                    p.picks.mainQuest.pots.splice(potIdx, 1);
                    if (!p.picks.mainQuest.pots.length) p.picks.mainQuest.pots.push({ teams: ['', ''] });
                    renderParticipants();
                });
                const pot = p.picks.mainQuest.pots[potIdx];
                if (!pot.teams) pot.teams = ['', ''];
                potEl.querySelector('[data-f="pot-a"]')?.addEventListener('change', e => {
                    pot.teams[0] = e.target.value;
                    renderParticipants();
                });
                potEl.querySelector('[data-f="pot-b"]')?.addEventListener('change', e => {
                    pot.teams[1] = e.target.value;
                    renderParticipants();
                });
            });

            row.querySelectorAll('[data-sq]').forEach(inp => {
                const key = inp.dataset.sq;
                const handler = () => {
                    if (key === 'totalGoal') {
                        p.picks.sideQuest.totalGoal = inp.value === '' ? null : parseInt(inp.value, 10);
                    } else {
                        p.picks.sideQuest[key] = inp.value;
                    }
                    updatePreviewForControl(inp);
                };
                inp.addEventListener('input', handler);
                inp.addEventListener('change', handler);
            });

            ['boot', 'glove'].forEach(kind => {
                row.querySelectorAll('[data-' + kind + ']').forEach(inp => {
                    const attr = inp.getAttribute('data-' + kind);
                    if (attr === 'player_name') return;
                    const handler = () => {
                        const target = kind === 'boot' ? p.picks.sideQuest.goldenBoot : p.picks.sideQuest.goldenGlove;
                        if (!target) return;
                        target[attr] = inp.value;
                        updatePreviewForControl(inp);
                    };
                    inp.addEventListener('input', handler);
                    inp.addEventListener('change', handler);
                });
            });

            bindPlayerNameLookup(row, p);
        });
        bindPreviewControls(el);
        updateCounts();
        renderScorePredictionsSection();
    }

    function collectScorePredictionsFromDom() {
        const root = document.getElementById('score-predictions-root');
        if (!root) return;
        form.participants.forEach(p => ensureScorePredictPicks(p));
        root.querySelectorAll('[data-sp-match][data-sp-participant]').forEach(wrap => {
            const matchId = wrap.dataset.spMatch;
            const pi = parseInt(wrap.dataset.spParticipant, 10);
            const p = form.participants[pi];
            if (!p || !matchId) return;
            const map = ensureScorePredictPicks(p);
            const aEl = wrap.querySelector('[data-sp="a"]');
            const bEl = wrap.querySelector('[data-sp="b"]');
            const entry = normalizeScorePredictEntry({
                a: aEl ? aEl.value : '',
                b: bEl ? bEl.value : '',
            });
            if (entry) map[matchId] = entry;
            else delete map[matchId];
        });
    }

    function pruneScorePredictionsToCatalog(catalogIds) {
        const valid = new Set(catalogIds || []);
        form.participants.forEach(p => {
            const map = ensureScorePredictPicks(p);
            Object.keys(map).forEach(id => {
                if (!valid.has(id)) delete map[id];
            });
        });
    }

    function renderScorePredictionsSection() {
        const root = document.getElementById('score-predictions-root');
        if (!root) return;

        collectScorePredictionsFromDom();

        const catalog = getScheduleCatalog();
        const participants = form.participants.filter(p => (p.name || '').trim());
        if (!catalog.length) {
            root.innerHTML = '<p class="hint">Add teams / matches in Section 3 to configure score predictions.</p>';
            return;
        }
        if (!participants.length) {
            root.innerHTML = '<p class="hint">Add named participants in Section 4 to enter score predictions.</p>';
            return;
        }

        pruneScorePredictionsToCatalog(catalog.map(e => e.id));

        let html = '<div class="score-predict-wrap"><table class="score-predict-table"><thead><tr>' +
            '<th>Match</th>' +
            participants.map(p => '<th class="sp-participant">' + esc(p.name) + '</th>').join('') +
            '</tr></thead><tbody>';

        catalog.forEach(entry => {
            html += '<tr><td class="sp-match-label" title="' + esc(entry.label) + '">' + esc(entry.label) + '</td>';
            form.participants.forEach((p, pi) => {
                if (!(p.name || '').trim()) return;
                const map = ensureScorePredictPicks(p);
                const pred = map[entry.id] || {};
                const aVal = pred.a != null ? String(pred.a) : '';
                const bVal = pred.b != null ? String(pred.b) : '';
                const hasPred = aVal !== '' || bVal !== '';
                html += '<td><div class="score-predict-inputs' + (hasPred ? '' : ' is-empty') +
                    '" data-sp-match="' + esc(entry.id) +
                    '" data-sp-participant="' + pi + '">' +
                    '<input type="number" min="0" step="1" data-sp="a" value="' + esc(aVal) +
                    '" aria-label="' + esc(p.name) + ' home score for ' + esc(entry.label) + '">' +
                    '<span class="sp-sep">-</span>' +
                    '<input type="number" min="0" step="1" data-sp="b" value="' + esc(bVal) +
                    '" aria-label="' + esc(p.name) + ' away score for ' + esc(entry.label) + '">' +
                    '<button type="button" class="sp-clear" title="Clear prediction" aria-label="Clear prediction for ' +
                    esc(p.name) + ' on ' + esc(entry.label) + '">✕</button>' +
                    '</div></td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        root.innerHTML = html;

        function syncClearVisibility(wrap) {
            if (!wrap) return;
            const aEl = wrap.querySelector('[data-sp="a"]');
            const bEl = wrap.querySelector('[data-sp="b"]');
            const filled = !!(aEl && aEl.value !== '') || !!(bEl && bEl.value !== '');
            wrap.classList.toggle('is-empty', !filled);
        }

        root.querySelectorAll('.score-predict-inputs').forEach(wrap => {
            wrap.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('change', () => {
                    collectScorePredictionsFromDom();
                    syncClearVisibility(wrap);
                });
                inp.addEventListener('input', () => {
                    collectScorePredictionsFromDom();
                    syncClearVisibility(wrap);
                });
            });
            wrap.querySelector('.sp-clear')?.addEventListener('click', () => {
                const aEl = wrap.querySelector('[data-sp="a"]');
                const bEl = wrap.querySelector('[data-sp="b"]');
                if (aEl) aEl.value = '';
                if (bEl) bEl.value = '';
                const matchId = wrap.dataset.spMatch;
                const pi = parseInt(wrap.dataset.spParticipant, 10);
                const p = form.participants[pi];
                if (p && matchId) {
                    const map = ensureScorePredictPicks(p);
                    delete map[matchId];
                }
                collectScorePredictionsFromDom();
                syncClearVisibility(wrap);
            });
        });
    }

    function renderAll(opts) {
        renderLeagueMeta();
        renderTeams();
        renderParticipants();
        renderScheduleSection(opts);
        renderScorePredictionsSection();
    }

    function addParticipant() {
        form.participants.push(emptyParticipant(form.participants.length));
        participantOpenState[form.participants.length - 1] = false;
        renderParticipants();
    }

    function removeParticipant(i) {
        if (form.participants.length <= 1) return;
        form.participants.splice(i, 1);
        renderParticipants();
    }

    function emptyTeam() {
        return { name: '', flag: '' };
    }

    function ensureInitialTeamPair() {
        if (!form.teams.length) {
            form.teams.push(emptyTeam(), emptyTeam());
        }
    }

    function ensureInitialParticipant() {
        if (!form.participants.length) {
            form.participants.push(emptyParticipant(0));
        }
    }

    function addGroup() {
        form.groupDefinitions.push(emptyGroup(form.groupDefinitions.length));
        renderTeams();
        renderParticipants();
        const list = document.getElementById('teams-list');
        const boxes = list && list.querySelectorAll('.group-def-box');
        const last = boxes && boxes[boxes.length - 1];
        last?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        last?.querySelector('[data-f="name"]')?.focus();
    }

    function removeGroup(gi) {
        if (form.groupDefinitions.length <= 1) return;
        form.groupDefinitions.splice(gi, 1);
        form.groupDefinitions.forEach((g, i) => {
            if (!(g.label || '').trim()) g.label = String.fromCharCode(65 + i);
        });
        renderTeams();
        renderParticipants();
    }

    function addTeamToGroup(gi) {
        const g = form.groupDefinitions[gi];
        if (!g) return;
        if (!g.teams) g.teams = [];
        g.teams.push(emptyTeam());
        const focusTidx = g.teams.length - 1;
        renderTeams();
        renderParticipants();
        const slot = document.querySelector(
            '.team-pair-slot[data-gidx="' + gi + '"][data-tidx="' + focusTidx + '"]'
        );
        slot?.querySelector('[data-f="name"]')?.focus();
        slot?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function removeTeamFromGroup(gi, ti) {
        const g = form.groupDefinitions[gi];
        if (!g || !g.teams || g.teams.length <= 2) return;
        g.teams.splice(ti, 1);
        renderTeams();
        renderParticipants();
    }

    function addTeamPair() {
        if (form.teams.length % 2 === 1) {
            form.teams.push(emptyTeam());
        } else {
            form.teams.push(emptyTeam(), emptyTeam());
        }
        const focusIdx = form.teams.length - 2;
        renderTeams();
        renderParticipants();
        focusTeamNameField(focusIdx);
    }

    function focusTeamNameField(teamIndex) {
        const list = document.getElementById('teams-list');
        if (!list) return;
        const slot = list.querySelector('.team-pair-slot[data-idx="' + teamIndex + '"]');
        if (!slot) return;
        const control = slot.querySelector('[data-f="name"]');
        if (!control) return;
        control.focus();
        if (typeof control.select === 'function' && control.tagName === 'INPUT') {
            control.select();
        }
        slot.closest('.team-pair-box')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function removeTeamPair(pairIndex) {
        const startIdx = pairIndex * 2;
        if (form.teams.length <= 2 || startIdx < 0 || startIdx >= form.teams.length) return;
        form.teams.splice(startIdx, 2);
        renderTeams();
        renderParticipants();
    }

    function newBlankLeague() {
        form = {
            competitionType: 'country',
            includeGroupStage: false,
            includeKnockoutStage: true,
            includeThirdPlace: true,
            twoLegKnockout: false,
            pointConfig: normalizePointConfig(null),
            teams: [],
            groupDefinitions: [],
            groupFixtures: [],
            participants: [],
            matchSchedule: {},
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
            updatePreviewForControl(iconInp);
        }
        const trophyInp = document.getElementById('league-trophy-url');
        if (trophyInp) {
            trophyInp.value = '';
            updatePreviewForControl(trophyInp);
        }
        const ballInp = document.getElementById('league-ball-url');
        if (ballInp) {
            ballInp.value = '';
            updatePreviewForControl(ballInp);
        }
        const musicInp = document.getElementById('league-bg-music-url');
        if (musicInp) musicInp.value = '';
        ensureInitialTeamPair();
        ensureInitialParticipant();
        renderAll();
        return form;
    }

    function hydrateGroupDefinitions(data, flagByName) {
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

    function loadFromSetupData(data) {
        form.competitionType = data.competitionType || 'country';
        form.includeGroupStage = !!data.includeGroupStage;
        form.includeKnockoutStage = data.includeKnockoutStage !== false;
        form.includeThirdPlace = data.includeThirdPlace !== false;
        form.twoLegKnockout = !!data.twoLegKnockout;
        form.pointConfig = normalizePointConfig(data.pointConfig);
        form.matchSchedule = data.matchSchedule || {};
        form.scheduleStartDate = data.scheduleStartDate || '';
        form.scheduleKickoff = data.scheduleKickoff || '19:00';
        form.iconImageUrl = data.iconImageUrl || '';
        form.trophyImageUrl = data.trophyImageUrl || '';
        form.ballImageUrl = data.ballImageUrl || '';
        form.backgroundMusicUrl = data.backgroundMusicUrl || '';
        if (!form.includeThirdPlace) form.pointConfig.sideQuest.third = 0;

        const fixtures = Array.isArray(data.groupFixtures) ? data.groupFixtures : [];
        form.groupFixtures = fixtures.map(f => ({
            a: String((f && f.a) || '').trim(),
            b: String((f && f.b) || '').trim(),
            group: String((f && (f.group || f.groupLabel)) || '').trim(),
        }));

        const uniqueTeams = (data.teams || []).map(t => ({ name: t.name || '', flag: t.flag || '' }));
        const flagByName = {};
        uniqueTeams.forEach(t => {
            if (t.name) flagByName[t.name] = t.flag || '';
        });

        form.groupDefinitions = form.includeGroupStage
            ? hydrateGroupDefinitions(data, flagByName)
            : [];
        if (form.includeGroupStage && !form.groupDefinitions.length) ensureInitialGroups();

        if (form.includeKnockoutStage) {
            const seeds = Array.isArray(data.knockoutSeeds) ? data.knockoutSeeds : null;
            if (seeds && seeds.length) {
                form.teams = seeds.map(t => ({
                    name: normalizeSeedName(typeof t === 'string' ? t : (t && t.name)),
                    flag: typeof t === 'object' && t ? (t.flag || flagByName[normalizeSeedName(t.name)] || '') : '',
                }));
            } else if (form.includeGroupStage) {
                // Group + knockout without saved seeds → default TBD pairs (not all group teams).
                form.teams = [];
            } else {
                form.teams = uniqueTeams.length ? uniqueTeams.slice() : [];
            }
            if (!form.teams.length) ensureInitialTeamPair();
            if (form.teams.length % 2 === 1) form.teams.push(emptyTeam());
        } else {
            form.teams = [];
        }

        form.participants = (data.participants || []).map((p, i) => {
            const row = {
                name: p.name || '',
                avatar_path: p.avatar_path || '',
                color: p.color || DEFAULT_PARTICIPANT_COLORS[i % DEFAULT_PARTICIPANT_COLORS.length],
                picks: p.picks || defaultPicks(form.includeThirdPlace),
            };
            if (!row.picks.sideQuest) {
                row.picks.sideQuest = defaultPicks(form.includeThirdPlace).sideQuest;
            }
            if (!row.picks.sideQuest.scorePredict || typeof row.picks.sideQuest.scorePredict !== 'object') {
                row.picks.sideQuest.scorePredict = {};
            }
            return row;
        });
        renderAll({ skipCollect: true });
        // Load league data is a user gesture — fill URL and autoplay preview.
        syncBackgroundMusicFieldFromForm();
    }

    function getPayload() {
        collectScheduleFromDom();
        pruneMatchSchedule();
        collectTeamPointsFromDom();
        syncTeamPointsWithTeamList();
        collectScorePredictionsFromDom();
        pruneScorePredictionsToCatalog(getScheduleCatalog().map(e => e.id));

        const pointConfig = normalizePointConfig(form.pointConfig);
        if (!form.includeThirdPlace) pointConfig.sideQuest.third = 0;

        let groupDefinitions = [];
        let groupFixtures = [];
        if (form.includeGroupStage) {
            groupDefinitions = (form.groupDefinitions || []).map((g, i) => ({
                label: (g.label || String.fromCharCode(65 + i)).trim() || String.fromCharCode(65 + i),
                teams: (g.teams || []).map(t => (t.name || '').trim()).filter(Boolean),
            })).filter(g => g.teams.length);
            groupFixtures = (typeof ArisanBracket !== 'undefined' && ArisanBracket.fixturesFromGroupDefinitions)
                ? ArisanBracket.fixturesFromGroupDefinitions(groupDefinitions)
                : [];
        }

        const byKey = new Map();
        function pushTeam(t) {
            const name = normalizeSeedName(t.name);
            if (!name) return;
            const key = name.toLowerCase();
            if (!byKey.has(key)) byKey.set(key, { name, flag: t.flag || '' });
            else if (t.flag && !byKey.get(key).flag) byKey.get(key).flag = t.flag;
        }
        if (form.includeGroupStage) uniqueTeamsFromGroups(form.groupDefinitions).forEach(pushTeam);
        const knockoutSeeds = form.includeKnockoutStage
            ? form.teams.map(t => ({
                name: normalizeSeedName(t.name),
                flag: normalizeSeedName(t.name) ? (t.flag || '') : '',
            }))
            : [];
        knockoutSeeds.forEach(pushTeam);
        const teams = Array.from(byKey.values());

        return {
            competitionType: form.competitionType,
            includeGroupStage: form.includeGroupStage,
            includeKnockoutStage: form.includeKnockoutStage,
            includeThirdPlace: form.includeThirdPlace,
            twoLegKnockout: form.twoLegKnockout,
            pointConfig,
            matchSchedule: JSON.parse(JSON.stringify(form.matchSchedule || {})),
            scheduleStartDate: form.scheduleStartDate || '',
            scheduleKickoff: form.scheduleKickoff || '19:00',
            iconImageUrl: form.iconImageUrl || '',
            trophyImageUrl: form.trophyImageUrl || '',
            ballImageUrl: form.ballImageUrl || '',
            backgroundMusicUrl: form.backgroundMusicUrl || '',
            teams,
            knockoutSeeds,
            groupDefinitions,
            groupFixtures,
            participants: form.participants.filter(p => p.name && p.name.trim()),
        };
    }

    function bindLeagueMeta() {
        document.getElementById('competition-type')?.addEventListener('change', e => {
            form.competitionType = e.target.value;
            form.teams.forEach(syncTeamFlagFromCountry);
            (form.groupDefinitions || []).forEach(g => (g.teams || []).forEach(syncTeamFlagFromCountry));
            updateSectionLabels();
            renderTeams();
            renderParticipants();
        });
        document.getElementById('include-group-stage')?.addEventListener('change', e => {
            form.includeGroupStage = e.target.checked;
            if (form.includeGroupStage) ensureInitialGroups();
            updateSectionLabels();
            syncTeamsSectionUi();
            renderTeams();
            renderScheduleSection();
        });
        document.getElementById('include-knockout-stage')?.addEventListener('change', e => {
            form.includeKnockoutStage = e.target.checked;
            if (form.includeKnockoutStage) ensureInitialTeamPair();
            syncStageOptionVisibility();
            updateSectionLabels();
            syncTeamsSectionUi();
            renderTeams();
            renderScheduleSection();
        });
        document.getElementById('include-third-place')?.addEventListener('change', e => {
            form.includeThirdPlace = e.target.checked;
            syncThirdPlacePointConfig();
            renderPointConfig();
            renderParticipants();
            renderScheduleSection();
        });
        document.getElementById('two-leg-knockout')?.addEventListener('change', e => {
            form.twoLegKnockout = e.target.checked;
            renderScheduleSection();
        });
        document.getElementById('league-year')?.addEventListener('change', () => {
            renderScheduleSection();
        });
    }

    function init() {
        bindPointConfig();
        bindLeagueMeta();
        if (form.includeGroupStage) ensureInitialGroups();
        if (form.includeKnockoutStage) ensureInitialTeamPair();
        ensureInitialParticipant();
        renderAll();
    }

    return {
        DEFAULT_POINT_CONFIG,
        DEFAULT_PARTICIPANT_COLORS,
        defaultPicks,
        get form() { return form; },
        init,
        renderAll,
        addParticipant,
        removeParticipant,
        addGroup,
        addTeamPair,
        removeTeamPair,
        newBlankLeague,
        loadFromSetupData,
        getPayload,
        validateTeamsForSave,
        teamPairsFromFixtures,
        isTeamsSectionComplete,
        renderScheduleSection,
    };
})();

// Global handlers for onclick in HTML
function addParticipant() { ArisanSetupForm.addParticipant(); }
function removeParticipant(i) { ArisanSetupForm.removeParticipant(i); }
function addTeam() { ArisanSetupForm.addTeamPair(); }
function addGroup() { ArisanSetupForm.addGroup(); }
function removeTeamPair(i) { ArisanSetupForm.removeTeamPair(i); }
function newBlankLeague() { ArisanSetupForm.newBlankLeague(); }
