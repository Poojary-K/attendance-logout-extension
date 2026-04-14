(() => {
  const app = globalThis.AttendanceLogoutExtension;
  if (!app) {
    return;
  }

  app.getCellBaseText = function getCellBaseText(cell) {
    if (!cell) {
      return "";
    }

    const clone = cell.cloneNode(true);
    clone.querySelectorAll(`[${app.GENERATED_ATTR}="true"]`).forEach((element) => element.remove());

    const cleanedText = app.normalizeText(clone.textContent);
    if (cleanedText) {
      return cleanedText;
    }

    return app.normalizeText(cell.getAttribute(app.ORIGINAL_VALUE_ATTR) || "");
  };

  app.parseTimeString = function parseTimeString(timeStr) {
    if (!timeStr) {
      return null;
    }

    const trimmed = timeStr.trim();
    if (!app.TIME_PATTERN.test(trimmed)) {
      return null;
    }

    const [hoursText, minutesText, secondsText = "0"] = trimmed.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    const seconds = Number(secondsText);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      Number.isNaN(seconds) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null;
    }

    return { hours, minutes, seconds };
  };

  app.addMinutesToTime = function addMinutesToTime(parts, minutesToAdd) {
    if (!parts || typeof minutesToAdd !== "number") {
      return null;
    }

    const totalSecondsInDay = 24 * 60 * 60;
    const startingSeconds = parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
    const updatedSeconds = ((startingSeconds + minutesToAdd * 60) % totalSecondsInDay + totalSecondsInDay) % totalSecondsInDay;

    const hours = Math.floor(updatedSeconds / 3600);
    const minutes = Math.floor((updatedSeconds % 3600) / 60);
    const seconds = updatedSeconds % 60;

    return { hours, minutes, seconds };
  };

  app.formatToAmPm = function formatToAmPm(hours, minutes, seconds = 0, includeSeconds = false) {
    const normalizedHours = ((hours % 24) + 24) % 24;
    const period = normalizedHours >= 12 ? "PM" : "AM";
    const hour12 = normalizedHours % 12 || 12;
    const paddedMinutes = String(minutes).padStart(2, "0");

    if (includeSeconds) {
      const paddedSeconds = String(seconds).padStart(2, "0");
      return `${hour12}:${paddedMinutes}:${paddedSeconds} ${period}`;
    }

    return `${hour12}:${paddedMinutes} ${period}`;
  };

  app.buildEstimateEntries = function buildEstimateEntries(timeInParts) {
    if (!timeInParts) {
      return [];
    }

    return app.ESTIMATE_RULES.map((rule) => {
      const estimatedParts = app.addMinutesToTime(timeInParts, rule.minutes);
      if (!estimatedParts) {
        return null;
      }

      return {
        ...rule,
        timeText: app.formatToAmPm(estimatedParts.hours, estimatedParts.minutes)
      };
    }).filter(Boolean);
  };

  app.serializeEstimateEntries = function serializeEstimateEntries(estimateEntries) {
    return estimateEntries.map((entry) => `${entry.key}:${entry.timeText}`).join("|");
  };
})();
