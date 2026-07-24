/**
 * League detail — view shell router (?view=) + celebration interval persistence.
 * One page; only the active section is shown / hydrated.
 */
(function () {
    'use strict';

    var CELEBRATION_INTERVAL_MS = 30 * 1000;
    var CELEBRATION_STORAGE_PREFIX = 'arisan_celeb_next_at:';

    var VIEWS = [
        { id: 'group', label: 'Group Stage', icon: '🏟️', title: 'Group Stage' },
        { id: 'ko', label: 'Knockout Stage', icon: '⚔️', title: 'Knockout Stage' },
        { id: 'standings', label: 'Standings Points', icon: '📊', title: 'Standings Points' },
        { id: 'main-quest', label: 'Main Quest', icon: '🎯', title: 'Main Quest' },
        { id: 'podium', label: 'Podiums', icon: '🏆', title: 'Podiums' },
        { id: 'golden-boot', label: 'Golden Boot', icon: '👟', title: 'Golden Boot' },
        { id: 'golden-glove', label: 'Golden Glove', icon: '🧤', title: 'Golden Glove' },
        { id: 'total-goal', label: 'Total Goal', icon: '⚽', title: 'Total Goal' },
    ];

    var VIEW_IDS = VIEWS.map(function (v) { return v.id; });
    var currentView = null;
    var changeListeners = [];
    var celebrationTimer = null;
    var hydrated = Object.create(null);
    var mountApi = null;

    function celebrationStorageKey() {
        var ctx = window.LEAGUE_CONTEXT || {};
        return CELEBRATION_STORAGE_PREFIX +
            String(ctx.communitySlug || '') + ':' + String(ctx.leagueSlug || '');
    }

    function readNextCelebrationAt() {
        try {
            var raw = sessionStorage.getItem(celebrationStorageKey());
            var n = parseInt(raw, 10);
            return Number.isFinite(n) ? n : null;
        } catch (e) {
            return null;
        }
    }

    function writeNextCelebrationAt(ts) {
        try {
            sessionStorage.setItem(celebrationStorageKey(), String(ts));
        } catch (e) {}
    }

    function clearCelebrationTimer() {
        if (celebrationTimer) {
            clearTimeout(celebrationTimer);
            celebrationTimer = null;
        }
    }

    function core() {
        return window.ArisanLeagueApp || null;
    }

    function playCelebrationNow() {
        var C = core();
        if (!C || typeof C.playFinalWinnerCelebration !== 'function') return;
        if (!C.pendingFinalCelebrationWinner) return;
        if (!C.hasEntered) return;
        C.playFinalWinnerCelebration();
    }

    function advanceNextCelebrationAt(fromTs) {
        var next = fromTs;
        var now = Date.now();
        if (!Number.isFinite(next) || next <= 0) next = now + CELEBRATION_INTERVAL_MS;
        while (next <= now) next += CELEBRATION_INTERVAL_MS;
        writeNextCelebrationAt(next);
        return next;
    }

    /**
     * Shared across view switches: absolute timestamp in sessionStorage.
     * Does not reset when changing menus; does not fire on every navigation.
     */
    function armCelebrationScheduler() {
        clearCelebrationTimer();
        var C = core();
        if (!C || !C.hasEntered || !C.pendingFinalCelebrationWinner) return;

        var now = Date.now();
        var next = readNextCelebrationAt();

        // First arm after Enter: play once soon, then schedule +30s from that play.
        if (next == null) {
            celebrationTimer = setTimeout(function () {
                celebrationTimer = null;
                playCelebrationNow();
                advanceNextCelebrationAt(Date.now() + CELEBRATION_INTERVAL_MS);
                armCelebrationScheduler();
            }, 450);
            return;
        }

        var delay = Math.max(250, next - now);
        celebrationTimer = setTimeout(function () {
            celebrationTimer = null;
            if (document.hidden) {
                // Keep the due time; retry shortly after tab visible again.
                armCelebrationScheduler();
                return;
            }
            playCelebrationNow();
            advanceNextCelebrationAt(Date.now() + CELEBRATION_INTERVAL_MS);
            armCelebrationScheduler();
        }, delay);
    }

    function parseViewFromUrl() {
        var q = new URLSearchParams(location.search || '');
        var v = (q.get('view') || '').trim().toLowerCase();
        return VIEW_IDS.indexOf(v) >= 0 ? v : null;
    }

    function defaultView() {
        var d = window.LEAGUE_DATA || {};
        if (d.includeGroupStage) return 'group';
        if (d.includeKnockoutStage !== false) return 'ko';
        return 'main-quest';
    }

    function isViewAvailable(id) {
        var d = window.LEAGUE_DATA || {};
        if (id === 'group') return !!d.includeGroupStage;
        if (id === 'ko') return d.includeKnockoutStage !== false;
        return true;
    }

    function getView() {
        if (currentView && isViewAvailable(currentView)) return currentView;
        var fromUrl = parseViewFromUrl();
        if (fromUrl && isViewAvailable(fromUrl)) return fromUrl;
        var fallback = defaultView();
        if (!isViewAvailable(fallback)) {
            for (var i = 0; i < VIEW_IDS.length; i++) {
                if (isViewAvailable(VIEW_IDS[i])) return VIEW_IDS[i];
            }
            return 'main-quest';
        }
        return fallback;
    }

    function writeUrl(viewId, replace) {
        try {
            var url = new URL(location.href);
            url.searchParams.set('view', viewId);
            if (replace) {
                history.replaceState({ leagueView: viewId }, '', url);
            } else {
                history.pushState({ leagueView: viewId }, '', url);
            }
        } catch (e) {}
    }

    function updateNavActive(viewId) {
        document.querySelectorAll('.float-btn[data-league-view]').forEach(function (btn) {
            var active = btn.getAttribute('data-league-view') === viewId;
            btn.classList.toggle('is-active', active);
            if (active) btn.setAttribute('aria-current', 'page');
            else btn.removeAttribute('aria-current');
        });
    }

    function showOnlyView(viewId) {
        document.querySelectorAll('[data-league-view-panel]').forEach(function (panel) {
            var id = panel.getAttribute('data-league-view-panel');
            var on = id === viewId;
            panel.hidden = !on;
            panel.classList.toggle('is-active-view', on);
        });
    }

    function setView(viewId, opts) {
        opts = opts || {};
        if (!isViewAvailable(viewId)) viewId = getView();
        var prev = currentView;
        currentView = viewId;
        showOnlyView(viewId);
        updateNavActive(viewId);
        if (opts.updateUrl !== false) {
            writeUrl(viewId, !!opts.replaceUrl || prev == null);
        }
        if (mountApi && typeof mountApi.activate === 'function') {
            mountApi.activate(viewId, { first: !hydrated[viewId], prev: prev });
            hydrated[viewId] = true;
        }
        changeListeners.forEach(function (fn) {
            try { fn(viewId, prev); } catch (e) {}
        });
        // Do NOT play celebration or reset interval on menu change.
    }

    function syncNavAvailability() {
        VIEWS.forEach(function (v) {
            var btn = document.querySelector('.float-btn[data-league-view="' + v.id + '"]');
            if (!btn) return;
            var ok = isViewAvailable(v.id);
            btn.hidden = !ok;
            btn.setAttribute('aria-hidden', ok ? 'false' : 'true');
        });
    }

    function bindNav() {
        document.querySelectorAll('.float-btn[data-league-view]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                var id = btn.getAttribute('data-league-view');
                if (!id || id === currentView || btn.classList.contains('is-active')) return;
                setView(id, { updateUrl: true, replaceUrl: false });
                requestAnimationFrame(function () {
                    window.scrollTo(0, 0);
                });
            });
        });
        window.addEventListener('popstate', function () {
            var fromUrl = parseViewFromUrl() || defaultView();
            setView(fromUrl, { updateUrl: false });
        });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) armCelebrationScheduler();
        });
    }

    function patchCelebrationHooks() {
        var C = core();
        if (!C) return;

        C.FINAL_CELEBRATION_REPEAT_MS = CELEBRATION_INTERVAL_MS;

        var originalPlay = C.playFinalWinnerCelebration;
        if (typeof originalPlay === 'function' && !originalPlay._leagueViewsPatched) {
            C.playFinalWinnerCelebration = function playFinalWinnerCelebrationPatched() {
                // Strip legacy setInterval; interval is owned by armCelebrationScheduler.
                if (C.finalCelebrationRepeatTimer) {
                    clearInterval(C.finalCelebrationRepeatTimer);
                    C.finalCelebrationRepeatTimer = null;
                }
                return originalPlay.apply(this, arguments);
            };
            C.playFinalWinnerCelebration._leagueViewsPatched = true;
        }

        C.scheduleFinalWinnerCelebration = function scheduleFinalWinnerCelebration() {
            var winner = null;
            if (typeof C.isTwoLegKnockout === 'function' && C.isTwoLegKnockout()) {
                var tieEl = typeof C.getTieElement === 'function' ? C.getTieElement('final-0') : null;
                winner = tieEl && C.getTieWinnerTeamData ? C.getTieWinnerTeamData(tieEl) : null;
            } else {
                var finalMatch = document.querySelector('[data-match-id="final-0"].finished');
                winner = finalMatch && C.getMatchupWinner ? C.getMatchupWinner(finalMatch) : null;
            }
            // Winner may live only on KO DOM; if KO not mounted yet, try ADMIN_CONFIG.
            if (!winner && window.ADMIN_CONFIG && typeof C.getFinishedMatchTeam === 'function') {
                winner = C.getFinishedMatchTeam('final-0', 'winner');
            }
            if (!winner || !winner.flagSrc) return;
            C.pendingFinalCelebrationWinner = winner;
            if (C.hasEntered) armCelebrationScheduler();
        };

        // enterSite previously fired celebration immediately; route through scheduler.
        var originalEnter = C.enterSite;
        if (typeof originalEnter === 'function' && !originalEnter._leagueViewsPatched) {
            C.enterSite = function enterSitePatched() {
                var splash = document.getElementById('splash-overlay');
                if (splash) splash.classList.add('hidden');
                if (typeof C.unlockSplashScroll === 'function') C.unlockSplashScroll();
                C.hasEntered = true;
                requestAnimationFrame(function () {
                    window.scrollTo(0, 0);
                });
                armCelebrationScheduler();
                if (C.audio) {
                    if (typeof C.playBackgroundMusic === 'function') {
                        C.playBackgroundMusic();
                    } else {
                        C.audio.play();
                    }
                    var btn = document.getElementById('music-toggle');
                    if (btn) btn.classList.add('playing');
                }
            };
            C.enterSite._leagueViewsPatched = true;
            window.enterSite = function () { return C.enterSite.apply(C, arguments); };
        }
    }

    function init(api) {
        mountApi = api || null;
        patchCelebrationHooks();
        bindNav();
        syncNavAvailability();
        var initial = getView();
        setView(initial, { updateUrl: true, replaceUrl: true });
        document.body.classList.add('league-views-ready');
    }

    window.ArisanLeagueViews = {
        VIEWS: VIEWS,
        INTERVAL_MS: CELEBRATION_INTERVAL_MS,
        init: init,
        getView: getView,
        setView: setView,
        isViewAvailable: isViewAvailable,
        syncNavAvailability: syncNavAvailability,
        armCelebrationScheduler: armCelebrationScheduler,
        onChange: function (fn) {
            if (typeof fn === 'function') changeListeners.push(fn);
        },
        markHydrated: function (id) { hydrated[id] = true; },
        isHydrated: function (id) { return !!hydrated[id]; },
    };
})();
