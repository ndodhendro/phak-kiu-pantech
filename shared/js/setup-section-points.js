/**
 * Setup section: point config
 * Auto-split from setup-form.js — uses shared ArisanSetupFormCore.
 */
(function (Core) {
'use strict';

    Core.syncThirdPlacePointConfig = function syncThirdPlacePointConfig() {
        if (!Core.form.includeThirdPlace) {
            Core.form.pointConfig.sideQuest.third = 0;
        } else if (Core.form.pointConfig.sideQuest.third === 0) {
            Core.form.pointConfig.sideQuest.third = Core.DEFAULT_POINT_CONFIG.sideQuest.third;
        }

        const wrap = document.getElementById('pt-third-wrap');
        if (wrap) wrap.classList.toggle('hidden', !Core.form.includeThirdPlace);
    }

    Core.syncMainQuestModeUi = function syncMainQuestModeUi() {
        const mode = Core.form.pointConfig.mainQuestMode === 'fifa' ? 'fifa' : 'fixed';
        Core.form.pointConfig.mainQuestMode = mode;
        const fixedEl = document.getElementById('main-quest-fixed-points');
        const fifaEl = document.getElementById('main-quest-fifa-points');
        const fixedRadio = document.getElementById('mq-mode-fixed');
        const fifaRadio = document.getElementById('mq-mode-fifa');
        if (fixedRadio) fixedRadio.checked = mode === 'fixed';
        if (fifaRadio) fifaRadio.checked = mode === 'fifa';
        if (fixedEl) fixedEl.classList.toggle('hidden', mode !== 'fixed');
        if (fifaEl) fifaEl.classList.toggle('hidden', mode !== 'fifa');
    }

    Core.collectTeamPointsFromDom = function collectTeamPointsFromDom() {
        const root = document.getElementById('main-quest-team-points');
        if (!root) return;
        if (!Core.form.pointConfig.teamPoints) Core.form.pointConfig.teamPoints = {};
        root.querySelectorAll('tr[data-team]').forEach(row => {
            const name = row.dataset.team;
            if (!name) return;
            const num = (sel) => {
                const el = row.querySelector(sel);
                const v = el ? parseInt(el.value, 10) : NaN;
                return Number.isNaN(v) ? 0 : Math.max(0, v);
            };
            Core.form.pointConfig.teamPoints[name] = {
                win: num('[data-tp="win"]'),
                draw: num('[data-tp="draw"]'),
                loss: num('[data-tp="loss"]'),
            };
        });
    }

    Core.syncTeamPointsWithTeamList = function syncTeamPointsWithTeamList() {
        const mq = Core.form.pointConfig.mainQuest || Core.DEFAULT_POINT_CONFIG.mainQuest;
        const prev = Core.form.pointConfig.teamPoints || {};
        const next = {};
        Core.teamNames().forEach(name => {
            next[name] = Core.normalizeTeamPointRow(prev[name], mq);
        });
        Core.form.pointConfig.teamPoints = next;
    }

    Core.renderMainQuestTeamPoints = function renderMainQuestTeamPoints() {
        const root = document.getElementById('main-quest-team-points');
        if (!root) return;

        Core.collectTeamPointsFromDom();
        Core.syncTeamPointsWithTeamList();

        const names = Core.teamNames();
        if (!names.length) {
            root.innerHTML = '<p class="hint">Add teams in Section 3 to configure per-team points.</p>';
            return;
        }

        const rows = names.map(name => ({
            name,
            ...(Core.form.pointConfig.teamPoints[name] || Core.normalizeTeamPointRow(null, Core.form.pointConfig.mainQuest)),
        }));
        rows.sort((a, b) => a.name.localeCompare(b.name));

        root.innerHTML =
            '<div class="mq-team-points-wrap"><table class="mq-team-points-table">' +
            '<thead><tr>' +
            '<th>Team</th><th>W</th><th>D</th><th>L</th>' +
            '</tr></thead><tbody>' +
            rows.map(row =>
                '<tr data-team="' + Core.esc(row.name) + '">' +
                '<td class="mq-team-name">' + Core.esc(row.name) + '</td>' +
                '<td><input type="number" min="0" step="1" data-tp="win" value="' + Core.esc(String(row.win)) + '" aria-label="Win points for ' + Core.esc(row.name) + '"></td>' +
                '<td><input type="number" min="0" step="1" data-tp="draw" value="' + Core.esc(String(row.draw)) + '" aria-label="Draw points for ' + Core.esc(row.name) + '"></td>' +
                '<td><input type="number" min="0" step="1" data-tp="loss" value="' + Core.esc(String(row.loss)) + '" aria-label="Loss points for ' + Core.esc(row.name) + '"></td>' +
                '</tr>'
            ).join('') +
            '</tbody></table></div>';

        root.querySelectorAll('input[data-tp]').forEach(inp => {
            inp.addEventListener('change', () => Core.collectTeamPointsFromDom());
            inp.addEventListener('input', () => Core.collectTeamPointsFromDom());
        });
    }

    Core.renderPointConfig = function renderPointConfig() {
        Core.syncThirdPlacePointConfig();
        const pc = Core.form.pointConfig = Core.normalizePointConfig(Core.form.pointConfig);
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
        Core.syncMainQuestModeUi();
        Core.renderMainQuestTeamPoints();
    }

    Core.bindPointConfig = function bindPointConfig() {
        const bind = (id, section, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                const v = parseInt(el.value, 10);
                Core.form.pointConfig[section][key] = Number.isNaN(v) ? 0 : v;
            });
        };
        const bindShare = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                if (!Core.form.pointConfig.sideQuestShare) {
                    Core.form.pointConfig.sideQuestShare = Object.assign(
                        {},
                        Core.DEFAULT_POINT_CONFIG.sideQuestShare
                    );
                }
                Core.form.pointConfig.sideQuestShare[key] = !!el.checked;
            });
        };
        const bindMode = (id, mode) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                if (!el.checked) return;
                Core.form.pointConfig.mainQuestMode = mode;
                Core.syncMainQuestModeUi();
                if (mode === 'fifa') Core.renderMainQuestTeamPoints();
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

})(window.ArisanSetupFormCore);
