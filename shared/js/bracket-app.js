
        function splitLegacyScoreString(scoreStr) {
            const text = String(scoreStr ?? '').trim();
            const m = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
            if (m) {
                return { ft: parseInt(m[1], 10), et: parseInt(m[2], 10) };
            }
            const n = parseInt(text, 10);
            return { ft: Number.isNaN(n) ? 0 : n, et: 0 };
        }

        function getMatchScoreParts(match) {
            const scores = match?.scores;
            if (scores && typeof scores === 'object' && !Array.isArray(scores)) {
                const toNum = v => {
                    const n = parseInt(String(v ?? ''), 10);
                    return Number.isNaN(n) ? 0 : Math.max(0, n);
                };
                return {
                    ft: [toNum(scores.ft?.[0]), toNum(scores.ft?.[1])],
                    et: [toNum(scores.et?.[0]), toNum(scores.et?.[1])],
                };
            }
            const legacy0 = splitLegacyScoreString(scores?.[0]);
            const legacy1 = splitLegacyScoreString(scores?.[1]);
            return {
                ft: [legacy0.ft, legacy1.ft],
                et: [legacy0.et, legacy1.et],
            };
        }

        function formatScoreForDisplay(ft, et, showExtraTimeFormat) {
            const fullTime = Math.max(0, parseInt(ft, 10) || 0);
            const extraTime = Math.max(0, parseInt(et, 10) || 0);
            if (showExtraTimeFormat || extraTime > 0) {
                return fullTime + ' (' + extraTime + ')';
            }
            return String(fullTime);
        }

        function resolveFinishedWinnerIndex(match) {
            const explicit = parseInt(match?.winner, 10);
            if (explicit === 0 || explicit === 1) return explicit;

            // Fallback: tentukan pemenang dari skor jika admin lupa pilih winner.
            const parts = getMatchScoreParts(match);
            const total0 = parts.ft[0] + parts.et[0];
            const total1 = parts.ft[1] + parts.et[1];
            if (total0 > total1) return 0;
            if (total1 > total0) return 1;
            return null;
        }

        function applyAdminConfig() {
            if (!window.ADMIN_CONFIG) return;

            const lastUpdatedEl = document.querySelector('.last-updated');
            if (lastUpdatedEl && ADMIN_CONFIG.lastUpdated) {
                lastUpdatedEl.textContent = 'Last updated: ' + ADMIN_CONFIG.lastUpdated;
            }

            (ADMIN_CONFIG.finishedMatches || []).forEach(match => {
                const el = document.querySelector('[data-match-id="' + match.id + '"]');
                if (!el) return;

                const status = match.status || 'finished';
                const teams = el.querySelectorAll(':scope > .team');
                const dateEl = el.querySelector('.matchup-date');
                const scoreParts = getMatchScoreParts(match);
                const hasExtraTime = scoreParts.et[0] > 0 || scoreParts.et[1] > 0;
                const displayScores = [
                    formatScoreForDisplay(scoreParts.ft[0], scoreParts.et[0], hasExtraTime),
                    formatScoreForDisplay(scoreParts.ft[1], scoreParts.et[1], hasExtraTime),
                ];

                displayScores.forEach((score, i) => {
                    if (!teams[i]) return;
                    let scoreEl = teams[i].querySelector('.team-score');
                    if (!scoreEl) {
                        scoreEl = document.createElement('span');
                        scoreEl.className = 'team-score';
                        teams[i].appendChild(scoreEl);
                    }
                    scoreEl.textContent = score;
                    teams[i].classList.remove('winner');
                });

                el.classList.remove('tbd', 'today', 'live', 'waiting-admin', 'finished');
                if (typeof setLiveBadge === 'function') setLiveBadge(dateEl, false);
                if (typeof setSoonBadge === 'function') setSoonBadge(dateEl, false);
                if (typeof setWaitingAdminBadge === 'function') setWaitingAdminBadge(dateEl, false);

                if (status === 'finished') {
                    // Hanya finished yang di-freeze dari timer schedule
                    el.dataset.adminManaged = 'true';
                    const winnerIdx = resolveFinishedWinnerIndex(match);
                    if (winnerIdx !== null && teams[winnerIdx]) {
                        teams[winnerIdx].classList.add('winner');
                    }
                    el.classList.add('finished');
                    delete el.dataset.liveUrl;
                    el.removeAttribute('title');
                } else if (status === 'live') {
                    // live / waiting-admin tetap bisa di-advance timer
                    delete el.dataset.adminManaged;
                    el.classList.add('live');
                    if (typeof setLiveBadge === 'function') setLiveBadge(dateEl, true);
                    if (typeof LIVE_STREAM_URL !== 'undefined') {
                        el.dataset.liveUrl = LIVE_STREAM_URL;
                    }
                    el.title = 'Tonton live';
                } else if (status === 'waiting-admin') {
                    delete el.dataset.adminManaged;
                    el.classList.add('waiting-admin');
                    if (typeof setWaitingAdminBadge === 'function') setWaitingAdminBadge(dateEl, true);
                    delete el.dataset.liveUrl;
                    el.removeAttribute('title');
                }
            });

            if (isTwoLegKnockout() && typeof ArisanBracket !== 'undefined') {
                ArisanBracket.updateTieAggregates(ADMIN_CONFIG.finishedMatches || []);
            }

            if (typeof buildTotalGoalBar === 'function') {
                buildTotalGoalBar();
            }
        }
    

