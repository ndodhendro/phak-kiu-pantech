/**
 * Split bracket-app.js into league-app core + section modules (same pattern as setup-form).
 * Run: node shared/js/_split-league-app.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bakPath = path.join(__dirname, 'bracket-app.js.bak');
const srcPath = fs.existsSync(bakPath) ? bakPath : path.join(__dirname, 'bracket-app.js');
const src = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const CORE = new Set([
  'splitLegacyScoreString', 'getMatchScoreParts', 'formatScoreForDisplay', 'resolveFinishedWinnerIndex',
  'isGroupMatchId', 'isKnockoutMatchup', 'getWdlMatchupSelector', 'forEachWdlMatchup', 'forEachGoalStatMatchup',
  'isTwoLegKnockout', 'getTieElement', 'getTieLeg1', 'isTieResolved', 'isFinalResolved', 'isThirdPlaceResolved',
  'getRoundBracketUnits', 'applyParticipantAvatar', 'getInitials', 'formatSupportersLabel',
  'createPanelSlideInner', 'createSupportersDrop', 'appendSupporterItems', 'ensureSupportersPanelFilled',
  'toggleSlidePanel', 'pinElementScreenY', 'afterPanelSlide', 'bindSupportersToggle',
  'getTrophyImageUrl', 'getLeagueIconImageUrl', 'getBallImageUrl',
  'countryFlagSrc', 'parseFlagCodeFromSrc', 'getCelebrationFlagSrc',
  'getTeamDataFromElement', 'getMatchupWinner', 'getMatchupLoser',
  'getTieWinnerTeamData', 'getTieLoserTeamData', 'getBracketUnitWinner', 'getBracketUnitLoser',
  'setTieTeamSlots', 'setBracketUnitTeamSlots', 'setTeamSlot', 'getRoundOutputWinners',
  'appendTeamPlaceBadge', 'resolveMatchWinnerTeamEl',
  'prefersReducedMotion', 'slideDimension', 'playBarSlide', 'resetBarSlide', 'getBarDurationMs', 'barEase',
  'getBarSlideSectionEl', 'playBarSlideSection', 'flushPendingBarSlides', 'resetBarSlideSection', 'getBarSlideObserver', 'observeBarSlide',
  'isThirdPlaceMatchup', 'parseTeamScore', 'parseFullTimeScore', 'parseTotalGoalsFromScoreText',
  'mainQuestOutcomePoints', 'isSideQuestShareEnabled', 'addPointsToSupporters',
  'getFinishedMatchTeam', 'roundStandingsPoints', 'formatStandingsPoints',
  'compareStandingsParticipants', 'getStandingsRankOneParticipants',
  'syncLeagueDataFromDb',
]);

const BRACKET = new Set([
  'applyAdminConfig',
  'getBracketPoint', 'getBracketUnitLineAnchor', 'resolveBracketLineSource', 'appendBracketConnectorPath',
  'drawByeAdvanceLine', 'drawRoundTransitionLines', 'drawBracketLines',
  'getSupportersMapForMatchup', 'injectSupporters',
  'getScorePredictionsForMatch', 'sortScorePredictions', 'matchupTeamFlagSrc', 'appendPredictFlag',
  'fillScorePredictPanel', 'injectScorePredictions',
  'getTournamentYear', 'getLeagueChampionSubtitle', 'makeWIBDate', 'extractMatchupDateText',
  'parseMatchupDateWIB', 'getOrStoreMatchDateText', 'setLiveBadge', 'formatCountdownHMS',
  'initGlowSync', 'getSoonProgress', 'playSoonProgressSlide', 'resetSoonProgressSlide',
  'getSoonSlideObserver', 'observeSoonProgressSlide', 'setSoonProgressTarget', 'setSoonBadge',
  'updateSoonCountdowns', 'setWaitingAdminBadge', 'ensureDefaultTeamScores', 'updateMatchupScheduleStatus',
  'getScheduledKickoffFromMatchSchedule', 'getTieScheduledKickoffMs', 'isMainQuestPodiumPhaseActive',
  'applyFinishedMatchBadges', 'fillNextRoundSlotsFromTies', 'fillNextRoundSlots',
  'advanceKnockoutRound', 'advanceThirdPlaceMatch', 'markConfirmedTeamNames', 'advanceBracketWinners',
  'applyFinalPlacementBadges', 'applyTiePlacementBadges',
  'scheduleFinalWinnerCelebration', 'getWinnerCelebrationSupporters', 'buildWinnerAnnouncementSupporters',
  'playFinalWinnerCelebration', 'startWinnerFireworks', 'applyPodiumBadgePreviewDemo', 'initLiveMatchupLinks',
]);

const PODIUM = new Set([
  'getTeamFlagCode', 'getThirdPlaceContenders', 'getEliminatedFromBracket',
  'mainQuestTeamMatchesResult', 'mainQuestTeamInSet', 'podiumTeamMatchesResult', 'podiumTeamInMatchup',
  'isPodiumTeamFinalist', 'isPodiumTeamInThirdPlace', 'isPodiumTeamMatchLoser',
  'isPodiumTeamKnockedOut', 'isPodiumTeamKnockedOutBeforeSf',
  'updateSideQuestEliminatedStatus', 'updateMainQuestEliminatedStatus',
  'getBatteryFillColor', 'updateMainQuestBatteries', 'buildPodiumCards',
]);

const AWARDS = new Set([
  'getPlayerNationality', 'appendPlayerCountry', 'applyPlayerAvatarBlend', 'sortGoldenGloveNominations',
  'createPlayerPodiumPlace', 'buildPlayerPodium', 'buildGoldenBootChart',
  'cancelTotalGoalCurrentLabel', 'syncTotalGoalMarkers', 'resetTotalGoalCurrentLabel',
  'finishTotalGoalCurrentLabel', 'playTotalGoalCurrentLabel',
  'calculateCurrentGoalFromBracket', 'getTotalGoalBarEndValue', 'getClosestTotalGoalParticipants',
  'getClosestTotalGoalParticipant', 'buildTotalGoalBar',
  'applyFinalSideQuestBonuses', 'applyGoldenBootBonus', 'applyGoldenGloveBonus', 'applyTotalGoalBonus',
  'applyScorePredictBonus',
]);

const STANDINGS = new Set([
  'buildParticipantSupportedTeams', 'calculateParticipantGoalStats', 'awardSideQuestPoints',
  'calculateStandingsPointsFromBracket', 'updateStandingsPoints', 'resetStandingsChartBars', 'updateStandingsChart',
]);

const SHELL = new Set([
  'unlockSplashScroll', 'lockSplashScroll', 'enterSite', 'toggleMusic',
  'updateMusicForPageFocus', 'syncAnimPausedForVisibility', 'observeAnimPauseTargets',
]);

const ALL_FN = new Set([...CORE, ...BRACKET, ...PODIUM, ...AWARDS, ...STANDINGS, ...SHELL]);

const STATE_NAMES = [
  'bracketLinesResizeTimer', 'teamSupporters', 'teamSupportersGroup', 'teamSupportersKnockout',
  'pointConfig', 'includeGroupStage', 'includeKnockoutStage', 'includeThirdPlace', 'competitionType',
  'twoLegKnockout', 'defaultAvatar', 'participantAvatars', 'scorePredictions',
  'TOURNAMENT_YEAR', 'TWENTY_FOUR_HOURS_MS', 'GLOW_RHYTHM_MS', 'LIVE_PREMATCH_MS',
  'LIVE_MATCH_DURATION_MS', 'LIVE_STREAM_URL', 'MONTH_INDEX',
  'soonSlideWatchVisible', 'soonSlideWatchToEl', 'soonSlideObserver',
  'TBD_FLAG_SRC', 'DEFAULT_TROPHY_URL', 'DEFAULT_BALL_URL', 'FINAL_PLACE_IMAGES',
  'pendingFinalCelebrationWinner', 'finalCelebrationActive', 'finalCelebrationRepeatTimer',
  'FINAL_CELEBRATION_REPEAT_MS', 'sideQuestPodium', 'totalGoalData', 'PLAYER_NATIONALITY',
  'barSlideVisible', 'barSlideSectionVisible', 'barSlideSectionMembers', 'barSlideElToSection',
  'barSlideObserver', 'totalGoalLabelAnims', 'THIRD_PLACE_MATCH_ID',
  'isMuted', 'hasEntered', 'pausedByFocusLoss', 'audio',
  'animPauseObserved', 'animPauseObserver', 'ANIM_PAUSE_SELECTOR',
];

function bucketFor(name) {
  if (CORE.has(name)) return 'core';
  if (BRACKET.has(name)) return 'bracket';
  if (PODIUM.has(name)) return 'podium';
  if (AWARDS.has(name)) return 'awards';
  if (STANDINGS.has(name)) return 'standings';
  if (SHELL.has(name)) return 'shell';
  return 'core';
}

// Normalize: strip one level of 8-space indent from every line that has it
const rawLines = src.split('\n');
const lines = rawLines.map((l) => (l.startsWith('        ') ? l.slice(8) : l));

// Parse top-level chunks (indent 0 after strip)
const chunks = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const fnMatch = line.match(/^((?:async )?function) ([A-Za-z0-9_]+)/);
  const winFn = line.match(/^window\.([A-Za-z0-9_]+) = (?:async )?function/);
  const decl = line.match(/^(let|var|const) ([A-Za-z0-9_]+) =/);
  const commentSec = line.match(/^\/\* ---/);

  if (fnMatch || winFn) {
    const name = fnMatch ? fnMatch[2] : winFn[1];
    let text = line + '\n';
    let depth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    i++;
    while (i < lines.length && depth > 0) {
      const l = lines[i];
      text += l + '\n';
      depth += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length;
      i++;
    }
    chunks.push({ type: 'function', name, text });
    continue;
  }

  if (decl) {
    const name = decl[2];
    let text = line + '\n';
    let depth =
      (line.match(/{/g) || []).length - (line.match(/}/g) || []).length +
      (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;
    i++;
    while (i < lines.length && (depth > 0 || !text.trimEnd().endsWith(';'))) {
      if (depth <= 0 && text.trimEnd().endsWith(';')) break;
      const l = lines[i];
      text += l + '\n';
      depth += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length;
      depth += (l.match(/\[/g) || []).length - (l.match(/\]/g) || []).length;
      i++;
      if (depth <= 0 && l.includes(';')) break;
    }
    chunks.push({ type: 'decl', name, text });
    continue;
  }

  // Block / section comments (attach to next chunk via pendingComment, or keep as other)
  if (commentSec || /^\/\*/.test(line.trim()) || /^\/\//.test(line.trim())) {
    let text = line + '\n';
    i++;
    if (line.trim().startsWith('/*') && !line.includes('*/')) {
      while (i < lines.length && !lines[i].includes('*/')) {
        text += lines[i] + '\n';
        i++;
      }
      if (i < lines.length) {
        text += lines[i] + '\n';
        i++;
      }
    }
    chunks.push({ type: 'other', text });
    continue;
  }

  // nested IIFE at top level e.g. (function bindSplash...
  if (/^\(function/.test(line.trim())) {
    let text = line + '\n';
    let depth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    let paren = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    i++;
    while (i < lines.length && (depth > 0 || paren > 0 || !text.trimEnd().endsWith(';'))) {
      const l = lines[i];
      text += l + '\n';
      depth += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length;
      paren += (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
      i++;
      if (depth <= 0 && paren <= 0 && /\)\s*;?\s*$/.test(l)) break;
    }
    chunks.push({ type: 'iife', text, bucket: 'shell' });
    continue;
  }

  chunks.push({ type: 'other', text: line + '\n' });
  i++;
}

