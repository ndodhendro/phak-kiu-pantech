/**
 * League setup form — public facade (ArisanSetupForm)
 * Auto-split from setup-form.js — uses shared ArisanSetupFormCore.
 */
(function (Core) {
'use strict';

    Core.renderAll = function renderAll(opts) {
        Core.renderLeagueMeta();
        Core.renderTeams();
        Core.renderParticipants();
        Core.renderScheduleSection(opts);
        Core.renderScorePredictionsSection();
    }

    Core.init = function init() {
        Core.bindPointConfig();
        Core.bindLeagueMeta();
        if (Core.form.includeGroupStage) Core.ensureInitialGroups();
        if (Core.form.includeKnockoutStage) Core.ensureInitialTeamPair();
        Core.ensureInitialParticipant();
        Core.renderAll();
    }

    window.ArisanSetupForm = {
        DEFAULT_POINT_CONFIG: Core.DEFAULT_POINT_CONFIG,
        DEFAULT_PARTICIPANT_COLORS: Core.DEFAULT_PARTICIPANT_COLORS,
        defaultPicks: function () { return Core.defaultPicks.apply(Core, arguments); },
        get form() { return Core.form; },
        init: function () { return Core.init.apply(Core, arguments); },
        renderAll: function () { return Core.renderAll.apply(Core, arguments); },
        addParticipant: function () { return Core.addParticipant.apply(Core, arguments); },
        removeParticipant: function () { return Core.removeParticipant.apply(Core, arguments); },
        addGroup: function () { return Core.addGroup.apply(Core, arguments); },
        addTeamPair: function () { return Core.addTeamPair.apply(Core, arguments); },
        removeTeamPair: function () { return Core.removeTeamPair.apply(Core, arguments); },
        newBlankLeague: function () { return Core.newBlankLeague.apply(Core, arguments); },
        loadFromSetupData: function () { return Core.loadFromSetupData.apply(Core, arguments); },
        getPayload: function () { return Core.getPayload.apply(Core, arguments); },
        validateTeamsForSave: function () { return Core.validateTeamsForSave.apply(Core, arguments); },
        teamPairsFromFixtures: function () { return Core.teamPairsFromFixtures.apply(Core, arguments); },
        isTeamsSectionComplete: function () { return Core.isTeamsSectionComplete.apply(Core, arguments); },
        renderScheduleSection: function () { return Core.renderScheduleSection.apply(Core, arguments); },
        reorderScheduleSectionsAfterSave: function () { return Core.reorderScheduleSectionsAfterSave.apply(Core, arguments); },
    };

    // Global handlers for onclick in HTML
    window.addParticipant = function () { Core.addParticipant(); };
    window.removeParticipant = function (i) { Core.removeParticipant(i); };
    window.addTeam = function () { Core.addTeamPair(); };
    window.addGroup = function () { Core.addGroup(); };
    window.removeTeamPair = function (i) { Core.removeTeamPair(i); };
    window.newBlankLeague = function () { Core.newBlankLeague(); };

})(window.ArisanSetupFormCore);
