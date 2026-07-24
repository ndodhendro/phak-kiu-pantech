/**
 * Setup section: participants & picks
 * Auto-split from setup-form.js — uses shared ArisanSetupFormCore.
 */
(function (Core) {
'use strict';

    Core.emptyParticipant = function emptyParticipant(index) {
        return {
            name: '',
            avatar_path: '',
            color: Core.DEFAULT_PARTICIPANT_COLORS[index % Core.DEFAULT_PARTICIPANT_COLORS.length],
            picks: Core.defaultPicks(true),
        };
    }

    Core.captureParticipantOpenState = function captureParticipantOpenState() {
        document.querySelectorAll('.participant-row').forEach(row => {
            Core.participantOpenState[row.dataset.idx] = row.classList.contains('is-open');
        });
    }

    Core.isParticipantOpenByDefault = function isParticipantOpenByDefault(index) {
        return Object.prototype.hasOwnProperty.call(Core.participantOpenState, String(index))
            ? Core.participantOpenState[index]
            : index === 0;
    }

    Core.participantHeaderLabel = function participantHeaderLabel(p, index) {
        const name = p.name && String(p.name).trim();
        return 'Participant ' + (index + 1) +
            (name ? '<span class="participant-name-label"> — ' + Core.esc(name) + '</span>' : '');
    }

    Core.syncParticipantHeaderLabel = function syncParticipantHeaderLabel(row, name) {
        const strong = row.querySelector('.participant-toggle strong');
        if (!strong) return;
        const index = +row.dataset.idx;
        const trimmed = name && String(name).trim();
        strong.innerHTML = 'Participant ' + (index + 1) +
            (trimmed ? '<span class="participant-name-label"> — ' + Core.esc(trimmed) + '</span>' : '');
    }

    Core.bindParticipantCollapse = function bindParticipantCollapse(row) {
        const index = row.dataset.idx;
        const btn = row.querySelector('.participant-toggle');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const open = row.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            Core.participantOpenState[index] = open;
        });
    }

    Core.collectSelectedPotTeams = function collectSelectedPotTeams(participantIndex, stage) {
        const selected = new Set();
        const p = Core.form.participants[participantIndex];
        if (!p) return selected;
        const mq = Core.ensureParticipantMainQuest(p);
        const stages = stage ? [stage] : ['group', 'knockout'];
        stages.forEach((key) => {
            ((mq[key] && mq[key].pots) || []).forEach((pot) => {
                (pot.teams || []).forEach((t) => {
                    const name = (t || '').trim();
                    if (name) selected.add(name);
                });
            });
        });
        return selected;
    }

    Core.potTeamOptions = function potTeamOptions(selectedValue, participantIndex, stage) {
        const names = Core.teamNames();
        const taken = Core.collectSelectedPotTeams(participantIndex, stage || 'group');
        const current = (selectedValue || '').trim();
        let html = '<option value="">— select —</option>';
        names.forEach(n => {
            if (n !== current && taken.has(n)) return;
            html += '<option value="' + Core.esc(n) + '"' + (n === current ? ' selected' : '') + '>' + Core.esc(n) + '</option>';
        });
        return html;
    }

    Core.renderTeamSelectField = function renderTeamSelectField(label, selected, participantIndex, dataAttr, optionsFn, stage) {
        const opts = optionsFn.length >= 3
            ? optionsFn(selected, participantIndex, stage)
            : optionsFn(selected, participantIndex);
        return Core.labeledPreviewField(
            label,
            '<select ' + dataAttr + ' data-preview="team-flag">' + opts + '</select>',
            'team-flag',
            selected,
            selected,
            'flag'
        );
    }

    Core.renderParticipantPotsForStage = function renderParticipantPotsForStage(p, pi, stage, title) {
        const mq = Core.ensureParticipantMainQuest(p);
        const pots = (mq[stage] && mq[stage].pots) || [{ teams: ['', ''] }];
        const entity = Core.form.competitionType === 'country' ? 'Country' : 'Club';
        const stageOpts = (selected, participantIndex) => Core.potTeamOptions(selected, participantIndex, stage);
        const blocks = pots.map((pot, potIdx) => {
            const t0 = (pot.teams && pot.teams[0]) || '';
            const t1 = (pot.teams && pot.teams[1]) || '';
            return '<div class="sub-block" data-mq-stage="' + stage + '" data-pot="' + potIdx + '">' +
                '<div class="row-head"><strong>Pot ' + (potIdx + 1) + '</strong>' +
                (pots.length > 1
                    ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-pot">Remove pot</button>'
                    : '') +
                '</div>' +
                '<div class="grid-2">' +
                Core.renderTeamSelectField(entity + ' A', t0, pi, 'data-f="pot-a"', stageOpts, stage) +
                Core.renderTeamSelectField(entity + ' B', t1, pi, 'data-f="pot-b"', stageOpts, stage) +
                '</div></div>';
        }).join('');
        return '<div class="mq-stage-pots" data-mq-stage="' + stage + '">' +
            '<h4 class="sub-title" style="font-size:0.95rem;margin:10px 0 6px;">' + Core.esc(title) + '</h4>' +
            blocks +
            '<button type="button" class="btn btn-secondary btn-sm" data-action="add-pot" data-mq-stage="' +
            stage + '">+ Add pot</button>' +
            '</div>';
    }

    Core.renderParticipantPots = function renderParticipantPots(p, pi) {
        Core.ensureParticipantMainQuest(p);
        let html = '';
        if (Core.form.includeGroupStage) {
            html += Core.renderParticipantPotsForStage(p, pi, 'group', 'Table pot — Group Stage');
        }
        if (Core.form.includeKnockoutStage) {
            html += Core.renderParticipantPotsForStage(p, pi, 'knockout', 'Table pot — Knockout Stage');
        }
        if (!html) {
            html = '<p class="hint">Enable Group Stage and/or Knockout Stage to configure Main Quest pots.</p>';
        }
        return html;
    }

    Core.renderSideQuestTeamSelect = function renderSideQuestTeamSelect(label, dataAttr, selected) {
        return Core.labeledPreviewField(
            label,
            '<select ' + dataAttr + ' data-preview="team-flag">' + Core.teamOptions(selected) + '</select>',
            'team-flag',
            selected,
            selected,
            'flag'
        );
    }

    Core.renderPlayerTeamField = function renderPlayerTeamField(kind, selected) {
        const attr = kind === 'boot' ? 'data-boot' : 'data-glove';
        const isCountry = Core.form.competitionType === 'country';
        const label = isCountry ? 'Country' : 'Club';
        return Core.labeledPreviewField(
            label,
            '<select ' + attr + '="team" data-preview="team-flag">' + Core.teamOptions(selected) + '</select>',
            'team-flag',
            selected || '',
            selected || label,
            'flag'
        );
    }

    Core.ensureCountrySuggestionsList = function ensureCountrySuggestionsList() {
        // Kept for any legacy free-text country fields; list mirrors Section 3 when available.
        let list = document.getElementById('arisan-country-suggestions');
        if (!list) {
            list = document.createElement('datalist');
            list.id = 'arisan-country-suggestions';
            document.body.appendChild(list);
        }
        const names = Core.teamNames();
        if (names.length) {
            list.innerHTML = names.map(n => '<option value="' + Core.esc(n) + '">').join('');
        } else {
            const countries = (window.ArisanCountries || []).slice().sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
            );
            list.innerHTML = countries.map(c => '<option value="' + Core.esc(c.name) + '">').join('');
        }
    }

    Core.matchLeagueTeamLabel = function matchLeagueTeamLabel(candidate) {
        const raw = String(candidate || '').trim();
        if (!raw) return '';
        const names = Core.teamNames();
        if (!names.length) return '';

        const resolved = Core.form.competitionType === 'country'
            ? Core.resolveFreeCountryLabel(raw)
            : raw;
        const candidates = [resolved, raw].filter(Boolean);
        for (let i = 0; i < candidates.length; i++) {
            const norm = Core.normalizeTeamLabel(candidates[i]);
            const hit = names.find(n => Core.normalizeTeamLabel(n) === norm);
            if (hit) return hit;
        }
        return '';
    }

    Core.renderPlayerNameField = function renderPlayerNameField(kind, value) {
        const attr = kind === 'boot' ? 'data-boot' : 'data-glove';
        return '<div class="player-name-lookup">' +
            '<label>Player name</label>' +
            '<div class="player-autocomplete-input-wrap">' +
            '<input type="text" ' + attr + '="player_name" value="' + Core.esc(value) + '" placeholder="Start typing player name…" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list">' +
            '<div class="player-autocomplete-list hidden" role="listbox"></div>' +
            '</div>' +
            '<p class="player-lookup-status hint" aria-live="polite"></p>' +
            '</div>';
    }

    Core.hidePlayerAutocomplete = function hidePlayerAutocomplete(nameInp) {
        const wrap = nameInp.closest('.player-name-lookup');
        const list = wrap?.querySelector('.player-autocomplete-list');
        if (!list) return;
        list.innerHTML = '';
        list.classList.add('hidden');
        list._players = null;
        nameInp.setAttribute('aria-expanded', 'false');
    }

    Core.normalizeTeamLabel = function normalizeTeamLabel(s) {
        return String(s || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    Core.resolveFreeCountryLabel = function resolveFreeCountryLabel(nationality) {
        const raw = String(nationality || '').trim();
        if (!raw) return '';
        const norm = Core.normalizeTeamLabel(raw);
        const countries = window.ArisanCountries || [];
        const exact = countries.find(c => Core.normalizeTeamLabel(c.name) === norm);
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

    Core.applyPlayerTeamFromLookup = function applyPlayerTeamFromLookup(row, p, kind, player) {
        const targetKey = kind === 'boot' ? 'goldenBoot' : 'goldenGlove';
        const target = p.picks.sideQuest[targetKey];
        const teamInp = row.querySelector('[data-' + kind + '="team"]');
        if (!target || !teamInp || !player) return '';

        let candidate = '';
        if (Core.form.competitionType === 'country') {
            candidate = player.nationality || '';
        } else {
            const club = String(player.team || '').trim();
            if (club && !/^_/i.test(club) && !/free agent/i.test(club) && !/retired/i.test(club)) {
                candidate = club;
            } else {
                candidate = player.nationality || '';
            }
        }

        const fill = Core.matchLeagueTeamLabel(candidate);
        if (!fill) return '';

        target.team = fill;
        teamInp.value = fill;
        Core.updatePreviewForControl(teamInp);
        return fill;
    }

    Core.applyPlayerSelection = async function applyPlayerSelection(row, p, kind, player) {
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
            Core.setPlayerLookupStatus(nameInp, 'loading', 'Loading player avatar…');
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

        const filledTeam = Core.applyPlayerTeamFromLookup(row, p, kind, selected);

        if (selected.img) {
            target.img = selected.img;
            if (imgInp) {
                imgInp.value = selected.img;
                Core.updatePreviewForControl(imgInp);
            }
            Core.setPlayerLookupStatus(
                nameInp,
                'ok',
                'Transparent cutout loaded from TheSportsDB.'
                    + (filledTeam
                        ? ' Country/club set to ' + filledTeam + '.'
                        : ' Pick country/club from Section 3 list.')
            );
        } else {
            Core.setPlayerLookupStatus(
                nameInp,
                'warn',
                'No transparent cutout — enter avatar URL manually.'
                    + (filledTeam
                        ? ' Country/club set to ' + filledTeam + '.'
                        : ' Pick country/club from Section 3 list.')
            );
        }

        Core.hidePlayerAutocomplete(nameInp);
    }

    Core.renderPlayerAutocompleteOptions = function renderPlayerAutocompleteOptions(nameInp, players, onSelect) {
        const list = nameInp.closest('.player-name-lookup')?.querySelector('.player-autocomplete-list');
        if (!list) return;

        if (!players.length) {
            Core.hidePlayerAutocomplete(nameInp);
            return;
        }

        list._players = players;
        list.innerHTML = players.map((pl, idx) =>
            '<button type="button" class="player-autocomplete-option' + (idx === 0 ? ' active' : '') + '" role="option" data-idx="' + idx + '">' +
            (pl.previewThumb
                ? '<img src="' + Core.esc(pl.previewThumb) + '" alt="" class="player-autocomplete-thumb' + (pl.hasCutout ? '' : ' player-img-opaque-bg') + '">'
                : '<span class="player-autocomplete-thumb" aria-hidden="true"></span>') +
            '<span class="player-autocomplete-text"><strong>' + Core.esc(pl.name) + '</strong>' +
            '<small>' + Core.esc(pl.team || '') +
            (pl.nationality ? (pl.team ? ' · ' : '') + Core.esc(pl.nationality) : '') +
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

    Core.setActiveAutocompleteOption = function setActiveAutocompleteOption(nameInp, delta) {
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

    Core.setPlayerLookupStatus = function setPlayerLookupStatus(nameInp, state, message) {
        const statusEl = nameInp.closest('.player-name-lookup')?.querySelector('.player-lookup-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'player-lookup-status hint' + (state ? ' ' + state : '');
    }

    Core.bindPlayerNameLookup = function bindPlayerNameLookup(row, p) {
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
                Core.applyPlayerSelection(row, p, kind, player);
            };

            const fetchSuggestions = async () => {
                const target = p.picks.sideQuest[targetKey];
                if (!target) return;

                const name = nameInp.value.trim();
                target.player_name = name;

                if (name.length < 2) {
                    Core.hidePlayerAutocomplete(nameInp);
                    Core.setPlayerLookupStatus(nameInp, '', '');
                    return;
                }

                if (typeof ArisanTheSportsDB === 'undefined') {
                    Core.hidePlayerAutocomplete(nameInp);
                    Core.setPlayerLookupStatus(nameInp, 'warn', 'Player lookup unavailable — enter name and avatar manually.');
                    return;
                }

                const gen = ++suggestGen;
                Core.setPlayerLookupStatus(nameInp, 'loading', 'Searching TheSportsDB…');

                try {
                    const players = await ArisanTheSportsDB.searchPlayers(name, 8);
                    if (gen !== suggestGen) return;

                    if (players.length) {
                        Core.renderPlayerAutocompleteOptions(nameInp, players, onSelect);
                        Core.setPlayerLookupStatus(nameInp, '', players.length + ' player(s) found — pick one or keep typing.');
                    } else {
                        Core.hidePlayerAutocomplete(nameInp);
                        Core.setPlayerLookupStatus(nameInp, 'warn', 'Not found — enter avatar URL manually and pick country/club from Section 3.');
                    }
                } catch (e) {
                    if (gen !== suggestGen) return;
                    Core.hidePlayerAutocomplete(nameInp);
                    Core.setPlayerLookupStatus(nameInp, 'warn', 'Lookup failed — enter name/avatar manually and pick country/club from Section 3.');
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
                Core.hidePlayerAutocomplete(nameInp);

                if (name.length < 2) {
                    Core.setPlayerLookupStatus(nameInp, '', '');
                    return;
                }

                if (typeof ArisanTheSportsDB === 'undefined') return;

                try {
                    const result = await ArisanTheSportsDB.searchPlayer(name);
                    const imgInp = row.querySelector('[data-' + kind + '="img"]');
                    if (result) {
                        target.player_name = result.name || name;
                        nameInp.value = target.player_name;
                        const filledTeam = Core.applyPlayerTeamFromLookup(row, p, kind, result);
                        if (result.img) {
                            target.img = result.img;
                            if (imgInp) {
                                imgInp.value = result.img;
                                Core.updatePreviewForControl(imgInp);
                            }
                            Core.setPlayerLookupStatus(
                                nameInp,
                                'ok',
                                'Transparent cutout loaded from TheSportsDB.'
                                    + (filledTeam ? ' Country/club set to ' + filledTeam + '.' : '')
                            );
                        } else if (!target.img) {
                            Core.setPlayerLookupStatus(
                                nameInp,
                                'warn',
                                'No transparent cutout — enter avatar URL manually.'
                                    + (filledTeam ? ' Country/club set to ' + filledTeam + '.' : '')
                            );
                        } else if (filledTeam) {
                            Core.setPlayerLookupStatus(nameInp, 'ok', 'Country/club set to ' + filledTeam + '.');
                        }
                    } else if (!target.img) {
                        Core.setPlayerLookupStatus(nameInp, 'warn', 'No transparent cutout — enter avatar URL manually.');
                    }
                } catch (e) {
                    Core.setPlayerLookupStatus(nameInp, 'warn', 'Lookup failed — enter avatar URL manually.');
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
                    Core.setActiveAutocompleteOption(nameInp, 1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    Core.setActiveAutocompleteOption(nameInp, -1);
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
                    Core.hidePlayerAutocomplete(nameInp);
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

    Core.renderParticipantSideQuest = function renderParticipantSideQuest(p) {
        const sq = (p.picks && p.picks.sideQuest) || Core.defaultPicks(Core.form.includeThirdPlace).sideQuest;
        const entity = Core.form.competitionType === 'country' ? 'Country' : 'Club';
        const thirdBlock = Core.form.includeThirdPlace
            ? Core.renderSideQuestTeamSelect('3rd place', 'data-sq="third"', sq.third)
            : '';

        return '<div class="sub-section">' +
            '<h3 class="sub-title">Side Quest</h3>' +
            '<div class="grid-3">' +
            Core.renderSideQuestTeamSelect('Champion', 'data-sq="champion"', sq.champion) +
            Core.renderSideQuestTeamSelect('Runner-up', 'data-sq="runnerup"', sq.runnerup) +
            thirdBlock +
            '</div>' +
            '<p class="hint sub-hint">Golden Boot</p>' +
            '<div class="grid-3">' +
            Core.renderPlayerNameField('boot', sq.goldenBoot?.player_name) +
            Core.labeledPreviewField(
                'Player\'s avatar (image URL)',
                '<input type="text" data-boot="img" data-preview="image-url" value="' + Core.esc(sq.goldenBoot?.img) + '">',
                'image-url',
                sq.goldenBoot?.img,
                sq.goldenBoot?.player_name || 'Avatar',
                'image'
            ) +
            Core.renderPlayerTeamField('boot', sq.goldenBoot?.team) +
            '</div>' +
            '<p class="hint sub-hint">Golden Glove</p>' +
            '<div class="grid-3">' +
            Core.renderPlayerNameField('glove', sq.goldenGlove?.player_name) +
            Core.labeledPreviewField(
                'Player\'s avatar (image URL)',
                '<input type="text" data-glove="img" data-preview="image-url" value="' + Core.esc(sq.goldenGlove?.img) + '">',
                'image-url',
                sq.goldenGlove?.img,
                sq.goldenGlove?.player_name || 'Avatar',
                'image'
            ) +
            Core.renderPlayerTeamField('glove', sq.goldenGlove?.team) +
            '</div>' +
            '<div class="grid-2" style="margin-top:12px">' +
            '<div><label>Total goal prediction</label><input type="number" data-sq="totalGoal" min="0" step="1" value="' +
            (sq.totalGoal != null ? sq.totalGoal : '') + '"></div>' +
            '</div></div>';
    }

    Core.renderParticipants = function renderParticipants() {
        const el = document.getElementById('participants-list');
        if (!el) return;
        Core.ensureCountrySuggestionsList();
        Core.captureParticipantOpenState();
        Core.collectScorePredictionsFromDom();

        el.innerHTML = Core.form.participants.map((p, i) => {
            if (!p.picks) p.picks = Core.defaultPicks(Core.form.includeThirdPlace);
            Core.ensureScorePredictPicks(p);
            const open = Core.isParticipantOpenByDefault(i);
            return '<div class="row-item participant-row participant-collapsible' + (open ? ' is-open' : '') + '" data-idx="' + i + '">' +
                '<div class="row-head participant-toggle-wrap">' +
                '<button type="button" class="participant-toggle" aria-expanded="' + (open ? 'true' : 'false') + '">' +
                '<span class="participant-toggle-icon" aria-hidden="true">▼</span>' +
                '<strong>' + Core.participantHeaderLabel(p, i) + '</strong>' +
                '</button>' +
                (Core.form.participants.length > 1
                    ? '<button type="button" class="btn btn-danger btn-sm" data-action="remove-participant">Remove</button>'
                    : '') +
                '</div>' +
                '<div class="participant-body">' +
                '<div class="grid-3">' +
                '<div><label>Name</label><input type="text" data-f="name" value="' + Core.esc(p.name) + '"></div>' +
                Core.labeledPreviewField(
                    'Avatar (image URL)',
                    '<input type="text" data-f="avatar_path" data-preview="avatar-url" value="' + Core.esc(p.avatar_path) + '" placeholder="https://...">',
                    'avatar-url',
                    p.avatar_path,
                    p.name || 'Avatar',
                    'avatar'
                ) +
                '<div><label>Color</label><input type="color" data-f="color" value="' + Core.esc(p.color || Core.DEFAULT_PARTICIPANT_COLORS[i % Core.DEFAULT_PARTICIPANT_COLORS.length]) + '"></div>' +
                '</div>' +
                '<div class="sub-section">' +
                '<h3 class="sub-title">Main Quest</h3>' +
                Core.renderParticipantPots(p, i) +
                '</div>' +
                Core.renderParticipantSideQuest(p) +
                '</div>' +
                '</div>';
        }).join('');

        el.querySelectorAll('.participant-row').forEach(row => {
            const i = +row.dataset.idx;
            const p = Core.form.participants[i];
            if (!p.picks) p.picks = Core.defaultPicks(Core.form.includeThirdPlace);
            Core.ensureParticipantMainQuest(p);

            Core.bindParticipantCollapse(row);
            row.querySelector('[data-action="remove-participant"]')?.addEventListener('click', () => Core.removeParticipant(i));
            row.querySelectorAll('[data-f]').forEach(inp => {
                inp.addEventListener('input', () => {
                    p[inp.dataset.f] = inp.value;
                    Core.updatePreviewForControl(inp);
                    if (inp.dataset.f === 'name') Core.syncParticipantHeaderLabel(row, inp.value);
                });
            });

            row.querySelectorAll('[data-action="add-pot"]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const stage = btn.getAttribute('data-mq-stage') || 'group';
                    const mq = Core.ensureParticipantMainQuest(p);
                    if (!mq[stage]) mq[stage] = { pots: [] };
                    mq[stage].pots.push({ teams: ['', ''] });
                    Core.renderParticipants();
                });
            });

            row.querySelectorAll('.sub-block[data-pot][data-mq-stage]').forEach((potEl) => {
                const stage = potEl.getAttribute('data-mq-stage') || 'group';
                const potIdx = +potEl.dataset.pot;
                const mq = Core.ensureParticipantMainQuest(p);
                if (!mq[stage]) mq[stage] = { pots: [{ teams: ['', ''] }] };
                potEl.querySelector('[data-action="remove-pot"]')?.addEventListener('click', () => {
                    mq[stage].pots.splice(potIdx, 1);
                    if (!mq[stage].pots.length) mq[stage].pots.push({ teams: ['', ''] });
                    Core.renderParticipants();
                });
                const pot = mq[stage].pots[potIdx];
                if (!pot) return;
                if (!pot.teams) pot.teams = ['', ''];
                potEl.querySelector('[data-f="pot-a"]')?.addEventListener('change', (e) => {
                    pot.teams[0] = e.target.value;
                    Core.renderParticipants();
                });
                potEl.querySelector('[data-f="pot-b"]')?.addEventListener('change', (e) => {
                    pot.teams[1] = e.target.value;
                    Core.renderParticipants();
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
                    Core.updatePreviewForControl(inp);
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
                        Core.updatePreviewForControl(inp);
                    };
                    inp.addEventListener('input', handler);
                    inp.addEventListener('change', handler);
                });
            });

            Core.bindPlayerNameLookup(row, p);
        });
        Core.bindPreviewControls(el);
        Core.updateCounts();
        Core.renderScorePredictionsSection();
    }

    Core.addParticipant = function addParticipant() {
        Core.form.participants.push(Core.emptyParticipant(Core.form.participants.length));
        Core.participantOpenState[Core.form.participants.length - 1] = false;
        Core.renderParticipants();
    }

    Core.removeParticipant = function removeParticipant(i) {
        if (Core.form.participants.length <= 1) return;
        Core.form.participants.splice(i, 1);
        Core.renderParticipants();
    }

    Core.ensureInitialParticipant = function ensureInitialParticipant() {
        if (!Core.form.participants.length) {
            Core.form.participants.push(Core.emptyParticipant(0));
        }
    }

})(window.ArisanSetupFormCore);
