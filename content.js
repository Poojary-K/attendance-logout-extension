(() => {
  const app = globalThis.AttendanceLogoutExtension || {};

  app.LOG_PREFIX = "[Attendance Logout Extension]";
  app.TARGET_PATH = "/ms/time/660001/attendance";
  app.TODAY_ROW_SELECTOR = 'tr.table-row[is-today="1"]';
  app.GENERATED_ATTR = "data-attendance-logout-generated";
  app.ORIGINAL_VALUE_ATTR = "data-attendance-logout-original";
  app.ESTIMATE_VALUE_ATTR = "data-attendance-logout-estimate";
  app.ENHANCED_ATTR = "data-attendance-logout-enhanced";
  app.ESTIMATE_RULES = [
    { key: "half-day", label: "Half day", durationLabel: "4h 30m", minutes: 4 * 60 + 30, tone: "secondary" },
    { key: "full-day", label: "Logout", durationLabel: "8h 45m", minutes: 8 * 60 + 45, tone: "primary" }
  ];
  app.TIME_PATTERN = /^\d{1,2}:\d{2}(?::\d{2})?$/;

  app.observerStarted = false;
  app.refreshTimer = null;

  app.logDebug = function logDebug(message, details) {
    if (details !== undefined) {
      console.debug(app.LOG_PREFIX, message, details);
      return;
    }

    console.debug(app.LOG_PREFIX, message);
  };

  app.normalizeText = function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  };

  app.isTargetAttendancePage = function isTargetAttendancePage() {
    return window.location.origin === "https://musigma.darwinbox.in" && window.location.pathname === app.TARGET_PATH;
  };

  globalThis.AttendanceLogoutExtension = app;
})();
