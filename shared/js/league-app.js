/**
 * League detail — public facade (globals for bootstrap + onclick).
 * Split from bracket-app.js — uses shared ArisanLeagueApp.
 */
(function (Core) {
'use strict';

    // Functions bootstrap.js / onclick handlers expect on window
    window.splitLegacyScoreString = function () { return Core.splitLegacyScoreString.apply(Core, arguments); };
    window.getMatchScoreParts = function () { return Core.getMatchScoreParts.apply(Core, arguments); };
    window.formatScoreForDisplay = function () { return Core.formatScoreForDisplay.apply(Core, arguments); };
    window.resolveFinishedWinnerIndex = function () { return Core.resolveFinishedWinnerIndex.apply(Core, arguments); };
    window.isGroupMatchId = function () { return Core.isGroupMatchId.apply(Core, arguments); };
    window.isKnockoutMatchup = function () { return Core.isKnockoutMatchup.apply(Core, arguments); };
    window.getWdlMatchupSelector = function () { return Core.getWdlMatchupSelector.apply(Core, arguments); };
    window.forEachWdlMatchup = function () { return Core.forEachWdlMatchup.apply(Core, arguments); };
    window.forEachGoalStatMatchup = function () { return Core.forEachGoalStatMatchup.apply(Core, arguments); };
    window.isTwoLegKnockout = function () { return Core.isTwoLegKnockout.apply(Core, arguments); };
    window.getTieElement = function () { return Core.getTieElement.apply(Core, arguments); };
    window.getTieLeg1 = function () { return Core.getTieLeg1.apply(Core, arguments); };
    window.isTieResolved = function () { return Core.isTieResolved.apply(Core, arguments); };
    window.isFinalResolved = function () { return Core.isFinalResolved.apply(Core, arguments); };
    window.isThirdPlaceResolved = function () { return Core.isThirdPlaceResolved.apply(Core, arguments); };
    window.getRoundBracketUnits = function () { return Core.getRoundBracketUnits.apply(Core, arguments); };
    window.applyParticipantAvatar = function () { return Core.applyParticipantAvatar.apply(Core, arguments); };
    window.getInitials = function () { return Core.getInitials.apply(Core, arguments); };
    window.formatSupportersLabel = function () { return Core.formatSupportersLabel.apply(Core, arguments); };
    window.createPanelSlideInner = function () { return Core.createPanelSlideInner.apply(Core, arguments); };
    window.createSupportersDrop = function () { return Core.createSupportersDrop.apply(Core, arguments); };
    window.appendSupporterItems = function () { return Core.appendSupporterItems.apply(Core, arguments); };
    window.ensureSupportersPanelFilled = function () { return Core.ensureSupportersPanelFilled.apply(Core, arguments); };
    window.toggleSlidePanel = function () { return Core.toggleSlidePanel.apply(Core, arguments); };
    window.pinElementScreenY = function () { return Core.pinElementScreenY.apply(Core, arguments); };
    window.afterPanelSlide = function () { return Core.afterPanelSlide.apply(Core, arguments); };
    window.bindSupportersToggle = function () { return Core.bindSupportersToggle.apply(Core, arguments); };
    window.getTrophyImageUrl = function () { return Core.getTrophyImageUrl.apply(Core, arguments); };
    window.getLeagueIconImageUrl = function () { return Core.getLeagueIconImageUrl.apply(Core, arguments); };
    window.getBallImageUrl = function () { return Core.getBallImageUrl.apply(Core, arguments); };
    window.countryFlagSrc = function () { return Core.countryFlagSrc.apply(Core, arguments); };
    window.parseFlagCodeFromSrc = function () { return Core.parseFlagCodeFromSrc.apply(Core, arguments); };
    window.getCelebrationFlagSrc = function () { return Core.getCelebrationFlagSrc.apply(Core, arguments); };
    window.getTeamDataFromElement = function () { return Core.getTeamDataFromElement.apply(Core, arguments); };
    window.getMatchupWinner = function () { return Core.getMatchupWinner.apply(Core, arguments); };
    window.getMatchupLoser = function () { return Core.getMatchupLoser.apply(Core, arguments); };
    window.getTieWinnerTeamData = function () { return Core.getTieWinnerTeamData.apply(Core, arguments); };
    window.getTieLoserTeamData = function () { return Core.getTieLoserTeamData.apply(Core, arguments); };
    window.getBracketUnitWinner = function () { return Core.getBracketUnitWinner.apply(Core, arguments); };
    window.getBracketUnitLoser = function () { return Core.getBracketUnitLoser.apply(Core, arguments); };
    window.setTieTeamSlots = function () { return Core.setTieTeamSlots.apply(Core, arguments); };
    window.setBracketUnitTeamSlots = function () { return Core.setBracketUnitTeamSlots.apply(Core, arguments); };
    window.setTeamSlot = function () { return Core.setTeamSlot.apply(Core, arguments); };
    window.getRoundOutputWinners = function () { return Core.getRoundOutputWinners.apply(Core, arguments); };
    window.appendTeamPlaceBadge = function () { return Core.appendTeamPlaceBadge.apply(Core, arguments); };
    window.resolveMatchWinnerTeamEl = function () { return Core.resolveMatchWinnerTeamEl.apply(Core, arguments); };
    window.prefersReducedMotion = function () { return Core.prefersReducedMotion.apply(Core, arguments); };
    window.slideDimension = function () { return Core.slideDimension.apply(Core, arguments); };
    window.playBarSlide = function () { return Core.playBarSlide.apply(Core, arguments); };
    window.resetBarSlide = function () { return Core.resetBarSlide.apply(Core, arguments); };
    window.getBarDurationMs = function () { return Core.getBarDurationMs.apply(Core, arguments); };
    window.barEase = function () { return Core.barEase.apply(Core, arguments); };
    window.getBarSlideSectionEl = function () { return Core.getBarSlideSectionEl.apply(Core, arguments); };
    window.playBarSlideSection = function () { return Core.playBarSlideSection.apply(Core, arguments); };
    window.resetBarSlideSection = function () { return Core.resetBarSlideSection.apply(Core, arguments); };
    window.getBarSlideObserver = function () { return Core.getBarSlideObserver.apply(Core, arguments); };
    window.observeBarSlide = function () { return Core.observeBarSlide.apply(Core, arguments); };
    window.isThirdPlaceMatchup = function () { return Core.isThirdPlaceMatchup.apply(Core, arguments); };
    window.parseTeamScore = function () { return Core.parseTeamScore.apply(Core, arguments); };
    window.parseFullTimeScore = function () { return Core.parseFullTimeScore.apply(Core, arguments); };
    window.parseTotalGoalsFromScoreText = function () { return Core.parseTotalGoalsFromScoreText.apply(Core, arguments); };
    window.mainQuestOutcomePoints = function () { return Core.mainQuestOutcomePoints.apply(Core, arguments); };
    window.isSideQuestShareEnabled = function () { return Core.isSideQuestShareEnabled.apply(Core, arguments); };
    window.addPointsToSupporters = function () { return Core.addPointsToSupporters.apply(Core, arguments); };
    window.getFinishedMatchTeam = function () { return Core.getFinishedMatchTeam.apply(Core, arguments); };
    window.roundStandingsPoints = function () { return Core.roundStandingsPoints.apply(Core, arguments); };
    window.formatStandingsPoints = function () { return Core.formatStandingsPoints.apply(Core, arguments); };
    window.compareStandingsParticipants = function () { return Core.compareStandingsParticipants.apply(Core, arguments); };
    window.getStandingsRankOneParticipants = function () { return Core.getStandingsRankOneParticipants.apply(Core, arguments); };
    window.syncLeagueDataFromDb = function () { return Core.syncLeagueDataFromDb.apply(Core, arguments); };
    window.applyAdminConfig = function () { return Core.applyAdminConfig.apply(Core, arguments); };
    window.getBracketPoint = function () { return Core.getBracketPoint.apply(Core, arguments); };
    window.getBracketUnitLineAnchor = function () { return Core.getBracketUnitLineAnchor.apply(Core, arguments); };
    window.resolveBracketLineSource = function () { return Core.resolveBracketLineSource.apply(Core, arguments); };
    window.appendBracketConnectorPath = function () { return Core.appendBracketConnectorPath.apply(Core, arguments); };
    window.drawByeAdvanceLine = function () { return Core.drawByeAdvanceLine.apply(Core, arguments); };
    window.drawRoundTransitionLines = function () { return Core.drawRoundTransitionLines.apply(Core, arguments); };
    window.drawBracketLines = function () { return Core.drawBracketLines.apply(Core, arguments); };
    window.getSupportersMapForMatchup = function () { return Core.getSupportersMapForMatchup.apply(Core, arguments); };
    window.injectSupporters = function () { return Core.injectSupporters.apply(Core, arguments); };
    window.getScorePredictionsForMatch = function () { return Core.getScorePredictionsForMatch.apply(Core, arguments); };
    window.sortScorePredictions = function () { return Core.sortScorePredictions.apply(Core, arguments); };
    window.matchupTeamFlagSrc = function () { return Core.matchupTeamFlagSrc.apply(Core, arguments); };
    window.appendPredictFlag = function () { return Core.appendPredictFlag.apply(Core, arguments); };
    window.fillScorePredictPanel = function () { return Core.fillScorePredictPanel.apply(Core, arguments); };
    window.injectScorePredictions = function () { return Core.injectScorePredictions.apply(Core, arguments); };
    window.getTournamentYear = function () { return Core.getTournamentYear.apply(Core, arguments); };
    window.getLeagueChampionSubtitle = function () { return Core.getLeagueChampionSubtitle.apply(Core, arguments); };
    window.makeWIBDate = function () { return Core.makeWIBDate.apply(Core, arguments); };
    window.extractMatchupDateText = function () { return Core.extractMatchupDateText.apply(Core, arguments); };
    window.parseMatchupDateWIB = function () { return Core.parseMatchupDateWIB.apply(Core, arguments); };
    window.getOrStoreMatchDateText = function () { return Core.getOrStoreMatchDateText.apply(Core, arguments); };
    window.setLiveBadge = function () { return Core.setLiveBadge.apply(Core, arguments); };
    window.formatCountdownHMS = function () { return Core.formatCountdownHMS.apply(Core, arguments); };
    window.initGlowSync = function () { return Core.initGlowSync.apply(Core, arguments); };
    window.getSoonProgress = function () { return Core.getSoonProgress.apply(Core, arguments); };
    window.playSoonProgressSlide = function () { return Core.playSoonProgressSlide.apply(Core, arguments); };
    window.resetSoonProgressSlide = function () { return Core.resetSoonProgressSlide.apply(Core, arguments); };
    window.getSoonSlideObserver = function () { return Core.getSoonSlideObserver.apply(Core, arguments); };
    window.observeSoonProgressSlide = function () { return Core.observeSoonProgressSlide.apply(Core, arguments); };
    window.setSoonProgressTarget = function () { return Core.setSoonProgressTarget.apply(Core, arguments); };
    window.setSoonBadge = function () { return Core.setSoonBadge.apply(Core, arguments); };
    window.updateSoonCountdowns = function () { return Core.updateSoonCountdowns.apply(Core, arguments); };
    window.setWaitingAdminBadge = function () { return Core.setWaitingAdminBadge.apply(Core, arguments); };
    window.ensureDefaultTeamScores = function () { return Core.ensureDefaultTeamScores.apply(Core, arguments); };
    window.updateMatchupScheduleStatus = function () { return Core.updateMatchupScheduleStatus.apply(Core, arguments); };
    window.getScheduledKickoffFromMatchSchedule = function () { return Core.getScheduledKickoffFromMatchSchedule.apply(Core, arguments); };
    window.getTieScheduledKickoffMs = function () { return Core.getTieScheduledKickoffMs.apply(Core, arguments); };
    window.isMainQuestPodiumPhaseActive = function () { return Core.isMainQuestPodiumPhaseActive.apply(Core, arguments); };
    window.applyFinishedMatchBadges = function () { return Core.applyFinishedMatchBadges.apply(Core, arguments); };
    window.fillNextRoundSlotsFromTies = function () { return Core.fillNextRoundSlotsFromTies.apply(Core, arguments); };
    window.fillNextRoundSlots = function () { return Core.fillNextRoundSlots.apply(Core, arguments); };
    window.advanceKnockoutRound = function () { return Core.advanceKnockoutRound.apply(Core, arguments); };
    window.advanceThirdPlaceMatch = function () { return Core.advanceThirdPlaceMatch.apply(Core, arguments); };
    window.markConfirmedTeamNames = function () { return Core.markConfirmedTeamNames.apply(Core, arguments); };
    window.advanceBracketWinners = function () { return Core.advanceBracketWinners.apply(Core, arguments); };
    window.applyFinalPlacementBadges = function () { return Core.applyFinalPlacementBadges.apply(Core, arguments); };
    window.applyTiePlacementBadges = function () { return Core.applyTiePlacementBadges.apply(Core, arguments); };
    window.scheduleFinalWinnerCelebration = function () { return Core.scheduleFinalWinnerCelebration.apply(Core, arguments); };
    window.getWinnerCelebrationSupporters = function () { return Core.getWinnerCelebrationSupporters.apply(Core, arguments); };
    window.buildWinnerAnnouncementSupporters = function () { return Core.buildWinnerAnnouncementSupporters.apply(Core, arguments); };
    window.playFinalWinnerCelebration = function () { return Core.playFinalWinnerCelebration.apply(Core, arguments); };
    window.startWinnerFireworks = function () { return Core.startWinnerFireworks.apply(Core, arguments); };
    window.applyPodiumBadgePreviewDemo = function () { return Core.applyPodiumBadgePreviewDemo.apply(Core, arguments); };
    window.initLiveMatchupLinks = function () { return Core.initLiveMatchupLinks.apply(Core, arguments); };
    window.getTeamFlagCode = function () { return Core.getTeamFlagCode.apply(Core, arguments); };
    window.getThirdPlaceContenders = function () { return Core.getThirdPlaceContenders.apply(Core, arguments); };
    window.getEliminatedFromBracket = function () { return Core.getEliminatedFromBracket.apply(Core, arguments); };
    window.mainQuestTeamMatchesResult = function () { return Core.mainQuestTeamMatchesResult.apply(Core, arguments); };
    window.mainQuestTeamInSet = function () { return Core.mainQuestTeamInSet.apply(Core, arguments); };
    window.podiumTeamMatchesResult = function () { return Core.podiumTeamMatchesResult.apply(Core, arguments); };
    window.podiumTeamInMatchup = function () { return Core.podiumTeamInMatchup.apply(Core, arguments); };
    window.isPodiumTeamFinalist = function () { return Core.isPodiumTeamFinalist.apply(Core, arguments); };
    window.isPodiumTeamInThirdPlace = function () { return Core.isPodiumTeamInThirdPlace.apply(Core, arguments); };
    window.isPodiumTeamMatchLoser = function () { return Core.isPodiumTeamMatchLoser.apply(Core, arguments); };
    window.isPodiumTeamKnockedOut = function () { return Core.isPodiumTeamKnockedOut.apply(Core, arguments); };
    window.isPodiumTeamKnockedOutBeforeSf = function () { return Core.isPodiumTeamKnockedOutBeforeSf.apply(Core, arguments); };
    window.updateSideQuestEliminatedStatus = function () { return Core.updateSideQuestEliminatedStatus.apply(Core, arguments); };
    window.updateMainQuestEliminatedStatus = function () { return Core.updateMainQuestEliminatedStatus.apply(Core, arguments); };
    window.getBatteryFillColor = function () { return Core.getBatteryFillColor.apply(Core, arguments); };
    window.updateMainQuestBatteries = function () { return Core.updateMainQuestBatteries.apply(Core, arguments); };
    window.buildPodiumCards = function () { return Core.buildPodiumCards.apply(Core, arguments); };
    window.getPlayerNationality = function () { return Core.getPlayerNationality.apply(Core, arguments); };
    window.appendPlayerCountry = function () { return Core.appendPlayerCountry.apply(Core, arguments); };
    window.applyPlayerAvatarBlend = function () { return Core.applyPlayerAvatarBlend.apply(Core, arguments); };
    window.sortGoldenGloveNominations = function () { return Core.sortGoldenGloveNominations.apply(Core, arguments); };
    window.createPlayerPodiumPlace = function () { return Core.createPlayerPodiumPlace.apply(Core, arguments); };
    window.buildPlayerPodium = function () { return Core.buildPlayerPodium.apply(Core, arguments); };
    window.buildGoldenBootChart = function () { return Core.buildGoldenBootChart.apply(Core, arguments); };
    window.cancelTotalGoalCurrentLabel = function () { return Core.cancelTotalGoalCurrentLabel.apply(Core, arguments); };
    window.syncTotalGoalMarkers = function () { return Core.syncTotalGoalMarkers.apply(Core, arguments); };
    window.resetTotalGoalCurrentLabel = function () { return Core.resetTotalGoalCurrentLabel.apply(Core, arguments); };
    window.finishTotalGoalCurrentLabel = function () { return Core.finishTotalGoalCurrentLabel.apply(Core, arguments); };
    window.playTotalGoalCurrentLabel = function () { return Core.playTotalGoalCurrentLabel.apply(Core, arguments); };
    window.calculateCurrentGoalFromBracket = function () { return Core.calculateCurrentGoalFromBracket.apply(Core, arguments); };
    window.getTotalGoalBarEndValue = function () { return Core.getTotalGoalBarEndValue.apply(Core, arguments); };
    window.getClosestTotalGoalParticipants = function () { return Core.getClosestTotalGoalParticipants.apply(Core, arguments); };
    window.getClosestTotalGoalParticipant = function () { return Core.getClosestTotalGoalParticipant.apply(Core, arguments); };
    window.buildTotalGoalBar = function () { return Core.buildTotalGoalBar.apply(Core, arguments); };
    window.applyFinalSideQuestBonuses = function () { return Core.applyFinalSideQuestBonuses.apply(Core, arguments); };
    window.applyGoldenBootBonus = function () { return Core.applyGoldenBootBonus.apply(Core, arguments); };
    window.applyGoldenGloveBonus = function () { return Core.applyGoldenGloveBonus.apply(Core, arguments); };
    window.applyTotalGoalBonus = function () { return Core.applyTotalGoalBonus.apply(Core, arguments); };
    window.applyScorePredictBonus = function () { return Core.applyScorePredictBonus.apply(Core, arguments); };
    window.buildParticipantSupportedTeams = function () { return Core.buildParticipantSupportedTeams.apply(Core, arguments); };
    window.calculateParticipantGoalStats = function () { return Core.calculateParticipantGoalStats.apply(Core, arguments); };
    window.awardSideQuestPoints = function () { return Core.awardSideQuestPoints.apply(Core, arguments); };
    window.calculateStandingsPointsFromBracket = function () { return Core.calculateStandingsPointsFromBracket.apply(Core, arguments); };
    window.updateStandingsPoints = function () { return Core.updateStandingsPoints.apply(Core, arguments); };
    window.updateStandingsChart = function () { return Core.updateStandingsChart.apply(Core, arguments); };
    window.unlockSplashScroll = function () { return Core.unlockSplashScroll.apply(Core, arguments); };
    window.lockSplashScroll = function () { return Core.lockSplashScroll.apply(Core, arguments); };
    window.enterSite = function () { return Core.enterSite.apply(Core, arguments); };
    window.toggleMusic = function () { return Core.toggleMusic.apply(Core, arguments); };
    window.updateMusicForPageFocus = function () { return Core.updateMusicForPageFocus.apply(Core, arguments); };
    window.syncAnimPausedForVisibility = function () { return Core.syncAnimPausedForVisibility.apply(Core, arguments); };
    window.observeAnimPauseTargets = function () { return Core.observeAnimPauseTargets.apply(Core, arguments); };

    // Mutable state aliases used by bootstrap startApp
    Object.defineProperty(window, 'teamSupportersKnockout', {
        get: function () { return Core.teamSupportersKnockout; },
        set: function (v) { Core.teamSupportersKnockout = v; },
        configurable: true
    });
    Object.defineProperty(window, 'includeKnockoutStage', {
        get: function () { return Core.includeKnockoutStage; },
        set: function (v) { Core.includeKnockoutStage = v; },
        configurable: true
    });
    Object.defineProperty(window, 'teamSupportersGroup', {
        get: function () { return Core.teamSupportersGroup; },
        set: function (v) { Core.teamSupportersGroup = v; },
        configurable: true
    });
    Object.defineProperty(window, 'participantAvatars', {
        get: function () { return Core.participantAvatars; },
        set: function (v) { Core.participantAvatars = v; },
        configurable: true
    });
    Object.defineProperty(window, 'includeGroupStage', {
        get: function () { return Core.includeGroupStage; },
        set: function (v) { Core.includeGroupStage = v; },
        configurable: true
    });
    Object.defineProperty(window, 'includeThirdPlace', {
        get: function () { return Core.includeThirdPlace; },
        set: function (v) { Core.includeThirdPlace = v; },
        configurable: true
    });
    Object.defineProperty(window, 'scorePredictions', {
        get: function () { return Core.scorePredictions; },
        set: function (v) { Core.scorePredictions = v; },
        configurable: true
    });
    Object.defineProperty(window, 'competitionType', {
        get: function () { return Core.competitionType; },
        set: function (v) { Core.competitionType = v; },
        configurable: true
    });
    Object.defineProperty(window, 'sideQuestPodium', {
        get: function () { return Core.sideQuestPodium; },
        set: function (v) { Core.sideQuestPodium = v; },
        configurable: true
    });
    Object.defineProperty(window, 'teamSupporters', {
        get: function () { return Core.teamSupporters; },
        set: function (v) { Core.teamSupporters = v; },
        configurable: true
    });
    Object.defineProperty(window, 'twoLegKnockout', {
        get: function () { return Core.twoLegKnockout; },
        set: function (v) { Core.twoLegKnockout = v; },
        configurable: true
    });
    Object.defineProperty(window, 'totalGoalData', {
        get: function () { return Core.totalGoalData; },
        set: function (v) { Core.totalGoalData = v; },
        configurable: true
    });
    Object.defineProperty(window, 'pointConfig', {
        get: function () { return Core.pointConfig; },
        set: function (v) { Core.pointConfig = v; },
        configurable: true
    });
    Object.defineProperty(window, 'hasEntered', {
        get: function () { return Core.hasEntered; },
        set: function (v) { Core.hasEntered = v; },
        configurable: true
    });

    window.ArisanLeagueApp = Core;

})(window.ArisanLeagueApp);
