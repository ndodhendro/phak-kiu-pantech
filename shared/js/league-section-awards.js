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

    document.querySelectorAll('.bracket .matchup.finished, .bracket .matchup.live').forEach(matchup => {
        // Perebutan juara 3 tidak masuk current goal
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
Core.buildTotalGoalBar = function buildTotalGoalBar() {
    const container = document.getElementById('total-goal-bar');
    if (!container) return;
    container.innerHTML = '';

    const startValue = 0;
    const currentGoal = Core.calculateCurrentGoalFromBracket();
    const endValue = Core.getTotalGoalBarEndValue(currentGoal);
    const finalResolved = Core.isFinalResolved();
    const trackHeight = 500; // Total height of the track in px

    // Adjustable spacing offsets (in px from calculated position)
    // Positive = move down, Negative = move up
    const markerOffsets = {
        'Marten': 0,    // 57 goals
        'Davin': 0,     // 71 goals
        'Willy': 0,     // 81 goals
        'Ndod': 0,      // 82 goals
        'Khuang': 0,    // 88 goals
        'Wesly': 0,     // 93 goals
        'Cham': 0       // 117 goals
    };

    // Match standings points bar colors
    const participantColors = (window.LEAGUE_DATA && window.LEAGUE_DATA.participantColors) || {
        'Davin': '#3498db',
        'Ndod': '#2ecc71',
        'Khuang': '#f1c40f',
        'Marten': '#9b59b6',
        'Cham': '#e74c3c',
        'Willy': '#e67e22',
        'Wesly': '#00bcd4'
    };

    // Create vertical structure
    const vertical = document.createElement('div');
    vertical.className = 'total-goal-vertical';

    const track = document.createElement('div');
    track.className = 'total-goal-track-v';
    track.style.height = trackHeight + 'px';

    const goalToPx = (goal) =>
        ((goal - startValue) / (endValue - startValue)) * trackHeight;

    const sorted = [...totalGoalData].sort((a, b) => a.goal - b.goal);

    // Wilayah di atas currentGoal: tiap segmen midpoint antar prediksi
    // diwarnai sesuai warna peserta arisan
    sorted.forEach((p, index) => {
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

    // Fill to current goal position (heatmap gradient maps to full track height)
    const currentPct = ((currentGoal - startValue) / (endValue - startValue)) * 100;
    const fill = document.createElement('div');
    fill.className = 'total-goal-fill-v';
    fill.style.height = '0%';
    fill.style.setProperty('--tg-track-px', trackHeight + 'px');
    track.appendChild(fill);

    // End label
    const endLabel = document.createElement('span');
    endLabel.className = 'total-goal-end-label';
    endLabel.textContent = endValue;
    track.appendChild(endLabel);

    // Current goal indicator (slides + counts with fill)
    const currentTop = ((currentGoal - startValue) / (endValue - startValue)) * trackHeight;
    const currentIndicator = document.createElement('div');
    currentIndicator.className = 'total-goal-current-indicator';
    currentIndicator.style.top = '0px';

    const countEl = document.createElement('span');
    countEl.className = 'total-goal-current-count';
    countEl.textContent = '0';
    currentIndicator.appendChild(countEl);

    const currentLine = document.createElement('div');
    currentIndicator.appendChild(currentLine);

    const currentLabel = document.createElement('span');
    currentLabel.className = 'total-goal-current-label-v';
    currentLabel.textContent = '';
    currentIndicator.appendChild(currentLabel);

    track.appendChild(currentIndicator);

    fill._tgIndicator = currentIndicator;
    fill._tgCountEl = countEl;
    fill._tgFinalResolved = finalResolved;
    fill._tgMarkers = [];
    fill.dataset.tgTop = String(currentTop);
    fill.dataset.tgCountTo = String(currentGoal);

    // Sebelum Final: eliminasi progresif bila skor aktual keluar dari wilayah peserta.
    // Setelah Final: hanya peserta terdekat (glowing) yang tersisa; sisanya eliminated.
    // Glow bergantian mengikuti nilai current goal selama sliding.
    sorted.forEach((p, index) => {
        const zoneFrom = index === 0
            ? startValue
            : (sorted[index - 1].goal + p.goal) / 2;
        const zoneTo = index === sorted.length - 1
            ? endValue
            : (p.goal + sorted[index + 1].goal) / 2;

        const pct = ((p.goal - startValue) / (endValue - startValue));
        const baseTop = pct * trackHeight;
        const offset = markerOffsets[p.name] || 0;
        const finalTop = baseTop + offset;

        const marker = document.createElement('div');
        marker.className = 'total-goal-marker-v';
        marker.style.top = finalTop + 'px';

        // Index ganjil di kiri, selain itu di kanan
        if (index % 2 !== 0) {
            marker.style.right = 'auto';
            marker.style.left = '10px';
            marker.style.flexDirection = 'row';
        }

        const line = document.createElement('div');
        line.className = 'total-goal-marker-line-v';
        line.style.background = participantColors[p.name] || '#555';

        const info = document.createElement('div');
        info.className = 'total-goal-marker-info';
        const color = participantColors[p.name] || '#555';
        info.style.borderColor = color;
        info.style.setProperty('--glow-color', color);

        const avatar = document.createElement('img');
        avatar.className = 'total-goal-marker-avatar-v';
        Core.applyParticipantAvatar(avatar, p.name);
        avatar.style.borderColor = color;

        const name = document.createElement('span');
        name.className = 'total-goal-marker-name-v';
        name.textContent = p.name;

        const value = document.createElement('span');
        value.className = 'total-goal-marker-value-v';
        value.textContent = p.goal;
        value.style.color = color;

        info.appendChild(avatar);
        info.appendChild(name);
        info.appendChild(value);
        marker.appendChild(line);
        marker.appendChild(info);
        track.appendChild(marker);

        fill._tgMarkers.push({
            name: p.name,
            goal: p.goal,
            zoneFrom: zoneFrom,
            zoneTo: zoneTo,
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
