/**
 * FocusOS background worker.
 *
 * The timer runs in the app tab (app.html), which publishes a summary of it to
 * chrome.storage.local — see src/extension/summary.ts for its shape. This
 * worker only watches that summary:
 *
 * - the toolbar badge shows the minutes left, so the time is visible from any
 *   tab without opening anything;
 * - an alarm is set for the session's end, and if the app tab has been closed
 *   by then it is reopened in the background so the session is recorded on
 *   time (the app only credits a session it sees end within two minutes);
 * - the keyboard shortcut is passed on to the app.
 *
 * Notifications stay the app's: it already sends them, and only it knows
 * whether the user has switched them off.
 *
 * It runs as a service worker in Chrome and Edge and as an event page in
 * Firefox, so nothing here may rely on either being alive between events.
 */

const SUMMARY_KEY = "focusos:timerSummary";
const PENDING_COMMAND_KEY = "focusos:pendingCommand";
const END_ALARM = "focusos-end";
const BADGE_ALARM = "focusos-badge";
const APP_URL = chrome.runtime.getURL("app.html#/dashboard");

const COLORS = {
  focus: "#7886ff",
  "short-break": "#40ceb2",
  "long-break": "#40ceb2",
  paused: "#949cb8",
};

function minutesLeft(summary, now = Date.now()) {
  const ms = summary.endsAt !== null ? Math.max(0, summary.endsAt - now) : summary.remainingMs;
  return Math.ceil(ms / 60000);
}

async function paintBadge(summary) {
  if (!summary || (summary.status !== "running" && summary.status !== "paused")) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "FocusOS" });
    return;
  }
  const paused = summary.status === "paused";
  await chrome.action.setBadgeBackgroundColor({ color: paused ? COLORS.paused : COLORS[summary.type] });
  // Firefox ignores this and picks its own contrasting colour; Chrome needs it.
  if (chrome.action.setBadgeTextColor) {
    await chrome.action.setBadgeTextColor({ color: "#0b0c14" });
  }
  await chrome.action.setBadgeText({ text: paused ? "❚❚" : `${minutesLeft(summary)}m` });
  await chrome.action.setTitle({
    title: `FocusOS — ${summary.type === "focus" ? "Focus" : "Break"}, ${minutesLeft(summary)} min left${paused ? " (paused)" : ""}`,
  });
}

async function schedule(summary) {
  await chrome.alarms.clear(END_ALARM);
  await chrome.alarms.clear(BADGE_ALARM);
  if (summary?.status === "running" && summary.endsAt !== null) {
    chrome.alarms.create(END_ALARM, { when: summary.endsAt });
    // Once a minute is enough for a badge that shows whole minutes.
    chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 1 });
  }
}

async function readSummary() {
  const stored = await chrome.storage.local.get(SUMMARY_KEY);
  return stored[SUMMARY_KEY] ?? null;
}

/** Whether a FocusOS app page is open in any tab. */
async function appIsOpen() {
  // Chrome and Edge (116+).
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ["TAB"] });
    return contexts.some((context) => context.documentUrl?.includes("/app.html"));
  }
  // Firefox's event page can see the extension's own tabs directly.
  if (chrome.extension?.getViews) {
    return chrome.extension.getViews({ type: "tab" }).some((view) => view.location.pathname.endsWith("/app.html"));
  }
  return false;
}

/**
 * Hands a command to the open app tab, or opens one to run it.
 *
 * With no tab open there is nothing to receive the message, so the command is
 * left in storage and the tab picks it up once it has booted.
 */
async function sendCommand(command, { focusTab }) {
  if (await appIsOpen()) {
    try {
      await chrome.runtime.sendMessage({ type: "focusos:command", command });
      return;
    } catch {
      // The tab closed between the check and the message; open a new one.
    }
  }
  await chrome.storage.local.set({ [PENDING_COMMAND_KEY]: { command, at: Date.now() } });
  await chrome.tabs.create({ url: APP_URL, active: focusTab });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(SUMMARY_KEY in changes)) return;
  const summary = changes[SUMMARY_KEY].newValue ?? null;
  void paintBadge(summary);
  void schedule(summary);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    const summary = await readSummary();
    if (alarm.name === BADGE_ALARM) {
      await paintBadge(summary);
      return;
    }
    if (alarm.name !== END_ALARM || summary?.status !== "running") return;
    await chrome.action.setBadgeText({ text: "✓" });
    // An open app tab finishes the session itself. A closed one is reopened
    // behind the current tab to do it: the app restores the session from its
    // own storage, records it, and sends the notification.
    if (!(await appIsOpen())) await chrome.tabs.create({ url: APP_URL, active: false });
  })();
});

chrome.commands.onCommand.addListener((name) => {
  if (name === "toggle-timer") void sendCommand("toggle", { focusTab: false });
});

// A browser restart drops alarms in some browsers; rebuild them from the summary.
chrome.runtime.onStartup.addListener(() => {
  void readSummary().then((summary) => {
    void paintBadge(summary);
    void schedule(summary);
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") void chrome.tabs.create({ url: APP_URL });
});
