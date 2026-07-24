/**
 * Setup section: community / league meta & branding
 * Auto-split from setup-form.js — uses shared ArisanSetupFormCore.
 */
(function (Core) {
'use strict';

    Core.syncStageOptionVisibility = function syncStageOptionVisibility() {
        const knockoutOpts = document.getElementById('knockout-stage-options');
        if (knockoutOpts) knockoutOpts.classList.toggle('hidden', !Core.form.includeKnockoutStage);
    }

    Core.syncTeamsSectionUi = function syncTeamsSectionUi() {
        // Per-stage hints are rendered inside Group / Knockout panels.
    }

    Core.updateSectionLabels = function updateSectionLabels() {
        const isCountry = Core.form.competitionType === 'country';
        const title = document.getElementById('teams-section-title');
        const typeHint = document.getElementById('competition-type-hint');
        if (title) {
            if (Core.form.includeGroupStage && !Core.form.includeKnockoutStage) {
                title.textContent = isCountry ? '3. Groups (countries)' : '3. Groups (clubs)';
            } else if (Core.form.includeGroupStage && Core.form.includeKnockoutStage) {
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

    Core.setLeagueTitleLookupStatus = function setLeagueTitleLookupStatus(state, message) {
        const statusEl = document.getElementById('league-title-lookup-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'player-lookup-status hint' + (state ? ' ' + state : '');
    }

    Core.hideLeagueTitleAutocomplete = function hideLeagueTitleAutocomplete() {
        const list = document.getElementById('league-title-autocomplete');
        const titleInp = document.getElementById('league-title');
        if (!list) return;
        list.innerHTML = '';
        list.classList.add('hidden');
        list._leagues = null;
        if (titleInp) titleInp.setAttribute('aria-expanded', 'false');
    }

    Core.applyLeagueSelection = function applyLeagueSelection(league) {
        const titleInp = document.getElementById('league-title');
        const yearInp = document.getElementById('league-year');
        const iconInp = document.getElementById('league-icon-url');
        if (!league || !titleInp) return;

        titleInp.value = league.name || titleInp.value;
        if (league.year != null && yearInp && !yearInp.value) {
            yearInp.value = String(league.year);
        }

        if (league.icon) {
            Core.form.iconImageUrl = league.icon;
            if (iconInp) {
                iconInp.value = league.icon;
                Core.updatePreviewForControl(iconInp);
            }
            Core.setLeagueTitleLookupStatus('ok', 'League icon loaded from TheSportsDB.');
        } else {
            Core.setLeagueTitleLookupStatus('warn', 'League found — enter icon URL manually.');
        }

        Core.hideLeagueTitleAutocomplete();
    }

    Core.renderLeagueTitleAutocomplete = function renderLeagueTitleAutocomplete(leagues, onSelect) {
        const list = document.getElementById('league-title-autocomplete');
        const titleInp = document.getElementById('league-title');
        if (!list || !titleInp) return;

        if (!leagues.length) {
            Core.hideLeagueTitleAutocomplete();
            return;
        }

        list._leagues = leagues;
        list.innerHTML = leagues.map((lg, idx) =>
            '<button type="button" class="player-autocomplete-option' + (idx === 0 ? ' active' : '') + '" role="option" data-idx="' + idx + '">' +
            (lg.previewThumb
                ? '<img src="' + Core.esc(lg.previewThumb) + '" alt="" class="player-autocomplete-thumb">'
                : '<span class="player-autocomplete-thumb" aria-hidden="true"></span>') +
            '<span class="player-autocomplete-text"><strong>' + Core.esc(lg.name) + '</strong>' +
            '<small>' + Core.esc(lg.country || 'Soccer') +
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

    Core.selectLeagueById = async function selectLeagueById(row) {
        Core.setLeagueTitleLookupStatus('loading', 'Loading league icon…');
        try {
            if (typeof ArisanTheSportsDB === 'undefined') {
                Core.applyLeagueSelection({ name: row.name, icon: '', hasIcon: false });
                return;
            }
            const full = await ArisanTheSportsDB.lookupLeague(row.id);
            Core.applyLeagueSelection(full || { name: row.name, icon: '', hasIcon: false });
        } catch (e) {
            Core.applyLeagueSelection({ name: row.name, icon: '', hasIcon: false });
            Core.setLeagueTitleLookupStatus('warn', 'Icon lookup failed — enter URL manually.');
        }
    }

    Core.bindLeagueTitleLookup = function bindLeagueTitleLookup() {
        const titleInp = document.getElementById('league-title');
        if (!titleInp || titleInp.dataset.lookupBound) return;
        titleInp.dataset.lookupBound = '1';

        let suggestTimer = null;
        let pickedFromList = false;

        const showSuggestions = () => {
            const q = titleInp.value.trim();
            if (q.length < 2) {
                Core.hideLeagueTitleAutocomplete();
                Core.setLeagueTitleLookupStatus('', '');
                return;
            }
            if (typeof ArisanTheSportsDB === 'undefined') {
                Core.setLeagueTitleLookupStatus('warn', 'League lookup unavailable — enter title and icon manually.');
                return;
            }

            const leagues = ArisanTheSportsDB.searchLeagues(q, 8);
            if (leagues.length) {
                Core.renderLeagueTitleAutocomplete(leagues, row => {
                    pickedFromList = true;
                    Core.selectLeagueById(row);
                });
                Core.setLeagueTitleLookupStatus('', leagues.length + ' league(s) found — pick one.');
            } else {
                Core.hideLeagueTitleAutocomplete();
                Core.setLeagueTitleLookupStatus('warn', 'Not in catalog — enter title and icon URL manually.');
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
                Core.setActiveAutocompleteOption(titleInp, 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                Core.setActiveAutocompleteOption(titleInp, -1);
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
                        Core.selectLeagueById(league);
                    }
                }
            } else if (e.key === 'Escape') {
                Core.hideLeagueTitleAutocomplete();
            }
        });

        titleInp.addEventListener('blur', () => {
            setTimeout(() => {
                if (pickedFromList) {
                    pickedFromList = false;
                    return;
                }
                Core.hideLeagueTitleAutocomplete();
            }, 180);
        });

        titleInp.addEventListener('focus', () => {
            if (titleInp.value.trim().length >= 2) showSuggestions();
        });
    }

    Core.ensureIconUrlField = function ensureIconUrlField() {
        const wrap = document.getElementById('league-icon-url-wrap');
        if (!wrap || wrap.dataset.rendered) return;
        wrap.dataset.rendered = '1';
        wrap.innerHTML = Core.labeledPreviewField(
            'League icon image URL',
            '<input type="text" id="league-icon-url" data-preview="icon-url" placeholder="https://...  (default: FIFA WC 2026 icon)">',
            'icon-url',
            Core.form.iconImageUrl || '',
            'League icon',
            'icon'
        );
        const inp = document.getElementById('league-icon-url');
        if (!inp) return;
        inp.value = Core.form.iconImageUrl || '';
        const syncIcon = () => {
            Core.form.iconImageUrl = inp.value.trim();
            Core.updatePreviewForControl(inp);
        };
        inp.addEventListener('input', syncIcon);
        inp.addEventListener('change', syncIcon);
        Core.bindPreviewControls(wrap);
    }

    Core.ensureTrophyUrlField = function ensureTrophyUrlField() {
        const wrap = document.getElementById('league-trophy-url-wrap');
        if (!wrap || wrap.dataset.rendered) return;
        wrap.dataset.rendered = '1';
        wrap.innerHTML = Core.labeledPreviewField(
            'League trophy image URL',
            '<input type="text" id="league-trophy-url" data-preview="trophy-url" placeholder="https://... (default: FIFA WC 2026 trophy)">',
            'trophy-url',
            Core.form.trophyImageUrl || '',
            'League trophy',
            'trophy'
        );
        const inp = document.getElementById('league-trophy-url');
        if (!inp) return;
        inp.value = Core.form.trophyImageUrl || '';
        const syncTrophy = () => {
            Core.form.trophyImageUrl = inp.value.trim();
            Core.updatePreviewForControl(inp);
        };
        inp.addEventListener('input', syncTrophy);
        inp.addEventListener('change', syncTrophy);
        Core.bindPreviewControls(wrap);
    }

    Core.ensureBallUrlField = function ensureBallUrlField() {
        const wrap = document.getElementById('league-ball-url-wrap');
        if (!wrap || wrap.dataset.rendered) return;
        wrap.dataset.rendered = '1';
        wrap.innerHTML = Core.labeledPreviewField(
            'Match ball image URL',
            '<input type="text" id="league-ball-url" data-preview="ball-url" placeholder="https://... (default: FIFA WC 2026 ball)">',
            'ball-url',
            Core.form.ballImageUrl || '',
            'Match ball',
            'ball'
        );
        const inp = document.getElementById('league-ball-url');
        if (!inp) return;
        inp.value = Core.form.ballImageUrl || '';
        const syncBall = () => {
            Core.form.ballImageUrl = inp.value.trim();
            Core.updatePreviewForControl(inp);
        };
        inp.addEventListener('input', syncBall);
        inp.addEventListener('change', syncBall);
        Core.bindPreviewControls(wrap);
    }

    Core.ensureBgMusicUrlField = function ensureBgMusicUrlField() {
        const inp = document.getElementById('league-bg-music-url');
        if (!inp) return;

        const statusEl = document.getElementById('league-bg-music-status');
        const audio = document.getElementById('league-bg-music-preview');
        if (audio) audio.volume = 0.5;

        if (inp.dataset.bound) {
            // Keep API in sync when field already bound (e.g. after Load league data).
            if (Core.bgMusicPreviewApi) {
                inp.value = Core.form.backgroundMusicUrl || '';
            }
            return;
        }
        inp.dataset.bound = '1';
        inp.value = Core.form.backgroundMusicUrl || '';

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
            const src = String(url == null ? (Core.form.backgroundMusicUrl || '') : url).trim();
            if (!src || !Core.isHttpUrl(src)) {
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
            Core.form.backgroundMusicUrl = url;
            clearTimeout(previewTimer);
            previewTimer = setTimeout(() => playPreview(url), 350);
        };

        inp.addEventListener('input', sync);
        inp.addEventListener('change', sync);
        inp.addEventListener('paste', () => {
            clearTimeout(previewTimer);
            previewTimer = setTimeout(() => {
                const url = inp.value.trim();
                Core.form.backgroundMusicUrl = url;
                playPreview(url);
            }, 50);
        });

        audio?.addEventListener('error', () => {
            if (!Core.form.backgroundMusicUrl) return;
            setMusicStatus('warn', 'Audio failed to load — check the URL.');
        });

        document.addEventListener('visibilitychange', updateMusicForPageFocus);
        window.addEventListener('blur', updateMusicForPageFocus);
        window.addEventListener('focus', updateMusicForPageFocus);

        Core.bgMusicPreviewApi = {
            play: playPreview,
            stop: stopPreview,
            setStatus: setMusicStatus,
        };

        if (Core.isHttpUrl(Core.form.backgroundMusicUrl)) {
            // Don't autoplay on initial page load / after Load league data.
            setMusicStatus('', 'URL loaded — edit or re-paste to preview.');
        }
    }

    Core.syncBackgroundMusicFieldFromForm = function syncBackgroundMusicFieldFromForm() {
        Core.ensureBgMusicUrlField();
        const url = (Core.form.backgroundMusicUrl || '').trim();
        const musicInp = document.getElementById('league-bg-music-url');
        if (musicInp) musicInp.value = url;
        if (!Core.bgMusicPreviewApi) return;
        if (url && Core.isHttpUrl(url)) {
            Core.bgMusicPreviewApi.play(url);
        } else {
            Core.bgMusicPreviewApi.stop();
            Core.bgMusicPreviewApi.setStatus('', '');
        }
    }

    Core.renderLeagueMeta = function renderLeagueMeta() {
        Core.ensureIconUrlField();
        Core.ensureTrophyUrlField();
        Core.ensureBallUrlField();
        Core.ensureBgMusicUrlField();
        Core.bindLeagueTitleLookup();
        const typeEl = document.getElementById('competition-type');
        const groupEl = document.getElementById('include-group-stage');
        const knockoutEl = document.getElementById('include-knockout-stage');
        const thirdEl = document.getElementById('include-third-place');
        const twoLegEl = document.getElementById('two-leg-knockout');
        const iconInp = document.getElementById('league-icon-url');
        const trophyInp = document.getElementById('league-trophy-url');
        const ballInp = document.getElementById('league-ball-url');
        const musicInp = document.getElementById('league-bg-music-url');
        if (typeEl) typeEl.value = Core.form.competitionType;
        if (groupEl) groupEl.checked = Core.form.includeGroupStage;
        if (knockoutEl) knockoutEl.checked = Core.form.includeKnockoutStage;
        if (thirdEl) thirdEl.checked = Core.form.includeThirdPlace;
        if (twoLegEl) twoLegEl.checked = Core.form.twoLegKnockout;
        if (iconInp && iconInp.value !== (Core.form.iconImageUrl || '')) {
            iconInp.value = Core.form.iconImageUrl || '';
            Core.updatePreviewForControl(iconInp);
        }
        if (trophyInp && trophyInp.value !== (Core.form.trophyImageUrl || '')) {
            trophyInp.value = Core.form.trophyImageUrl || '';
            Core.updatePreviewForControl(trophyInp);
        }
        if (ballInp && ballInp.value !== (Core.form.ballImageUrl || '')) {
            ballInp.value = Core.form.ballImageUrl || '';
            Core.updatePreviewForControl(ballInp);
        }
        if (musicInp && musicInp.value !== (Core.form.backgroundMusicUrl || '')) {
            musicInp.value = Core.form.backgroundMusicUrl || '';
        }
        Core.updateSectionLabels();
        Core.syncStageOptionVisibility();
        Core.renderPointConfig();
    }

    Core.bindLeagueMeta = function bindLeagueMeta() {
        document.getElementById('competition-type')?.addEventListener('change', e => {
            Core.form.competitionType = e.target.value;
            Core.form.teams.forEach(Core.syncTeamFlagFromCountry);
            (Core.form.groupDefinitions || []).forEach(g => (g.teams || []).forEach(Core.syncTeamFlagFromCountry));
            Core.updateSectionLabels();
            Core.renderTeams();
            Core.renderParticipants();
        });
        document.getElementById('include-group-stage')?.addEventListener('change', e => {
            Core.form.includeGroupStage = e.target.checked;
            if (Core.form.includeGroupStage) Core.ensureInitialGroups();
            Core.updateSectionLabels();
            Core.syncTeamsSectionUi();
            Core.renderTeams();
            Core.renderScheduleSection();
            Core.renderParticipants();
        });
        document.getElementById('include-knockout-stage')?.addEventListener('change', e => {
            Core.form.includeKnockoutStage = e.target.checked;
            if (Core.form.includeKnockoutStage) Core.ensureInitialTeamPair();
            Core.syncStageOptionVisibility();
            Core.updateSectionLabels();
            Core.syncTeamsSectionUi();
            Core.renderTeams();
            Core.renderScheduleSection();
            Core.renderParticipants();
        });
        document.getElementById('include-third-place')?.addEventListener('change', e => {
            Core.form.includeThirdPlace = e.target.checked;
            Core.syncThirdPlacePointConfig();
            Core.renderPointConfig();
            Core.renderParticipants();
            Core.renderScheduleSection();
        });
        document.getElementById('two-leg-knockout')?.addEventListener('change', e => {
            Core.form.twoLegKnockout = e.target.checked;
            Core.renderScheduleSection();
        });
        document.getElementById('league-year')?.addEventListener('change', () => {
            Core.renderScheduleSection();
        });
    }

})(window.ArisanSetupFormCore);
