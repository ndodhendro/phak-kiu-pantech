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
    window.setTimeout(Core.playFinalWinnerCelebration, 450);
    // Mulai musik
    if (Core.audio) {
        Core.audio.play();
        var btn = document.getElementById('music-toggle');
        if (btn) btn.classList.add('playing');
    }
};
Core.toggleMusic = function toggleMusic() {
    if (!Core.audio) return;
    var btn = document.getElementById('music-toggle');

    if (Core.isMuted) {
        Core.audio.play();
        if (btn) {
            btn.textContent = '🔊';
            btn.classList.remove('muted');
            btn.classList.add('playing');
        }
        Core.isMuted = false;
    } else {
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
Core.updateMusicForPageFocus = function updateMusicForPageFocus() {
    if (!Core.audio || !Core.hasEntered || Core.isMuted) return;

    var pageInactive = document.hidden || !document.hasFocus();

    if (pageInactive) {
        if (!Core.audio.paused) {
            Core.pausedByFocusLoss = true;
            Core.audio.pause();
        }
    } else if (Core.pausedByFocusLoss) {
        Core.pausedByFocusLoss = false;
        Core.audio.play();
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

})(window.ArisanLeagueApp);
