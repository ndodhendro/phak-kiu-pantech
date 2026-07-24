/**
 * Setup section: teams / groups / schedule
 * Auto-split from setup-form.js — uses shared ArisanSetupFormCore.
 */
(function (Core) {
'use strict';

    Core.isStageOpen = function isStageOpen(key) {
        return Core.stageOpenState[key] !== false;
    }

    Core.collectTakenGroupCountries = function collectTakenGroupCountries(exceptGidx, exceptTidx) {
        const taken = new Set();
        (Core.form.groupDefinitions || []).forEach((g, gi) => {
            (g.teams || []).forEach((t, ti) => {
                if (gi === exceptGidx && ti === exceptTidx) return;
                const name = typeof t === 'string' ? t.trim() : String((t && t.name) || '').trim();
                if (name) taken.add(name.toLowerCase());
            });
        });
        return taken;
    }

    Core.emptyGroup = function emptyGroup(index) {
        return {
            label: String.fromCharCode(65 + (index || 0)),
            teams: [Core.emptyTeam(), Core.emptyTeam(), Core.emptyTeam(), Core.emptyTeam()],
        };
    }

    Core.ensureInitialGroups = function ensureInitialGroups() {
        if (!Core.form.groupDefinitions.length) {
            Core.form.groupDefinitions.push(Core.emptyGroup(0), Core.emptyGroup(1));
        }
    }

    Core.getDefaultScheduleKickoff = function getDefaultScheduleKickoff() {
        return (Core.form.scheduleKickoff || '19:00').trim() || '19:00';
    }

    Core.getLeagueYearFromDom = function getLeagueYearFromDom() {
        const el = document.getElementById('league-year');
        const y = el ? parseInt(el.value, 10) : NaN;
        return Number.isNaN(y) ? new Date().getFullYear() : y;
    }

    Core.sortScheduleCatalogAscending = function sortScheduleCatalogAscending(catalog) {
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

    Core.matchScheduleSortMsForEntry = function matchScheduleSortMsForEntry(entry) {
        const text = Core.scheduleTextForEntry(entry);
        if (!text) return null;
        const parts = Core.scheduleTextToParts(text);
        if (!parts.date) return null;
        const dm = String(parts.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const tm = String(parts.time || '00:00').match(/^(\d{1,2}):(\d{2})/);
        if (!dm || !tm) return null;
        return Date.UTC(
            parseInt(dm[1], 10),
            parseInt(dm[2], 10) - 1,
            parseInt(dm[3], 10),
            parseInt(tm[1], 10) - 7,
            parseInt(tm[2], 10)
        );
    }

    Core.sortScheduleCatalogForSetup = function sortScheduleCatalogForSetup(catalog) {
        const ordered = Core.sortScheduleCatalogAscending(catalog);
        const indexOf = new Map(ordered.map((e, i) => [e.id, i]));
        const now = Date.now();

        return ordered.slice().sort((a, b) => {
            const msA = Core.matchScheduleSortMsForEntry(a);
            const msB = Core.matchScheduleSortMsForEntry(b);
            const hasA = msA != null && Number.isFinite(msA);
            const hasB = msB != null && Number.isFinite(msB);
            if (hasA !== hasB) return hasA ? 1 : -1; // unscheduled first
            if (!hasA && !hasB) {
                return (indexOf.get(a.id) || 0) - (indexOf.get(b.id) || 0);
            }
            const distA = Math.abs(msA - now);
            const distB = Math.abs(msB - now);
            if (distA !== distB) return distA - distB;
            if (msA !== msB) return msA - msB;
            return (indexOf.get(a.id) || 0) - (indexOf.get(b.id) || 0);
        });
    }

    Core.reorderScheduleSectionsAfterSave = function reorderScheduleSectionsAfterSave() {
        Core.collectScheduleFromDom();
        Core.collectScorePredictionsFromDom();
        Core.renderScheduleSection({ skipCollect: true });
        Core.renderScorePredictionsSection({ skipCollect: true });
    }

    Core.collectScheduleFromDom = function collectScheduleFromDom() {
        const preview = document.getElementById('schedule-preview');
        if (!preview) return;
        preview.querySelectorAll('.schedule-edit-row').forEach(Core.syncScheduleFromRow);
    }

    Core.pruneMatchSchedule = function pruneMatchSchedule() {
        const catalog = Core.getScheduleCatalog();
        // Incomplete teams / empty catalog must NOT wipe schedules — that was wiping
        // playoff times whenever a team name was briefly incomplete during edit.
        if (!catalog.length) return;
        const valid = new Set(catalog.map(c => Core.catalogPairKey(c)));
        const next = {};
        Object.keys(Core.form.matchSchedule || {}).forEach(k => {
            if (valid.has(k) && Core.form.matchSchedule[k]) next[k] = Core.form.matchSchedule[k];
        });
        Core.form.matchSchedule = next;
    }

    Core.scheduleTextToParts = function scheduleTextToParts(text) {
        const raw = String(text || '').replace(/^✅\s*/, '').trim();
        if (!raw) return { date: '', time: '' };

        const year = Core.getLeagueYearFromDom();
        let day; let month; let hour; let minute;

        let m = raw.match(/^(?:\w+,\s*)?(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
        if (m) {
            const mi = Core.MONTH_INDEX[m[2].toLowerCase()];
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

    Core.partsToScheduleText = function partsToScheduleText(dateStr, timeStr) {
        if (!dateStr || !timeStr) return '';
        const dm = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const tm = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
        if (!dm || !tm) return '';
        const year = parseInt(dm[1], 10);
        const month = parseInt(dm[2], 10);
        const day = parseInt(dm[3], 10);
        const hour = parseInt(tm[1], 10);
        const minute = parseInt(tm[2], 10);
        const wd = Core.WEEKDAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
        return wd + ', ' + day + ' ' + Core.MONTH_SHORT[month - 1] + ', ' +
            String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ' WIB';
    }

    Core.parseHhMm = function parseHhMm(timeStr) {
        const m = String(timeStr || '').match(/^(\d{1,2}):(\d{2})/);
        if (!m) return { hour: '19', minute: '00' };
        return {
            hour: String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0'),
            minute: String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0'),
        };
    }

    Core.buildTimeSelectOptions = function buildTimeSelectOptions(max, selected) {
        let html = '';
        for (let i = 0; i <= max; i++) {
            const v = String(i).padStart(2, '0');
            html += '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + v + '</option>';
        }
        return html;
    }

    Core.scheduleTimeInputsHtml = function scheduleTimeInputsHtml(timeValue) {
        const parts = Core.parseHhMm(timeValue || Core.getDefaultScheduleKickoff());
        return '<div class="schedule-time-24h" title="Kickoff WIB (24-hour)">' +
            '<select data-schedule-hour aria-label="Hour (24h)">' +
            Core.buildTimeSelectOptions(23, parts.hour) +
            '</select>' +
            '<span class="schedule-time-sep" aria-hidden="true">:</span>' +
            '<select data-schedule-minute aria-label="Minute">' +
            Core.buildTimeSelectOptions(59, parts.minute) +
            '</select>' +
            '</div>';
    }

    Core.getScheduleTimeFromRow = function getScheduleTimeFromRow(row) {
        const hourEl = row.querySelector('[data-schedule-hour]');
        const minuteEl = row.querySelector('[data-schedule-minute]');
        if (hourEl && minuteEl) {
            return hourEl.value + ':' + minuteEl.value;
        }
        const timeEl = row.querySelector('[data-schedule-time]');
        return (timeEl && timeEl.value ? timeEl.value.trim() : '') || Core.getDefaultScheduleKickoff();
    }

    Core.syncScheduleFromRow = function syncScheduleFromRow(row) {
        const key = row && (row.dataset.pairKey || row.dataset.matchId);
        if (!key) return;
        const dateEl = row.querySelector('[data-schedule-date]');
        const dateVal = dateEl && dateEl.value ? dateEl.value.trim() : '';
        const timeVal = Core.getScheduleTimeFromRow(row);
        const text = dateVal ? Core.partsToScheduleText(dateVal, timeVal) : '';
        if (!Core.form.matchSchedule) Core.form.matchSchedule = {};
        if (text) Core.form.matchSchedule[key] = text;
        else delete Core.form.matchSchedule[key];
    }

    Core.isGroupScheduleEntry = function isGroupScheduleEntry(entry) {
        return String(entry && entry.id || '').toLowerCase().startsWith('group-');
    }

    Core.renderScheduleRowsHtml = function renderScheduleRowsHtml(catalog) {
        const swaps = Core.form.fixtureSideSwaps || {};
        return '<ul class="schedule-preview-list">' +
            catalog.map(entry => {
                const pk = Core.catalogPairKey(entry);
                const parts = Core.scheduleTextToParts(Core.scheduleTextForEntry(entry));
                const timeValue = parts.time || Core.getDefaultScheduleKickoff();
                const swapped = !!swaps[pk];
                return '<li class="schedule-edit-row" data-match-id="' + Core.esc(entry.id) +
                    '" data-pair-key="' + Core.esc(pk) + '">' +
                    '<div class="schedule-match-main">' +
                    '<strong>' + Core.esc(entry.label) + '</strong>' +
                    (swapped ? '<span class="schedule-swapped-badge">Swapped</span>' : '') +
                    '</div>' +
                    '<div class="schedule-edit-inputs">' +
                    '<button type="button" class="btn btn-secondary btn-sm schedule-swap-btn" data-action="swap-sides" title="Swap home/away order" aria-label="Swap home and away for ' + Core.esc(entry.label) + '">⇄ Swap</button>' +
                    '<input type="date" data-schedule-date value="' + Core.esc(parts.date) + '" aria-label="Date">' +
                    Core.scheduleTimeInputsHtml(timeValue) +
                    '</div></li>';
            }).join('') +
            '</ul>';
    }

    Core.bindScheduleStagePanels = function bindScheduleStagePanels(root) {
        if (!root) return;
        root.querySelectorAll('.stage-panel[data-stage]').forEach(panel => {
            const key = panel.dataset.stage;
            panel.querySelector('.stage-panel-toggle')?.addEventListener('click', () => {
                const open = panel.classList.toggle('is-open');
                Core.stageOpenState[key] = open;
                const btn = panel.querySelector('.stage-panel-toggle');
                if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });
    }

    Core.renderScheduleSection = function renderScheduleSection(opts) {
        const skipCollect = !!(opts && opts.skipCollect);
        const section = document.getElementById('schedule-section');
        const preview = document.getElementById('schedule-preview');
        const complete = Core.isTeamsSectionComplete();

        // Persist any in-progress date/time edits before rebuilding the list
        if (!skipCollect) Core.collectScheduleFromDom();

        if (section) section.classList.toggle('hidden', !complete);
        if (!preview) return;

        if (!complete) {
            preview.innerHTML = '';
            return;
        }

        Core.pruneMatchSchedule();
        const catalog = Core.getScheduleCatalog();
        Core.pruneFixtureSideSwaps(catalog.map(e => Core.catalogPairKey(e)));
        if (!catalog.length) {
            preview.innerHTML = '<p class="hint">Add teams to see match schedule.</p>';
            return;
        }

        const scheduleTitle = document.getElementById('schedule-section-title');
        const scheduleHint = document.getElementById('schedule-section-hint');
        if (scheduleTitle) {
            scheduleTitle.textContent = 'Match Schedule';
        }
        if (scheduleHint) {
            scheduleHint.textContent = 'Set kickoff date and time in 24-hour format (WIB). Leave date blank if not scheduled yet. Use Swap to reverse home/away order. ' +
                'List order: unscheduled first, then scheduled by nearest date. Order refreshes after Save.';
        }

        const groupEntries = catalog.filter(Core.isGroupScheduleEntry);
        const knockoutEntries = catalog.filter(e => !Core.isGroupScheduleEntry(e));
        let html = '';
        if (Core.form.includeGroupStage && groupEntries.length) {
            html += Core.stagePanelShell(
                'schedule-group',
                'Group Stage Schedule',
                Core.renderScheduleRowsHtml(groupEntries)
            );
        }
        if (Core.form.includeKnockoutStage && knockoutEntries.length) {
            html += Core.stagePanelShell(
                'schedule-knockout',
                'Knockout Schedule',
                Core.renderScheduleRowsHtml(knockoutEntries)
            );
        }
        if (!html) {
            html = Core.renderScheduleRowsHtml(catalog);
        }
        preview.innerHTML = html;
        Core.bindScheduleStagePanels(preview);

        preview.querySelectorAll('.schedule-edit-row').forEach(row => {
            const onChange = () => Core.syncScheduleFromRow(row);
            row.querySelectorAll('input, select').forEach(inp => {
                inp.addEventListener('change', onChange);
                inp.addEventListener('input', onChange);
            });
            row.querySelector('[data-action="swap-sides"]')?.addEventListener('click', () => {
                Core.toggleFixtureSideSwap(row.dataset.pairKey || row.dataset.matchId);
            });
        });
    }

    Core.pruneFixtureSideSwaps = function pruneFixtureSideSwaps(catalogKeys) {
        if (!Core.form.fixtureSideSwaps || typeof Core.form.fixtureSideSwaps !== 'object') {
            Core.form.fixtureSideSwaps = {};
            return;
        }
        const valid = new Set(catalogKeys || []);
        Object.keys(Core.form.fixtureSideSwaps).forEach(id => {
            if (!valid.has(id)) delete Core.form.fixtureSideSwaps[id];
        });
    }

    Core.swapScorePredictionsForMatch = function swapScorePredictionsForMatch(bindingKey) {
        if (!bindingKey) return;
        Core.form.participants.forEach(p => {
            const map = Core.ensureScorePredictPicks(p);
            const pred = map[bindingKey];
            if (!pred || typeof pred !== 'object') return;
            const tmp = pred.a;
            pred.a = pred.b;
            pred.b = tmp;
        });
    }

    Core.updateScheduleRowAfterSwap = function updateScheduleRowAfterSwap(bindingKey) {
        const key = String(bindingKey || '').trim();
        const row = Array.from(
            document.querySelectorAll('#schedule-preview .schedule-edit-row')
        ).find(el => (el.dataset.pairKey || el.dataset.matchId) === key);
        if (!row) {
            Core.renderScheduleSection({ skipCollect: true });
            return;
        }
        const entry = Core.getScheduleCatalog().find(e => Core.catalogPairKey(e) === key);
        if (!entry) {
            Core.renderScheduleSection({ skipCollect: true });
            return;
        }
        const main = row.querySelector('.schedule-match-main');
        if (!main) {
            Core.renderScheduleSection({ skipCollect: true });
            return;
        }
        const swapped = !!(Core.form.fixtureSideSwaps && Core.form.fixtureSideSwaps[key]);
        main.innerHTML = '<strong>' + Core.esc(entry.label) + '</strong>' +
            (swapped ? '<span class="schedule-swapped-badge">Swapped</span>' : '');
    }

    Core.toggleFixtureSideSwap = function toggleFixtureSideSwap(bindingKey) {
        const id = String(bindingKey || '').trim();
        if (!id) return;
        Core.collectScheduleFromDom();
        Core.collectScorePredictionsFromDom();
        if (!Core.form.fixtureSideSwaps || typeof Core.form.fixtureSideSwaps !== 'object') {
            Core.form.fixtureSideSwaps = {};
        }
        if (Core.form.fixtureSideSwaps[id]) delete Core.form.fixtureSideSwaps[id];
        else Core.form.fixtureSideSwaps[id] = true;
        Core.swapScorePredictionsForMatch(id);

        const scrollY = window.scrollY || window.pageYOffset || 0;
        Core.updateScheduleRowAfterSwap(id);
        Core.renderScorePredictionsSection({ skipCollect: true });
        window.scrollTo(0, scrollY);
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }

    Core.refreshGroupCountrySelectOptions = function refreshGroupCountrySelectOptions(activeSelect) {
        document.querySelectorAll('.team-pair-slot[data-gidx] select[data-f="name"]').forEach(sel => {
            const slot = sel.closest('.team-pair-slot');
            if (!slot) return;
            const gidx = +slot.dataset.gidx;
            const tidx = +slot.dataset.tidx;
            const team = Core.getTeamRefFromSlot(slot);
            const selected = (team && team.name) || sel.value || '';
            const taken = Core.collectTakenGroupCountries(gidx, tidx);
            const html = Core.countryOptions(selected, taken);
            if (sel === activeSelect) {
                // Keep the open/focused select intact; only sync value if needed.
                if (sel.value !== selected) sel.value = selected;
                return;
            }
            sel.innerHTML = html;
        });
    }

    Core.syncTeamFlagFromCountry = function syncTeamFlagFromCountry(team) {
        if (Core.form.competitionType !== 'country' || !team.name) return;
        team.flag = window.ArisanCountries ? ArisanCountries.getFlagCode(team.name) : '';
    }

    Core.renderTeamSlotHtml = function renderTeamSlotHtml(t, slotKey, isCountry, slotLabel, opts) {
        const options = opts || {};
        const allowTbd = !!options.allowTbd;
        let nameField;
        if (isCountry) {
            const taken = slotKey.kind === 'group'
                ? Core.collectTakenGroupCountries(slotKey.gidx, slotKey.tidx)
                : new Set();
            nameField = Core.labeledPreviewField(
                allowTbd ? 'Country name (or TBD)' : 'Country name',
                '<select data-f="name" data-preview="country-flag">' +
                    Core.countryOptions(t.name, taken, { allowTbd }) +
                '</select>',
                'country-flag',
                t.name,
                t.name,
                'flag'
            );
        } else if (allowTbd) {
            const isTbd = !Core.normalizeSeedName(t.name);
            nameField =
                '<div class="club-name-lookup">' +
                '<label>Club name (or TBD)</label>' +
                '<select data-f="tbd-toggle" class="club-tbd-toggle">' +
                '<option value="tbd"' + (isTbd ? ' selected' : '') + '>TBD</option>' +
                '<option value="club"' + (!isTbd ? ' selected' : '') + '>Choose club…</option>' +
                '</select>' +
                '<div class="club-tbd-fields' + (isTbd ? ' hidden' : '') + '">' +
                '<div class="player-autocomplete-input-wrap">' +
                '<input type="text" data-f="name" data-club-lookup="1" value="' + Core.esc(isTbd ? '' : t.name) +
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
                '<input type="text" data-f="name" data-club-lookup="1" value="' + Core.esc(t.name) + '" placeholder="Start typing club name…" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list">' +
                '<div class="player-autocomplete-list hidden" role="listbox"></div>' +
                '</div>' +
                '<p class="player-lookup-status hint" aria-live="polite"></p>' +
                '</div>';
        }

        const flagField = isCountry || (allowTbd && !Core.normalizeSeedName(t.name)) ? '' :
            Core.labeledPreviewField(
                'Club\'s flag (image URL)',
                '<input type="text" data-f="flag" data-preview="flag-url" value="' + Core.esc(t.flag) + '" placeholder="https://...">',
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
            '<label class="team-pair-slot-label">' + Core.esc(slotLabel) + '</label>' +
            removeBtn +
            '</div>' +
            nameField + flagField +
            '</div>';
    }

    Core.getTeamRefFromSlot = function getTeamRefFromSlot(slot) {
        if (!slot) return null;
        if (slot.dataset.gidx != null) {
            const g = Core.form.groupDefinitions[+slot.dataset.gidx];
            return g && g.teams ? g.teams[+slot.dataset.tidx] : null;
        }
        if (slot.dataset.idx != null) {
            return Core.form.teams[+slot.dataset.idx] || null;
        }
        return null;
    }

    Core.stagePanelShell = function stagePanelShell(key, title, bodyHtml) {
        const open = Core.isStageOpen(key);
        return '<div class="stage-panel' + (open ? ' is-open' : '') + '" data-stage="' + key + '">' +
            '<button type="button" class="stage-panel-toggle" aria-expanded="' + (open ? 'true' : 'false') + '">' +
            '<span class="stage-panel-title">' + Core.esc(title) + '</span>' +
            '<span class="stage-panel-icon" aria-hidden="true">▼</span>' +
            '</button>' +
            '<div class="stage-panel-body">' + bodyHtml + '</div>' +
            '</div>';
    }

    Core.getGroupStageHint = function getGroupStageHint() {
        const defs = Core.form.groupDefinitions || [];
        const unique = Core.uniqueTeamsFromGroups(defs).length;
        const fixtures = (typeof ArisanBracket !== 'undefined' && ArisanBracket.fixturesFromGroupDefinitions)
            ? ArisanBracket.fixturesFromGroupDefinitions(defs.map(g => ({
                label: g.label,
                teams: (g.teams || []).map(t => t.name).filter(Boolean),
            })))
            : [];
        return 'List members of each group. Matches auto-generate as round-robin. Currently '
            + defs.length + ' group(s), ' + unique + ' teams, ' + fixtures.length + ' matches.';
    }

    Core.getKnockoutStageHint = function getKnockoutStageHint(isCountry) {
        const filled = Core.form.teams.filter(t => Core.normalizeSeedName(t.name)).length;
        const slots = Core.form.teams.length;
        return 'Opening knockout matchups (pairing order). Use TBD until group winners are known. Currently '
            + slots + ' slot(s), ' + filled + ' named '
            + (isCountry ? 'countries' : 'clubs') + '.';
    }

    Core.renderGroupsHtml = function renderGroupsHtml(isCountry, entity) {
        Core.ensureInitialGroups();
        let body = '<p class="hint">' + Core.esc(Core.getGroupStageHint()) + '</p>';
        Core.form.groupDefinitions.forEach((g, gi) => {
            const label = (g.label || String.fromCharCode(65 + gi)).trim();
            const matchCount = (() => {
                const n = (g.teams || []).filter(t => (t.name || '').trim()).length;
                return n >= 2 ? (n * (n - 1)) / 2 : 0;
            })();
            body += '<div class="group-def-box row-item" data-group="' + gi + '">' +
                '<div class="row-head">' +
                '<div class="group-def-label-wrap">' +
                '<strong>Group</strong> ' +
                '<input type="text" class="group-label-input" data-g="label" maxlength="8" value="' + Core.esc(label) + '" aria-label="Group label">' +
                '<span class="hint group-match-hint">' + matchCount + ' match(es)</span>' +
                '</div>' +
                (Core.form.groupDefinitions.length > 1
                    ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-group">Remove group</button>'
                    : '') +
                '</div>' +
                '<div class="group-teams-grid">';
            (g.teams || []).forEach((t, ti) => {
                body += Core.renderTeamSlotHtml(
                    t,
                    { kind: 'group', gidx: gi, tidx: ti },
                    isCountry,
                    entity + ' ' + (ti + 1),
                    { showRemove: (g.teams || []).length > 2 }
                );
            });
            body += '</div>' +
                '<button type="button" class="btn btn-secondary btn-sm" data-action="add-group-team">+ ' + Core.esc(entity) + '</button>' +
                '</div>';
        });
        body += '<button type="button" class="btn btn-secondary btn-sm" id="btn-add-group" data-action="add-group">+ Group</button>';
        return Core.stagePanelShell('group', 'Group Stage', body);
    }

    Core.renderKnockoutPairsHtml = function renderKnockoutPairsHtml(isCountry, entity) {
        if (Core.form.teams.length % 2 === 1) {
            Core.form.teams.push(Core.emptyTeam());
        }
        if (!Core.form.teams.length) {
            Core.form.teams.push(Core.emptyTeam(), Core.emptyTeam());
        }

        let body = '<p class="hint">' + Core.esc(Core.getKnockoutStageHint(isCountry)) + '</p>';
        for (let p = 0; p < Core.form.teams.length; p += 2) {
            const matchNum = Math.floor(p / 2) + 1;
            const t0 = Core.form.teams[p];
            const t1 = Core.form.teams[p + 1];

            body += '<div class="team-pair-box row-item" data-pair="' + matchNum + '">' +
                '<div class="row-head"><strong>Match ' + matchNum + '</strong>' +
                (Core.form.teams.length > 2
                    ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-match">Remove match</button>'
                    : '') +
                '</div>' +
                '<div class="team-pair-grid">' +
                Core.renderTeamSlotHtml(t0, { kind: 'pair', idx: p }, isCountry, entity + ' ' + (p + 1), { allowTbd: true });

            body += '<div class="team-pair-vs" aria-hidden="true">vs</div>';
            body += Core.renderTeamSlotHtml(t1, { kind: 'pair', idx: p + 1 }, isCountry, entity + ' ' + (p + 2), { allowTbd: true });
            body += '</div></div>';
        }
        body += '<button type="button" class="btn btn-secondary btn-sm" id="btn-add-team" data-action="add-knockout-match">'
            + (isCountry ? '+ Match (2 countries)' : '+ Match (2 clubs)')
            + '</button>';
        return Core.stagePanelShell('knockout', 'Knockout bracket pairs', body);
    }

    Core.bindTeamSlotControls = function bindTeamSlotControls(el, isCountry) {
        el.querySelectorAll('.team-pair-slot').forEach(slot => {
            slot.querySelectorAll('[data-f]').forEach(inp => {
                if (inp.dataset.clubLookup === '1') return;
                const handler = (e) => {
                    const team = Core.getTeamRefFromSlot(slot);
                    if (!team) return;
                    if (inp.dataset.f === 'tbd-toggle') {
                        if (inp.value === 'tbd') {
                            team.name = '';
                            team.flag = '';
                        }
                        Core.renderTeams();
                        Core.renderParticipants();
                        Core.renderScheduleSection();
                        return;
                    }
                    team[inp.dataset.f] = inp.value;
                    if (inp.dataset.f === 'name') {
                        if (!Core.normalizeSeedName(inp.value)) {
                            team.name = '';
                            team.flag = '';
                        } else {
                            Core.syncTeamFlagFromCountry(team);
                        }
                    }
                    Core.updatePreviewForControl(inp);

                    const isGroupCountrySelect = isCountry
                        && inp.dataset.f === 'name'
                        && slot.dataset.gidx != null
                        && inp.tagName === 'SELECT';

                    // While typing/jumping in <select>, only sync local state — avoid heavy re-renders.
                    if (isGroupCountrySelect && e.type === 'input') {
                        const box = slot.closest('.group-def-box');
                        const hint = box && box.querySelector('.group-match-hint');
                        if (hint) {
                            const g = Core.form.groupDefinitions[+slot.dataset.gidx];
                            const n = (g && g.teams || []).filter(t => (t.name || '').trim()).length;
                            hint.textContent = (n >= 2 ? (n * (n - 1)) / 2 : 0) + ' match(es)';
                        }
                        Core.syncTeamsSectionUi();
                        return;
                    }

                    if (isGroupCountrySelect && (e.type === 'change' || e.type === 'blur')) {
                        Core.refreshGroupCountrySelectOptions(inp);
                    }

                    // Knockout country TBD/pick: refresh schedule labels.
                    if (
                        isCountry
                        && inp.dataset.f === 'name'
                        && slot.dataset.idx != null
                        && e.type === 'change'
                    ) {
                        Core.renderScheduleSection();
                        Core.syncTeamsSectionUi();
                        Core.renderParticipants();
                        if (Core.form.pointConfig.mainQuestMode === 'fifa') Core.renderMainQuestTeamPoints();
                        return;
                    }

                    Core.renderParticipants();
                    Core.renderScheduleSection();
                    Core.syncTeamsSectionUi();
                    if (inp.dataset.f === 'name' && Core.form.pointConfig.mainQuestMode === 'fifa') {
                        Core.renderMainQuestTeamPoints();
                    }
                    if (slot.dataset.gidx != null) {
                        const box = slot.closest('.group-def-box');
                        const hint = box && box.querySelector('.group-match-hint');
                        if (hint) {
                            const g = Core.form.groupDefinitions[+slot.dataset.gidx];
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
            if (!isCountry) Core.bindClubNameLookup(slot);
        });
    }

    Core.renderTeams = function renderTeams() {
        const el = document.getElementById('teams-list');
        if (!el) return;
        const isCountry = Core.form.competitionType === 'country';
        const entity = isCountry ? 'Country' : 'Club';

        if (!Core.form.includeGroupStage && !Core.form.includeKnockoutStage) {
            el.innerHTML = '<p class="hint">Enable Group Stage and/or Knockout Stage above.</p>';
            Core.updateCounts();
            Core.renderScheduleSection();
            return;
        }

        let html = '';
        if (Core.form.includeGroupStage) html += Core.renderGroupsHtml(isCountry, entity);
        if (Core.form.includeKnockoutStage) html += Core.renderKnockoutPairsHtml(isCountry, entity);
        el.innerHTML = html || '<p class="hint">No teams yet.</p>';

        el.querySelectorAll('.group-def-box[data-group]').forEach(box => {
            const gi = +box.dataset.group;
            box.querySelector('[data-g="label"]')?.addEventListener('input', e => {
                if (!Core.form.groupDefinitions[gi]) return;
                Core.form.groupDefinitions[gi].label = e.target.value;
                Core.renderScheduleSection();
            });
            box.querySelector('[data-action="remove-group"]')?.addEventListener('click', () => Core.removeGroup(gi));
            box.querySelector('[data-action="add-group-team"]')?.addEventListener('click', () => Core.addTeamToGroup(gi));
            box.querySelectorAll('[data-action="remove-group-team"]').forEach(btn => {
                const slot = btn.closest('.team-pair-slot[data-tidx]');
                if (!slot) return;
                btn.addEventListener('click', () => Core.removeTeamFromGroup(gi, +slot.dataset.tidx));
            });
        });

        el.querySelectorAll('.team-pair-box[data-pair]').forEach(box => {
            const pairIdx = +box.dataset.pair - 1;
            box.querySelector('[data-action="remove-match"]')?.addEventListener('click', () => Core.removeTeamPair(pairIdx));
        });

        el.querySelectorAll('.stage-panel[data-stage]').forEach(panel => {
            const key = panel.dataset.stage;
            panel.querySelector('.stage-panel-toggle')?.addEventListener('click', () => {
                const open = panel.classList.toggle('is-open');
                Core.stageOpenState[key] = open;
                const btn = panel.querySelector('.stage-panel-toggle');
                if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });

        el.querySelector('[data-action="add-group"]')?.addEventListener('click', () => Core.addGroup());
        el.querySelector('[data-action="add-knockout-match"]')?.addEventListener('click', () => Core.addTeamPair());

        Core.bindTeamSlotControls(el, isCountry);
        Core.bindPreviewControls(el);
        Core.updateCounts();
        if (Core.form.pointConfig.mainQuestMode === 'fifa') Core.renderMainQuestTeamPoints();
        // Collect while the schedule DOM still matches the previous catalog, then remap
        // index-based ids onto team pairs and re-render.
        Core.collectScheduleFromDom();
        Core.collectScorePredictionsFromDom();
        Core.renderScheduleSection({ skipCollect: true });
        Core.renderScorePredictionsSection({ skipCollect: true });
    }

    Core.setClubLookupStatus = function setClubLookupStatus(nameInp, state, message) {
        const statusEl = nameInp.closest('.club-name-lookup')?.querySelector('.player-lookup-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'player-lookup-status hint' + (state ? ' ' + state : '');
    }

    Core.hideClubAutocomplete = function hideClubAutocomplete(nameInp) {
        const list = nameInp.closest('.club-name-lookup')?.querySelector('.player-autocomplete-list');
        if (!list) return;
        list.innerHTML = '';
        list.classList.add('hidden');
        list._clubs = null;
        nameInp.setAttribute('aria-expanded', 'false');
    }

    Core.applyClubSelection = async function applyClubSelection(slot, club) {
        const nameInp = slot.querySelector('[data-f="name"]');
        const flagInp = slot.querySelector('[data-f="flag"]');
        const team = Core.getTeamRefFromSlot(slot);
        if (!club || !nameInp || !team) return;

        let selected = club;
        if ((!selected.badge || String(selected.id || '').startsWith('curated:'))
            && typeof ArisanTheSportsDB !== 'undefined') {
            Core.setClubLookupStatus(nameInp, 'loading', 'Loading club badge…');
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
                Core.updatePreviewForControl(flagInp);
            }
            Core.setClubLookupStatus(nameInp, 'ok', 'Club badge loaded from TheSportsDB.');
        } else {
            Core.setClubLookupStatus(nameInp, 'warn', 'Club found — enter flag/logo URL manually.');
        }

        Core.hideClubAutocomplete(nameInp);
        Core.renderParticipants();
        Core.renderScheduleSection();
        Core.syncTeamsSectionUi();
        if (Core.form.pointConfig.mainQuestMode === 'fifa') Core.renderMainQuestTeamPoints();
    }

    Core.renderClubAutocompleteOptions = function renderClubAutocompleteOptions(nameInp, clubs, onSelect) {
        const list = nameInp.closest('.club-name-lookup')?.querySelector('.player-autocomplete-list');
        if (!list) return;

        if (!clubs.length) {
            Core.hideClubAutocomplete(nameInp);
            return;
        }

        list._clubs = clubs;
        list.innerHTML = clubs.map((cl, idx) =>
            '<button type="button" class="player-autocomplete-option' + (idx === 0 ? ' active' : '') + '" role="option" data-idx="' + idx + '">' +
            (cl.previewThumb
                ? '<img src="' + Core.esc(cl.previewThumb) + '" alt="" class="player-autocomplete-thumb">'
                : '<span class="player-autocomplete-thumb" aria-hidden="true"></span>') +
            '<span class="player-autocomplete-text"><strong>' + Core.esc(cl.name) + '</strong>' +
            '<small>' + Core.esc([cl.league, cl.country].filter(Boolean).join(' · ')) +
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

    Core.bindClubNameLookup = function bindClubNameLookup(slot) {
        const nameInp = slot.querySelector('[data-f="name"][data-club-lookup]');
        if (!nameInp || nameInp.dataset.lookupBound) return;
        nameInp.dataset.lookupBound = '1';

        let suggestTimer = null;
        let lookupTimer = null;
        let suggestGen = 0;
        let pickedFromList = false;

        const onSelect = club => {
            pickedFromList = true;
            Core.applyClubSelection(slot, club);
        };

        const fetchSuggestions = async () => {
            const name = nameInp.value.trim();
            const team = Core.getTeamRefFromSlot(slot);
            if (team) team.name = name;

            if (name.length < 2) {
                Core.hideClubAutocomplete(nameInp);
                Core.setClubLookupStatus(nameInp, '', '');
                return;
            }

            if (typeof ArisanTheSportsDB === 'undefined') {
                Core.hideClubAutocomplete(nameInp);
                Core.setClubLookupStatus(nameInp, 'warn', 'Club lookup unavailable — enter name and flag URL manually.');
                return;
            }

            const gen = ++suggestGen;
            Core.setClubLookupStatus(nameInp, 'loading', 'Searching TheSportsDB…');

            try {
                const clubs = await ArisanTheSportsDB.searchTeams(name, 8);
                if (gen !== suggestGen) return;

                if (clubs.length) {
                    Core.renderClubAutocompleteOptions(nameInp, clubs, onSelect);
                    Core.setClubLookupStatus(nameInp, '', clubs.length + ' club(s) found — pick one or keep typing.');
                } else {
                    Core.hideClubAutocomplete(nameInp);
                    Core.setClubLookupStatus(nameInp, 'warn', 'Not found — enter flag/logo URL manually.');
                }
            } catch (e) {
                if (gen !== suggestGen) return;
                Core.hideClubAutocomplete(nameInp);
                Core.setClubLookupStatus(nameInp, 'warn', 'Lookup failed — enter name and flag URL manually.');
            }
        };

        const runLookupOnBlur = async () => {
            if (pickedFromList) {
                pickedFromList = false;
                return;
            }

            const name = nameInp.value.trim();
            const team = Core.getTeamRefFromSlot(slot);
            if (team) team.name = name;
            Core.hideClubAutocomplete(nameInp);

            if (name.length < 2 || typeof ArisanTheSportsDB === 'undefined' || !team) return;

            try {
                const result = await ArisanTheSportsDB.searchTeam(name);
                const flagInp = slot.querySelector('[data-f="flag"]');
                if (result && result.badge) {
                    team.flag = result.badge;
                    if (flagInp) {
                        flagInp.value = result.badge;
                        Core.updatePreviewForControl(flagInp);
                    }
                    Core.setClubLookupStatus(nameInp, 'ok', 'Club badge loaded from TheSportsDB.');
                    Core.renderParticipants();
                    Core.renderScheduleSection();
                } else if (!team.flag) {
                    Core.setClubLookupStatus(nameInp, 'warn', 'Not found — enter flag/logo URL manually.');
                }
            } catch (e) {
                Core.setClubLookupStatus(nameInp, 'warn', 'Lookup failed — enter flag/logo URL manually.');
            }
        };

        nameInp.addEventListener('input', () => {
            pickedFromList = false;
            const team = Core.getTeamRefFromSlot(slot);
            if (team) team.name = nameInp.value;
            clearTimeout(suggestTimer);
            clearTimeout(lookupTimer);
            suggestTimer = setTimeout(fetchSuggestions, 320);
        });

        nameInp.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                Core.setActiveAutocompleteOption(nameInp, 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                Core.setActiveAutocompleteOption(nameInp, -1);
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
                Core.hideClubAutocomplete(nameInp);
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
            const team = Core.getTeamRefFromSlot(slot);
            if (team) team.name = nameInp.value.trim();
            Core.renderParticipants();
            Core.renderScheduleSection();
            if (Core.form.pointConfig.mainQuestMode === 'fifa') Core.renderMainQuestTeamPoints();
        });
    }

    Core.emptyTeam = function emptyTeam() {
        return { name: '', flag: '' };
    }

    Core.ensureInitialTeamPair = function ensureInitialTeamPair() {
        if (!Core.form.teams.length) {
            Core.form.teams.push(Core.emptyTeam(), Core.emptyTeam());
        }
    }

    Core.addGroup = function addGroup() {
        Core.form.groupDefinitions.push(Core.emptyGroup(Core.form.groupDefinitions.length));
        Core.renderTeams();
        Core.renderParticipants();
        const list = document.getElementById('teams-list');
        const boxes = list && list.querySelectorAll('.group-def-box');
        const last = boxes && boxes[boxes.length - 1];
        last?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        last?.querySelector('[data-f="name"]')?.focus();
    }

    Core.removeGroup = function removeGroup(gi) {
        if (Core.form.groupDefinitions.length <= 1) return;
        Core.form.groupDefinitions.splice(gi, 1);
        Core.form.groupDefinitions.forEach((g, i) => {
            if (!(g.label || '').trim()) g.label = String.fromCharCode(65 + i);
        });
        Core.renderTeams();
        Core.renderParticipants();
    }

    Core.addTeamToGroup = function addTeamToGroup(gi) {
        const g = Core.form.groupDefinitions[gi];
        if (!g) return;
        if (!g.teams) g.teams = [];
        g.teams.push(Core.emptyTeam());
        const focusTidx = g.teams.length - 1;
        Core.renderTeams();
        Core.renderParticipants();
        const slot = document.querySelector(
            '.team-pair-slot[data-gidx="' + gi + '"][data-tidx="' + focusTidx + '"]'
        );
        slot?.querySelector('[data-f="name"]')?.focus();
        slot?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    Core.removeTeamFromGroup = function removeTeamFromGroup(gi, ti) {
        const g = Core.form.groupDefinitions[gi];
        if (!g || !g.teams || g.teams.length <= 2) return;
        g.teams.splice(ti, 1);
        Core.renderTeams();
        Core.renderParticipants();
    }

    Core.addTeamPair = function addTeamPair() {
        if (Core.form.teams.length % 2 === 1) {
            Core.form.teams.push(Core.emptyTeam());
        } else {
            Core.form.teams.push(Core.emptyTeam(), Core.emptyTeam());
        }
        const focusIdx = Core.form.teams.length - 2;
        Core.renderTeams();
        Core.renderParticipants();
        Core.focusTeamNameField(focusIdx);
    }

    Core.focusTeamNameField = function focusTeamNameField(teamIndex) {
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

    Core.removeTeamPair = function removeTeamPair(pairIndex) {
        const startIdx = pairIndex * 2;
        if (Core.form.teams.length <= 2 || startIdx < 0 || startIdx >= Core.form.teams.length) return;
        Core.form.teams.splice(startIdx, 2);
        Core.renderTeams();
        Core.renderParticipants();
    }

})(window.ArisanSetupFormCore);
