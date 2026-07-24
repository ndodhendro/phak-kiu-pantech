/**
 * Setup section: score predictions
 * Auto-split from setup-form.js — uses shared ArisanSetupFormCore.
 */
(function (Core) {
'use strict';

    Core.collectScorePredictionsFromDom = function collectScorePredictionsFromDom() {
        const root = document.getElementById('score-predictions-root');
        if (!root) return;
        Core.form.participants.forEach(p => Core.ensureScorePredictPicks(p));
        root.querySelectorAll('[data-sp-match][data-sp-participant]').forEach(wrap => {
            const matchId = wrap.dataset.spMatch;
            const pi = parseInt(wrap.dataset.spParticipant, 10);
            const p = Core.form.participants[pi];
            if (!p || !matchId) return;
            const map = Core.ensureScorePredictPicks(p);
            const aEl = wrap.querySelector('[data-sp="a"]');
            const bEl = wrap.querySelector('[data-sp="b"]');
            const entry = Core.normalizeScorePredictEntry({
                a: aEl ? aEl.value : '',
                b: bEl ? bEl.value : '',
            });
            if (entry) map[matchId] = entry;
            else delete map[matchId];
        });
    }

    Core.pruneScorePredictionsToCatalog = function pruneScorePredictionsToCatalog(catalogKeys) {
        const valid = new Set(catalogKeys || []);
        Core.form.participants.forEach(p => {
            const map = Core.ensureScorePredictPicks(p);
            Object.keys(map).forEach(id => {
                if (!valid.has(id)) delete map[id];
            });
        });
    }

    Core.renderScorePredictionsSection = function renderScorePredictionsSection(opts) {
        const root = document.getElementById('score-predictions-root');
        if (!root) return;

        const skipCollect = !!(opts && opts.skipCollect);
        if (!skipCollect) Core.collectScorePredictionsFromDom();

        const catalog = Core.getScheduleCatalog();
        const participants = Core.form.participants.filter(p => (p.name || '').trim());
        if (!catalog.length) {
            root.innerHTML = '<p class="hint">Add teams / matches in Section 3 to configure score predictions.</p>';
            return;
        }
        if (!participants.length) {
            root.innerHTML = '<p class="hint">Add named participants in Section 4 to enter score predictions.</p>';
            return;
        }

        Core.pruneScorePredictionsToCatalog(catalog.map(e => Core.catalogPairKey(e)));

        let html = '<div class="score-predict-wrap"><table class="score-predict-table"><thead><tr>' +
            '<th>Match</th>' +
            participants.map(p => '<th class="sp-participant">' + Core.esc(p.name) + '</th>').join('') +
            '</tr></thead><tbody>';

        catalog.forEach(entry => {
            const pk = Core.catalogPairKey(entry);
            html += '<tr><td class="sp-match-label" title="' + Core.esc(entry.label) + '">' + Core.esc(entry.label) + '</td>';
            Core.form.participants.forEach((p, pi) => {
                if (!(p.name || '').trim()) return;
                const map = Core.ensureScorePredictPicks(p);
                const pred = map[pk] || {};
                const aVal = pred.a != null ? String(pred.a) : '';
                const bVal = pred.b != null ? String(pred.b) : '';
                const hasPred = aVal !== '' || bVal !== '';
                html += '<td><div class="score-predict-inputs' + (hasPred ? '' : ' is-empty') +
                    '" data-sp-match="' + Core.esc(pk) +
                    '" data-sp-participant="' + pi + '">' +
                    '<input type="number" min="0" step="1" data-sp="a" value="' + Core.esc(aVal) +
                    '" aria-label="' + Core.esc(p.name) + ' home score for ' + Core.esc(entry.label) + '">' +
                    '<span class="sp-sep">-</span>' +
                    '<input type="number" min="0" step="1" data-sp="b" value="' + Core.esc(bVal) +
                    '" aria-label="' + Core.esc(p.name) + ' away score for ' + Core.esc(entry.label) + '">' +
                    '<button type="button" class="sp-clear" title="Clear prediction" aria-label="Clear prediction for ' +
                    Core.esc(p.name) + ' on ' + Core.esc(entry.label) + '">✕</button>' +
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
                    Core.collectScorePredictionsFromDom();
                    syncClearVisibility(wrap);
                });
                inp.addEventListener('input', () => {
                    Core.collectScorePredictionsFromDom();
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
                const p = Core.form.participants[pi];
                if (p && matchId) {
                    const map = Core.ensureScorePredictPicks(p);
                    delete map[matchId];
                }
                Core.collectScorePredictionsFromDom();
                syncClearVisibility(wrap);
            });
        });
    }

})(window.ArisanSetupFormCore);