/* --- */


        function getBracketUnitLineAnchor(unitEl, bracketRect) {
            const r = unitEl.getBoundingClientRect();
            return {
                x: r.right - bracketRect.left,
                y: r.top + r.height / 2 - bracketRect.top,
            };
        }

        function resolveBracketLineSource(prevRoundEl, units, winnerIndex) {
            const hasByeCarrier = !!prevRoundEl.dataset.koByeCarrier;
            if (hasByeCarrier && winnerIndex === 0) {
                return null;
            }
            const unitIndex = hasByeCarrier ? winnerIndex - 1 : winnerIndex;
            return units[unitIndex] || null;
        }

        function drawByeAdvanceLine(svg, bracketRect, sourceEl, nextRoundEl, nextUnits) {
            if (!sourceEl) return;
            const src = getBracketUnitLineAnchor(sourceEl, bracketRect);
            const nextRect = nextRoundEl.getBoundingClientRect();
            const targetX = nextRect.left - bracketRect.left;
            let targetY;
            if (nextUnits.length) {
                const firstRect = nextUnits[0].getBoundingClientRect();
                targetY = firstRect.top - bracketRect.top - 6;
            } else {
                targetY = nextRect.top + nextRect.height * 0.2 - bracketRect.top;
            }
            const midX = (src.x + targetX) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M${src.x},${src.y} H${midX} V${targetY} H${targetX}`);
            path.setAttribute('stroke', '#666');
            path.setAttribute('stroke-width', '1.5');
            path.setAttribute('stroke-dasharray', '4 3');
            path.setAttribute('fill', 'none');
            svg.appendChild(path);
        }

        function drawRoundTransitionLines(svg, bracketRect, bracket, prevRoundEl, nextRoundEl, currentUnits, nextUnits) {
            const nextBye = parseInt(nextRoundEl.dataset.koByes || '0', 10);
            const isSfToFinal = (prevRoundEl.classList.contains('round-sf') ||
                prevRoundEl.dataset.semifinalRound === 'true') &&
                nextRoundEl.classList.contains('round-final');

            for (let j = 0; j < nextUnits.length; j++) {
                const idx1 = nextBye + j * 2;
                const idx2 = nextBye + j * 2 + 1;
                const src1El = resolveBracketLineSource(prevRoundEl, currentUnits, idx1);
                const src2El = resolveBracketLineSource(prevRoundEl, currentUnits, idx2);
                const targetEl = nextUnits[j];
                if (!targetEl) continue;

                const targetRect = targetEl.getBoundingClientRect();
                const x3 = targetRect.left - bracketRect.left;
                const y3 = targetRect.top + targetRect.height / 2 - bracketRect.top;

                const sources = [src1El, src2El].filter(Boolean);
                if (!sources.length) continue;

                let midX = (getBracketUnitLineAnchor(sources[0], bracketRect).x + x3) / 2;
                if (isSfToFinal) {
                    const thirdRound = bracket.querySelector('.round-3rd');
                    if (thirdRound) {
                        const thirdRight = thirdRound.getBoundingClientRect().right - bracketRect.left;
                        midX = (thirdRight + x3) / 2;
                    }
                } else if (sources.length === 2) {
                    const a1 = getBracketUnitLineAnchor(sources[0], bracketRect);
                    const a2 = getBracketUnitLineAnchor(sources[1], bracketRect);
                    midX = (a1.x + a2.x + x3) / 3;
                }

                sources.forEach((srcEl, idx) => {
                    const anchor = getBracketUnitLineAnchor(srcEl, bracketRect);
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    if (idx === 0 || sources.length === 1) {
                        path.setAttribute('d', `M${anchor.x},${anchor.y} H${midX} V${y3} H${x3}`);
                    } else {
                        path.setAttribute('d', `M${anchor.x},${anchor.y} H${midX} V${y3}`);
                    }
                    path.setAttribute('stroke', '#444');
                    path.setAttribute('stroke-width', '1.5');
                    path.setAttribute('fill', 'none');
                    svg.appendChild(path);
                });
            }

            if (nextBye > 0 && !prevRoundEl.dataset.koByeCarrier && currentUnits[0]) {
                drawByeAdvanceLine(svg, bracketRect, currentUnits[0], nextRoundEl, nextUnits);
            }
        }

        function drawBracketLines() {
            const bracket = document.querySelector('.bracket');
            if (!bracket) return;
            // Rantai pairwise: grup → R16 → QF → SF → Final.
            // Juara 3 tidak ikut rantai (ditumpuk di bawah Final di kolom yang sama).
            const rounds = bracket.querySelectorAll('[data-bracket-chain]');

            const existingSvg = bracket.querySelector('.bracket-lines');
            if (existingSvg) existingSvg.remove();

            bracket.style.position = 'relative';

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('bracket-lines');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = bracket.scrollWidth + 'px';
            svg.style.height = bracket.scrollHeight + 'px';
            svg.style.pointerEvents = 'none';
            svg.style.overflow = 'visible';
            svg.setAttribute('width', bracket.scrollWidth);
            svg.setAttribute('height', bracket.scrollHeight);

            const bracketRect = bracket.getBoundingClientRect();

            for (let i = 0; i < rounds.length - 1; i++) {
                const currentUnits = getRoundBracketUnits(rounds[i]);
                const nextUnits = getRoundBracketUnits(rounds[i + 1]);
                if (!currentUnits.length || !nextUnits.length) continue;
                drawRoundTransitionLines(
                    svg, bracketRect, bracket, rounds[i], rounds[i + 1], currentUnits, nextUnits
                );
            }

            // SF (15 & 16 Juli) → Perebutan Juara 3 (penyisih)
            const sfUnits = bracket.querySelectorAll(
                '[data-semifinal-round="true"] .matchup-tie, [data-semifinal-round="true"] .round-matches > .matchup, ' +
                '.round-sf .matchup-tie, .round-sf .round-matches > .matchup'
            );
            const thirdUnit = bracket.querySelector('.round-3rd .matchup-tie') ||
                bracket.querySelector('.round-3rd .matchup');
            if (sfUnits.length >= 2 && thirdUnit) {
                const tRect = thirdUnit.getBoundingClientRect();
                const x3 = tRect.left - bracketRect.left;
                const y3 = tRect.top + tRect.height / 2 - bracketRect.top;
                const midX = (sfUnits[0].getBoundingClientRect().right - bracketRect.left + x3) / 2;

                [0, 1].forEach((i, idx) => {
                    const mRect = sfUnits[i].getBoundingClientRect();
                    const x1 = mRect.right - bracketRect.left;
                    const y1 = mRect.top + mRect.height / 2 - bracketRect.top;

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    if (idx === 0) {
                        path.setAttribute('d', `M${x1},${y1} H${midX} V${y3} H${x3}`);
                    } else {
                        path.setAttribute('d', `M${x1},${y1} H${midX} V${y3}`);
                    }
                    path.setAttribute('stroke', '#444');
                    path.setAttribute('stroke-width', '1.5');
                    path.setAttribute('fill', 'none');
                    svg.appendChild(path);
                });
            }

            bracket.appendChild(svg);
        }

        window.addEventListener('resize', drawBracketLines);
    

/* --- */


        // Main Quest supporter data: team name -> array of supporters
        let teamSupporters = {
            'Portugal': ['Davin'],
            'Argentina': ['Davin', 'Ndod', 'Khuang', 'Marten', 'Cham', 'Willy'],
            'United States': ['Davin'],
            'Colombia': ['Davin', 'Khuang', 'Marten', 'Cham'],
            'Norway': ['Davin', 'Ndod', 'Khuang', 'Marten', 'Cham', 'Willy'],
            'Canada': ['Davin', 'Khuang'],
            'Algeria': ['Davin', 'Khuang'],
            'DR Congo': ['Davin', 'Ndod'],
            'France': ['Ndod', 'Cham', 'Willy'],
            'Morocco': ['Ndod', 'Cham', 'Wesly'],
            'Croatia': ['Ndod'],
            'Senegal': ['Ndod', 'Marten', 'Cham', 'Willy', 'Wesly'],
            'South Africa': ['Ndod', 'Willy'],
            'Spain': ['Khuang', 'Marten', 'Wesly'],
            'Belgium': ['Khuang', 'Willy'],
            'Bosnia and Herzegovina': ['Khuang', 'Wesly'],
            'Japan': ['Marten', 'Willy', 'Wesly'],
            'Ghana': ['Marten', 'Cham'],
            'Austria': ['Marten', 'Cham'],
            'Cape Verde': ['Willy'],
            'Brazil': ['Wesly'],
            'Sweden': ['Wesly'],
            'Paraguay': ['Wesly'],
        };

        let pointConfig = {
            mainQuestMode: 'fixed',
            mainQuest: { win: 3, draw: 1, loss: 0 },
            teamPoints: {},
            sideQuest: { champion: 10, runnerup: 5, third: 3, goldenBoot: 5, goldenGlove: 5, totalGoal: 5, scorePredict: 5 },
            sideQuestShare: {
                champion: true, runnerup: true, third: true,
                goldenBoot: true, goldenGlove: true, totalGoal: true, scorePredict: true,
            },
        };
        let includeGroupStage = false;
        let includeKnockoutStage = true;
        let includeThirdPlace = true;
        let competitionType = 'country';
        let twoLegKnockout = false;

        function isGroupMatchId(matchId) {
            return String(matchId || '').startsWith('group-');
        }

        function isKnockoutMatchup(matchup) {
            const matchId = matchup?.dataset?.matchId || '';
            return !isGroupMatchId(matchId);
        }

        function getWdlMatchupSelector() {
            const parts = [];
            if (includeGroupStage) parts.push('.group-stage .matchup.finished');
            if (includeKnockoutStage) parts.push('.bracket .matchup.finished');
            return parts.join(', ');
        }

        function forEachWdlMatchup(callback) {
            const selector = getWdlMatchupSelector();
            if (!selector) return;
            document.querySelectorAll(selector).forEach(matchup => {
                if (includeKnockoutStage && isKnockoutMatchup(matchup) && isThirdPlaceMatchup(matchup)) return;
                callback(matchup);
            });
        }

        function forEachGoalStatMatchup(callback) {
            if (includeGroupStage) {
                document.querySelectorAll('.group-stage .matchup.finished').forEach(callback);
            }
            if (includeKnockoutStage) {
                document.querySelectorAll('.bracket .matchup.finished').forEach(callback);
            }
        }

        function isTwoLegKnockout() {
            return !!twoLegKnockout || !!(window.LEAGUE_DATA && window.LEAGUE_DATA.twoLegKnockout);
        }

        function getTieElement(tieId) {
            return document.querySelector('.matchup-tie[data-tie-id="' + tieId + '"]');
        }

        function getTieLeg1(tieEl) {
            if (!tieEl) return null;
            return tieEl.querySelector('.matchup[data-match-id$="-leg1"]') || tieEl.querySelector('.matchup');
        }

        function isTieResolved(tieId) {
            if (!isTwoLegKnockout() || typeof ArisanBracket === 'undefined') return false;
            const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
            return result.legsComplete && result.winnerIdx !== null;
        }

        function isFinalResolved() {
            if (isTwoLegKnockout()) return isTieResolved('final-0');
            const m = document.querySelector('[data-match-id="final-0"]');
            return !!(m && m.classList.contains('finished'));
        }

        function isThirdPlaceResolved() {
            if (isTwoLegKnockout()) return isTieResolved('third-0');
            const m = document.querySelector('[data-match-id="third-0"]');
            return !!(m && m.classList.contains('finished'));
        }

        function getRoundBracketUnits(roundEl) {
            if (!roundEl) return [];
            const roots = [
                ...roundEl.querySelectorAll(':scope > .round-matches'),
                ...roundEl.querySelectorAll(':scope > .final-match-row > .round-matches'),
            ];
            const ties = [];
            const matchups = [];
            roots.forEach(root => {
                root.querySelectorAll(':scope > .matchup-tie').forEach(el => ties.push(el));
                root.querySelectorAll(':scope > .matchup').forEach(el => matchups.push(el));
            });
            return ties.length ? ties : matchups;
        }

        const defaultAvatar = 'https://img.icons8.com/ios-filled/50/6b7280/user-male-circle.png';

        // Fallback lokal; diganti dari LEAGUE_DATA.participantAvatars saat sync DB.
        let participantAvatars = {};

        function applyParticipantAvatar(img, name) {
            if (!img) return;
            const src = participantAvatars[name] || defaultAvatar;
            img.referrerPolicy = 'no-referrer';
            img.decoding = 'async';
            img.alt = name || img.alt || '';
            img.onerror = function () {
                if (this.dataset.avatarFallback === '1') return;
                this.dataset.avatarFallback = '1';
                this.src = defaultAvatar;
            };
            img.src = src;
        }

        function getInitials(name) {
            return name.substring(0, 3).toUpperCase();
        }

        function injectSupporters() {
            const matchups = document.querySelectorAll('.bracket .matchup');
            matchups.forEach(matchup => {
                const teams = matchup.querySelectorAll('.team');
                teams.forEach(teamEl => {
                    const nameEl = teamEl.querySelector('.team-name');
                    if (!nameEl) return;
                    const teamName = nameEl.textContent.trim();
                    if (teamName === 'TBD') return;

                    // Find supporters
                    const supporters = teamSupporters[teamName] || [];
                    if (supporters.length === 0) return;

                    // Create toggle button and panel at matchup level (after team rows)
                    // Check if this team already has a panel sibling
                    if (teamEl.dataset.supporterInjected) return;
                    teamEl.dataset.supporterInjected = 'true';

                    // Create panel
                    const panel = document.createElement('div');
                    panel.className = 'supporters-panel';
                    panel.id = 'sp-' + teamName.replace(/[^a-zA-Z0-9]/g, '') + '-' + Math.random().toString(36).substr(2, 4);

                    supporters.forEach(s => {
                        const item = document.createElement('div');
                        item.className = 'supporter-item';
                        const img = document.createElement('img');
                        img.className = 'supporter-avatar';
                        applyParticipantAvatar(img, s);
                        const label = document.createElement('span');
                        label.className = 'supporter-name';
                        label.textContent = getInitials(s);
                        item.appendChild(img);
                        item.appendChild(label);
                        panel.appendChild(item);
                    });

                    // Create toggle button
                    const btn = document.createElement('button');
                    btn.className = 'supporters-toggle';
                    btn.textContent = 'Show';
                    btn.onclick = function() {
                        const isVisible = panel.classList.toggle('show');
                        btn.textContent = isVisible ? 'Hide' : 'Show';
                        // Redraw bracket lines after toggle
                        setTimeout(drawBracketLines, 50);
                    };

                    // Insert after team element
                    teamEl.insertAdjacentElement('afterend', panel);
                    teamEl.insertAdjacentElement('afterend', btn);
                });
            });
        }

        let scorePredictions = {};

        function getScorePredictionsForMatch(matchId) {
            return (scorePredictions && scorePredictions[matchId]) || [];
        }

        function injectScorePredictions() {
            document.querySelectorAll('.bracket .matchup, .group-stage .matchup').forEach(matchup => {
                if (matchup.dataset.scorePredictInjected) return;
                const matchId = matchup.dataset.matchId;
                if (!matchId) return;
                const preds = getScorePredictionsForMatch(matchId);
                if (!preds.length) return;

                matchup.dataset.scorePredictInjected = 'true';

                const teams = matchup.querySelectorAll(':scope > .team');
                const teamA = teams[0]?.querySelector('.team-name')?.textContent.trim() || 'A';
                const teamB = teams[1]?.querySelector('.team-name')?.textContent.trim() || 'B';

                let actualA = null;
                let actualB = null;
                if (matchup.classList.contains('finished') && teams.length === 2) {
                    actualA = typeof parseFullTimeScore === 'function'
                        ? parseFullTimeScore(teams[0].querySelector('.team-score')?.textContent)
                        : null;
                    actualB = typeof parseFullTimeScore === 'function'
                        ? parseFullTimeScore(teams[1].querySelector('.team-score')?.textContent)
                        : null;
                }
                const hasResult = actualA != null && actualB != null;

                const panel = document.createElement('div');
                panel.className = 'score-predict-panel';

                preds.forEach(pred => {
                    const item = document.createElement('div');
                    item.className = 'score-predict-item';
                    const exact = hasResult && pred.a === actualA && pred.b === actualB;
                    if (hasResult) item.classList.add(exact ? 'correct' : 'wrong');

                    const img = document.createElement('img');
                    img.className = 'score-predict-avatar';
                    applyParticipantAvatar(img, pred.name);

                    const meta = document.createElement('div');
                    meta.className = 'score-predict-meta';

                    const left = document.createElement('div');
                    left.className = 'score-predict-left';
                    const nameEl = document.createElement('span');
                    nameEl.className = 'score-predict-name';
                    nameEl.textContent = pred.name;
                    left.appendChild(nameEl);

                    const right = document.createElement('div');
                    right.className = 'score-predict-right';
                    const scoreEl = document.createElement('span');
                    scoreEl.className = 'score-predict-score';
                    scoreEl.textContent = pred.a + ' - ' + pred.b;
                    scoreEl.title = teamA + ' ' + pred.a + ' - ' + pred.b + ' ' + teamB;
                    right.appendChild(scoreEl);

                    if (hasResult) {
                        const badge = document.createElement('span');
                        badge.className = 'score-predict-badge';
                        badge.textContent = exact ? 'Hit' : 'Miss';
                        right.appendChild(badge);
                    }

                    meta.appendChild(left);
                    meta.appendChild(right);
                    item.appendChild(img);
                    item.appendChild(meta);
                    panel.appendChild(item);
                });

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'score-predict-toggle';
                btn.textContent = 'Predictions (' + preds.length + ')';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const open = panel.classList.toggle('show');
                    btn.textContent = open
                        ? 'Hide predictions'
                        : 'Predictions (' + preds.length + ')';
                    if (typeof drawBracketLines === 'function') setTimeout(drawBracketLines, 50);
                });

                const anchor = matchup.querySelector(':scope > .team:last-of-type') || matchup.lastElementChild;
                if (anchor) {
                    anchor.insertAdjacentElement('afterend', panel);
                    anchor.insertAdjacentElement('afterend', btn);
                } else {
                    matchup.appendChild(btn);
                    matchup.appendChild(panel);
                }
            });
        }

        const TOURNAMENT_YEAR = 2026;

        function getTournamentYear() {
            return (window.LEAGUE_DATA && window.LEAGUE_DATA.year) || TOURNAMENT_YEAR;
        }

        function getLeagueChampionSubtitle() {
            const d = window.LEAGUE_DATA || {};
            const title = d.title && String(d.title).trim();
            const year = d.year != null && d.year !== '' ? String(d.year).trim() : '';
            const parts = [];
            if (title) parts.push(title);
            if (year) parts.push(year);
            if (!parts.length) return 'Champion';
            return parts.join(' ') + ' Champion';
        }
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const GLOW_RHYTHM_MS = 2500;
        // Live dimulai 15 menit sebelum kickoff, berakhir 3 jam setelah kickoff
        const LIVE_PREMATCH_MS = 15 * 60 * 1000;
        const LIVE_MATCH_DURATION_MS = 180 * 60 * 1000;
        const LIVE_STREAM_URL = 'https://lee22.0i52waitxcy8needs.cfd/id';

        const MONTH_INDEX = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
            jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
            // legacy Indonesian
            januari: 0, februari: 1, maret: 2, mei: 4, juni: 5,
            juli: 6, agustus: 7, oktober: 9, desember: 11,
        };

        function makeWIBDate(year, monthIndex, day, hour, minute) {
            return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute));
        }

        function extractMatchupDateText(dateEl) {
            const text = dateEl.textContent.replace(/\s+/g, ' ').trim();
            const match = text.match(/((?:\w+,\s*)?(?:\d{1,2}\s+\w+|\d{1,2}\/\d{1,2}),?\s+\d{1,2}:\d{2}(?:\s*WIB)?)/i);
            return match ? match[1].trim() : text.replace(/^✅\s*/, '').trim();
        }

        function parseMatchupDateWIB(dateText) {
            const text = (dateText || '').replace(/^✅\s*/, '').trim();
            if (!text) return null;

            // WIB optional — display strings omit it for brevity; timezone still treated as WIB
            let match = text.match(/^(?:\w+,\s*)?(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
            if (match) {
                const monthIndex = MONTH_INDEX[match[2].toLowerCase()];
                if (monthIndex === undefined) return null;
                return makeWIBDate(
                    getTournamentYear(),
                    monthIndex,
                    parseInt(match[1], 10),
                    parseInt(match[3], 10),
                    parseInt(match[4], 10)
                );
            }

            match = text.match(/^(?:\w+,\s*)?(\d{1,2})\/(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?:\s*WIB)?$/i);
            if (match) {
                return makeWIBDate(
                    getTournamentYear(),
                    parseInt(match[1], 10) - 1,
                    parseInt(match[2], 10),
                    parseInt(match[3], 10),
                    parseInt(match[4], 10)
                );
            }

            return null;
        }

        function getOrStoreMatchDateText(dateEl) {
            if (!dateEl.dataset.scheduleDate) {
                dateEl.dataset.scheduleDate = extractMatchupDateText(dateEl);
            }
            return dateEl.dataset.scheduleDate;
        }

        function setLiveBadge(dateEl, show) {
            const dateText = getOrStoreMatchDateText(dateEl);
            if (show) {
                if (dateEl.querySelector('.matchup-live-badge')) return;
                dateEl.innerHTML =
                    '<span class="matchup-live-badge">' +
                    '<span class="wave-bars"><span></span><span></span><span></span></span>' +
                    'Live</span> ' + dateText;
            } else if (dateEl.querySelector('.matchup-live-badge')) {
                dateEl.textContent = dateText;
            }
        }

        function formatCountdownHMS(ms) {
            if (ms <= 0) return '00:00:00';
            const totalSec = Math.floor(ms / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
        }

        function initGlowSync() {
            const negDelay = -(Date.now() % GLOW_RHYTHM_MS);
            document.documentElement.style.setProperty('--glow-sync-delay', negDelay + 'ms');
        }

        function getSoonProgress(msRemaining) {
            if (msRemaining <= LIVE_PREMATCH_MS) return 1;
            if (msRemaining >= TWENTY_FOUR_HOURS_MS) return 0;
            return 1 - (msRemaining - LIVE_PREMATCH_MS) / (TWENTY_FOUR_HOURS_MS - LIVE_PREMATCH_MS);
        }

        function setSoonBadge(dateEl, show, msRemaining) {
            const dateText = getOrStoreMatchDateText(dateEl);
            if (show) {
                const countdown = formatCountdownHMS(msRemaining);
                const progressPct = Math.round(getSoonProgress(msRemaining) * 100);
                const existing = dateEl.querySelector('.matchup-soon-badge');
                if (existing) {
                    const cdEl = existing.querySelector('.matchup-soon-countdown');
                    if (cdEl) cdEl.textContent = countdown;
                    const progEl = existing.querySelector('.matchup-soon-progress');
                    if (progEl) progEl.style.width = progressPct + '%';
                    return;
                }
                dateEl.innerHTML =
                    '<span class="matchup-soon-badge">' +
                    '<span class="matchup-soon-progress" style="width:' + progressPct + '%"></span>' +
                    '<span class="matchup-soon-badge-inner">Soon' +
                    '<span class="matchup-soon-countdown">' + countdown + '</span></span></span> ' + dateText;
            } else if (dateEl.querySelector('.matchup-soon-badge')) {
                dateEl.textContent = dateText;
            }
        }

        function updateSoonCountdowns() {
            const now = Date.now();
            let needFullUpdate = false;
            document.querySelectorAll('.bracket .matchup.today, .group-stage .matchup.today').forEach(matchup => {
                const kickoff = Number(matchup.dataset.kickoff);
                if (!kickoff) return;
                const untilKickoff = kickoff - now;
                if (untilKickoff <= LIVE_PREMATCH_MS) {
                    needFullUpdate = true;
                    return;
                }
                const badge = matchup.querySelector('.matchup-soon-badge');
                if (!badge) return;
                const cdEl = badge.querySelector('.matchup-soon-countdown');
                if (cdEl) cdEl.textContent = formatCountdownHMS(untilKickoff);
                const progEl = badge.querySelector('.matchup-soon-progress');
                if (progEl) {
                    progEl.style.width = Math.round(getSoonProgress(untilKickoff) * 100) + '%';
                }
            });
            if (needFullUpdate) updateMatchupScheduleStatus();
        }

        function setWaitingAdminBadge(dateEl, show) {
            const dateText = getOrStoreMatchDateText(dateEl);
            if (show) {
                if (dateEl.querySelector('.matchup-waiting-badge')) return;
                dateEl.innerHTML =
                    '<span class="matchup-waiting-badge">Waiting for Admin</span> ' + dateText;
            } else if (dateEl.querySelector('.matchup-waiting-badge')) {
                dateEl.textContent = dateText;
            }
        }

        function ensureDefaultTeamScores(matchup) {
            matchup.querySelectorAll('.team').forEach(teamEl => {
                const teamName = teamEl.querySelector('.team-name')?.textContent.trim();
                if (!teamName || teamName === 'TBD') return;
                if (teamEl.querySelector('.team-score')) return;

                const scoreEl = document.createElement('span');
                scoreEl.className = 'team-score';
                scoreEl.textContent = '0';
                teamEl.appendChild(scoreEl);
            });
        }

        function updateMatchupScheduleStatus() {
            const now = Date.now();

            document.querySelectorAll(
                '.bracket .matchup:not(.finished):not([data-admin-managed]), ' +
                '.group-stage .matchup:not(.finished):not([data-admin-managed])'
            ).forEach(matchup => {
                const dateEl = matchup.querySelector('.matchup-date');
                if (!dateEl) return;

                const matchTime = parseMatchupDateWIB(getOrStoreMatchDateText(dateEl));
                if (!matchTime) return;

                const kickoff = matchTime.getTime();
                const untilKickoff = kickoff - now;

                matchup.classList.remove('tbd', 'today', 'live', 'waiting-admin');
                delete matchup.dataset.kickoff;
                setLiveBadge(dateEl, false);
                setSoonBadge(dateEl, false);
                setWaitingAdminBadge(dateEl, false);

                if (now >= kickoff - LIVE_PREMATCH_MS && now < kickoff + LIVE_MATCH_DURATION_MS) {
                    matchup.classList.add('live');
                    setLiveBadge(dateEl, true);
                    ensureDefaultTeamScores(matchup);
                    matchup.dataset.liveUrl = LIVE_STREAM_URL;
                    matchup.title = 'Tonton live';
                } else if (now >= kickoff + LIVE_MATCH_DURATION_MS) {
                    matchup.classList.add('waiting-admin');
                    setWaitingAdminBadge(dateEl, true);
                    ensureDefaultTeamScores(matchup);
                    delete matchup.dataset.liveUrl;
                    matchup.removeAttribute('title');
                } else if (untilKickoff > LIVE_PREMATCH_MS && untilKickoff < TWENTY_FOUR_HOURS_MS) {
                    matchup.classList.add('today');
                    matchup.dataset.kickoff = String(kickoff);
                    setSoonBadge(dateEl, true, untilKickoff);
                    delete matchup.dataset.liveUrl;
                    matchup.removeAttribute('title');
                } else {
                    matchup.classList.add('tbd');
                    delete matchup.dataset.liveUrl;
                    matchup.removeAttribute('title');
                }
            });

            updateMainQuestEliminatedStatus();
        }

        function getScheduledKickoffFromMatchSchedule(matchId) {
            const schedule = window.LEAGUE_DATA?.matchSchedule || {};
            const text = schedule[matchId];
            if (!text) return null;
            return parseMatchupDateWIB(text);
        }

        function getTieScheduledKickoffMs(tieId) {
            if (isTwoLegKnockout()) {
                const kickoffs = [1, 2]
                    .map(leg => getScheduledKickoffFromMatchSchedule(tieId + '-leg' + leg))
                    .filter(Boolean)
                    .map(d => d.getTime());
                return kickoffs.length ? Math.min(...kickoffs) : null;
            }
            const kickoff = getScheduledKickoffFromMatchSchedule(tieId);
            return kickoff ? kickoff.getTime() : null;
        }

        /** True once server time has passed third-place or final kickoff (from matchSchedule). */
        function isMainQuestPodiumPhaseActive() {
            const kickoffs = [];
            if (window.LEAGUE_DATA?.includeThirdPlace !== false) {
                const third = getTieScheduledKickoffMs('third-0');
                if (third !== null) kickoffs.push(third);
            }
            const finalKick = getTieScheduledKickoffMs('final-0');
            if (finalKick !== null) kickoffs.push(finalKick);
            if (!kickoffs.length) return false;
            return Date.now() >= Math.min(...kickoffs);
        }

        function applyFinishedMatchBadges() {
            document.querySelectorAll(
                '.bracket .matchup.finished .matchup-date, .group-stage .matchup.finished .matchup-date'
            ).forEach(dateEl => {
                if (dateEl.querySelector('.matchup-finished-badge')) return;

                const dateText = extractMatchupDateText(dateEl).replace(/^✅\s*/, '').trim();
                dateEl.dataset.scheduleDate = dateText;
                dateEl.innerHTML =
                    '<span class="matchup-finished-badge">Match Finished</span> ' + dateText;
            });
        }

        const TBD_FLAG_SRC = 'https://img.icons8.com/ios-filled/50/6b7280/shield.png';

        function getTeamDataFromElement(teamEl) {
            const nameEl = teamEl.querySelector('.team-name');
            const flagImg = teamEl.querySelector('.team-flag img');
            if (!nameEl || !flagImg) return null;

            return {
                name: nameEl.textContent.trim(),
                flagSrc: flagImg.getAttribute('src'),
                flagAlt: flagImg.getAttribute('alt') || '',
            };
        }

        function getMatchupWinner(matchup) {
            if (!matchup.classList.contains('finished')) return null;

            let winnerEl = matchup.querySelector(':scope > .team.winner');

            if (!winnerEl) {
                const matchId = matchup.dataset.matchId;
                const match = (window.ADMIN_CONFIG?.finishedMatches || []).find(m => m.id === matchId);
                const winnerIdx = typeof resolveFinishedWinnerIndex === 'function'
                    ? resolveFinishedWinnerIndex(match)
                    : null;
                if (winnerIdx === 0 || winnerIdx === 1) {
                    winnerEl = matchup.querySelectorAll(':scope > .team')[winnerIdx];
                }
            }

            if (!winnerEl) return null;

            const data = getTeamDataFromElement(winnerEl);
            if (!data || data.name === 'TBD') return null;
            return data;
        }

        function getMatchupLoser(matchup) {
            if (!matchup.classList.contains('finished')) return null;

            const teams = matchup.querySelectorAll(':scope > .team');
            let loserEl = Array.from(teams).find(teamEl => !teamEl.classList.contains('winner'));

            // Fallback: tentukan dari config bila class winner belum ada di DOM
            if (!loserEl || !getTeamDataFromElement(loserEl) || getTeamDataFromElement(loserEl).name === 'TBD') {
                const matchId = matchup.dataset.matchId;
                const match = (window.ADMIN_CONFIG?.finishedMatches || []).find(m => m.id === matchId);
                const winnerIdx = typeof resolveFinishedWinnerIndex === 'function'
                    ? resolveFinishedWinnerIndex(match)
                    : null;
                if (winnerIdx === 0 || winnerIdx === 1) {
                    loserEl = teams[1 - winnerIdx];
                }
            }

            if (!loserEl) return null;

            const data = getTeamDataFromElement(loserEl);
            if (!data || data.name === 'TBD') return null;
            return data;
        }

        function getTieWinnerTeamData(tieEl) {
            if (!tieEl || !tieEl.classList.contains('matchup-tie')) return null;
            const tieId = tieEl.dataset.tieId;
            if (!tieId || typeof ArisanBracket === 'undefined') return null;
            const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
            if (!result.legsComplete || result.winnerIdx === null) return null;
            const leg1 = getTieLeg1(tieEl);
            const teams = leg1.querySelectorAll(':scope > .team');
            const winnerEl = teams[result.winnerIdx];
            if (!winnerEl) return null;
            const data = getTeamDataFromElement(winnerEl);
            if (!data || data.name === 'TBD') return null;
            return data;
        }

        function getTieLoserTeamData(tieEl) {
            if (!tieEl || !tieEl.classList.contains('matchup-tie')) return null;
            const tieId = tieEl.dataset.tieId;
            if (!tieId || typeof ArisanBracket === 'undefined') return null;
            const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
            if (!result.legsComplete || result.winnerIdx === null) return null;
            const leg1 = getTieLeg1(tieEl);
            const teams = leg1.querySelectorAll(':scope > .team');
            const loserEl = teams[1 - result.winnerIdx];
            if (!loserEl) return null;
            const data = getTeamDataFromElement(loserEl);
            if (!data || data.name === 'TBD') return null;
            return data;
        }

        function getBracketUnitWinner(unitEl) {
            if (unitEl.classList.contains('matchup-tie')) return getTieWinnerTeamData(unitEl);
            return getMatchupWinner(unitEl);
        }

        function getBracketUnitLoser(unitEl) {
            if (unitEl.classList.contains('matchup-tie')) return getTieLoserTeamData(unitEl);
            return getMatchupLoser(unitEl);
        }

        function setTieTeamSlots(tieEl, slotIndex, teamData) {
            tieEl.querySelectorAll('.matchup').forEach(matchup => {
                const teams = matchup.querySelectorAll(':scope > .team');
                if (teams[slotIndex]) setTeamSlot(teams[slotIndex], teamData);
            });
        }

        function getRoundOutputWinners(roundEl) {
            const list = [];
            if (roundEl.dataset.koByeCarrier) {
                try {
                    list.push(JSON.parse(roundEl.dataset.koByeCarrier));
                } catch (e) { /* ignore */ }
            }
            getRoundBracketUnits(roundEl).forEach(unit => {
                const winner = getBracketUnitWinner(unit);
                if (winner) list.push(winner);
            });
            return list;
        }

        function setBracketUnitTeamSlots(unitEl, teamA, teamB) {
            if (unitEl.classList.contains('matchup-tie')) {
                if (teamA) setTieTeamSlots(unitEl, 0, teamA);
                if (teamB) setTieTeamSlots(unitEl, 1, teamB);
                return;
            }
            const teams = unitEl.querySelectorAll(':scope > .team');
            if (teamA && teams[0]) setTeamSlot(teams[0], teamA);
            if (teamB && teams[1]) setTeamSlot(teams[1], teamB);
        }

        function advanceKnockoutRound(prevRoundEl, nextRoundEl) {
            const prevWinners = getRoundOutputWinners(prevRoundEl);
            const nextBye = parseInt(nextRoundEl.dataset.koByes || '0', 10);
            const nextUnits = getRoundBracketUnits(nextRoundEl);

            if (nextBye && prevWinners[0]) {
                nextRoundEl.dataset.koByeCarrier = JSON.stringify(prevWinners[0]);
            } else {
                delete nextRoundEl.dataset.koByeCarrier;
            }

            for (let j = 0; j < nextUnits.length; j++) {
                setBracketUnitTeamSlots(
                    nextUnits[j],
                    prevWinners[nextBye + j * 2] || null,
                    prevWinners[nextBye + j * 2 + 1] || null
                );
            }
        }

        function fillNextRoundSlotsFromTies(currentTies, nextTies) {
            for (let j = 0; j < nextTies.length; j++) {
                [j * 2, j * 2 + 1].forEach((tieIndex, slotIndex) => {
                    const sourceTie = currentTies[tieIndex];
                    const nextTie = nextTies[j];
                    if (!sourceTie || !nextTie) return;

                    const winner = getTieWinnerTeamData(sourceTie);
                    if (!winner) return;

                    setTieTeamSlots(nextTie, slotIndex, winner);
                });
            }
        }

        function setTeamSlot(teamEl, teamData) {
            const flagEl = teamEl.querySelector('.team-flag');
            const nameEl = teamEl.querySelector('.team-name');
            const scoreEl = teamEl.querySelector('.team-score');
            teamEl.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());

            // Hanya ganti identitas tim. Skor/winner di-restore lewat applyAdminConfig
            // setelah advance, supaya tidak hilang di babak tujuan.
            teamEl.classList.remove('winner');

            if (!teamData) {
                if (flagEl) {
                    flagEl.innerHTML = '<img src="' + TBD_FLAG_SRC + '" alt="TBD" style="opacity:0.4">';
                }
                if (nameEl) {
                    nameEl.textContent = 'TBD';
                }
                if (scoreEl) scoreEl.remove();
                delete teamEl.dataset.supporterInjected;
                return;
            }

            if (flagEl) {
                flagEl.innerHTML = '<img src="' + teamData.flagSrc + '" alt="' + teamData.flagAlt + '">';
            }
            if (nameEl) {
                nameEl.textContent = teamData.name;
            }
            if (scoreEl) scoreEl.remove();

            delete teamEl.dataset.supporterInjected;
        }

        function fillNextRoundSlots(currentMatches, nextMatches) {
            for (let j = 0; j < nextMatches.length; j++) {
                const nextTeams = nextMatches[j].querySelectorAll(':scope > .team');
                if (nextTeams.length < 2) continue;

                [j * 2, j * 2 + 1].forEach((matchIndex, slotIndex) => {
                    const sourceMatchup = currentMatches[matchIndex];
                    if (!sourceMatchup) return;

                    const winner = getMatchupWinner(sourceMatchup);
                    if (!winner) return;

                    setTeamSlot(nextTeams[slotIndex], winner);
                });
            }
        }

        function advanceThirdPlaceMatch() {
            const bracket = document.querySelector('.bracket');
            if (!bracket) return;

            const sfUnits = bracket.querySelectorAll(
                '[data-semifinal-round="true"] .matchup-tie, [data-semifinal-round="true"] .round-matches > .matchup, ' +
                '.round-sf .matchup-tie, .round-sf .round-matches > .matchup'
            );
            const thirdTie = bracket.querySelector('.round-3rd .matchup-tie');
            const thirdMatchup = thirdTie || bracket.querySelector('.round-3rd .matchup');
            if (!thirdMatchup || sfUnits.length < 2) return;

            if (thirdTie) {
                [0, 1].forEach(index => {
                    const loser = getBracketUnitLoser(sfUnits[index]);
                    if (!loser) return;
                    setTieTeamSlots(thirdTie, index, loser);
                });
                return;
            }

            const slots = thirdMatchup.querySelectorAll(':scope > .team');
            if (slots.length < 2) return;

            [0, 1].forEach(index => {
                const loser = getBracketUnitLoser(sfUnits[index]);
                if (!loser) return;
                setTeamSlot(slots[index], loser);
            });
        }

        function markConfirmedTeamNames() {
            // FIX: matchup boleh berstatus .tbd (belum tanding), tapi kalau nama tim sudah
            // pasti (bukan placeholder "TBD"), teks tidak boleh tampil abu-abu.
            document.querySelectorAll('.matchup .team-name').forEach(nameEl => {
                const isPlaceholder = nameEl.textContent.trim() === 'TBD';
                nameEl.classList.toggle('confirmed', !isPlaceholder);
            });
        }

        function advanceBracketWinners() {
            const bracket = document.querySelector('.bracket');
            if (!bracket) return;

            const rounds = bracket.querySelectorAll('[data-bracket-chain]');

            for (let i = 0; i < rounds.length - 1; i++) {
                const currentUnits = getRoundBracketUnits(rounds[i]);
                const nextUnits = getRoundBracketUnits(rounds[i + 1]);
                if (!currentUnits.length || !nextUnits.length) continue;

                const usesFlexibleKo = rounds[i].dataset.koRound || rounds[i + 1].dataset.koRound;
                if (usesFlexibleKo) {
                    advanceKnockoutRound(rounds[i], rounds[i + 1]);
                    applyAdminConfig();
                    continue;
                }

                const currentAreTies = currentUnits[0].classList.contains('matchup-tie');
                const nextAreTies = nextUnits[0].classList.contains('matchup-tie');
                if (currentAreTies && nextAreTies) {
                    fillNextRoundSlotsFromTies(currentUnits, nextUnits);
                } else {
                    fillNextRoundSlots(currentUnits, nextUnits);
                }
                applyAdminConfig();
            }

            advanceThirdPlaceMatch();
            applyAdminConfig();
            applyFinalPlacementBadges();
            if (typeof drawBracketLines === 'function') drawBracketLines();
        }

        const DEFAULT_TROPHY_URL = 'https://png.pngtree.com/png-vector/20250923/ourmid/pngtree-the-fifa-world-cup-trophy-png-image_17551611.webp';
        const DEFAULT_BALL_URL = 'https://png.pngtree.com/png-vector/20260610/ourmid/pngtree-vibrant-trionda-soccer-football-official-fifa-world-cup-2026-design-png-image_19512258.webp';
        const FINAL_PLACE_IMAGES = {
            champion: DEFAULT_TROPHY_URL,
            runnerup: 'https://png.pngtree.com/png-clipart/20250717/original/pngtree-silver-second-place-trophy-with-number-two-png-image_21318342.png',
            third: 'https://static.vecteezy.com/system/resources/previews/063/104/243/non_2x/bronze-medal-with-number-three-and-laurel-wreath-isolated-on-transparent-background-png.png',
        };

        function getTrophyImageUrl() {
            const fromData = window.LEAGUE_DATA && window.LEAGUE_DATA.trophyImageUrl;
            if (fromData && /^https?:\/\//i.test(String(fromData).trim())) return String(fromData).trim();
            if (typeof ArisanBracket !== 'undefined' && ArisanBracket.DEFAULT_TROPHY_IMG) {
                return ArisanBracket.DEFAULT_TROPHY_IMG;
            }
            return DEFAULT_TROPHY_URL;
        }

        function getLeagueIconImageUrl() {
            if (typeof getLeagueIconUrl === 'function') return getLeagueIconUrl();
            const d = window.LEAGUE_DATA || {};
            const icon = d.iconImageUrl;
            if (icon && /^https?:\/\//i.test(String(icon).trim())) return String(icon).trim();
            const legacy = d.trophyImageUrl;
            if (legacy && /^https?:\/\//i.test(String(legacy).trim())) return String(legacy).trim();
            return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT41kl1nnX-tqBQiGHVikOIDViXDZXRRulNdKFAK6c1eQ&s=10';
        }

        function getBallImageUrl() {
            if (typeof getLeagueBallUrl === 'function') return getLeagueBallUrl();
            const fromData = window.LEAGUE_DATA && window.LEAGUE_DATA.ballImageUrl;
            if (fromData && /^https?:\/\//i.test(String(fromData).trim())) return String(fromData).trim();
            return DEFAULT_BALL_URL;
        }

        function appendTeamPlaceBadge(teamEl, src, alt, variant) {
            if (!teamEl) return;
            const slot = document.createElement('span');
            slot.className = 'team-place-badge-slot' + (variant ? ' badge-' + variant : '');
            if (src) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = alt || '';
                img.title = alt || '';
                slot.appendChild(img);
            }
            teamEl.appendChild(slot);
        }

        function resolveMatchWinnerTeamEl(matchup, matchId) {
            if (!matchup) return null;
            const teams = matchup.querySelectorAll(':scope > .team');
            const winnerEl = matchup.querySelector(':scope > .team.winner');
            if (winnerEl) return winnerEl;

            if (typeof resolveFinishedWinnerIndex !== 'function') return null;
            const match = (window.ADMIN_CONFIG?.finishedMatches || []).find(m => m.id === matchId);
            const idx = resolveFinishedWinnerIndex(match);
            return (idx === 0 || idx === 1) ? teams[idx] : null;
        }

        function applyFinalPlacementBadges() {
            if (isTwoLegKnockout()) {
                applyTiePlacementBadges('final-0', 'final');
                applyTiePlacementBadges('third-0', 'third');
                return;
            }

            const finalMatch = document.querySelector('[data-match-id="final-0"]');
            if (finalMatch) {
                finalMatch.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());
                if (finalMatch.classList.contains('finished')) {
                    const teams = finalMatch.querySelectorAll(':scope > .team');
                    const winnerEl = resolveMatchWinnerTeamEl(finalMatch, 'final-0');
                    if (winnerEl) {
                        const loserEl = Array.from(teams).find(teamEl => teamEl !== winnerEl);
                        appendTeamPlaceBadge(winnerEl, getTrophyImageUrl(), 'Champion', 'champion');
                        appendTeamPlaceBadge(loserEl, FINAL_PLACE_IMAGES.runnerup, 'Runner-Up', 'runnerup');
                    }
                }
            }

            const thirdMatch = document.querySelector('[data-match-id="third-0"]');
            if (thirdMatch) {
                thirdMatch.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());
                if (thirdMatch.classList.contains('finished')) {
                    const teams = thirdMatch.querySelectorAll(':scope > .team');
                    const winnerEl = resolveMatchWinnerTeamEl(thirdMatch, 'third-0');
                    if (winnerEl) {
                        const loserEl = Array.from(teams).find(teamEl => teamEl !== winnerEl);
                        appendTeamPlaceBadge(winnerEl, FINAL_PLACE_IMAGES.third, 'Third Place', 'third');
                        // Slot kosong agar skor 4th rank sejajar dengan 3rd
                        appendTeamPlaceBadge(loserEl, null, '', '');
                    }
                }
            }
        }

        function applyTiePlacementBadges(tieId, kind) {
            const tieEl = getTieElement(tieId);
            if (!tieEl || typeof ArisanBracket === 'undefined') return;

            tieEl.querySelectorAll('.team-place-badge, .team-place-badge-slot').forEach(el => el.remove());
            const result = ArisanBracket.resolveTieWinner(tieId, window.ADMIN_CONFIG?.finishedMatches || []);
            if (!result.legsComplete || result.winnerIdx === null) return;

            const leg1 = getTieLeg1(tieEl);
            const teams = leg1.querySelectorAll(':scope > .team');
            const winnerEl = teams[result.winnerIdx];
            const loserEl = teams[1 - result.winnerIdx];

            if (kind === 'final') {
                appendTeamPlaceBadge(winnerEl, getTrophyImageUrl(), 'Champion', 'champion');
                appendTeamPlaceBadge(loserEl, FINAL_PLACE_IMAGES.runnerup, 'Runner-Up', 'runnerup');
            } else if (kind === 'third') {
                appendTeamPlaceBadge(winnerEl, FINAL_PLACE_IMAGES.third, 'Third Place', 'third');
                appendTeamPlaceBadge(loserEl, null, '', '');
            }
        }

        let pendingFinalCelebrationWinner = null;
        let finalCelebrationActive = false;
        let finalCelebrationRepeatTimer = null;
        const FINAL_CELEBRATION_REPEAT_MS = 30 * 1000;

        function getCelebrationFlagSrc(flagSrc) {
            if (typeof ArisanCountries !== 'undefined' && ArisanCountries.getCelebrationFlagUrl) {
                return ArisanCountries.getCelebrationFlagUrl(flagSrc) || String(flagSrc || '');
            }
            return String(flagSrc || '');
        }

        function parseFlagCodeFromSrc(src) {
            if (typeof ArisanCountries !== 'undefined' && ArisanCountries.parseFlagCode) {
                return ArisanCountries.parseFlagCode(src) || null;
            }
            const m = String(src || '').match(/flagcdn\.com\/w\d+\/([a-z0-9-]+)\.png/i);
            return m ? m[1].toLowerCase() : null;
        }

        function countryFlagSrc(codeOrUrl, width) {
            if (typeof ArisanCountries !== 'undefined' && ArisanCountries.resolveFlagUrl) {
                return ArisanCountries.resolveFlagUrl(codeOrUrl, width);
            }
            return String(codeOrUrl || '');
        }

        function scheduleFinalWinnerCelebration() {
            let winner = null;
            if (isTwoLegKnockout()) {
                const tieEl = getTieElement('final-0');
                winner = tieEl ? getTieWinnerTeamData(tieEl) : null;
            } else {
                const finalMatch = document.querySelector('[data-match-id="final-0"].finished');
                winner = finalMatch ? getMatchupWinner(finalMatch) : null;
            }
            if (!winner || !winner.flagSrc) return;

            pendingFinalCelebrationWinner = winner;
            if (typeof hasEntered !== 'undefined' && hasEntered) {
                playFinalWinnerCelebration();
            }
        }

        function getWinnerCelebrationSupporters(teamName) {
            const championEntry = sideQuestPodium.champion && sideQuestPodium.champion[teamName];
            if (championEntry && championEntry.supporters && championEntry.supporters.length) {
                return championEntry.supporters.slice();
            }
            return (teamSupporters[teamName] || []).slice();
        }

        function buildWinnerAnnouncementSupporters(teamName) {
            const supporters = getWinnerCelebrationSupporters(teamName);
            if (!supporters.length) return null;

            const wrap = document.createElement('div');
            wrap.className = 'winner-announcement-supporters';

            supporters.forEach(function (participantName) {
                const item = document.createElement('div');
                item.className = 'winner-announcement-supporter';

                const avatar = document.createElement('img');
                avatar.className = 'winner-announcement-supporter-avatar';
                applyParticipantAvatar(avatar, participantName);

                const label = document.createElement('span');
                label.className = 'winner-announcement-supporter-name';
                label.textContent = participantName;

                item.appendChild(avatar);
                item.appendChild(label);
                wrap.appendChild(item);
            });

            return wrap;
        }

        function playFinalWinnerCelebration() {
            if (finalCelebrationActive || !pendingFinalCelebrationWinner || document.hidden) return;
            finalCelebrationActive = true;

            if (!finalCelebrationRepeatTimer) {
                finalCelebrationRepeatTimer = window.setInterval(
                    playFinalWinnerCelebration,
                    FINAL_CELEBRATION_REPEAT_MS
                );
            }

            const winner = pendingFinalCelebrationWinner;
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const isMobile = window.innerWidth < 600;
            const flagSrc = getCelebrationFlagSrc(winner.flagSrc);
            const overlay = document.createElement('div');
            overlay.className = 'winner-celebration';
            overlay.setAttribute('aria-hidden', 'true');

            const announcement = document.createElement('div');
            announcement.className = 'winner-announcement';
            const title = document.createElement('strong');
            title.className = 'winner-announcement-title';

            const trophy = document.createElement('img');
            trophy.className = 'winner-announcement-trophy';
            trophy.src = getTrophyImageUrl();
            trophy.alt = '';
            trophy.decoding = 'async';
            title.appendChild(trophy);

            if (flagSrc) {
                const flag = document.createElement('img');
                flag.className = 'winner-announcement-flag';
                flag.src = flagSrc;
                flag.alt = winner.name || '';
                flag.decoding = 'async';
                title.appendChild(flag);
            }

            const name = document.createElement('span');
            name.className = 'winner-announcement-name';
            name.textContent = winner.name;
            title.appendChild(name);

            const supportersEl = buildWinnerAnnouncementSupporters(winner.name);

            const subtitle = document.createElement('span');
            subtitle.className = 'winner-announcement-subtitle';

            const leagueIcon = document.createElement('img');
            leagueIcon.className = 'winner-announcement-league-icon';
            leagueIcon.src = getLeagueIconImageUrl();
            leagueIcon.alt = '';
            leagueIcon.decoding = 'async';

            const leagueText = document.createElement('span');
            leagueText.className = 'winner-announcement-league-text';
            leagueText.textContent = getLeagueChampionSubtitle();

            subtitle.append(leagueIcon, leagueText);
            if (supportersEl) {
                announcement.append(title, supportersEl, subtitle);
            } else {
                announcement.append(title, subtitle);
            }
            overlay.appendChild(announcement);

            if (!reducedMotion) {
                const canvas = document.createElement('canvas');
                canvas.className = 'winner-fireworks';
                overlay.appendChild(canvas);

                const balloonCount = isMobile ? 12 : 20;
                const fragment = document.createDocumentFragment();
                const itemPattern = [
                    'flag', 'participant', 'trophy', 'flag', 'ball',
                    'participant', 'league-icon', 'flag', 'participant', 'flag'
                ];
                const rankOneParticipants = getStandingsRankOneParticipants();
                let participantFloatIndex = 0;

                for (let i = 0; i < balloonCount; i += 1) {
                    const balloon = document.createElement('div');
                    balloon.className = 'winner-balloon';
                    balloon.style.setProperty('--balloon-left', (6 + Math.random() * 84).toFixed(1) + '%');
                    balloon.style.setProperty('--balloon-size', Math.round(48 + Math.random() * 28) + 'px');
                    balloon.style.setProperty('--balloon-delay', (Math.random() * 2.8).toFixed(2) + 's');
                    balloon.style.setProperty('--balloon-duration', (5.5 + Math.random() * 2).toFixed(2) + 's');
                    balloon.style.setProperty('--balloon-drift', Math.round(-30 + Math.random() * 60) + 'px');
                    balloon.style.setProperty('--string-tilt', Math.round(-6 + Math.random() * 12) + 'deg');

                    let itemType = itemPattern[i % itemPattern.length];
                    if (itemType === 'participant') {
                        if (rankOneParticipants.length) {
                            balloon.classList.add('winner-floating-object', 'object-participant');
                            const floatingImage = document.createElement('img');
                            const participantName = rankOneParticipants[participantFloatIndex % rankOneParticipants.length];
                            participantFloatIndex += 1;
                            applyParticipantAvatar(floatingImage, participantName);
                            balloon.appendChild(floatingImage);
                            fragment.appendChild(balloon);
                            continue;
                        }
                        itemType = 'flag';
                    }
                    if (itemType !== 'flag') {
                        balloon.classList.add('winner-floating-object', 'object-' + itemType);
                        const floatingImage = document.createElement('img');
                        floatingImage.src = itemType === 'ball'
                            ? getBallImageUrl()
                            : itemType === 'league-icon'
                                ? getLeagueIconImageUrl()
                                : getTrophyImageUrl();
                        floatingImage.alt = '';
                        floatingImage.decoding = 'async';
                        balloon.appendChild(floatingImage);
                        fragment.appendChild(balloon);
                        continue;
                    }

                    const body = document.createElement('div');
                    body.className = 'winner-balloon-body';
                    const flag = document.createElement('img');
                    flag.src = flagSrc;
                    flag.alt = '';
                    flag.decoding = 'async';
                    body.appendChild(flag);

                    const knot = document.createElement('span');
                    knot.className = 'winner-balloon-knot';
                    const string = document.createElement('span');
                    string.className = 'winner-balloon-string';
                    balloon.append(body, knot, string);
                    fragment.appendChild(balloon);
                }

                overlay.appendChild(fragment);
                document.body.appendChild(overlay);
                startWinnerFireworks(canvas, isMobile ? 5500 : 7000);
                window.setTimeout(() => {
                    overlay.remove();
                    finalCelebrationActive = false;
                }, isMobile ? 8500 : 10000);
                return;
            }

            document.body.appendChild(overlay);
            window.setTimeout(() => {
                overlay.remove();
                finalCelebrationActive = false;
            }, 4200);
        }

        function startWinnerFireworks(canvas, duration) {
            const context = canvas.getContext('2d', { alpha: true });
            if (!context) return;

            const colors = ['#ffd700', '#ff4d6d', '#50e3c2', '#4da3ff', '#ffffff'];
            const particles = [];
            const startedAt = performance.now();
            let nextBurstAt = startedAt;
            let width = 0;
            let height = 0;
            let rafId = 0;
            let ended = false;

            function resizeCanvas() {
                width = window.innerWidth;
                height = window.innerHeight;
                // Cap DPR agar canvas tidak terlalu berat di layar retina
                const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
                canvas.width = Math.round(width * pixelRatio);
                canvas.height = Math.round(height * pixelRatio);
                context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            }

            function createBurst() {
                const x = width * (0.15 + Math.random() * 0.7);
                const y = height * (0.12 + Math.random() * 0.4);
                const particleCount = width < 600 ? 14 : 20;
                const color = colors[(Math.random() * colors.length) | 0];

                for (let i = 0; i < particleCount; i += 1) {
                    const angle = (Math.PI * 2 * i / particleCount) + Math.random() * 0.12;
                    const speed = 1.2 + Math.random() * 3.2;
                    particles.push({
                        x,
                        y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        alpha: 1,
                        color,
                        size: 1.4 + Math.random() * 1.6,
                    });
                }
            }

            function render(now) {
                if (ended) return;
                context.clearRect(0, 0, width, height);

                if (now < startedAt + duration && now >= nextBurstAt) {
                    createBurst();
                    nextBurstAt = now + 700 + Math.random() * 900;
                }

                for (let i = particles.length - 1; i >= 0; i -= 1) {
                    const particle = particles[i];
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    particle.vx *= 0.98;
                    particle.vy = particle.vy * 0.98 + 0.05;
                    particle.alpha -= 0.018;

                    if (particle.alpha <= 0) {
                        const last = particles.pop();
                        if (i < particles.length) particles[i] = last;
                        continue;
                    }

                    context.globalAlpha = particle.alpha;
                    context.fillStyle = particle.color;
                    context.fillRect(
                        particle.x - particle.size,
                        particle.y - particle.size,
                        particle.size * 2,
                        particle.size * 2
                    );
                }
                context.globalAlpha = 1;

                if (now < startedAt + duration || particles.length) {
                    rafId = requestAnimationFrame(render);
                }
            }

            function stop() {
                ended = true;
                if (rafId) cancelAnimationFrame(rafId);
            }

            resizeCanvas();
            rafId = requestAnimationFrame(render);
            window.setTimeout(stop, duration + 1500);
        }

        // Contoh preview badge: buka index.html?preview-podium=1
        function applyPodiumBadgePreviewDemo() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('preview-podium') !== '1') return;

            function fillDemoMatch(matchId, team0, team1, winnerIdx, scores) {
                const matchup = document.querySelector('[data-match-id="' + matchId + '"]');
                if (!matchup) return;
                const teams = matchup.querySelectorAll(':scope > .team');
                const dateEl = matchup.querySelector('.matchup-date');
                [{ ...team0, score: scores[0] }, { ...team1, score: scores[1] }].forEach((t, i) => {
                    if (!teams[i]) return;
                    const flagEl = teams[i].querySelector('.team-flag');
                    const nameEl = teams[i].querySelector('.team-name');
                    if (flagEl) {
                        flagEl.innerHTML = '<img src="' + countryFlagSrc(t.flag) + '" alt="' + t.alt + '">';
                    }
                    if (nameEl) {
                        nameEl.textContent = t.name;
                        nameEl.classList.add('confirmed');
                    }
                    let scoreEl = teams[i].querySelector('.team-score');
                    if (!scoreEl) {
                        scoreEl = document.createElement('span');
                        scoreEl.className = 'team-score';
                        teams[i].appendChild(scoreEl);
                    }
                    scoreEl.textContent = String(t.score);
                    teams[i].classList.toggle('winner', i === winnerIdx);
                });
                matchup.classList.remove('tbd', 'today', 'live', 'waiting-admin');
                matchup.classList.add('finished');
                matchup.dataset.adminManaged = 'true';
                if (dateEl && !dateEl.querySelector('.matchup-finished-badge')) {
                    const dateText = (dateEl.dataset.scheduleDate || dateEl.textContent || '').replace(/^✅\s*/, '').trim();
                    dateEl.dataset.scheduleDate = dateText;
                    dateEl.innerHTML = '<span class="matchup-finished-badge">Match Finished</span> ' + dateText;
                }
            }

            fillDemoMatch('third-0',
                { name: 'Argentina', flag: 'ar', alt: 'ARG' },
                { name: 'Brazil', flag: 'br', alt: 'BRA' },
                0, [2, 1]);
            fillDemoMatch('final-0',
                { name: 'Spain', flag: 'es', alt: 'ESP' },
                { name: 'France', flag: 'fr', alt: 'FRA' },
                0, [3, 1]);

            applyFinalPlacementBadges();
            if (typeof drawBracketLines === 'function') drawBracketLines();
        }

        function initLiveMatchupLinks() {
            const roots = [
                document.querySelector('.bracket'),
                document.querySelector('.group-stage'),
            ].filter(Boolean);
            roots.forEach(root => {
                if (root.dataset.liveLinksBound) return;
                root.dataset.liveLinksBound = 'true';
                root.addEventListener('click', (e) => {
                    const matchup = e.target.closest('.matchup.live');
                    if (!matchup || !root.contains(matchup)) return;
                    if (e.target.closest('.supporters-toggle, .supporters-panel, .score-predict-toggle, .score-predict-panel')) return;
                    window.open(matchup.dataset.liveUrl || LIVE_STREAM_URL, '_blank', 'noopener,noreferrer');
                });
            });
        }
    

/* --- */


        // Side Quest Podium Data
        let sideQuestPodium = {
            champion: {
                'Argentina': { flag: 'ar', supporters: ['Khuang', 'Willy'], eliminated: false },
                'Portugal': { flag: 'pt', supporters: ['Davin'], eliminated: false },
                'France': { flag: 'fr', supporters: ['Ndod', 'Cham'], eliminated: false },
                'Spain': { flag: 'es', supporters: ['Marten'], eliminated: false },
                'Brazil': { flag: 'br', supporters: ['Wesly'], eliminated: false }
            },
            runnerup: {
                'Argentina': { flag: 'ar', supporters: ['Cham', 'Davin', 'Ndod', 'Marten'], eliminated: false },
                'Spain': { flag: 'es', supporters: ['Khuang', 'Wesly'], eliminated: false },
                'France': { flag: 'fr', supporters: ['Willy'], eliminated: false }
            },
            third: {
                'Brazil': { flag: 'br', supporters: ['Davin', 'Marten'], eliminated: false },
                'Spain': { flag: 'es', supporters: ['Ndod'], eliminated: false },
                'France': { flag: 'fr', supporters: ['Khuang', 'Wesly'], eliminated: false },
                'Portugal': { flag: 'pt', supporters: ['Cham', 'Willy'], eliminated: false }
            }
        };

        function getTeamFlagCode(teamEl) {
            const flagImg = teamEl.querySelector('.team-flag img');
            if (!flagImg) return null;
            return parseFlagCodeFromSrc(flagImg.getAttribute('src') || '');
        }

        function getThirdPlaceContenders() {
            const names = new Set();
            const flags = new Set();
            const thirdTie = getTieElement('third-0');
            const thirdMatchup = thirdTie ? getTieLeg1(thirdTie) : document.querySelector('[data-match-id="third-0"]');
            const ongoing = thirdTie
                ? !isTieResolved('third-0')
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
                        getTeamFlagCode(teamEl)
                    );
                });
            }

            document.querySelectorAll('.round-sf .matchup-tie, .round-sf .round-matches > .matchup.finished').forEach(unit => {
                const loser = typeof getBracketUnitLoser === 'function' ? getBracketUnitLoser(unit) : null;
                if (!loser) return;
                const flagCode = parseFlagCodeFromSrc(loser.flagSrc || '');
                addContender(loser.name, flagCode);
            });

            return { names, flags, ongoing: true };
        }

        function getEliminatedFromBracket() {
            const names = new Set();
            const flags = new Set();
            const pendingThird = getThirdPlaceContenders();

            const addEliminated = (teamName, flagCode) => {
                if (!teamName || teamName === 'TBD') return;
                if (pendingThird.names.has(teamName) || (flagCode && pendingThird.flags.has(flagCode))) return;
                names.add(teamName);
                if (flagCode) flags.add(flagCode);
            };

            if (isTwoLegKnockout()) {
                document.querySelectorAll('.bracket .matchup-tie').forEach(tieEl => {
                    const tieId = tieEl.dataset.tieId;
                    if (!tieId || !isTieResolved(tieId)) return;
                    const loser = getTieLoserTeamData(tieEl);
                    if (!loser) return;
                    const flagCode = parseFlagCodeFromSrc(loser.flagSrc || '');
                    addEliminated(loser.name, flagCode);
                });
                return { names, flags };
            }

            document.querySelectorAll('.bracket .matchup.finished').forEach(matchup => {
                matchup.querySelectorAll(':scope > .team').forEach(teamEl => {
                    if (teamEl.classList.contains('winner')) return;

                    const teamName = teamEl.querySelector('.team-name')?.textContent.trim();
                    if (!teamName || teamName === 'TBD') return;

                    const flagCode = getTeamFlagCode(teamEl);
                    if (pendingThird.names.has(teamName) || (flagCode && pendingThird.flags.has(flagCode))) {
                        return;
                    }

                    names.add(teamName);
                    if (flagCode) flags.add(flagCode);
                });
            });

            return { names, flags };
        }

        function mainQuestTeamMatchesResult(teamName, resultTeam, flagCodes) {
            if (!resultTeam) return false;
            if (resultTeam.name === teamName) return true;

            const flag = flagCodes[teamName];
            if (!flag) return false;

            const resultCode = parseFlagCodeFromSrc(resultTeam.flagSrc || '');
            return !!(resultCode && resultCode === flag);
        }

        function mainQuestTeamInSet(teamName, names, flags, flagCodes) {
            if (names.has(teamName)) return true;
            const flag = flagCodes[teamName];
            return !!(flag && flags.has(flag));
        }

        function podiumTeamMatchesResult(teamName, info, resultTeam) {
            if (!resultTeam) return false;
            if (resultTeam.name === teamName) return true;

            const resultCode = parseFlagCodeFromSrc(resultTeam.flagSrc || '');
            return !!(resultCode && resultCode === info.flag);
        }

        function podiumTeamInMatchup(teamName, info, matchId) {
            if (isTwoLegKnockout()) {
                const tieEl = getTieElement(matchId);
                const leg1 = getTieLeg1(tieEl);
                if (!leg1) return false;
                return Array.from(leg1.querySelectorAll(':scope > .team')).some(teamEl => {
                    const name = teamEl.querySelector('.team-name')?.textContent.trim();
                    if (!name || name === 'TBD') return false;
                    if (name === teamName) return true;
                    const flagCode = getTeamFlagCode(teamEl);
                    return !!(flagCode && flagCode === info.flag);
                });
            }

            const matchup = document.querySelector('[data-match-id="' + matchId + '"]');
            if (!matchup) return false;

            return Array.from(matchup.querySelectorAll(':scope > .team')).some(teamEl => {
                const name = teamEl.querySelector('.team-name')?.textContent.trim();
                if (!name || name === 'TBD') return false;
                if (name === teamName) return true;
                const flagCode = getTeamFlagCode(teamEl);
                return !!(flagCode && flagCode === info.flag);
            });
        }

        function isPodiumTeamFinalist(teamName, info) {
            if (podiumTeamInMatchup(teamName, info, 'final-0')) return true;

            const sfUnits = document.querySelectorAll('.round-sf .matchup-tie, .round-sf .round-matches > .matchup.finished');
            return Array.from(sfUnits).some(unit => {
                const winner = typeof getBracketUnitWinner === 'function' ? getBracketUnitWinner(unit) : null;
                return podiumTeamMatchesResult(teamName, info, winner);
            });
        }

        function isPodiumTeamInThirdPlace(teamName, info) {
            if (podiumTeamInMatchup(teamName, info, 'third-0')) return true;

            const sfUnits = document.querySelectorAll('.round-sf .matchup-tie, .round-sf .round-matches > .matchup.finished');
            return Array.from(sfUnits).some(unit => {
                const loser = typeof getBracketUnitLoser === 'function' ? getBracketUnitLoser(unit) : null;
                return podiumTeamMatchesResult(teamName, info, loser);
            });
        }

        function isPodiumTeamMatchLoser(teamName, info, matchup) {
            const tieEl = matchup.closest('.matchup-tie');
            if (tieEl && isTwoLegKnockout()) {
                if (!isTieResolved(tieEl.dataset.tieId)) return false;
                const loser = getTieLoserTeamData(tieEl);
                return podiumTeamMatchesResult(teamName, info, loser);
            }
            const loser = typeof getMatchupLoser === 'function' ? getMatchupLoser(matchup) : null;
            return podiumTeamMatchesResult(teamName, info, loser);
        }

        function isPodiumTeamKnockedOut(teamName, info) {
            if (isTwoLegKnockout()) {
                return Array.from(document.querySelectorAll('.bracket .matchup-tie')).some(tieEl => {
                    const tieId = tieEl.dataset.tieId;
                    if (!tieId || !isTieResolved(tieId)) return false;
                    const loser = getTieLoserTeamData(tieEl);
                    return podiumTeamMatchesResult(teamName, info, loser);
                });
            }
            return Array.from(document.querySelectorAll('.bracket .matchup.finished')).some(matchup => {
                return isPodiumTeamMatchLoser(teamName, info, matchup);
            });
        }

        function isPodiumTeamKnockedOutBeforeSf(teamName, info) {
            if (isTwoLegKnockout()) {
                return Array.from(document.querySelectorAll('.bracket .matchup-tie')).some(tieEl => {
                    const tieId = tieEl.dataset.tieId || '';
                    if (tieId.startsWith('sf-') || tieId.startsWith('final-0') || tieId.startsWith('third-0')) return false;
                    if (tieEl.closest('[data-semifinal-round="true"]')) return false;
                    if (!isTieResolved(tieId)) return false;
                    const loser = getTieLoserTeamData(tieEl);
                    return podiumTeamMatchesResult(teamName, info, loser);
                });
            }
            return Array.from(document.querySelectorAll('.bracket .matchup.finished')).some(matchup => {
                const matchId = matchup.dataset.matchId || '';
                if (matchId.startsWith('sf-') || matchId.startsWith('final-0') || matchId.startsWith('third-0')) return false;
                if (matchup.closest('[data-semifinal-round="true"]')) return false;
                return isPodiumTeamMatchLoser(teamName, info, matchup);
            });
        }

        function updateSideQuestEliminatedStatus() {
            // Default: semua glowing. Matikan glow sesuai status bracket per kolom.
            const finalFinished = isFinalResolved();
            const thirdFinished = isThirdPlaceResolved();
            const champion = typeof getFinishedMatchTeam === 'function'
                ? getFinishedMatchTeam('final-0', 'winner')
                : null;
            const runnerUp = typeof getFinishedMatchTeam === 'function'
                ? getFinishedMatchTeam('final-0', 'loser')
                : null;
            const thirdWinner = typeof getFinishedMatchTeam === 'function'
                ? getFinishedMatchTeam('third-0', 'winner')
                : null;

            Object.entries(sideQuestPodium.champion).forEach(([name, info]) => {
                if (finalFinished) {
                    // Setelah Final: hanya juara yang glowing
                    info.eliminated = !podiumTeamMatchesResult(name, info, champion);
                    return;
                }
                // Gugur atau masuk perebutan juara 3 → tidak glowing
                info.eliminated = isPodiumTeamKnockedOut(name, info) || isPodiumTeamInThirdPlace(name, info);
            });

            Object.entries(sideQuestPodium.runnerup).forEach(([name, info]) => {
                if (finalFinished) {
                    // Setelah Final: hanya runner-up (kalah Final) yang glowing
                    info.eliminated = !podiumTeamMatchesResult(name, info, runnerUp);
                    return;
                }
                // Gugur atau masuk perebutan juara 3 → tidak glowing
                info.eliminated = isPodiumTeamKnockedOut(name, info) || isPodiumTeamInThirdPlace(name, info);
            });

            Object.entries(sideQuestPodium.third).forEach(([name, info]) => {
                if (thirdFinished) {
                    // Setelah perebutan juara 3: hanya pemenang yang glowing
                    info.eliminated = !podiumTeamMatchesResult(name, info, thirdWinner);
                    return;
                }
                // Sudah lolos Final → tidak glowing di Third Place
                if (isPodiumTeamFinalist(name, info)) {
                    info.eliminated = true;
                    return;
                }
                // Sudah di slot perebutan juara 3 → tetap glowing
                if (isPodiumTeamInThirdPlace(name, info)) {
                    info.eliminated = false;
                    return;
                }
                // Gugur sebelum SF → tidak glowing; selain itu default glowing
                info.eliminated = isPodiumTeamKnockedOutBeforeSf(name, info);
            });
        }

        function updateMainQuestEliminatedStatus() {
            const { names, flags } = getEliminatedFromBracket();
            const pendingThird = getThirdPlaceContenders();
            const table = document.querySelector('.standings-table');
            if (!table) return;

            const mainQuestTeamFlagCodes = {};
            (window.LEAGUE_DATA?.teams || []).forEach(t => {
                if (t.name && t.flag) mainQuestTeamFlagCodes[t.name] = t.flag.toLowerCase();
            });
            if (!Object.keys(mainQuestTeamFlagCodes).length) {
                Object.assign(mainQuestTeamFlagCodes, { 'France': 'fr', 'Algeria': 'dz' });
            }

            const champion = typeof getFinishedMatchTeam === 'function'
                ? getFinishedMatchTeam('final-0', 'winner')
                : null;
            const runnerUp = typeof getFinishedMatchTeam === 'function'
                ? getFinishedMatchTeam('final-0', 'loser')
                : null;
            const thirdWinner = typeof getFinishedMatchTeam === 'function'
                ? getFinishedMatchTeam('third-0', 'winner')
                : null;

            const statusClasses = ['eliminated', 'mq-gold', 'mq-silver', 'mq-bronze'];
            const podiumPhase = isMainQuestPodiumPhaseActive();

            table.querySelectorAll('tbody td.mq-pot-cell').forEach(cell => {
                const teamName = cell.textContent.trim();
                const isPot1 = cell.classList.contains('pot1');
                cell.classList.remove(...statusClasses);

                // Podium results take priority over eliminated (e.g. runner-up lost final but earns silver)
                if (isPot1 && podiumPhase) {
                    if (mainQuestTeamMatchesResult(teamName, champion, mainQuestTeamFlagCodes)) {
                        cell.classList.add('mq-gold');
                        return;
                    }
                    if (mainQuestTeamMatchesResult(teamName, runnerUp, mainQuestTeamFlagCodes)) {
                        cell.classList.add('mq-silver');
                        return;
                    }
                    if (mainQuestTeamMatchesResult(teamName, thirdWinner, mainQuestTeamFlagCodes)) {
                        cell.classList.add('mq-bronze');
                        return;
                    }
                    if (mainQuestTeamInSet(teamName, pendingThird.names, pendingThird.flags, mainQuestTeamFlagCodes)) {
                        cell.classList.add('mq-bronze');
                        return;
                    }
                }

                if (mainQuestTeamInSet(teamName, names, flags, mainQuestTeamFlagCodes)) {
                    cell.classList.add('eliminated');
                    return;
                }

                if (isPot1 && podiumPhase) {
                    cell.classList.add('mq-gold');
                }
            });

            updateMainQuestBatteries(table);
        }

        function getBatteryFillColor(ratio) {
            // Green (120) when full → red (0) when empty
            const hue = Math.round(Math.max(0, Math.min(1, ratio)) * 120);
            return {
                solid: `hsla(${hue}, 72%, 42%, 0.72)`,
                soft: `hsla(${hue}, 80%, 58%, 0.45)`,
                border: `hsla(${hue}, 70%, 55%, 0.55)`,
                glow: `hsla(${hue}, 70%, 50%, 0.35)`,
            };
        }

        function updateMainQuestBatteries(table) {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;

            const standingsPoints = calculateStandingsPointsFromBracket();
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

                fill.style.width = pct + '%';

                if (alive === 0) {
                    battery.classList.add('is-empty');
                    fill.style.background = 'transparent';
                    battery.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                    battery.style.boxShadow = 'none';
                } else {
                    battery.classList.remove('is-empty');
                    const colors = getBatteryFillColor(ratio);
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
        }

        function buildPodiumCards(containerId, data) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';

            let winnerTeam = null;
            if (containerId === 'podium-champion' && isFinalResolved()) {
                winnerTeam = getFinishedMatchTeam('final-0', 'winner');
            } else if (containerId === 'podium-runnerup' && isFinalResolved()) {
                winnerTeam = getFinishedMatchTeam('final-0', 'loser');
            } else if (containerId === 'podium-3rd' && isThirdPlaceResolved()) {
                winnerTeam = getFinishedMatchTeam('third-0', 'winner');
            }

            const sortBySupportersThenName = (entries) => entries.slice().sort((a, b) => {
                const sa = (a[1].supporters && a[1].supporters.length) || 0;
                const sb = (b[1].supporters && b[1].supporters.length) || 0;
                if (sb !== sa) return sb - sa;
                return a[0].localeCompare(b[0], 'id');
            });

            const entries = Object.entries(data || {});
            const winnerEntry = winnerTeam
                ? entries.find(([name, info]) => podiumTeamMatchesResult(name, info, winnerTeam))
                : null;

            function appendPodiumCard(parent, team, info) {
                const card = document.createElement('div');
                card.className = 'podium-team-card';
                if (info.eliminated) card.classList.add('no-glow');

                const teamInfo = document.createElement('div');
                teamInfo.className = 'podium-team-info';
                const flagImg = document.createElement('img');
                flagImg.src = countryFlagSrc(info.flag);
                flagImg.alt = team;
                const nameSpan = document.createElement('span');
                nameSpan.textContent = team;
                teamInfo.appendChild(flagImg);
                teamInfo.appendChild(nameSpan);
                card.appendChild(teamInfo);

                const btn = document.createElement('button');
                btn.className = 'podium-supporters-toggle';
                btn.textContent = 'Show';

                const panel = document.createElement('div');
                panel.className = 'podium-supporters-panel';

                (info.supporters || []).forEach(s => {
                    const item = document.createElement('div');
                    item.className = 'supporter-item';
                    const img = document.createElement('img');
                    img.className = 'supporter-avatar';
                    applyParticipantAvatar(img, s);
                    const label = document.createElement('span');
                    label.className = 'supporter-name';
                    label.textContent = getInitials(s);
                    item.appendChild(img);
                    item.appendChild(label);
                    panel.appendChild(item);
                });

                btn.onclick = function() {
                    const isVisible = panel.classList.toggle('show');
                    btn.textContent = isVisible ? 'Hide' : 'Show';
                };

                card.appendChild(btn);
                card.appendChild(panel);
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
                return;
            }

            const row = document.createElement('div');
            row.className = 'podium-teams-row';
            sortBySupportersThenName(entries).forEach(([team, info]) => {
                appendPodiumCard(row, team, info);
            });
            container.appendChild(row);
        }

        // Total Goal Data (prediksi peserta — fix dari awal, tidak perlu di-update)
        let totalGoalData = [
            { name: 'Marten', goal: 57 },
            { name: 'Davin', goal: 71 },
            { name: 'Willy', goal: 81 },
            { name: 'Ndod', goal: 82 },
            { name: 'Khuang', goal: 88 },
            { name: 'Wesly', goal: 93 },
            { name: 'Cham', goal: 117 }
        ];

        // Negara pemain Golden Boot / Golden Glove (override via player.country + player.flag di config)
        const PLAYER_NATIONALITY = {
            'kylian mbappe': { country: 'France', flag: 'fr' },
            'lionel messi': { country: 'Argentina', flag: 'ar' },
            'lamine yamal': { country: 'Spain', flag: 'es' },
            'emiliano martinez': { country: 'Argentina', flag: 'ar' },
            'mike maignan': { country: 'France', flag: 'fr' },
            'vozinha': { country: 'Cape Verde', flag: 'cv' },
            'unai simon': { country: 'Spain', flag: 'es' },
            'alison becker': { country: 'Brazil', flag: 'br' },
            'alisson becker': { country: 'Brazil', flag: 'br' },
        };

        function getPlayerNationality(player) {
            if (player && player.country && player.flag) {
                return { country: player.country, flag: player.flag };
            }
            const key = String(player?.name || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
            return PLAYER_NATIONALITY[key] || null;
        }

        function appendPlayerCountry(container, player, countryClass) {
            const nationality = getPlayerNationality(player);
            if (!nationality || !container) return;

            const countryEl = document.createElement('span');
            countryEl.className = countryClass;

            const flagImg = document.createElement('img');
            flagImg.src = countryFlagSrc(nationality.flag);
            flagImg.alt = nationality.country;
            flagImg.onerror = function() { this.style.display = 'none'; };

            countryEl.appendChild(flagImg);
            countryEl.appendChild(document.createTextNode(nationality.country));
            container.appendChild(countryEl);
        }

        function applyPlayerAvatarBlend(img, src) {
            if (!img) return;
            const s = String(src || '').trim();
            if (typeof ArisanTheSportsDB !== 'undefined' &&
                typeof ArisanTheSportsDB.applyPlayerImgBlend === 'function') {
                ArisanTheSportsDB.applyPlayerImgBlend(img, s);
                return;
            }
            img.classList.remove('player-img-opaque-bg');
        }

        function sortGoldenGloveNominations(data) {
            return [...(data || [])].sort((a, b) => {
                const sa = (a.supporters && a.supporters.length) || 0;
                const sb = (b.supporters && b.supporters.length) || 0;
                if (sb !== sa) return sb - sa;
                return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
            });
        }

        function createPlayerPodiumPlace(player, icon) {
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
                applyPlayerAvatarBlend(playerImg, player.img);
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
            appendPlayerCountry(meta, player, 'player-podium-country');
            info.appendChild(meta);
            card.appendChild(info);

            const btn = document.createElement('button');
            btn.className = 'podium-supporters-toggle';
            btn.textContent = 'Show';

            const panel = document.createElement('div');
            panel.className = 'podium-supporters-panel';

            (player.supporters || []).forEach(s => {
                const item = document.createElement('div');
                item.className = 'supporter-item';
                const img = document.createElement('img');
                img.className = 'supporter-avatar';
                applyParticipantAvatar(img, s);
                const label = document.createElement('span');
                label.className = 'supporter-name';
                label.textContent = getInitials(s);
                item.appendChild(img);
                item.appendChild(label);
                panel.appendChild(item);
            });

            btn.onclick = function() {
                const isVisible = panel.classList.toggle('show');
                btn.textContent = isVisible ? 'Hide' : 'Show';
            };

            card.appendChild(btn);
            card.appendChild(panel);
            place.appendChild(card);
            return place;
        }

        function buildPlayerPodium(containerId, data, icon) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';

            const sorted = sortGoldenGloveNominations(data);
            const isGoldenGlove = containerId === 'podium-goldenglove-container';
            const winner = isGoldenGlove ? sorted.find(p => p.winner) : null;
            const others = winner ? sorted.filter(p => p !== winner) : sorted;

            if (winner) {
                const winnerRow = document.createElement('div');
                winnerRow.className = 'gg-row gg-row-winner';
                winnerRow.appendChild(createPlayerPodiumPlace(winner, icon));
                container.appendChild(winnerRow);

                if (others.length) {
                    const othersRow = document.createElement('div');
                    othersRow.className = 'gg-row gg-row-others';
                    others.forEach(player => {
                        othersRow.appendChild(createPlayerPodiumPlace(player, icon));
                    });
                    container.appendChild(othersRow);
                }
                return;
            }

            if (isGoldenGlove) {
                const row = document.createElement('div');
                row.className = 'gg-row';
                sorted.forEach(player => {
                    row.appendChild(createPlayerPodiumPlace(player, icon));
                });
                container.appendChild(row);
                return;
            }

            sorted.forEach(player => {
                container.appendChild(createPlayerPodiumPlace(player, icon));
            });
        }

        // Build Golden Boot Bar Chart (based on goals scored)
        function buildGoldenBootChart() {
            const container = document.getElementById('goldenboot-chart');
            if (!container) return;

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
                appendPlayerCountry(meta, player, 'goldenboot-player-country');
                cardInfo.appendChild(meta);
                card.appendChild(cardInfo);

                // Supporters toggle button
                const btn = document.createElement('button');
                btn.className = 'goldenboot-supporters-btn';
                btn.textContent = 'Show';

                // Supporters panel
                const panel = document.createElement('div');
                panel.className = 'goldenboot-supporters-panel';

                player.supporters.forEach(s => {
                    const item = document.createElement('div');
                    item.className = 'supporter-item';
                    const img = document.createElement('img');
                    img.className = 'supporter-avatar';
                    applyParticipantAvatar(img, s);
                    const sLabel = document.createElement('span');
                    sLabel.className = 'supporter-name';
                    sLabel.textContent = getInitials(s);
                    item.appendChild(img);
                    item.appendChild(sLabel);
                    panel.appendChild(item);
                });

                btn.onclick = function() {
                    const isVisible = panel.classList.toggle('show');
                    btn.textContent = isVisible ? 'Hide' : 'Show';
                };

                card.appendChild(btn);
                card.appendChild(panel);

                // Bar wrapper + bar
                const barWrapper = document.createElement('div');
                barWrapper.className = 'goldenboot-bar-wrapper';
                const bar = document.createElement('div');
                bar.className = 'goldenboot-bar';
                const pct = player.goals > 0 ? Math.max((player.goals / maxGoals) * 100, 15) : 15;
                bar.style.width = pct + '%';
                const valueSpan = document.createElement('span');
                valueSpan.className = 'goldenboot-value';
                valueSpan.textContent = player.goals + ' Goal';
                bar.appendChild(valueSpan);
                // Player avatar on the right of the bar
                const playerImg = document.createElement('img');
                playerImg.className = 'goldenboot-avatar';
                playerImg.src = player.img;
                playerImg.alt = player.name;
                applyPlayerAvatarBlend(playerImg, player.img);
                playerImg.onerror = function() { this.style.display = 'none'; };
                bar.appendChild(playerImg);
                barWrapper.appendChild(bar);

                barArea.appendChild(card);
                barArea.appendChild(barWrapper);
                row.appendChild(barArea);
                container.appendChild(row);
            });
        }

        // Perebutan juara 3: hanya untuk Side Quest Third Place (bukan Main Quest / current goal)
        const THIRD_PLACE_MATCH_ID = 'third-0';

        function isThirdPlaceMatchup(matchup) {
            const id = matchup?.dataset?.matchId || '';
            return id === THIRD_PLACE_MATCH_ID || id.startsWith(THIRD_PLACE_MATCH_ID + '-leg');
        }

        // Build Total Goal Vertical Progress Bar
        // Current goal = FT + ET (format "FT (ET)"). Gol penalti tidak dicatat / tidak dihitung.
        function parseTeamScore(scoreText) {
            const text = (scoreText || '').trim();
            if (!text) return 0;

            // Supports: 1(1), 1 (1), 1  (1), 1 ( 1 ) → FT + ET
            const extraTimeMatch = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
            if (extraTimeMatch) {
                return parseInt(extraTimeMatch[1], 10) + parseInt(extraTimeMatch[2], 10);
            }

            const score = parseInt(text, 10);
            return Number.isNaN(score) ? 0 : score;
        }

        function calculateCurrentGoalFromBracket() {
            let total = 0;

            document.querySelectorAll('.bracket .matchup.finished, .bracket .matchup.live').forEach(matchup => {
                // Perebutan juara 3 tidak masuk current goal
                if (isThirdPlaceMatchup(matchup)) return;

                matchup.querySelectorAll('.team-score').forEach(scoreEl => {
                    total += parseTeamScore(scoreEl.textContent);
                });
            });

            return total;
        }

        function getTotalGoalBarEndValue(currentGoal) {
            const predictions = (totalGoalData || [])
                .map(p => Math.max(0, parseInt(p.goal, 10) || 0));
            const maxPredicted = predictions.length ? Math.max(...predictions) : 0;
            const buffer = Math.max(5, Math.ceil(maxPredicted * 0.1));
            let endValue = maxPredicted + buffer;
            if (currentGoal > endValue) {
                endValue = currentGoal + Math.max(5, Math.ceil(currentGoal * 0.1));
            }
            return Math.max(endValue, 1);
        }

        function getClosestTotalGoalParticipants(currentGoal) {
            let closestDiff = Infinity;
            const closest = [];
            (totalGoalData || []).forEach(p => {
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
        }

        function getClosestTotalGoalParticipant(currentGoal) {
            const closest = getClosestTotalGoalParticipants(currentGoal).slice().sort((a, b) =>
                a.localeCompare(b)
            );
            return closest[0] || '';
        }

        function buildTotalGoalBar() {
            const container = document.getElementById('total-goal-bar');
            if (!container) return;
            container.innerHTML = '';

            const startValue = 0;
            const currentGoal = calculateCurrentGoalFromBracket();
            const endValue = getTotalGoalBarEndValue(currentGoal);
            const finalResolved = isFinalResolved();
            const closestNames = new Set(getClosestTotalGoalParticipants(currentGoal));
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

            // Fill to current goal position
            const currentPct = ((currentGoal - startValue) / (endValue - startValue)) * 100;
            const fill = document.createElement('div');
            fill.className = 'total-goal-fill-v';
            fill.style.height = currentPct + '%';
            track.appendChild(fill);

            // Start label
            const startLabel = document.createElement('span');
            startLabel.className = 'total-goal-start-label';
            startLabel.textContent = startValue;
            track.appendChild(startLabel);

            // End label
            const endLabel = document.createElement('span');
            endLabel.className = 'total-goal-end-label';
            endLabel.textContent = endValue;
            track.appendChild(endLabel);

            // Current goal indicator
            const currentTop = ((currentGoal - startValue) / (endValue - startValue)) * trackHeight;
            const currentIndicator = document.createElement('div');
            currentIndicator.className = 'total-goal-current-indicator';
            currentIndicator.style.top = currentTop + 'px';
            currentIndicator.textContent = currentGoal;

            const currentLine = document.createElement('div');
            currentIndicator.appendChild(currentLine);

            const currentLabel = document.createElement('span');
            currentLabel.className = 'total-goal-current-label-v';
            currentLabel.textContent = '';
            currentIndicator.appendChild(currentLabel);

            track.appendChild(currentIndicator);

            // Sebelum Final: eliminasi progresif bila skor aktual melewati prediksi.
            // Setelah Final: hanya peserta terdekat (glowing) yang tersisa; sisanya eliminated.
            sorted.forEach((p, index) => {
                const pct = ((p.goal - startValue) / (endValue - startValue));
                const baseTop = pct * trackHeight;
                const offset = markerOffsets[p.name] || 0;
                const finalTop = baseTop + offset;
                const isClosest = closestNames.has(p.name);
                const shouldEliminate = finalResolved
                    ? !isClosest
                    : currentGoal > p.goal && !isClosest;

                const marker = document.createElement('div');
                marker.className = 'total-goal-marker-v';
                marker.style.top = finalTop + 'px';
                if (shouldEliminate) marker.classList.add('eliminated');

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
                info.style.borderColor = participantColors[p.name] || '#2a2a5a';

                if (isClosest) {
                    info.classList.add('glowing');
                }

                const avatar = document.createElement('img');
                avatar.className = 'total-goal-marker-avatar-v';
                applyParticipantAvatar(avatar, p.name);
                avatar.style.borderColor = participantColors[p.name] || '#444';

                const name = document.createElement('span');
                name.className = 'total-goal-marker-name-v';
                name.textContent = p.name;

                const value = document.createElement('span');
                value.className = 'total-goal-marker-value-v';
                value.textContent = p.goal;
                value.style.color = participantColors[p.name] || '#f39c12';

                info.appendChild(avatar);
                info.appendChild(name);
                info.appendChild(value);
                marker.appendChild(line);
                marker.appendChild(info);
                track.appendChild(marker);
            });

            vertical.appendChild(track);
            container.appendChild(vertical);
        }

        // Standings points memakai skor Full Time saja (abaikan ET & penalti)
        function parseFullTimeScore(scoreText) {
            const text = (scoreText || '').trim();
            if (!text) return null;

            // Format "FT (ET)" → ambil FT saja
            const extraTimeMatch = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
            if (extraTimeMatch) {
                return parseInt(extraTimeMatch[1], 10);
            }

            const score = parseInt(text, 10);
            return Number.isNaN(score) ? null : score;
        }

        /** FT + ET total from bracket score display (e.g. "2 (1)" → 3). */
        function parseTotalGoalsFromScoreText(scoreText) {
            const text = (scoreText || '').trim();
            if (!text) return null;

            const extraTimeMatch = text.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
            if (extraTimeMatch) {
                return parseInt(extraTimeMatch[1], 10) + parseInt(extraTimeMatch[2], 10);
            }

            const score = parseInt(text, 10);
            return Number.isNaN(score) ? null : score;
        }

        function buildParticipantSupportedTeams() {
            const map = {};
            Object.keys(participantAvatars).forEach(name => {
                map[name] = new Set();
            });
            Object.entries(teamSupporters).forEach(([teamName, supporters]) => {
                (supporters || []).forEach(participant => {
                    if (map[participant]) map[participant].add(teamName);
                });
            });
            return map;
        }

        /** Aggregate goals for/against all teams each participant supports (FT + ET). */
        function calculateParticipantGoalStats() {
            const supportedTeams = buildParticipantSupportedTeams();
            const stats = {};
            Object.keys(participantAvatars).forEach(name => {
                stats[name] = { scored: 0, conceded: 0 };
            });

            forEachGoalStatMatchup(matchup => {
                const teams = matchup.querySelectorAll(':scope > .team');
                if (teams.length !== 2) return;

                const teamData = Array.from(teams).map(teamEl => ({
                    name: teamEl.querySelector('.team-name')?.textContent.trim(),
                    scoreText: teamEl.querySelector('.team-score')?.textContent,
                }));

                if (!teamData[0].name || !teamData[1].name) return;
                if (teamData[0].name === 'TBD' || teamData[1].name === 'TBD') return;

                const goals0 = parseTotalGoalsFromScoreText(teamData[0].scoreText);
                const goals1 = parseTotalGoalsFromScoreText(teamData[1].scoreText);
                if (goals0 === null || goals1 === null) return;

                [
                    { name: teamData[0].name, scored: goals0, conceded: goals1 },
                    { name: teamData[1].name, scored: goals1, conceded: goals0 },
                ].forEach(({ name, scored, conceded }) => {
                    Object.keys(stats).forEach(participant => {
                        if (supportedTeams[participant]?.has(name)) {
                            stats[participant].scored += scored;
                            stats[participant].conceded += conceded;
                        }
                    });
                });
            });

            return stats;
        }

        function addPointsToSupporters(points, supporters, amount) {
            (supporters || []).forEach(name => {
                if (!name || points[name] === undefined) return;
                points[name] += amount;
            });
        }

        function isSideQuestShareEnabled(category) {
            const share = pointConfig && pointConfig.sideQuestShare;
            if (!share || typeof share !== 'object') return true;
            return share[category] !== false;
        }

        /** Award side-quest points to correct guessers; optionally split the pool equally. */
        function awardSideQuestPoints(points, winners, totalAmount, shareEqually) {
            const unique = [];
            const seen = Object.create(null);
            (winners || []).forEach(name => {
                if (!name || points[name] === undefined || seen[name]) return;
                seen[name] = true;
                unique.push(name);
            });
            if (!unique.length) return;
            const pool = Number(totalAmount) || 0;
            const each = shareEqually
                ? roundStandingsPoints(pool / unique.length)
                : roundStandingsPoints(pool);
            unique.forEach(name => {
                points[name] = roundStandingsPoints(points[name] + each);
            });
        }

        function getFinishedMatchTeam(matchId, role) {
            if (isTwoLegKnockout() && typeof ArisanBracket !== 'undefined') {
                const parsed = ArisanBracket.parseMatchId(matchId);
                const tieId = parsed.leg ? parsed.tieId : matchId;
                const tieEl = getTieElement(tieId);
                if (tieEl) {
                    const teamData = role === 'winner'
                        ? getTieWinnerTeamData(tieEl)
                        : getTieLoserTeamData(tieEl);
                    if (teamData) return teamData;
                }
            }

            const matchup = document.querySelector('[data-match-id="' + matchId + '"]');
            if (!matchup || !matchup.classList.contains('finished')) return null;
            if (role === 'winner') {
                return typeof getMatchupWinner === 'function' ? getMatchupWinner(matchup) : null;
            }
            return typeof getMatchupLoser === 'function' ? getMatchupLoser(matchup) : null;
        }

        function applyFinalSideQuestBonuses(points) {
            const champion = getFinishedMatchTeam('final-0', 'winner');
            const runnerUp = getFinishedMatchTeam('final-0', 'loser');
            const third = getFinishedMatchTeam(THIRD_PLACE_MATCH_ID, 'winner');

            if (champion) {
                awardSideQuestPoints(
                    points,
                    sideQuestPodium.champion[champion.name]?.supporters,
                    pointConfig.sideQuest.champion,
                    isSideQuestShareEnabled('champion')
                );
            }
            if (runnerUp) {
                awardSideQuestPoints(
                    points,
                    sideQuestPodium.runnerup[runnerUp.name]?.supporters,
                    pointConfig.sideQuest.runnerup,
                    isSideQuestShareEnabled('runnerup')
                );
            }
            if (third && includeThirdPlace) {
                awardSideQuestPoints(
                    points,
                    sideQuestPodium.third[third.name]?.supporters,
                    pointConfig.sideQuest.third,
                    isSideQuestShareEnabled('third')
                );
            }
        }

        function applyGoldenBootBonus(points) {
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
            awardSideQuestPoints(
                points,
                winners,
                pointConfig.sideQuest.goldenBoot,
                isSideQuestShareEnabled('goldenBoot')
            );
        }

        function applyGoldenGloveBonus(points) {
            const gloveData = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.goldenGlove) || [];
            const winners = [];
            gloveData
                .filter(p => p.winner)
                .forEach(player => {
                    (player.supporters || []).forEach(name => winners.push(name));
                });
            awardSideQuestPoints(
                points,
                winners,
                pointConfig.sideQuest.goldenGlove,
                isSideQuestShareEnabled('goldenGlove')
            );
        }

        function applyTotalGoalBonus(points) {
            const currentGoal = typeof calculateCurrentGoalFromBracket === 'function'
                ? calculateCurrentGoalFromBracket()
                : 0;

            awardSideQuestPoints(
                points,
                getClosestTotalGoalParticipants(currentGoal),
                pointConfig.sideQuest.totalGoal,
                isSideQuestShareEnabled('totalGoal')
            );
        }

        function mainQuestOutcomePoints(teamName, outcome) {
            if (pointConfig.mainQuestMode === 'fifa') {
                const row = pointConfig.teamPoints && pointConfig.teamPoints[teamName];
                if (row && row[outcome] != null) return Number(row[outcome]) || 0;
            }
            return Number(pointConfig.mainQuest && pointConfig.mainQuest[outcome]) || 0;
        }

        function applyScorePredictBonus(points) {
            const amount = pointConfig.sideQuest.scorePredict;
            if (amount == null) return;
            const share = isSideQuestShareEnabled('scorePredict');

            document.querySelectorAll(
                '.bracket .matchup.finished, .group-stage .matchup.finished'
            ).forEach(matchup => {
                const matchId = matchup.dataset.matchId;
                if (!matchId) return;
                const teams = matchup.querySelectorAll(':scope > .team');
                if (teams.length !== 2) return;
                const actualA = parseFullTimeScore(teams[0].querySelector('.team-score')?.textContent);
                const actualB = parseFullTimeScore(teams[1].querySelector('.team-score')?.textContent);
                if (actualA == null || actualB == null) return;

                const winners = getScorePredictionsForMatch(matchId)
                    .filter(p => p.a === actualA && p.b === actualB)
                    .map(p => p.name);
                awardSideQuestPoints(points, winners, amount, share);
            });
        }

        function calculateStandingsPointsFromBracket() {
            const points = {};
            Object.keys(participantAvatars).forEach(name => {
                points[name] = 0;
            });

            forEachWdlMatchup(matchup => {
                const teams = matchup.querySelectorAll(':scope > .team');
                if (teams.length !== 2) return;

                const teamData = Array.from(teams).map(teamEl => ({
                    name: teamEl.querySelector('.team-name')?.textContent.trim(),
                    scoreText: teamEl.querySelector('.team-score')?.textContent,
                }));

                if (!teamData[0].name || !teamData[1].name) return;
                if (teamData[0].name === 'TBD' || teamData[1].name === 'TBD') return;

                // FT only — ET/penalti tidak mempengaruhi poin Main Quest
                const score1 = parseFullTimeScore(teamData[0].scoreText);
                const score2 = parseFullTimeScore(teamData[1].scoreText);
                if (score1 === null || score2 === null) return;

                let team1Points;
                let team2Points;
                if (score1 > score2) {
                    team1Points = mainQuestOutcomePoints(teamData[0].name, 'win');
                    team2Points = mainQuestOutcomePoints(teamData[1].name, 'loss');
                } else if (score1 < score2) {
                    team1Points = mainQuestOutcomePoints(teamData[0].name, 'loss');
                    team2Points = mainQuestOutcomePoints(teamData[1].name, 'win');
                } else {
                    team1Points = mainQuestOutcomePoints(teamData[0].name, 'draw');
                    team2Points = mainQuestOutcomePoints(teamData[1].name, 'draw');
                }

                [
                    { name: teamData[0].name, pts: team1Points },
                    { name: teamData[1].name, pts: team2Points },
                ].forEach(({ name, pts }) => {
                    (teamSupporters[name] || []).forEach(supporter => {
                        if (points[supporter] !== undefined) {
                            points[supporter] = roundStandingsPoints(points[supporter] + pts);
                        }
                    });
                });
            });

            // Bonus Side Quest (Champion / Runner-Up / Third Place) — Third Place dari perebutan juara 3 saja
            applyFinalSideQuestBonuses(points);

            // Exact score predictions — awarded as soon as each match is finished (FT)
            applyScorePredictBonus(points);

            // Bonus awards lain — hanya setelah Final selesai
            if (isFinalResolved()) {
                applyGoldenBootBonus(points);
                applyGoldenGloveBonus(points);
                applyTotalGoalBonus(points);
            }

            return points;
        }

        function compareStandingsParticipants(a, b, points, goalStats) {
            const diff = (points[b] ?? 0) - (points[a] ?? 0);
            if (diff !== 0) return diff;

            const gsA = goalStats[a] || { scored: 0, conceded: 0 };
            const gsB = goalStats[b] || { scored: 0, conceded: 0 };
            const scoredDiff = gsB.scored - gsA.scored;
            if (scoredDiff !== 0) return scoredDiff;

            const concededDiff = gsA.conceded - gsB.conceded;
            if (concededDiff !== 0) return concededDiff;

            return a.localeCompare(b);
        }

        function getStandingsRankOneParticipants() {
            const points = calculateStandingsPointsFromBracket();
            const goalStats = calculateParticipantGoalStats();
            const names = Object.keys(participantAvatars).slice().sort((a, b) =>
                compareStandingsParticipants(a, b, points, goalStats)
            );
            return names.length ? [names[0]] : [];
        }

        function roundStandingsPoints(value) {
            return Math.round((Number(value) || 0) * 100) / 100;
        }

        function formatStandingsPoints(value) {
            return roundStandingsPoints(value).toFixed(2);
        }

        function updateStandingsPoints() {
            const points = calculateStandingsPointsFromBracket();
            const chart = document.querySelector('.standings-section > .standings-chart');
            if (!chart) return;

            chart.querySelectorAll('.chart-row').forEach(row => {
                const name = row.querySelector('.chart-name')?.textContent.trim();
                const valueEl = row.querySelector('.chart-value');
                if (name && valueEl) {
                    valueEl.textContent = formatStandingsPoints(points[name] ?? 0);
                }
            });
        }

        function updateStandingsChart() {
            updateStandingsPoints();

            const chart = document.querySelector('.standings-section > .standings-chart');
            if (!chart) return;
            const rows = Array.from(chart.querySelectorAll('.chart-row'));
            
            // Get points from each row (supports decimals e.g. shared side-quest points)
            rows.forEach(row => {
                const valueEl = row.querySelector('.chart-value');
                row._points = roundStandingsPoints(parseFloat(valueEl?.textContent) || 0);
                row._name = row.querySelector('.chart-name')?.textContent.trim() || '';
            });

            const goalStats = calculateParticipantGoalStats();
            const pointsByName = Object.fromEntries(rows.map(r => [r._name, r._points]));

            // Sort: points desc → goals scored (FT+ET) desc → goals conceded (FT+ET) asc → name
            rows.sort((a, b) => compareStandingsParticipants(a._name, b._name, pointsByName, goalStats));

            rows.forEach((row, index) => {
                chart.appendChild(row);
                row.classList.remove('top-1', 'rank-1', 'rank-2', 'rank-3', 'podium-place-1', 'podium-place-2', 'podium-place-3');
                row.style.removeProperty('--glow-color');
                const rank = index + 1;
                const rankEl = row.querySelector('.chart-rank');
                const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
                const glowColors = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
                if (rankEl) rankEl.textContent = medals[rank] || String(rank);
                if (rank <= 3) {
                    row.classList.add('rank-' + rank, 'podium-place-' + rank);
                    row.style.setProperty('--glow-color', glowColors[rank]);
                }
            });

            // Calculate max points for width scaling
            const maxPoints = Math.max(...rows.map(r => r._points), 1);

            // Update widths
            rows.forEach(row => {
                const bar = row.querySelector('.chart-bar');
                const pct = Math.max((row._points / maxPoints) * 100, 8);
                bar.style.width = pct + '%';
            });
        }
    

/* --- */


        var isMuted = false;
        var hasEntered = false;
        var pausedByFocusLoss = false;
        var audio = document.getElementById('bg-music');
        if (audio) audio.volume = 0.5;

        function enterSite() {
            // Hilangkan splash overlay
            document.getElementById('splash-overlay').classList.add('hidden');
            hasEntered = true;
            window.setTimeout(playFinalWinnerCelebration, 450);
            // Mulai musik
            if (audio) {
                audio.play();
                var btn = document.getElementById('music-toggle');
                if (btn) btn.classList.add('playing');
            }
        }

        function toggleMusic() {
            if (!audio) return;
            var btn = document.getElementById('music-toggle');

            if (isMuted) {
                audio.play();
                if (btn) {
                    btn.textContent = '🔊';
                    btn.classList.remove('muted');
                    btn.classList.add('playing');
                }
                isMuted = false;
            } else {
                audio.pause();
                if (btn) {
                    btn.textContent = '🔇';
                    btn.classList.add('muted');
                    btn.classList.remove('playing');
                }
                isMuted = true;
                pausedByFocusLoss = false;
            }
        }

        function updateMusicForPageFocus() {
            if (!audio || !hasEntered || isMuted) return;

            var pageInactive = document.hidden || !document.hasFocus();

            if (pageInactive) {
                if (!audio.paused) {
                    pausedByFocusLoss = true;
                    audio.pause();
                }
            } else if (pausedByFocusLoss) {
                pausedByFocusLoss = false;
                audio.play();
            }
        }

        document.addEventListener('visibilitychange', updateMusicForPageFocus);
        window.addEventListener('blur', updateMusicForPageFocus);
        window.addEventListener('focus', updateMusicForPageFocus);
    

/* --- league data sync from Supabase --- */
window.syncLeagueDataFromDb = function syncLeagueDataFromDb() {
    const d = window.LEAGUE_DATA;
    if (!d) return;
    if (d.teamSupporters) teamSupporters = d.teamSupporters;
    if (d.participantAvatars) participantAvatars = d.participantAvatars;
    if (d.totalGoalData) totalGoalData = d.totalGoalData;
    if (d.sideQuestPodium) sideQuestPodium = d.sideQuestPodium;
    if (d.scorePredictions) scorePredictions = d.scorePredictions;
    if (d.pointConfig) {
        pointConfig = {
            mainQuestMode: d.pointConfig.mainQuestMode === 'fifa' ? 'fifa' : 'fixed',
            mainQuest: Object.assign({}, pointConfig.mainQuest, d.pointConfig.mainQuest || {}),
            teamPoints: Object.assign({}, d.pointConfig.teamPoints || {}),
            sideQuest: Object.assign({}, pointConfig.sideQuest, d.pointConfig.sideQuest || {}),
            sideQuestShare: Object.assign(
                {},
                pointConfig.sideQuestShare,
                d.pointConfig.sideQuestShare || {}
            ),
        };
    }
    if (d.includeGroupStage != null) includeGroupStage = !!d.includeGroupStage;
    if (d.includeKnockoutStage != null) includeKnockoutStage = d.includeKnockoutStage !== false;
    if (d.includeThirdPlace != null) includeThirdPlace = d.includeThirdPlace;
    if (d.twoLegKnockout != null) twoLegKnockout = !!d.twoLegKnockout;
    if (d.competitionType) competitionType = d.competitionType;
};