function rewrite(text) {
  let out = text;
  // Don't rewrite property access (foo.bar) or already-qualified Core.bar
  const protect = (name) =>
    new RegExp('(?<![.\\w])' + name + '\\b', 'g');

  for (const c of STATE_NAMES.sort((a, b) => b.length - a.length)) {
    out = out.replace(protect(c), 'Core.' + c);
  }
  for (const fn of [...ALL_FN].sort((a, b) => b.length - a.length)) {
    out = out.replace(protect(fn), 'Core.' + fn);
  }
  // Fix definitions
  out = out.replace(/^((?:async )?function) Core\.([A-Za-z0-9_]+)/gm, 'Core.$2 = $1 $2');
  out = out.replace(/^window\.Core\.([A-Za-z0-9_]+) = /gm, 'Core.$1 = ');
  out = out.replace(/^window\.([A-Za-z0-9_]+) = (async )?function/gm, 'Core.$1 = $2function');
  out = out.replace(/Core\.([A-Za-z0-9_]+) = async function Core\.\1/g, 'Core.$1 = async function $1');
  out = out.replace(/Core\.([A-Za-z0-9_]+) = function Core\.\1/g, 'Core.$1 = function $1');
  out = out.replace(/Core\.([A-Za-z0-9_]+) = async function  \$1/g, 'Core.$1 = async function $1');
  out = out.replace(/Core\.([A-Za-z0-9_]+) = function  \$1/g, 'Core.$1 = function $1');
  // decl → Core.x =
  out = out.replace(/^(let|var|const) Core\.([A-Za-z0-9_]+) =/gm, 'Core.$2 =');
  out = out.replace(/^(let|var|const) ([A-Za-z0-9_]+) =/gm, (m, k, n) => {
    if (STATE_NAMES.includes(n) || ALL_FN.has(n)) return 'Core.' + n + ' =';
    return m;
  });
  return out;
}

