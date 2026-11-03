(() => {
  const app = globalThis.AttendanceLogoutExtension;
  if (!app) {
    return;
  }

  app.updateAttendanceEstimate = function updateAttendanceEstimate() {
    if (!app.isTargetAttendancePage()) {
      return;
    }

    const todayRow = app.findTodayAttendanceRow();
    if (!todayRow) {
      app.logDebug(`Today's attendance row was not found with selector: ${app.TODAY_ROW_SELECTOR}`);
      return;
    }

    const relevantCells = app.extractRelevantTimeCells(todayRow);
    if (!relevantCells) {
      app.logDebug("Could not identify the Time In / Time Out / duration cells in today's row.");
      return;
    }

    const { timeInText, timeOutText, durationText, timeOutCell } = relevantCells;
    const timeInParts = app.parseTimeString(timeInText);

    if (!timeInParts) {
      app.logDebug("Time In could not be parsed.", timeInText);
      return;
    }

    const estimateEntries = app.buildEstimateEntries(timeInParts);
    if (!estimateEntries.length) {
      app.logDebug("Could not calculate the configured attendance estimates.");
      return;
    }

    app.renderEstimateIntoTimeOutCell(timeOutCell, estimateEntries, timeOutText);

    app.logDebug("Attendance estimate rendered.", {
      timeIn: timeInText,
      timeOut: timeOutText || "(empty)",
      duration: durationText,
      estimates: estimateEntries.reduce((accumulator, entry) => {
        accumulator[entry.key] = entry.timeText;
        return accumulator;
      }, {})
    });
  };

  app.scheduleUpdate = function scheduleUpdate() {
    // Avoid doing work when the tab is in the background.
    if (document.hidden) {
      return;
    }

    window.clearTimeout(app.refreshTimer);
    app.refreshTimer = window.setTimeout(app.updateAttendanceEstimate, 120);
  };

  app.observeDomChanges = function observeDomChanges() {
    if (app.observerStarted || !document.body) {
      return;
    }

    const observer = new MutationObserver(() => {
      app.scheduleUpdate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
      // characterData removed to reduce observer churn
    });

    app.observerStarted = true;
    app.logDebug("MutationObserver started for attendance page updates.");
  };

  app.init = function init() {
    if (!app.isTargetAttendancePage()) {
      app.logDebug(`Skipping non-target page: ${window.location.pathname}`);
      return;
    }

    app.updateAttendanceEstimate();
    app.observeDomChanges();

    window.setTimeout(app.updateAttendanceEstimate, 500);
    window.setTimeout(app.updateAttendanceEstimate, 1500);

    // Refresh once when the user returns to the tab.
    if (!app._visibilityListenerAttached) {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          app.scheduleUpdate();
        }
      });
      app._visibilityListenerAttached = true;
    }
  };

  app.init();
})();
