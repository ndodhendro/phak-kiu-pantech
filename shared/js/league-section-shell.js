/**
 * League detail — splash, music, anim pause
 * Split from bracket-app.js — shared ArisanLeagueApp core.
 */
(function (Core) {
'use strict';

Core.unlockSplashScroll = function unlockSplashScroll() {
    document.documentElement.classList.remove('splash-locked');
    document.body.style.top = '';
    delete document.body.dataset.splashScrollY;
    // Always start league detail from the top after Enter
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
};
Core.lockSplashScroll = function lockSplashScroll() {
    if (!document.documentElement.classList.contains('splash-locked')) {
        document.documentElement.classList.add('splash-locked');
    }
    // Freeze at current visual position, but Enter always resets to top
    var y = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.splashScrollY = String(y);
    document.body.style.top = '-' + y + 'px';
};
;(function bindSplashScrollGuard() {
    var overlay = document.getElementById('splash-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    Core.lockSplashScroll();
    var block = function (e) {
        if (!document.documentElement.classList.contains('splash-locked')) return;
        if (e.target && e.target.closest && e.target.closest('#enter-btn')) return;
        e.preventDefault();
    };
    window.addEventListener('wheel', block, { passive: false, capture: true });
    window.addEventListener('touchmove', block, { passive: false, capture: true });
})();

Core.enterSite = function enterSite() {
    // Hilangkan splash overlay
    document.getElementById('splash-overlay').classList.add('hidden');
    Core.unlockSplashScroll();
    Core.hasEntered = true;
    requestAnimationFrame(function () {
        window.scrollTo(0, 0);
    });
            window.setTimeout(function () {
                if (window.ArisanLeagueViews && typeof ArisanLeagueViews.armCelebrationScheduler === 'function') {
                    ArisanLeagueViews.armCelebrationScheduler();
                } else if (typeof Core.playFinalWinnerCelebration === 'function') {
                    Core.playFinalWinnerCelebration();
                }
            }, 450);
    // Mulai musik
    if (Core.audio) {
        Core.playBackgroundMusic();
        var btn = document.getElementById('music-toggle');
        if (btn) btn.classList.add('playing');
    }
};
/** Invalidate in-flight audio.play() promises (common mobile resume bug). */
Core.bumpMusicPlayGeneration = function bumpMusicPlayGeneration() {
    Core.musicPlayGen = (Core.musicPlayGen || 0) + 1;
    return Core.musicPlayGen;
};
Core.playBackgroundMusic = function playBackgroundMusic() {
    if (!Core.audio || Core.isMuted) return;
    Core.pausedByFocusLoss = false;
    var gen = Core.bumpMusicPlayGeneration();
    var playPromise = Core.audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
            // Late play() resolve on mobile can restart audio after we already paused.
            if (gen !== Core.musicPlayGen) return;
            if (Core.isMuted || Core.pausedByFocusLoss || document.hidden ||
                document.visibilityState === 'hidden') {
                try { Core.audio.pause(); } catch (e) {}
            }
        }).catch(function () {});
    }
};
Core.pauseBackgroundMusicForFocus = function pauseBackgroundMusicForFocus() {
    if (!Core.audio) return;
    Core.bumpMusicPlayGeneration();
    if (!Core.audio.paused || !Core.pausedByFocusLoss) {
        // Mark for resume even if the OS already paused the element.
        if (!Core.isMuted) Core.pausedByFocusLoss = true;
    }
    try { Core.audio.pause(); } catch (e) {}
};
Core.toggleMusic = function toggleMusic() {
    if (!Core.audio) return;
    var btn = document.getElementById('music-toggle');

    if (Core.isMuted) {
        Core.isMuted = false;
        Core.playBackgroundMusic();
        if (btn) {
            btn.textContent = '🔊';
            btn.classList.remove('muted');
            btn.classList.add('playing');
        }
    } else {
        Core.bumpMusicPlayGeneration();
        Core.audio.pause();
        if (btn) {
            btn.textContent = '🔇';
            btn.classList.add('muted');
            btn.classList.remove('playing');
        }
        Core.isMuted = true;
        Core.pausedByFocusLoss = false;
    }
};
Core.isPageMusicInactive = function isPageMusicInactive(ev) {
    var type = ev && ev.type;
    if (document.visibilityState === 'hidden' || document.hidden) return true;
    if (type === 'blur' || type === 'pagehide' || type === 'freeze') return true;
    return false;
};
Core.updateMusicForPageFocus = function updateMusicForPageFocus(ev) {
    if (!Core.audio || !Core.hasEntered || Core.isMuted) return;

    if (Core.isPageMusicInactive(ev)) {
        Core.pauseBackgroundMusicForFocus();
        return;
    }

    // Resume only when the page is visible again.
    if (Core.pausedByFocusLoss) {
        Core.playBackgroundMusic();
    }
};
Core.syncAnimPausedForVisibility = function syncAnimPausedForVisibility() {
    document.documentElement.classList.toggle('anim-paused', document.hidden);
};
Core.observeAnimPauseTargets = function observeAnimPauseTargets(root) {
    if (!('IntersectionObserver' in window)) return;
    if (!Core.animPauseObserver) {
        Core.animPauseObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle('anim-paused', !entry.isIntersecting);
            });
        }, { root: null, rootMargin: '100px 0px', threshold: 0 });
    }
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(Core.ANIM_PAUSE_SELECTOR).forEach((el) => {
        if (Core.animPauseObserved) {
            if (Core.animPauseObserved.has(el)) return;
            Core.animPauseObserved.add(el);
        } else if (el.dataset.animPauseObserved === '1') {
            return;
        } else {
            el.dataset.animPauseObserved = '1';
        }
        el.classList.add('anim-paused');
        Core.animPauseObserver.observe(el);
    });
};
;(function bindStandingsAnimPause() {
    if (!('IntersectionObserver' in window)) return;
    const section = document.querySelector('.standings-section')
        || document.querySelector('#standings-points-chart')?.closest('.league-panel');
    if (!section) return;
    const io = new IntersectionObserver((entries) => {
        const visible = !!(entries[0] && entries[0].isIntersecting);
        section.classList.toggle('anim-paused', !visible);
    }, { threshold: 0.08, rootMargin: '40px' });
    io.observe(section);
})();