function convertFn(chunk) {
  let text = chunk.text;
  if (text.startsWith('window.')) {
    text = text.replace(/^window\.([A-Za-z0-9_]+) = (async )?function/, 'Core.$1 = $2function');
  } else {
    text = text.replace(/^((?:async )?function) ([A-Za-z0-9_]+)/, 'Core.$2 = $1 $2');
  }
  text = rewrite(text);
  // normalize "function  name" double space
  text = text.replace(/= function  /g, '= function ');
  text = text.replace(/= async function  /g, '= async function ');
  // ASI: prevent `}(function` when next chunk is an IIFE
  text = text.replace(/\}\s*$/, '};');
  if (!/;\s*$/.test(text)) text = text.replace(/\s*$/, ';\n');
  return text;
}

function convertDecl(chunk) {
  let text = chunk.text.replace(/^(let|var|const) ([A-Za-z0-9_]+) =/, 'Core.$2 =');
  text = rewrite(text);
  if (!/;\s*$/.test(text.trimEnd())) text = text.replace(/\s*$/, ';\n');
  return text;
}

const buckets = { core: [], bracket: [], podium: [], awards: [], standings: [], shell: [] };

for (const chunk of chunks) {
  if (chunk.type === 'function') {
    buckets[bucketFor(chunk.name)].push(convertFn(chunk));
  } else if (chunk.type === 'decl') {
    buckets.core.push(convertDecl(chunk));
  } else if (chunk.type === 'iife') {
    // Leading ; guards against ASI with prior function expression assignment
    buckets[chunk.bucket || 'shell'].push(';' + rewrite(chunk.text));
  } else if (chunk.type === 'other') {
    const t = chunk.text.trim();
    if (!t || t.startsWith('/* ---')) continue;
    if (t.startsWith('//') || t.startsWith('/*')) {
      buckets.core.push(chunk.text);
    }
  }
}

