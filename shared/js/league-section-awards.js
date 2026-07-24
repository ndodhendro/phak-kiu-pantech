/**
 * League detail — golden boot / glove / total goal
 * Split from bracket-app.js — shared ArisanLeagueApp core.
 */
(function (Core) {
'use strict';

Core.getPlayerNationality = function getPlayerNationality(player) {
    if (player && player.country && player.flag) {
        return { country: player.country, flag: player.flag };
    }
    const key = String(player?.name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    return Core.PLAYER_NATIONALITY[key] || null;
};
Core.appendPlayerCountry = function appendPlayerCountry(container, player, countryClass) {
    const nationality = Core.getPlayerNationality(player);
    if (!nationality || !container) return;

    const countryEl = document.createElement('span');
    countryEl.className = countryClass;

    const flagWrap = document.createElement('span');
    flagWrap.className = 'flag-wave';
    const flagImg = document.createElement('img');
    flagImg.src = Core.countryFlagSrc(nationality.flag);
    flagImg.alt = nationality.country;
    flagImg.onerror = function() { flagWrap.style.display = 'none'; };
    flagWrap.appendChild(flagImg);

    countryEl.appendChild(flagWrap);
    countryEl.appendChild(document.createTextNode(nationality.country));
    container.appendChild(countryEl);
};
Core.applyPlayerAvatarBlend = function applyPlayerAvatarBlend(img, src) {
    if (!img) return;
    const s = String(src || '').trim();
    if (typeof ArisanTheSportsDB !== 'undefined' &&
        typeof ArisanTheSportsDB.applyPlayerImgBlend === 'function') {
        ArisanTheSportsDB.applyPlayerImgBlend(img, s);
        return;
    }
    img.classList.remove('player-img-opaque-bg');
};
Core.sortGoldenGloveNominations = function sortGoldenGloveNominations(data) {
    return [...(data || [])].sort((a, b) => {
        const sa = (a.supporters && a.supporters.length) || 0;
        const sb = (b.supporters && b.supporters.length) || 0;
        if (sb !== sa) return sb - sa;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
};
Core.createPlayerPodiumPlace = function createPlayerPodiumPlace(player, icon) {
    const place = document.createElement('div');
    place.className = 'player-podium-place';

    const card = document.createElement('div');
    card.className = 'player-podium-card';
    if (player.eliminated) card.classList.add('no-glow');
    if (player.winner) card.classList.add('golden-glove-winner');

    const info = document.createElement('div');
    info.className = 'player-podium-info';

    if (player.img) {
        const playerImg = document.createElement('img');
        playerImg.className = 'player-podium-img';
        playerImg.src = player.img;
        playerImg.alt = player.name;
        Core.applyPlayerAvatarBlend(playerImg, player.img);
        playerImg.onerror = function() {
            this.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.className = 'player-podium-icon';
            fallback.textContent = icon;
            this.parentNode.insertBefore(fallback, this);
        };
        info.appendChild(playerImg);
    } else {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'player-podium-icon';
        iconSpan.textContent = icon;
        info.appendChild(iconSpan);
    }

    const meta = document.createElement('div');
    meta.className = 'player-podium-meta';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-podium-name';
    nameSpan.textContent = player.name;
    meta.appendChild(nameSpan);
    Core.appendPlayerCountry(meta, player, 'player-podium-country');
    info.appendChild(meta);
    card.appendChild(info);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'podium-supporters-toggle';

    const panel = document.createElement('div');
    panel.className = 'podium-supporters-panel';
    panel.appendChild(Core.createPanelSlideInner());

    Core.bindSupportersToggle(
        btn,
        panel,
        (player.supporters || []).length,
        null,
        function() {
            Core.ensureSupportersPanelFilled(panel, player.supporters || []);
        }
    );

    card.appendChild(Core.createSupportersDrop(btn, panel));
    place.appendChild(card);
    return place;
};
Core.buildPlayerPodium = function buildPlayerPodium(containerId, data, icon) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const sorted = Core.sortGoldenGloveNominations(data);
    const isGoldenGlove = containerId === 'podium-goldenglove-container';
    const winner = isGoldenGlove ? sorted.find(p => p.winner) : null;
    const others = winner ? sorted.filter(p => p !== winner) : sorted;

    if (winner) {
        const winnerRow = document.createElement('div');
        winnerRow.className = 'gg-row gg-row-winner';
        winnerRow.appendChild(Core.createPlayerPodiumPlace(winner, icon));
        container.appendChild(winnerRow);

        if (others.length) {
            const othersRow = document.createElement('div');
            othersRow.className = 'gg-row gg-row-others';
            others.forEach(player => {
                othersRow.appendChild(Core.createPlayerPodiumPlace(player, icon));
            });
            container.appendChild(othersRow);
        }
        if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(container);
        return;
    }

    if (isGoldenGlove) {
        const row = document.createElement('div');
        row.className = 'gg-row';
        sorted.forEach(player => {
            row.appendChild(Core.createPlayerPodiumPlace(player, icon));
        });
        container.appendChild(row);
        if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(container);
        return;
    }

    sorted.forEach(player => {
        container.appendChild(Core.createPlayerPodiumPlace(player, icon));
    });
    if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(container);
};
Core.cancelTotalGoalCurrentLabel = function cancelTotalGoalCurrentLabel(fill) {
    const state = Core.totalGoalLabelAnims.get(fill);
    if (!state) return;
    if (state.raf) cancelAnimationFrame(state.raf);
    Core.totalGoalLabelAnims.delete(fill);
};
Core.syncTotalGoalMarkers = function syncTotalGoalMarkers(fill, goal, phase) {
    const markers = fill && fill._tgMarkers;
    if (!markers || !markers.length) return;
    const closest = new Set(Core.getClosestTotalGoalParticipants(goal));
    const finalResolved = !!fill._tgFinalResolved;
    const mode = phase || 'done';

    markers.forEach(function (m) {
        const isClosest = closest.has(m.name);
        m.info.classList.toggle('glowing', isClosest);

        // Left the participant's wilayah when current goal reaches/passes zone upper bound
        const leftZone = goal >= (m.zoneTo != null ? m.zoneTo : m.goal);

        let shouldEliminate = false;
        if (mode === 'reset' || goal <= 0) {
            // Start of slide: nobody eliminated yet
            shouldEliminate = false;
        } else if (mode === 'slide') {
            // During slide: eliminate only after leaving their wilayah (not just past prediction)
            shouldEliminate = leftZone;
        } else {
            // Slide finished
            if (leftZone) {
                // Left wilayah — stay eliminated (keep closest glowing)
                shouldEliminate = !isClosest;
            } else if (m.goal > goal) {
                // Still ahead of current goal: eliminate only if Final is finished
                shouldEliminate = finalResolved && !isClosest;
            } else {
                shouldEliminate = false;
            }
        }
        m.marker.classList.toggle('eliminated', shouldEliminate);
    });
};
Core.resetTotalGoalCurrentLabel = function resetTotalGoalCurrentLabel(fill) {
    Core.cancelTotalGoalCurrentLabel(fill);
    const indicator = fill && fill._tgIndicator;
    const countEl = fill && fill._tgCountEl;
    if (indicator) {
        indicator.style.transition = 'none';
        indicator.style.top = '0px';
    }
    if (countEl) countEl.textContent = '0';
    Core.syncTotalGoalMarkers(fill, 0, 'reset');
};
Core.finishTotalGoalCurrentLabel = function finishTotalGoalCurrentLabel(fill) {
    Core.cancelTotalGoalCurrentLabel(fill);
    const indicator = fill && fill._tgIndicator;
    const countEl = fill && fill._tgCountEl;
    if (!indicator || !countEl) return;
    const top = parseFloat(fill.dataset.tgTop || '0') || 0;
    const to = parseInt(fill.dataset.tgCountTo || '0', 10) || 0;
    indicator.style.transition = 'none';
    indicator.style.top = top + 'px';
    countEl.textContent = String(to);
    Core.syncTotalGoalMarkers(fill, to, 'done');
};
Core.playTotalGoalCurrentLabel = function playTotalGoalCurrentLabel(fill) {
    const indicator = fill && fill._tgIndicator;
    const countEl = fill && fill._tgCountEl;
    if (!indicator || !countEl) return;

    const toTop = parseFloat(fill.dataset.tgTop || '0') || 0;
    const toCount = parseInt(fill.dataset.tgCountTo || '0', 10) || 0;
    const duration = Core.getBarDurationMs();

    Core.cancelTotalGoalCurrentLabel(fill);

    if (Core.prefersReducedMotion() || toTop <= 0 && toCount <= 0) {
        Core.finishTotalGoalCurrentLabel(fill);
        return;
    }

    indicator.style.transition = 'none';
    indicator.style.top = '0px';
    countEl.textContent = '0';
    Core.syncTotalGoalMarkers(fill, 0, 'reset');
    void indicator.offsetWidth;

    let lastGlowGoal = -1;
    const startedAt = performance.now();
    function frame(now) {
        const t = Math.min(1, (now - startedAt) / duration);
        const e = Core.barEase(t);
        const animatedGoal = Math.round(toCount * e);
        indicator.style.top = (toTop * e) + 'px';
        countEl.textContent = String(animatedGoal);
        if (animatedGoal !== lastGlowGoal) {
            lastGlowGoal = animatedGoal;
            Core.syncTotalGoalMarkers(fill, animatedGoal, 'slide');
        }
        if (t < 1) {
            const raf = requestAnimationFrame(frame);
            Core.totalGoalLabelAnims.set(fill, { raf: raf });
        } else {
            indicator.style.top = toTop + 'px';
            countEl.textContent = String(toCount);
            Core.syncTotalGoalMarkers(fill, toCount, 'done');
            Core.totalGoalLabelAnims.delete(fill);
        }
    }
    const raf = requestAnimationFrame(frame);
    Core.totalGoalLabelAnims.set(fill, { raf: raf });
};
Core.buildGoldenBootChart = function buildGoldenBootChart() {
    const container = document.getElementById('goldenboot-chart');
    if (!container) return;
    container.innerHTML = '';

    // Sort by goals count descending, then name ascending
    const bootData = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.goldenBoot) || [];
    const sorted = [...bootData].sort((a, b) => {
        const diff = b.goals - a.goals;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
    });
    const maxGoals = Math.max(...sorted.map(p => p.goals), 1);

    sorted.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'goldenboot-row';
        if (player.goals === sorted[0].goals) row.classList.add('top-1');

        // Bar area (card + bar)
        const barArea = document.createElement('div');
        barArea.className = 'goldenboot-bar-area';

        // Card (like podium-team-card): info + toggle + panel
        const card = document.createElement('div');
        card.className = 'goldenboot-card';

        // Card info (player name + country)
        const cardInfo = document.createElement('div');
        cardInfo.className = 'goldenboot-card-info';
        const meta = document.createElement('div');
        meta.className = 'goldenboot-player-meta';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'goldenboot-player-name';
        nameSpan.textContent = player.name;
        meta.appendChild(nameSpan);
        Core.appendPlayerCountry(meta, player, 'goldenboot-player-country');
        cardInfo.appendChild(meta);
        card.appendChild(cardInfo);

        // Supporters toggle button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'goldenboot-supporters-btn';

        // Supporters panel
        const panel = document.createElement('div');
        panel.className = 'goldenboot-supporters-panel';
        panel.appendChild(Core.createPanelSlideInner());

        Core.bindSupportersToggle(
            btn,
            panel,
            (player.supporters || []).length,
            null,
            function() {
                Core.ensureSupportersPanelFilled(panel, player.supporters || []);
            }
        );

        card.appendChild(Core.createSupportersDrop(btn, panel));

        // Bar wrapper + bar
        const barWrapper = document.createElement('div');
        barWrapper.className = 'goldenboot-bar-wrapper';
        const bar = document.createElement('div');
        bar.className = 'goldenboot-bar';
        const pct = player.goals > 0
            ? Math.max((player.goals / maxGoals) * 100, 15)
            : 0;
        // Player avatar on the right of the bar; goal label left of avatar (slides with bar)
        const valueSpan = document.createElement('span');
        valueSpan.className = 'goldenboot-value';
        valueSpan.textContent = player.goals === 0
            ? '0'
            : player.goals + (player.goals === 1 ? ' Goal' : ' Goals');
        const playerImg = document.createElement('img');
        playerImg.className = 'goldenboot-avatar';
        playerImg.src = player.img;
        playerImg.alt = player.name;
        Core.applyPlayerAvatarBlend(playerImg, player.img);
        playerImg.onerror = function() { this.style.display = 'none'; };
        bar.appendChild(valueSpan);
        bar.appendChild(playerImg);
        barWrapper.appendChild(bar);

        barArea.appendChild(card);
        barArea.appendChild(barWrapper);
        row.appendChild(barArea);
        container.appendChild(row);
        Core.slideDimension(bar, 'width', pct + '%');
    });
    if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(container);
};
Core.calculateCurrentGoalFromBracket = function calculateCurrentGoalFromBracket() {
    let total = 0;

    // Group stage + knockout (FT+ET). Third-place playoff excluded.
    document.querySelectorAll(
        '.group-stage .matchup.finished, .group-stage .matchup.live, ' +
        '.bracket .matchup.finished, .bracket .matchup.live'
    ).forEach(matchup => {
        if (Core.isThirdPlaceMatchup(matchup)) return;

        matchup.querySelectorAll('.team-score').forEach(scoreEl => {
            total += Core.parseTeamScore(scoreEl.textContent);
        });
    });

    return total;
};
Core.getTotalGoalBarEndValue = function getTotalGoalBarEndValue(currentGoal) {
    const predictions = (Core.totalGoalData || [])
        .map(p => Math.max(0, parseInt(p.goal, 10) || 0));
    const maxPredicted = predictions.length ? Math.max(...predictions) : 0;
    const buffer = Math.max(5, Math.ceil(maxPredicted * 0.1));
    let endValue = maxPredicted + buffer;
    if (currentGoal > endValue) {
        endValue = currentGoal + Math.max(5, Math.ceil(currentGoal * 0.1));
    }
    return Math.max(endValue, 1);
};
Core.getClosestTotalGoalParticipants = function getClosestTotalGoalParticipants(currentGoal) {
    let closestDiff = Infinity;
    const closest = [];
    (Core.totalGoalData || []).forEach(p => {
        if (!p || !p.name) return;
        const diff = Math.abs((parseInt(p.goal, 10) || 0) - currentGoal);
        if (diff < closestDiff) {
            closestDiff = diff;
            closest.length = 0;
            closest.push(p.name);
        } else if (diff === closestDiff) {
            closest.push(p.name);
        }
    });
    return closest;
};
Core.getClosestTotalGoalParticipant = function getClosestTotalGoalParticipant(currentGoal) {
    const closest = Core.getClosestTotalGoalParticipants(currentGoal).slice().sort((a, b) =>
        a.localeCompare(b)
    );
    return closest[0] || '';
};
Core.resolveTotalGoalTrackHeight = function resolveTotalGoalTrackHeight(sorted, startValue, endValue) {
    // Scale the bar taller so every card can sit beside the track (L/R only).
    // Prefer a long page over deep tree columns that need a div horizontal scrollbar.
    const TG_MIN_GAP = 36;
    const minH = 320;
    const range = Math.max(1, (endValue - startValue));
    const left = [];
    const right = [];
    (sorted || []).forEach(function (p, i) {
        (i % 2 !== 0 ? left : right).push(p);
    });

    function needForSide(arr) {
        let h = Math.max(0, arr.length - 1) * TG_MIN_GAP + 48;
        for (let i = 1; i < arr.length; i++) {
            const dg = arr[i].goal - arr[i - 1].goal;
            if (dg > 0) {
                h = Math.max(h, (TG_MIN_GAP * range) / dg);
            } else {
                h = Math.max(h, arr.length * TG_MIN_GAP);
            }
        }
        return h;
    }

    return Math.ceil(Math.max(minH, needForSide(left), needForSide(right)));
};
Core.buildTotalGoalBar = function buildTotalGoalBar() {
    const container = document.getElementById('total-goal-bar');
    if (!container) return;
    container.innerHTML = '';

    const startValue = 0;
    const currentGoal = Core.calculateCurrentGoalFromBracket();
    const endValue = Core.getTotalGoalBarEndValue(currentGoal);
    const finalResolved = Core.isFinalResolved();
    const sorted = [...(Core.totalGoalData || [])].sort((a, b) => a.goal - b.goal);

    const TG_MIN_GAP = 36;
    const TG_STUB = 10;
    const TG_CARD_PAD = 100;

    // Pass 1: place every card beside the bar (L/R), grow height instead of deep columns.
    let trackHeight = Core.resolveTotalGoalTrackHeight(sorted, startValue, endValue);
    const placements = sorted.map(function (p, index) {
        const preferLeft = index % 2 !== 0;
        const pct = ((p.goal - startValue) / (endValue - startValue));
        return {
            name: p.name,
            goal: p.goal,
            index: index,
            side: preferLeft ? 'left' : 'right',
            top: pct * trackHeight,
            zoneFrom: index === 0
                ? startValue
                : (sorted[index - 1].goal + p.goal) / 2,
            zoneTo: index === sorted.length - 1
                ? endValue
                : (p.goal + sorted[index + 1].goal) / 2,
        };
    });

    ['left', 'right'].forEach(function (side) {
        const list = placements.filter(function (p) { return p.side === side; })
            .sort(function (a, b) { return a.top - b.top || a.index - b.index; });
        for (let i = 1; i < list.length; i++) {
            const minTop = list[i - 1].top + TG_MIN_GAP;
            if (list[i].top < minTop) list[i].top = minTop;
        }
        if (list.length) {
            trackHeight = Math.max(
                trackHeight,
                Math.ceil(list[list.length - 1].top + TG_MIN_GAP / 2)
            );
        }
    });

    const participantColors = (window.LEAGUE_DATA && window.LEAGUE_DATA.participantColors) || {
        'Davin': '#3498db',
        'Ndod': '#2ecc71',
        'Khuang': '#f1c40f',
        'Marten': '#9b59b6',
        'Cham': '#e74c3c',
        'Willy': '#e67e22',
        'Wesly': '#00bcd4'
    };

    const vertical = document.createElement('div');
    vertical.className = 'total-goal-vertical';
    vertical.style.setProperty('--tg-branch-pad', (TG_STUB + TG_CARD_PAD) + 'px');

    const track = document.createElement('div');
    track.className = 'total-goal-track-v';
    track.style.height = trackHeight + 'px';

    const goalToPx = function (goal) {
        return ((goal - startValue) / (endValue - startValue)) * trackHeight;
    };

    sorted.forEach(function (p, index) {
        const from = index === 0
            ? startValue
            : (sorted[index - 1].goal + p.goal) / 2;
        const to = index === sorted.length - 1
            ? endValue
            : (p.goal + sorted[index + 1].goal) / 2;

        const segFrom = Math.max(from, currentGoal);
        if (to <= currentGoal || to <= segFrom) return;

        const zone = document.createElement('div');
        zone.className = 'total-goal-zone-v';
        zone.style.top = goalToPx(segFrom) + 'px';
        zone.style.height = (goalToPx(to) - goalToPx(segFrom)) + 'px';
        zone.style.background = participantColors[p.name] || '#555';
        zone.title = p.name + ' (' + Math.ceil(segFrom) + '–' + Math.floor(to) + ')';
        track.appendChild(zone);
    });

    const currentPct = ((currentGoal - startValue) / (endValue - startValue)) * 100;
    const currentTop = goalToPx(currentGoal);
    const fill = document.createElement('div');
    fill.className = 'total-goal-fill-v';
    fill.style.height = '0%';
    fill.style.setProperty('--tg-track-px', trackHeight + 'px');
    track.appendChild(fill);

    const currentIndicator = document.createElement('div');
    currentIndicator.className = 'total-goal-current-indicator';
    currentIndicator.style.top = '0px';
    currentIndicator.setAttribute('title', 'Current goal');

    const countEl = document.createElement('span');
    countEl.className = 'total-goal-current-count';
    countEl.textContent = '0';
    currentIndicator.appendChild(countEl);

    const ballImg = document.createElement('img');
    ballImg.className = 'total-goal-current-ball';
    ballImg.setAttribute('data-league-ball', '');
    ballImg.alt = 'Current goal';
    ballImg.decoding = 'async';
    ballImg.referrerPolicy = 'no-referrer';
    ballImg.src = typeof Core.getBallImageUrl === 'function'
        ? Core.getBallImageUrl()
        : '';
    currentIndicator.appendChild(ballImg);

    track.appendChild(currentIndicator);

    fill._tgIndicator = currentIndicator;
    fill._tgCountEl = countEl;
    fill._tgFinalResolved = finalResolved;
    fill._tgMarkers = [];
    fill.dataset.tgTop = String(currentTop);
    fill.dataset.tgCountTo = String(currentGoal);

    placements.forEach(function (slot) {
        const marker = document.createElement('div');
        marker.className = 'total-goal-marker-v';
        marker.style.top = slot.top + 'px';
        marker.classList.toggle('is-left', slot.side === 'left');
        marker.classList.toggle('is-right', slot.side === 'right');
        marker.dataset.tgSide = slot.side;
        marker.dataset.tgDepth = '0';
        marker.style.zIndex = '20';
        if (slot.side === 'left') {
            marker.style.left = 'auto';
            marker.style.right = 'calc(100% + ' + TG_STUB + 'px)';
            marker.style.flexDirection = 'row-reverse';
        } else {
            marker.style.right = 'auto';
            marker.style.left = 'calc(100% + ' + TG_STUB + 'px)';
            marker.style.flexDirection = 'row';
        }

        const line = document.createElement('div');
        line.className = 'total-goal-marker-line-v';
        line.style.background = participantColors[slot.name] || '#555';
        line.style.width = TG_STUB + 'px';

        const info = document.createElement('div');
        info.className = 'total-goal-marker-info';
        const color = participantColors[slot.name] || '#555';
        info.style.borderColor = color;
        info.style.setProperty('--glow-color', color);

        const avatar = document.createElement('img');
        avatar.className = 'total-goal-marker-avatar-v';
        Core.applyParticipantAvatar(avatar, slot.name);
        avatar.style.borderColor = color;

        const name = document.createElement('span');
        name.className = 'total-goal-marker-name-v';
        name.textContent = slot.name;

        const value = document.createElement('span');
        value.className = 'total-goal-marker-value-v';
        value.textContent = slot.goal;
        value.style.color = color;

        info.appendChild(avatar);
        info.appendChild(name);
        info.appendChild(value);
        marker.appendChild(line);
        marker.appendChild(info);
        track.appendChild(marker);

        fill._tgMarkers.push({
            name: slot.name,
            goal: slot.goal,
            zoneFrom: slot.zoneFrom,
            zoneTo: slot.zoneTo,
            marker: marker,
            info: info,
        });
    });

    Core.slideDimension(fill, 'height', currentPct + '%');

    vertical.appendChild(track);
    container.appendChild(vertical);
    if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(container);
};
Core.applyFinalSideQuestBonuses = function applyFinalSideQuestBonuses(points) {
    const champion = Core.getFinishedMatchTeam('final-0', 'winner');
    const runnerUp = Core.getFinishedMatchTeam('final-0', 'loser');
    const third = Core.getFinishedMatchTeam(Core.THIRD_PLACE_MATCH_ID, 'winner');

    if (champion) {
        Core.awardSideQuestPoints(
            points,
            Core.sideQuestPodium.champion[champion.name]?.supporters,
            Core.pointConfig.sideQuest.champion,
            Core.isSideQuestShareEnabled('champion')
        );
    }
    if (runnerUp) {
        Core.awardSideQuestPoints(
            points,
            Core.sideQuestPodium.runnerup[runnerUp.name]?.supporters,
            Core.pointConfig.sideQuest.runnerup,
            Core.isSideQuestShareEnabled('runnerup')
        );
    }
    if (third && Core.includeThirdPlace) {
        Core.awardSideQuestPoints(
            points,
            Core.sideQuestPodium.third[third.name]?.supporters,
            Core.pointConfig.sideQuest.third,
            Core.isSideQuestShareEnabled('third')
        );
    }
};
Core.applyGoldenBootBonus = function applyGoldenBootBonus(points) {
    const bootData = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.goldenBoot) || [];
    if (!bootData.length) return;

    const maxGoals = Math.max(...bootData.map(p => p.goals || 0));
    if (maxGoals <= 0) return;

    const winners = [];
    bootData
        .filter(p => (p.goals || 0) === maxGoals)
        .forEach(player => {
            (player.supporters || []).forEach(name => winners.push(name));
        });
    Core.awardSideQuestPoints(
        points,
        winners,
        Core.pointConfig.sideQuest.goldenBoot,
        Core.isSideQuestShareEnabled('goldenBoot')
    );
};
Core.applyGoldenGloveBonus = function applyGoldenGloveBonus(points) {
    const gloveData = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.goldenGlove) || [];
    const winners = [];
    gloveData
        .filter(p => p.winner)
        .forEach(player => {
            (player.supporters || []).forEach(name => winners.push(name));
        });
    Core.awardSideQuestPoints(
        points,
        winners,
        Core.pointConfig.sideQuest.goldenGlove,
        Core.isSideQuestShareEnabled('goldenGlove')
    );
};
Core.applyTotalGoalBonus = function applyTotalGoalBonus(points) {
    const currentGoal = typeof Core.calculateCurrentGoalFromBracket === 'function'
        ? Core.calculateCurrentGoalFromBracket()
        : 0;

    Core.awardSideQuestPoints(
        points,
        Core.getClosestTotalGoalParticipants(currentGoal),
        Core.pointConfig.sideQuest.totalGoal,
        Core.isSideQuestShareEnabled('totalGoal')
    );
};
Core.applyScorePredictBonus = function applyScorePredictBonus(points) {
    const amount = Core.pointConfig.sideQuest.scorePredict;
    if (amount == null) return;
    const share = Core.isSideQuestShareEnabled('scorePredict');

    document.querySelectorAll(
        '.bracket .matchup.finished, .group-stage .matchup.finished'
    ).forEach(matchup => {
        const matchId = matchup.dataset.matchId;
        if (!matchId) return;
        const teams = matchup.querySelectorAll(':scope > .team');
        if (teams.length !== 2) return;
        const actualA = Core.parseFullTimeScore(teams[0].querySelector('.team-score')?.textContent);
        const actualB = Core.parseFullTimeScore(teams[1].querySelector('.team-score')?.textContent);
        if (actualA == null || actualB == null) return;

        const winners = Core.getScorePredictionsForMatch(matchId)
            .filter(p => p.a === actualA && p.b === actualB)
            .map(p => p.name);
        Core.awardSideQuestPoints(points, winners, amount, share);
    });
};
})(window.ArisanLeagueApp);