;(function bindMusicAndAnimFocus() {
    function onHide() {
        Core.syncAnimPausedForVisibility();
        Core.updateMusicForPageFocus({ type: 'visibilitychange' });
        // Mobile browsers (esp. iOS/Android Chrome) sometimes ignore the first pause
        // or resume via a late play() promise — re-assert while still hidden.
        [0, 120, 400, 1000].forEach(function (ms) {
            setTimeout(function () {
                if (!Core.audio || !Core.hasEntered || Core.isMuted) return;
                if (document.visibilityState === 'hidden' || document.hidden) {
                    Core.pauseBackgroundMusicForFocus();
                }
            }, ms);
        });
    }

    function onShow(type) {
        Core.syncAnimPausedForVisibility();
        Core.updateMusicForPageFocus({ type: type || 'focus' });
    }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' || document.hidden) onHide();
        else onShow('visibilitychange');
    });
    window.addEventListener('pagehide', function () {
        Core.updateMusicForPageFocus({ type: 'pagehide' });
    });
    window.addEventListener('pageshow', function () {
        onShow('pageshow');
    });
    window.addEventListener('freeze', function () {
        Core.updateMusicForPageFocus({ type: 'freeze' });
    }, true);
    window.addEventListener('resume', function () {
        onShow('resume');
    }, true);
    window.addEventListener('blur', function () {
        Core.updateMusicForPageFocus({ type: 'blur' });
    });
    window.addEventListener('focus', function () {
        onShow('focus');
    });
    // iOS Safari legacy alias
    document.addEventListener('webkitvisibilitychange', function () {
        if (document.visibilityState === 'hidden' || document.hidden) onHide();
        else onShow('visibilitychange');
    });
    Core.syncAnimPausedForVisibility();
})();

})(window.ArisanLeagueApp);
