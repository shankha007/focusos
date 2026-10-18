import { useTimerStore } from '@/store/useTimerStore';
import {
  PENDING_COMMAND_KEY,
  SUMMARY_KEY,
  isFocusRequest,
  readCommand,
  sameSummary,
  summarize,
  type ExtensionCommand,
  type TimerSummary,
} from './summary';

/**
 * Connects the app tab to the rest of the extension.
 *
 * The app is the only place the timer actually runs — it owns the session, the
 * history and every rule about what counts. The popup, the toolbar badge and
 * the keyboard shortcut are views onto it: this module publishes a summary of
 * the timer to `chrome.storage.local` for them to read, and carries their
 * commands back into the store.
 *
 * Loaded only by the extension build (see `main.tsx`).
 */

/**
 * How old a command left for a tab that was not open yet may be and still run.
 * Long enough for the tab to open and the workspace to boot; short enough that
 * a command left by a popup whose tab never loaded is not obeyed hours later.
 */
const PENDING_COMMAND_MAX_AGE_MS = 30_000;

let lastWritten: TimerSummary | null = null;

function publish(): void {
  const { timer, taskTitle, hydrated } = useTimerStore.getState();
  // Before hydration the store holds a placeholder timer, and publishing it
  // would tell the popup a running session had stopped.
  if (!hydrated) return;
  const summary = summarize(timer, taskTitle);
  if (sameSummary(lastWritten, summary)) return;
  lastWritten = summary;
  void chrome.storage.local.set({ [SUMMARY_KEY]: summary });
}

function run(command: ExtensionCommand): void {
  const store = useTimerStore.getState();
  const { status } = store.timer;
  switch (command) {
    case 'start':
      // A start pressed while a session is already going should not restart it.
      if (status === 'idle' || status === 'completed') void store.startSession();
      break;
    case 'toggle':
      store.toggle();
      break;
    case 'skip':
      if (status === 'running' || status === 'paused') void store.skip();
      break;
  }
}

/** Commands that arrive before the workspace has booted wait for it. */
const queued: ExtensionCommand[] = [];

function receive(command: ExtensionCommand): void {
  if (useTimerStore.getState().hydrated) run(command);
  else queued.push(command);
}

async function takePendingCommand(): Promise<void> {
  const stored = await chrome.storage.local.get(PENDING_COMMAND_KEY);
  const pending = stored[PENDING_COMMAND_KEY] as { command?: unknown; at?: unknown } | undefined;
  if (!pending) return;
  await chrome.storage.local.remove(PENDING_COMMAND_KEY);
  const command = readCommand({ type: 'focusos:command', command: pending.command });
  const fresh = typeof pending.at === 'number' && Date.now() - pending.at < PENDING_COMMAND_MAX_AGE_MS;
  if (command && fresh) receive(command);
}

/**
 * Brings this tab to the front. Asked for by the popup's "Open FocusOS", which
 * would otherwise open a second copy of the app beside this one — and two tabs
 * each running the same timer would both record the session.
 */
async function bringToFront(): Promise<void> {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id === undefined) return;
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

/** Starts the bridge. Call once, from the extension's app page. */
export function startExtensionBridge(): void {
  useTimerStore.subscribe((state, previous) => {
    if (state.hydrated && !previous.hydrated) {
      queued.splice(0).forEach(run);
    }
    publish();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (isFocusRequest(message)) {
      void bringToFront();
      return;
    }
    const command = readCommand(message);
    if (command) receive(command);
  });

  void takePendingCommand();
}
