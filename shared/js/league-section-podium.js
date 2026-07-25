/**
 * League detail — side quest / main quest podium UI
 * Split from bracket-app.js — shared ArisanLeagueApp core.
 */
(function (Core) {
'use strict';

Core.getTeamFlagCode = function getTeamFlagCode(teamEl) {
    const flagImg = teamEl.querySelector('.team-flag img');
    if (!flagImg) return null;
    return Core.parseFlagCodeFromSrc(flagImg.getAttribute('src') || '');
};
Core.getThirdPlaceContenders = function getThirdPlaceContenders() {
    const names = new Set();
    const flags = new Set();
    const thirdTie = Core.getTieElement('third-0');
    const thirdMatchup = thirdTie ? Core.getTieLeg1(thirdTie) : document.querySelector('[data-match-id="third-0"]');
    const ongoing = thirdTie
        ? !Core.isTieResolved('third-0')
        : !!(thirdMatchup && !thirdMatchup.classList.contains('finished'));

    if (!ongoing) return { names, flags, ongoing: false };

    const addContender = (teamName, flagCode) => {
        if (teamName && teamName !== 'TBD') names.add(teamName);
        if (flagCode) flags.add(flagCode);
    };

    if (thirdMatchup) {
        thirdMatchup.querySelectorAll(':scope > .team').forEach(teamEl => {
            addContender(
                teamEl.querySelector('.team-name')?.textContent.trim(),
                Core.getTeamFlagCode(teamEl)
            );
        });
    }

    document.querySelectorAll('.round-sf .matchup-tie, .round-sf .round-matches > .matchup.finished').forEach(unit => {
        const loser = typeof Core.getBracketUnitLoser === 'function' ? Core.getBracketUnitLoser(unit) : null;
        if (!loser) return;
        const flagCode = Core.parseFlagCodeFromSrc(loser.flagSrc || '');
        addContender(loser.name, flagCode);
    });

    return { names, flags, ongoing: true };
};
Core.getEliminatedFromBracket = function getEliminatedFromBracket() {
    const names = new Set();
    const flags = new Set();
    const pendingThird = Core.getThirdPlaceContenders();

    const addEliminated = (teamName, flagCode) => {
        if (!teamName || teamName === 'TBD') return;
        if (pendingThird.names.has(teamName) || (flagCode && pendingThird.flags.has(flagCode))) return;
        names.add(teamName);
        if (flagCode) flags.add(flagCode);
    };

    if (Core.isTwoLegKnockout()) {
        document.querySelectorAll('.bracket .matchup-tie').forEach(tieEl => {
            const tieId = tieEl.dataset.tieId;
            if (!tieId || !Core.isTieResolved(tieId)) return;
            const loser = Core.getTieLoserTeamData(tieEl);
            if (!loser) return;
            const flagCode = Core.parseFlagCodeFromSrc(loser.flagSrc || '');
            addEliminated(loser.name, flagCode);
        });
        return { names, flags };
    }

    document.querySelectorAll('.bracket .matchup.finished').forEach(matchup => {
        matchup.querySelectorAll(':scope > .team').forEach(teamEl => {
            if (teamEl.classList.contains('winner')) return;

            const teamName = teamEl.querySelector('.team-name')?.textContent.trim();
            if (!teamName || teamName === 'TBD') return;

            const flagCode = Core.getTeamFlagCode(teamEl);
            if (pendingThird.names.has(teamName) || (flagCode && pendingThird.flags.has(flagCode))) {
                return;
            }

            names.add(teamName);
            if (flagCode) flags.add(flagCode);
        });
    });

    return { names, flags };
};
Core.mainQuestTeamMatchesResult = function mainQuestTeamMatchesResult(teamName, resultTeam, flagCodes) {
    if (!resultTeam) return false;
    if (resultTeam.name === teamName) return true;

    const flag = flagCodes[teamName];
    if (!flag) return false;

    const resultCode = Core.parseFlagCodeFromSrc(resultTeam.flagSrc || '');
    return !!(resultCode && resultCode === flag);
};
Core.mainQuestTeamInSet = function mainQuestTeamInSet(teamName, names, flags, flagCodes) {
    if (names.has(teamName)) return true;
    const flag = flagCodes[teamName];
    return !!(flag && flags.has(flag));
};
Core.podiumTeamMatchesResult = function podiumTeamMatchesResult(teamName, info, resultTeam) {
    if (!resultTeam) return false;
    if (resultTeam.name === teamName) return true;

    const resultCode = Core.parseFlagCodeFromSrc(resultTeam.flagSrc || '');
    return !!(resultCode && resultCode === info.flag);
};
Core.podiumTeamInMatchup = function podiumTeamInMatchup(teamName, info, matchId) {
    if (Core.isTwoLegKnockout()) {
        const tieEl = Core.getTieElement(matchId);
        const leg1 = Core.getTieLeg1(tieEl);
        if (!leg1) return false;
        return Array.from(leg1.querySelectorAll(':scope > .team')).some(teamEl => {
            const name = teamEl.querySelector('.team-name')?.textContent.trim();
            if (!name || name === 'TBD') return false;
            if (name === teamName) return true;
            const flagCode = Core.getTeamFlagCode(teamEl);
            return !!(flagCode && flagCode === info.flag);
        });
    }

    const matchup = document.querySelector('[data-match-id="' + matchId + '"]');
    if (!matchup) return false;

    return Array.from(matchup.querySelectorAll(':scope > .team')).some(teamEl => {
        const name = teamEl.querySelector('.team-name')?.textContent.trim();
        if (!name || name === 'TBD') return false;
        if (name === teamName) return true;
        const flagCode = Core.getTeamFlagCode(teamEl);
        return !!(flagCode && flagCode === info.flag);
    });
};
Core.isPodiumTeamFinalist = function isPodiumTeamFinalist(teamName, info) {
    if (Core.podiumTeamInMatchup(teamName, info, 'final-0')) return true;

    const sfUnits = document.querySelectorAll('.round-sf .matchup-tie, .round-sf .round-matches > .matchup.finished');
    return Array.from(sfUnits).some(unit => {
        const winner = typeof Core.getBracketUnitWinner === 'function' ? Core.getBracketUnitWinner(unit) : null;
        return Core.podiumTeamMatchesResult(teamName, info, winner);
    });
};
Core.isPodiumTeamInThirdPlace = function isPodiumTeamInThirdPlace(teamName, info) {
    if (Core.podiumTeamInMatchup(teamName, info, 'third-0')) return true;

    const sfUnits = document.querySelectorAll('.round-sf .matchup-tie, .round-sf .round-matches > .matchup.finished');
    return Array.from(sfUnits).some(unit => {
        const loser = typeof Core.getBracketUnitLoser === 'function' ? Core.getBracketUnitLoser(unit) : null;
        return Core.podiumTeamMatchesResult(teamName, info, loser);
    });
};
Core.isPodiumTeamMatchLoser = function isPodiumTeamMatchLoser(teamName, info, matchup) {
    const tieEl = matchup.closest('.matchup-tie');
    if (tieEl && Core.isTwoLegKnockout()) {
        if (!Core.isTieResolved(tieEl.dataset.tieId)) return false;
        const loser = Core.getTieLoserTeamData(tieEl);
        return Core.podiumTeamMatchesResult(teamName, info, loser);
    }
    const loser = typeof Core.getMatchupLoser === 'function' ? Core.getMatchupLoser(matchup) : null;
    return Core.podiumTeamMatchesResult(teamName, info, loser);
};
Core.isPodiumTeamKnockedOut = function isPodiumTeamKnockedOut(teamName, info) {
    if (Core.isTwoLegKnockout()) {
        return Array.from(document.querySelectorAll('.bracket .matchup-tie')).some(tieEl => {
            const tieId = tieEl.dataset.tieId;
            if (!tieId || !Core.isTieResolved(tieId)) return false;
            const loser = Core.getTieLoserTeamData(tieEl);
            return Core.podiumTeamMatchesResult(teamName, info, loser);
        });
    }
    return Array.from(document.querySelectorAll('.bracket .matchup.finished')).some(matchup => {
        return Core.isPodiumTeamMatchLoser(teamName, info, matchup);
    });
};
Core.isPodiumTeamKnockedOutBeforeSf = function isPodiumTeamKnockedOutBeforeSf(teamName, info) {
    if (Core.isTwoLegKnockout()) {
        return Array.from(document.querySelectorAll('.bracket .matchup-tie')).some(tieEl => {
            const tieId = tieEl.dataset.tieId || '';
            if (tieId.startsWith('sf-') || tieId.startsWith('final-0') || tieId.startsWith('third-0')) return false;
            if (tieEl.closest('[data-semifinal-round="true"]')) return false;
            if (!Core.isTieResolved(tieId)) return false;
            const loser = Core.getTieLoserTeamData(tieEl);
            return Core.podiumTeamMatchesResult(teamName, info, loser);
        });
    }
    return Array.from(document.querySelectorAll('.bracket .matchup.finished')).some(matchup => {
        const matchId = matchup.dataset.matchId || '';
        if (matchId.startsWith('sf-') || matchId.startsWith('final-0') || matchId.startsWith('third-0')) return false;
        if (matchup.closest('[data-semifinal-round="true"]')) return false;
        return Core.isPodiumTeamMatchLoser(teamName, info, matchup);
    });
};
Core.updateSideQuestEliminatedStatus = function updateSideQuestEliminatedStatus() {
    // Default: semua glowing. Matikan glow sesuai status bracket per kolom.
    const finalFinished = Core.isFinalResolved();
    const thirdFinished = Core.isThirdPlaceResolved();
    const champion = typeof Core.getFinishedMatchTeam === 'function'
        ? Core.getFinishedMatchTeam('final-0', 'winner')
        : null;
    const runnerUp = typeof Core.getFinishedMatchTeam === 'function'
        ? Core.getFinishedMatchTeam('final-0', 'loser')
        : null;
    const thirdWinner = typeof Core.getFinishedMatchTeam === 'function'
        ? Core.getFinishedMatchTeam('third-0', 'winner')
        : null;

    Object.entries(Core.sideQuestPodium.champion).forEach(([name, info]) => {
        if (finalFinished) {
            // Setelah Final: hanya juara yang glowing
            info.eliminated = !Core.podiumTeamMatchesResult(name, info, champion);
            return;
        }
        // Gugur atau masuk perebutan juara 3 → tidak glowing
        info.eliminated = Core.isPodiumTeamKnockedOut(name, info) || Core.isPodiumTeamInThirdPlace(name, info);
    });

    Object.entries(Core.sideQuestPodium.runnerup).forEach(([name, info]) => {
        if (finalFinished) {
            // Setelah Final: hanya runner-up (kalah Final) yang glowing
            info.eliminated = !Core.podiumTeamMatchesResult(name, info, runnerUp);
            return;
        }
        // Gugur atau masuk perebutan juara 3 → tidak glowing
        info.eliminated = Core.isPodiumTeamKnockedOut(name, info) || Core.isPodiumTeamInThirdPlace(name, info);
    });

    Object.entries(Core.sideQuestPodium.third).forEach(([name, info]) => {
        if (thirdFinished) {
            // Setelah perebutan juara 3: hanya pemenang yang glowing
            info.eliminated = !Core.podiumTeamMatchesResult(name, info, thirdWinner);
            return;
        }
        // Sudah lolos Final → tidak glowing di 3rd Place
        if (Core.isPodiumTeamFinalist(name, info)) {
            info.eliminated = true;
            return;
        }
        // Sudah di slot perebutan juara 3 → tetap glowing
        if (Core.isPodiumTeamInThirdPlace(name, info)) {
            info.eliminated = false;
            return;
        }
        // Gugur sebelum SF → tidak glowing; selain itu default glowing
        info.eliminated = Core.isPodiumTeamKnockedOutBeforeSf(name, info);
    });
};
Core.updateMainQuestEliminatedStatus = function updateMainQuestEliminatedStatus() {
    const { names, flags } = Core.getEliminatedFromBracket();
    const groupEliminated = typeof Core.getMathematicallyEliminatedGroupTeams === 'function'
        ? Core.getMathematicallyEliminatedGroupTeams()
        : [];
    const groupElimSet = new Set(groupEliminated);
    const pendingThird = Core.getThirdPlaceContenders();
    const tables = document.querySelectorAll(
        '#main-quest-table-root .standings-table, #main-quest-group-root .standings-table, #main-quest-knockout-root .standings-table'
    );
    if (!tables.length) return;

    const mainQuestTeamFlagCodes = {};
    (window.LEAGUE_DATA?.teams || []).forEach(t => {
        if (t.name && t.flag) mainQuestTeamFlagCodes[t.name] = t.flag.toLowerCase();
    });
    if (!Object.keys(mainQuestTeamFlagCodes).length) {
        Object.assign(mainQuestTeamFlagCodes, { 'France': 'fr', 'Algeria': 'dz' });
    }

    const champion = typeof Core.getFinishedMatchTeam === 'function'
        ? Core.getFinishedMatchTeam('final-0', 'winner')
        : null;
    const runnerUp = typeof Core.getFinishedMatchTeam === 'function'
        ? Core.getFinishedMatchTeam('final-0', 'loser')
        : null;
    const thirdWinner = typeof Core.getFinishedMatchTeam === 'function'
        ? Core.getFinishedMatchTeam('third-0', 'winner')
        : null;

    const statusClasses = ['eliminated', 'mq-gold', 'mq-silver', 'mq-bronze'];
    const podiumPhase = Core.isMainQuestPodiumPhaseActive();

    tables.forEach((table) => {
        const stageBlock = table.closest('[data-mq-stage]');
        const stage = stageBlock ? stageBlock.getAttribute('data-mq-stage') : '';
        const allowPodiumMedals = stage === 'knockout' || stage === 'legacy' || !stage;
        const applyGroupMathElim = stage === 'group' || stage === 'legacy';

        table.querySelectorAll('tbody td.mq-pot-cell').forEach(cell => {
            if (cell.classList.contains('mq-pot-empty')) return;
            const teamName = cell.textContent.trim();
            if (!teamName) return;
            const isPot1 = cell.classList.contains('pot1');
            cell.classList.remove(...statusClasses);

            if (isPot1 && podiumPhase && allowPodiumMedals) {
                if (Core.mainQuestTeamMatchesResult(teamName, champion, mainQuestTeamFlagCodes)) {
                    cell.classList.add('mq-gold');
                    return;
                }
                if (Core.mainQuestTeamMatchesResult(teamName, runnerUp, mainQuestTeamFlagCodes)) {
                    cell.classList.add('mq-silver');
                    return;
                }
                if (Core.mainQuestTeamMatchesResult(teamName, thirdWinner, mainQuestTeamFlagCodes)) {
                    cell.classList.add('mq-bronze');
                    return;
                }
                if (Core.mainQuestTeamInSet(teamName, pendingThird.names, pendingThird.flags, mainQuestTeamFlagCodes)) {
                    cell.classList.add('mq-bronze');
                    return;
                }
            }

            if (Core.mainQuestTeamInSet(teamName, names, flags, mainQuestTeamFlagCodes)) {
                cell.classList.add('eliminated');
                return;
            }

            if (applyGroupMathElim && groupElimSet.has(teamName)) {
                cell.classList.add('eliminated');
                return;
            }

            if (isPot1 && podiumPhase && allowPodiumMedals) {
                cell.classList.add('mq-gold');
            }
        });

        Core.updateMainQuestBatteries(table);
    });
};
Core.getBatteryFillColor = function getBatteryFillColor(ratio) {
    // Green (120) when full → red (0) when empty
    const hue = Math.round(Math.max(0, Math.min(1, ratio)) * 120);
    return {
        solid: `hsla(${hue}, 72%, 42%, 0.72)`,
        soft: `hsla(${hue}, 80%, 58%, 0.45)`,
        border: `hsla(${hue}, 70%, 55%, 0.55)`,
        glow: `hsla(${hue}, 70%, 50%, 0.35)`,
    };
};
Core.updateMainQuestBatteries = function updateMainQuestBatteries(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const standingsPoints = Core.calculateStandingsPointsFromBracket();
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const rowStats = rows.map(row => {
        const teamCells = row.querySelectorAll('td.mq-pot-cell');
        const total = teamCells.length;
        let alive = 0;
        teamCells.forEach(cell => {
            if (!cell.classList.contains('eliminated')) alive += 1;
        });
        const name = row.querySelector('.participant-name-battery strong')?.textContent.trim() || '';
        const points = standingsPoints[name] ?? 0;
        return { row, alive, total, name, points };
    });

    rowStats.forEach(({ row, alive, total }) => {
        const battery = row.querySelector('.participant-name-battery');
        const fill = row.querySelector('.participant-battery-fill');
        if (!battery || !fill) return;

        const ratio = total > 0 ? alive / total : 0;
        const pct = Math.round(ratio * 100);

        Core.slideDimension(fill, 'width', pct + '%');

        if (alive === 0) {
            battery.classList.add('is-empty');
            fill.style.background = 'transparent';
            battery.style.borderColor = 'rgba(255, 255, 255, 0.35)';
            battery.style.boxShadow = 'none';
        } else {
            battery.classList.remove('is-empty');
            const colors = Core.getBatteryFillColor(ratio);
            fill.style.background = `linear-gradient(90deg, ${colors.soft} 0%, ${colors.solid} 100%)`;
            battery.style.borderColor = colors.border;
            battery.style.boxShadow = `0 0 8px ${colors.glow}`;
        }

        battery.title = alive + '/' + total + ' countries still supported';
        row.dataset.batteryAlive = String(alive);
    });

    // Sort: most battery first; tie-break by standings points (desc), then name
    rowStats.sort((a, b) => {
        if (b.alive !== a.alive) return b.alive - a.alive;
        if (b.points !== a.points) return b.points - a.points;
        return a.name.localeCompare(b.name);
    });

    rowStats.forEach(({ row }) => {
        tbody.appendChild(row);
    });
};
Core.buildPodiumCards = function buildPodiumCards(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    let winnerTeam = null;
    if (containerId === 'podium-champion' && Core.isFinalResolved()) {
        winnerTeam = Core.getFinishedMatchTeam('final-0', 'winner');
    } else if (containerId === 'podium-runnerup' && Core.isFinalResolved()) {
        winnerTeam = Core.getFinishedMatchTeam('final-0', 'loser');
    } else if (containerId === 'podium-3rd' && Core.isThirdPlaceResolved()) {
        winnerTeam = Core.getFinishedMatchTeam('third-0', 'winner');
    }

    const sortBySupportersThenName = (entries) => entries.slice().sort((a, b) => {
        const sa = (a[1].supporters && a[1].supporters.length) || 0;
        const sb = (b[1].supporters && b[1].supporters.length) || 0;
        if (sb !== sa) return sb - sa;
        return a[0].localeCompare(b[0], 'id');
    });

    const entries = Object.entries(data || {});
    const winnerEntry = winnerTeam
        ? entries.find(([name, info]) => Core.podiumTeamMatchesResult(name, info, winnerTeam))
        : null;

    function appendPodiumCard(parent, team, info) {
        const card = document.createElement('div');
        card.className = 'podium-team-card';
        if (info.eliminated) card.classList.add('no-glow');

        const teamInfo = document.createElement('div');
        teamInfo.className = 'podium-team-info';
        const flagWrap = document.createElement('span');
        flagWrap.className = 'flag-wave';
        const flagImg = document.createElement('img');
        flagImg.src = Core.countryFlagSrc(info.flag);
        flagImg.alt = team;
        flagWrap.appendChild(flagImg);
        const nameSpan = document.createElement('span');
        nameSpan.textContent = team;
        teamInfo.appendChild(flagWrap);
        teamInfo.appendChild(nameSpan);
        card.appendChild(teamInfo);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'podium-supporters-toggle';

        const panel = document.createElement('div');
        panel.className = 'podium-supporters-panel';
        panel.appendChild(Core.createPanelSlideInner());

        Core.bindSupportersToggle(
            btn,
            panel,
            (info.supporters || []).length,
            null,
            function() {
                Core.ensureSupportersPanelFilled(panel, info.supporters || []);
            }
        );

        card.appendChild(Core.createSupportersDrop(btn, panel));
        parent.appendChild(card);
    }

    if (winnerEntry) {
        const winnerRow = document.createElement('div');
        winnerRow.className = 'podium-teams-row podium-teams-row-winner';
        appendPodiumCard(winnerRow, winnerEntry[0], winnerEntry[1]);
        container.appendChild(winnerRow);

        const others = sortBySupportersThenName(
            entries.filter(([name]) => name !== winnerEntry[0])
        );
        if (others.length) {
            const othersRow = document.createElement('div');
            othersRow.className = 'podium-teams-row podium-teams-row-others';
            others.forEach(([team, info]) => appendPodiumCard(othersRow, team, info));
            container.appendChild(othersRow);
        }
        if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(container);
        return;
    }

    const row = document.createElement('div');
    row.className = 'podium-teams-row';
    sortBySupportersThenName(entries).forEach(([team, info]) => {
        appendPodiumCard(row, team, info);
    });
    container.appendChild(row);
    if (typeof Core.observeAnimPauseTargets === 'function') Core.observeAnimPauseTargets(container);
};
})(window.ArisanLeagueApp);
