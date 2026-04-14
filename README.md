# Attendance Logout Extension

This is a simple personal Chrome extension for Darwinbox attendance tracking. It reads today's attendance row, calculates both a half-day mark and a full-day logout estimate, and shows them inside the existing **Time Out** cell.

It is designed for local unpacked use only. There is no build step, no external library, and nothing here is intended for Chrome Web Store publishing.

## What The Extension Does

- Runs only on the Darwinbox attendance page at `https://musigma.darwinbox.in/ms/time/660001/attendance`
- Looks for today's row using `tr.table-row[is-today="1"]` when available, with a date-text fallback for pages that omit that attribute
- Finds the `Time In`, `Time Out`, and `Total Work Duration` cells from the table headers when possible, with a time-pattern fallback if the header lookup fails
- Calculates two estimates:
  - half day at `4 hours 30 minutes`
  - full day at `8 hours 45 minutes`
- Shows both estimates in the Time Out cell in `AM/PM` format
- Uses a `MutationObserver` so it still works when Angular renders the row later
- Avoids duplicate labels on repeated rerenders

## Folder Structure

```text
attendance-logout-extension/
├── .gitignore
├── README.md
├── content/
│   ├── attendance-dom.js
│   ├── runtime.js
│   └── time.js
├── content.js
├── manifest.json
└── styles.css
```

## Chrome Extensions In 5-10 Lines

Chrome extensions are small browser add-ons made of HTML, CSS, JavaScript, and a manifest file.  
`manifest.json` tells Chrome what the extension is called, which files it should load, and on which pages it should run.  
A **content script** is JavaScript that runs inside matching web pages and can read or update the DOM.  
CSS listed in the manifest can style elements created by the content script.  
Manifest V3 is the current extension format used by Chrome.  
For local development, you can load the extension as **unpacked** from a folder on your machine.  
After editing the files, you reload the extension in Chrome and refresh the target page to test changes.  
For debugging, the page DevTools console is usually enough for content-script logs like this project's debug messages.

## What `manifest.json` Does

The manifest is the entry point for the extension. In this project it:

- declares Manifest V3
- gives the extension a name, version, and description
- loads `content.js`, the helper scripts under `content/`, and `styles.css` as content scripts
- restricts script injection to `https://musigma.darwinbox.in/*`
- runs the content script at `document_idle`, which means after the initial page load work is mostly done

The content script then does an extra runtime check so the logic only runs on the exact attendance page path.

## How To Load The Extension In Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `attendance-logout-extension` folder
5. Open the Darwinbox attendance page:
   `https://musigma.darwinbox.in/ms/time/660001/attendance`

## How To Reload After Code Changes

1. Go back to `chrome://extensions`
2. Find **Attendance Logout Extension**
3. Click the reload icon on the extension card
4. Refresh the Darwinbox attendance page

Because this extension uses plain JavaScript with no build step, reloading the extension is enough after code changes.

## How To Debug

1. Open the target Darwinbox attendance page
2. Open DevTools with `F12` or `Ctrl+Shift+I`
3. Go to the **Console** tab
4. Look for messages prefixed with:
   `[Attendance Logout Extension]`

Useful cases:

- if the row is not present yet, you should see a helpful debug log
- if the row appears later, the `MutationObserver` should trigger another attempt
- if parsing fails because the table structure changed, the logs should tell you which step could not be completed

## Notes About Angular / Dynamic DOM

Darwinbox appears to render parts of the page dynamically. That means the attendance table or today's row may not exist at the exact moment the content script first runs.

To handle that safely, the content-script runtime does three things:

- runs once immediately
- retries again after short delays
- keeps a `MutationObserver` attached to the page so later DOM updates can trigger the logic again

The rendering logic is idempotent. The extension marks its own injected elements and removes/replaces only those, so rerenders should not stack duplicate estimate labels.

## Known Assumptions

- Today's row either exposes `tr.table-row[is-today="1"]` or includes today's date text in one of its cells
- The table headers include `Time In`, `Time Out`, and `Total Work Duration`, or the row still keeps those cells in adjacent order
- Relevant time values look like `HH:MM` or `HH:MM:SS`
- Blank `Time Out` and `Total Work Duration` cells are supported when the table headers are present
- The extension updates only the Time Out cell and does not try to rewrite unrelated table cells

If Darwinbox changes the row structure, the selector or extraction logic in `content.js` and `content/attendance-dom.js` may need a small update.

## How To Customize The Work Duration Later

Open `content.js` and find this configuration near the top:

```js
app.ESTIMATE_RULES = [
  { key: "half-day", label: "Half day", durationLabel: "4h 30m", minutes: 4 * 60 + 30, tone: "secondary" },
  { key: "full-day", label: "Logout", durationLabel: "8h 45m", minutes: 8 * 60 + 45, tone: "primary" }
];
```

Examples:

- `minutes: 5 * 60` for a 5 hour threshold
- `durationLabel: "5h"` to match that display label
- changing the `label` text updates the tooltip shown on hover

That is the only place you need to change to alter the half-day or full-day rules.
