(() => {
  const app = globalThis.AttendanceLogoutExtension;
  if (!app) {
    return;
  }

  app.findTodayAttendanceRow = function findTodayAttendanceRow() {
    const selectorMatch = document.querySelector(app.TODAY_ROW_SELECTOR);
    if (selectorMatch) {
      return selectorMatch;
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear());
    const todayDateCandidates = new Set([
      `${day}-${month}-${year}`,
      `${day}/${month}/${year}`,
      `${day}.${month}.${year}`
    ]);

    const allRows = Array.from(document.querySelectorAll("tr"));
    return (
      allRows.find((row) => {
        const cellTexts = Array.from(row.querySelectorAll("td")).map((cell) => app.getCellBaseText(cell));
        if (!cellTexts.length) {
          return false;
        }

        const hasTodayDate = cellTexts.some((text) => todayDateCandidates.has(text));
        const hasTimeValue = cellTexts.some((text) => app.TIME_PATTERN.test(text));

        return hasTodayDate && hasTimeValue;
      }) || null
    );
  };

  app.extractCellsByHeader = function extractCellsByHeader(row) {
    if (!row) {
      return null;
    }

    const table = row.closest("table");
    if (!table) {
      return null;
    }

    const headerRow =
      table.querySelector("thead tr") ||
      Array.from(table.querySelectorAll("tr")).find((candidateRow) => candidateRow.querySelector("th"));

    if (!headerRow) {
      return null;
    }

    const headerCells = Array.from(headerRow.querySelectorAll("th"));
    const rowCells = Array.from(row.querySelectorAll("td"));

    if (!headerCells.length || !rowCells.length) {
      return null;
    }

    const indexes = headerCells.reduce((accumulator, headerCell, index) => {
      const headerText = app.normalizeText(headerCell.textContent).toLowerCase();

      if (headerText === "time in") {
        accumulator.timeInIndex = index;
      } else if (headerText === "time out") {
        accumulator.timeOutIndex = index;
      } else if (headerText === "total work duration") {
        accumulator.durationIndex = index;
      }

      return accumulator;
    }, {});

    const { timeInIndex, timeOutIndex, durationIndex } = indexes;
    if (
      typeof timeInIndex !== "number" ||
      typeof timeOutIndex !== "number" ||
      typeof durationIndex !== "number"
    ) {
      return null;
    }

    const timeInCell = rowCells[timeInIndex];
    const timeOutCell = rowCells[timeOutIndex];
    const durationCell = rowCells[durationIndex];

    if (!timeInCell || !timeOutCell || !durationCell) {
      return null;
    }

    return {
      timeInCell,
      timeOutCell,
      durationCell,
      timeInText: app.getCellBaseText(timeInCell),
      timeOutText: app.getCellBaseText(timeOutCell),
      durationText: app.getCellBaseText(durationCell)
    };
  };

  app.extractRelevantTimeCells = function extractRelevantTimeCells(row) {
    if (!row) {
      return null;
    }

    const headerMatchedCells = app.extractCellsByHeader(row);
    if (headerMatchedCells) {
      return headerMatchedCells;
    }

    const cellDescriptors = Array.from(row.querySelectorAll("td")).map((cell, index) => {
      const text = app.getCellBaseText(cell);

      return {
        cell,
        index,
        text,
        isTime: app.TIME_PATTERN.test(text)
      };
    });

    for (let index = 0; index <= cellDescriptors.length - 3; index += 1) {
      const first = cellDescriptors[index];
      const second = cellDescriptors[index + 1];
      const third = cellDescriptors[index + 2];

      const isPotentialTimeOutCell = second.text === "" || second.isTime;

      if (first.isTime && third.isTime && isPotentialTimeOutCell) {
        return {
          timeInCell: first.cell,
          timeOutCell: second.cell,
          durationCell: third.cell,
          timeInText: first.text,
          timeOutText: second.text,
          durationText: third.text
        };
      }
    }

    const matchedTimeCells = cellDescriptors.filter((descriptor) => descriptor.isTime);

    if (matchedTimeCells.length >= 3) {
      const [timeIn, timeOut, duration] = matchedTimeCells;
      return {
        timeInCell: timeIn.cell,
        timeOutCell: timeOut.cell,
        durationCell: duration.cell,
        timeInText: timeIn.text,
        timeOutText: timeOut.text,
        durationText: duration.text
      };
    }

    if (matchedTimeCells.length >= 2) {
      const [timeIn, duration] = matchedTimeCells;

      if (duration.index === timeIn.index + 2) {
        const middleCell = cellDescriptors[timeIn.index + 1];

        return {
          timeInCell: timeIn.cell,
          timeOutCell: middleCell.cell,
          durationCell: duration.cell,
          timeInText: timeIn.text,
          timeOutText: middleCell.text,
          durationText: duration.text
        };
      }
    }

    return null;
  };

  app.createEstimateBadge = function createEstimateBadge(entry) {
    const badge = document.createElement("div");
    badge.className = `attendance-logout-estimate attendance-logout-estimate-${entry.tone}`;
    badge.setAttribute(app.GENERATED_ATTR, "true");
    badge.title = `${entry.label}: ${entry.timeText}`;

    const durationText = document.createElement("span");
    durationText.className = "attendance-logout-estimate-duration";
    durationText.setAttribute(app.GENERATED_ATTR, "true");
    durationText.textContent = entry.durationLabel;

    const timeText = document.createElement("span");
    timeText.className = "attendance-logout-estimate-time";
    timeText.setAttribute(app.GENERATED_ATTR, "true");
    timeText.textContent = entry.timeText;

    badge.append(durationText, timeText);
    return badge;
  };

  app.renderEstimateIntoTimeOutCell = function renderEstimateIntoTimeOutCell(timeOutCell, estimateEntries, actualText) {
    if (!timeOutCell || !estimateEntries.length) {
      return;
    }

    const trimmedActualText = (actualText || "").trim();
    const existingOriginalText = (timeOutCell.getAttribute(app.ORIGINAL_VALUE_ATTR) || "").trim();
    const existingEstimateText = (timeOutCell.getAttribute(app.ESTIMATE_VALUE_ATTR) || "").trim();
    const existingWrapper = timeOutCell.querySelector(".attendance-logout-wrapper");
    const estimateSignature = app.serializeEstimateEntries(estimateEntries);

    if (
      timeOutCell.getAttribute(app.ENHANCED_ATTR) === "true" &&
      existingOriginalText === trimmedActualText &&
      existingEstimateText === estimateSignature &&
      existingWrapper
    ) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "attendance-logout-wrapper";
    wrapper.setAttribute(app.GENERATED_ATTR, "true");

    if (trimmedActualText) {
      const actualLine = document.createElement("div");
      actualLine.className = "attendance-logout-actual";
      actualLine.setAttribute(app.GENERATED_ATTR, "true");
      actualLine.textContent = trimmedActualText;

      const estimatesLine = document.createElement("div");
      estimatesLine.className = "attendance-logout-estimates";
      estimatesLine.setAttribute(app.GENERATED_ATTR, "true");
      estimateEntries.forEach((entry) => estimatesLine.appendChild(app.createEstimateBadge(entry)));

      wrapper.append(actualLine, estimatesLine);
    } else {
      const estimatesLine = document.createElement("div");
      estimatesLine.className = "attendance-logout-estimates";
      estimatesLine.setAttribute(app.GENERATED_ATTR, "true");
      estimateEntries.forEach((entry) => estimatesLine.appendChild(app.createEstimateBadge(entry)));

      wrapper.appendChild(estimatesLine);
    }

    timeOutCell.setAttribute(app.ORIGINAL_VALUE_ATTR, trimmedActualText);
    timeOutCell.setAttribute(app.ESTIMATE_VALUE_ATTR, estimateSignature);
    timeOutCell.setAttribute(app.ENHANCED_ATTR, "true");
    timeOutCell.textContent = "";
    timeOutCell.appendChild(wrapper);
  };
})();
