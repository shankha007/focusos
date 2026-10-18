/**
 * The toolbar popup: a view of the timer running in the app tab, with its
 * three most-used controls.
 *
 * It reads the summary the app publishes (src/extension/summary.ts) and counts
 * down to its `endsAt` locally, so it stays live without the app writing every
 * second. Commands go to the app tab as runtime messages; with no tab open, one
 * is opened behind the current tab and picks the command up from storage.
 */

const SUMMARY_KEY = "focusos:timerSummary";
const PENDING_COMMAND_KEY = "focusos:pendingCommand";
const APP_URL = chrome.runtime.getURL("app.html#/dashboard");

const LABELS = { focus: "Focus", "short-break": "Short break", "long-break": "Long break" };

const el = {
  type: document.getElementById("type"),
  time: document.getElementById("time"),
  progress: document.getElementById("progress"),
  detail: document.getElementById("detail"),
  primary: document.getElementById("primary"),
  skip: document.getElementById("skip"),
  open: document.getElementById("open"),
  hint: document.querySelector(".hint"),
};

let summary = null;
/** Set while a command is on its way, so the popup can say so instead of looking stuck. */
let waiting = false;

function remaining(now = Date.now()) {
  if (!summary) return 25 * 60000;
  if (summary.endsAt !== null) return Math.max(0, summary.endsAt - now);
  return summary.remainingMs;
}

function clock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function endTime(at) {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function render() {
  const type = summary?.type ?? "focus";
  const status = summary?.status ?? "idle";
  const active = status === "running" || status === "paused";
  const left = remaining();

  document.body.toggleAttribute("data-break", type !== "focus");
  el.type.textContent = LABELS[type];
  el.time.textContent = clock(left);
  const done = summary && summary.durationMs > 0 ? 1 - left / summary.durationMs : 0;
  el.progress.style.width = `${active ? Math.min(100, Math.max(0, done * 100)) : 0}%`;

  if (status === "running") el.primary.textContent = "Pause";
  else if (status === "paused") el.primary.textContent = "Resume";
  else el.primary.textContent = type === "focus" ? "Start focus" : "Start break";
  el.skip.hidden = !active;

  const task = summary?.taskTitle;
  if (waiting) el.detail.textContent = "Opening FocusOS…";
  else if (status === "running" && left === 0) el.detail.textContent = "Wrapping up the session…";
  else if (status === "running") el.detail.textContent = `${task ? `${task} · ` : ""}ends at ${endTime(summary.endsAt)}`;
  else if (status === "paused") el.detail.textContent = `${task ? `${task} · ` : ""}paused`;
  else el.detail.textContent = task ? `Next up: ${task}` : "Ready when you are.";

  document.title = active ? `${clock(left)} · FocusOS` : "FocusOS";
}

/** Sends a message to the open app tab. Resolves false when there is none to receive it. */
async function tellApp(message) {
  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch {
    return false;
  }
}

async function command(name) {
  if (await tellApp({ type: "focusos:command", command: name })) return;
  waiting = true;
  render();
  await chrome.storage.local.set({ [PENDING_COMMAND_KEY]: { command: name, at: Date.now() } });
  await chrome.tabs.create({ url: APP_URL, active: false });
}

async function openApp() {
  if (!(await tellApp({ type: "focusos:focus" }))) await chrome.tabs.create({ url: APP_URL });
  window.close();
}

el.primary.addEventListener("click", () => {
  const status = summary?.status ?? "idle";
  void command(status === "running" || status === "paused" ? "toggle" : "start");
});
el.skip.addEventListener("click", () => void command("skip"));
el.open.addEventListener("click", () => void openApp());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(SUMMARY_KEY in changes)) return;
  summary = changes[SUMMARY_KEY].newValue ?? null;
  waiting = false;
  render();
});

void chrome.storage.local.get(SUMMARY_KEY).then((stored) => {
  summary = stored[SUMMARY_KEY] ?? null;
  render();
});

// Show the shortcut the browser actually assigned: the user can change it, and
// it is left unset when another extension already holds the suggested keys.
void chrome.commands.getAll().then((commands) => {
  const toggle = commands.find((c) => c.name === "toggle-timer");
  if (toggle?.shortcut) el.hint.textContent = `${toggle.shortcut} to start / pause`;
  else el.hint.hidden = true;
});

render();
setInterval(render, 1000);