const header = (title) =>
  `/**\n * ${title}\n * Split from bracket-app.js — shared ArisanLeagueApp core.\n */\n`;

function wrap(title, key, initCore) {
  const open = initCore
    ? `(function (Core) {\n'use strict';\n\n`
    : `(function (Core) {\n'use strict';\n\n`;
  const assign = initCore ? 'window.ArisanLeagueApp = window.ArisanLeagueApp || {}' : 'window.ArisanLeagueApp';
  return header(title) + open + buckets[key].join('\n') + `\n})(${assign});\n`;
}

fs.writeFileSync(path.join(__dirname, 'league-app-core.js'), wrap('League detail — shared core (state + helpers)', 'core', true));
fs.writeFileSync(path.join(__dirname, 'league-section-bracket.js'), wrap('League detail — group/KO bracket interactions', 'bracket', false));
fs.writeFileSync(path.join(__dirname, 'league-section-podium.js'), wrap('League detail — side quest / main quest podium UI', 'podium', false));
fs.writeFileSync(path.join(__dirname, 'league-section-awards.js'), wrap('League detail — golden boot / glove / total goal', 'awards', false));
fs.writeFileSync(path.join(__dirname, 'league-section-standings.js'), wrap('League detail — standings points chart', 'standings', false));
fs.writeFileSync(path.join(__dirname, 'league-section-shell.js'), wrap('League detail — splash, music, anim pause', 'shell', false));

const exposeFns = [...ALL_FN];
const exposeState = STATE_NAMES.filter((n) =>
  ['sideQuestPodium', 'teamSupporters', 'teamSupportersGroup', 'teamSupportersKnockout',
    'pointConfig', 'participantAvatars', 'scorePredictions', 'totalGoalData',
    'includeGroupStage', 'includeKnockoutStage', 'includeThirdPlace', 'twoLegKnockout',
    'competitionType', 'hasEntered'].includes(n)
);

const uniqueFns = [...new Set(exposeFns)];
const uniqueState = [...new Set(exposeState)];

const facade = `/**
 * League detail — public facade (globals for bootstrap + onclick).
 * Split from bracket-app.js — uses shared ArisanLeagueApp.
 */
(function (Core) {
'use strict';

    // Functions bootstrap.js / onclick handlers expect on window
${uniqueFns.map((n) => `    window.${n} = function () { return Core.${n}.apply(Core, arguments); };`).join('\n')}

    // Mutable state aliases used by bootstrap startApp
${uniqueState.map((n) => `    Object.defineProperty(window, '${n}', {
        get: function () { return Core.${n}; },
        set: function (v) { Core.${n} = v; },
        configurable: true
    });`).join('\n')}

    window.ArisanLeagueApp = Core;

})(window.ArisanLeagueApp);
`;

fs.writeFileSync(path.join(__dirname, 'league-app.js'), facade);

// Replace bracket-app.js with a thin re-export note? Keep as deprecated shim that loads nothing — better delete usage from HTML only.
const missing = [...ALL_FN].filter((n) => {
  const all = fs.readFileSync(path.join(__dirname, 'league-app-core.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, 'league-section-bracket.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, 'league-section-podium.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, 'league-section-awards.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, 'league-section-standings.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, 'league-section-shell.js'), 'utf8');
  return !all.includes('Core.' + n + ' =');
});
console.log('fn chunks', chunks.filter((c) => c.type === 'function').length);
console.log('missing', missing);
console.log('done');
