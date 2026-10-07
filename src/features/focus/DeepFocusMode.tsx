import { useEffect, useMemo, useRef, useState } from "react";
import {
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Presence } from "@/components/Presence";
import { Tooltip } from "@/components/ui/tooltip";
import { TimerRing } from "@/components/TimerRing";
import { DistractionLogger } from "./DistractionLogger";
import { BreakActivity } from "./BreakActivity";
import { WaterBreakCard } from "./WaterBreakCard";
import { AmbientOrbs } from "./AmbientOrbs";
import { SoundPicker } from "./SoundPicker";
import { SoundNudge } from "./SoundNudge";
import { useTimerStore } from "@/store/useTimerStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useHotkeys } from "@/hooks/useHotkeys";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { cn, formatClock, formatTime } from "@/lib/utils";
import {
  labelForType,
  progress as progressOf,
  projectedEndAt,
  remainingMs,
} from "@/engine/timerEngine";
import { countdownAnnouncement } from "./milestones";

/** Tracks the window's size so the ring can be sized against the height as well as the width. */
function useViewport() {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    const onResize = () => setViewport(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return viewport;
}

/**
 * The largest ring that leaves room for everything else on screen. The ring
 * used to be a fixed 360px, which on a short window (a laptop with the
 * taskbar showing, a browser at 125% zoom) pushed the break cards below the
 * fold of an overlay that could not scroll. `reserved` is the height the rest
 * of the column needs: bars, controls, and whatever sits under the ring.
 */
function ringSizeFor(
  { width, height }: { width: number; height: number },
  reserved: number,
) {
  const max = width < 640 ? 280 : 360;
  return Math.round(
    Math.max(200, Math.min(max, width - 48, height - reserved)),
  );
}

/** The full-screen session view: nothing but the ring, the time, and the controls. Everything here is reachable from the keyboard — space to start or pause, N to skip, D to log a distraction, S for sound, P to float the timer, Esc to leave. */
export function DeepFocusMode({ onClose }: { onClose: () => void }) {
  const timer = useTimerStore((s) => s.timer);
  useTimerStore((s) => s.tick);
  const taskTitle = useTimerStore((s) => s.taskTitle);
  const distractionCount = useTimerStore((s) => s.distractionCount);
  const toggle = useTimerStore((s) => s.toggle);
  // The guard that used to live here now sits in the store, so the command
  // palette's reset asks the same question this one does.
  const requestReset = useTimerStore((s) => s.requestReset);
  const skip = useTimerStore((s) => s.skip);

  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const pip = usePictureInPicture();
  const viewport = useViewport();

  const [showDistraction, setShowDistraction] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const running = timer.status === "running";
  const isFocus = timer.type === "focus";
  // A distraction is an interruption *of something*. Between sessions there is
  // nothing to interrupt, so the logger stays out of the way until the clock is
  // actually going.
  const inSession = timer.status === "running" || timer.status === "paused";
  const remaining = remainingMs(timer);
  const pct = progressOf(timer);
  const endsAt = projectedEndAt(timer);
  const showTask = isFocus && !!taskTitle;
  const showLogger = isFocus && inSession;
  // On a wide screen the break cards sit beside the ring rather than under it,
  // so the ring only has to share the height with the bars and the controls.
  const sideBySide = !isFocus && viewport.width >= 1024;
  const ringSize = ringSizeFor(
    viewport,
    // Top bar + legend + controls ≈ 260px. Below the ring: the task title,
    // the distraction button, or — stacked — at least the top of the break card.
    260 +
      (showTask ? 64 : 0) +
      (showLogger ? 72 : 0) +
      (!isFocus && !sideBySide ? 120 : 0),
  );

  useHotkeys(
    useMemo(
      () => [
        { key: " ", handler: toggle },
        { key: "escape", handler: onClose },
        { key: "n", handler: () => void skip() },
        { key: "r", handler: requestReset },
        {
          key: "d",
          handler: () => {
            if (isFocus && inSession) setShowDistraction(true);
          },
        },
        { key: "s", handler: () => setShowSound((v) => !v) },
        { key: "p", handler: () => void pip.toggle() },
      ],
      [toggle, onClose, skip, requestReset, pip, isFocus, inSession],
    ),
  );

  /**
   * `aria-modal` alone is a promise, not a mechanism: the page underneath keeps
   * its buttons in the tab order and in the accessibility tree, so a screen
   * reader hears the dashboard's controls duplicated behind the overlay. Mark
   * everything alongside it inert for as long as it is open, and hand it back
   * untouched on the way out.
   */
  useEffect(() => {
    // Workspace mounts this inside a Presence wrapper, which is what fades in
    // and out; that wrapper, not the overlay, is the page-level element whose
    // siblings are covered.
    const inner = overlayRef.current;
    const overlay = inner?.parentElement?.hasAttribute("data-presence")
      ? inner.parentElement
      : inner;
    const covered = Array.from(overlay?.parentElement?.children ?? []).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el !== overlay &&
        // The toast host and the route announcer are live regions sitting at
        // the same level. Silencing them would swallow the very confirmations
        // this screen produces, so they stay announceable and clickable.
        //
        // Only an element that *is* a live region is spared — not one that
        // merely contains one. The app shell holds live regions of its own
        // (drag-and-drop's announcer on the Tasks page), and sparing the shell
        // for them left the whole page behind the overlay reachable.
        !el.hasAttribute("aria-live"),
    );

    // Remember what each element looked like rather than assuming it was
    // untouched: StrictMode runs this twice, and putting back a guessed state
    // is how one of the two attributes ends up dropped.
    const previous = covered.map((el) => ({
      el,
      inert: el.hasAttribute("inert"),
      ariaHidden: el.getAttribute("aria-hidden"),
    }));

    for (const el of covered) {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    }

    return () => {
      for (const { el, inert, ariaHidden } of previous) {
        if (!inert) el.removeAttribute("inert");
        if (ariaHidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", ariaHidden);
      }
    };
  }, []);

  return (
    // Fades in and out through the Presence wrapper Workspace puts around it.
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40 flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Deep focus mode"
    >
      {/* Ambient background — two slow-drifting radial washes tinted by session
          type, with a field of smaller lights rising through them. The washes
          set the mood; the orbs are what stop a 90-minute session from looking
          like a still image. */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "wash-a absolute -left-1/4 top-[-20%] h-[70vh] w-[70vh] rounded-full blur-[120px]",
              isFocus ? "bg-accent/20" : "bg-break/20",
            )}
          />
          <div
            className={cn(
              "wash-b absolute -right-1/4 bottom-[-20%] h-[60vh] w-[60vh] rounded-full blur-[120px]",
              isFocus ? "bg-focus/14" : "bg-break/12",
            )}
          />
          <AmbientOrbs type={timer.type} />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              running
                ? isFocus
                  ? "animate-pulse bg-accent"
                  : "animate-pulse bg-break"
                : "bg-subtle",
            )}
          />
          <span className="text-[13px] font-medium text-muted">
            {labelForType(timer.type)}
            {timer.status === "paused" && " · paused"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Stands down while the sound panel is open — that is the question already being answered. */}
          <SoundNudge active={isFocus && running && !showSound} />
          {pip.supported && (
            <Tooltip content="Picture-in-picture (P)">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void pip.toggle()}
                aria-label="Picture-in-picture"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Ambient sound (S)">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSound((v) => !v)}
              aria-label="Ambient sound"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Exit deep focus (Esc)">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Exit deep focus"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Center. It scrolls when the content is taller than the window, and the
          inner `m-auto` (rather than `justify-center`) is what keeps it centred
          without clipping the top off when it does. */}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className={cn(
            "m-auto flex w-full items-center px-6 py-4",
            sideBySide
              ? "max-w-5xl flex-row justify-center gap-16"
              : "flex-col",
          )}
        >
          <div className="flex flex-col items-center">
            {showTask && (
              <p className="enter-rise mb-6 max-w-md text-center text-lg font-medium tracking-tight sm:text-xl">
                {taskTitle}
              </p>
            )}

            <TimerRing
              progress={pct}
              size={ringSize}
              strokeWidth={12}
              colorClass={isFocus ? "text-accent" : "text-break"}
              glow
            >
              <div className="flex flex-col items-center">
                <span
                  className="tabular text-[clamp(2.75rem,11vw,4.5rem)] font-semibold leading-none tracking-tight"
                  role="timer"
                  aria-live="off"
                >
                  {formatClock(remaining)}
                </span>
                {endsAt && running && (
                  <span className="mt-3 text-[13px] text-subtle">
                    ends {formatTime(endsAt)}
                  </span>
                )}
                {timer.status === "paused" && (
                  <span className="mt-3 text-[13px] font-medium text-warn">
                    Paused
                  </span>
                )}
              </div>
            </TimerRing>

            {/* Silent every second, spoken at the milestones — see countdownAnnouncement. */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {countdownAnnouncement(timer)}
            </p>

            {/* Controls */}
            <div className="mt-8 flex items-center gap-2">
              <Tooltip content="Reset (R)">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={requestReset}
                  className="rounded-full"
                  aria-label="Reset timer"
                >
                  <RotateCcw className="h-[18px] w-[18px]" />
                </Button>
              </Tooltip>

              <Button
                size="lg"
                onClick={toggle}
                className="h-14 min-w-[140px] rounded-full text-[15px] shadow-glow"
              >
                {running ? (
                  <>
                    <Pause className="h-5 w-5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />{" "}
                    {timer.status === "paused" ? "Resume" : "Start"}
                  </>
                )}
              </Button>

              <Tooltip content="Skip ahead (N)">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => void skip()}
                  className="rounded-full"
                  aria-label="Skip ahead"
                >
                  <SkipForward className="h-[18px] w-[18px]" />
                </Button>
              </Tooltip>
            </div>

            {/* Distraction logger — focus sessions only, and only while one runs */}
            {showLogger && (
              <button
                onClick={() => setShowDistraction(true)}
                className="mt-6 flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[13px] text-muted transition-colors hover:border-warn/40 hover:text-fg"
              >
                <Zap className="h-3.5 w-3.5" />
                Log a distraction
                {distractionCount > 0 && (
                  <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-[11px] font-medium text-warn">
                    {distractionCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {!isFocus && (
            <div
              className={cn(
                "flex w-full max-w-sm flex-col gap-3",
                !sideBySide && "mt-8",
              )}
            >
              <BreakActivity type={timer.type} cycleCount={timer.cycleCount} />
              <WaterBreakCard />
            </div>
          )}
        </div>
      </div>

      {/* Shortcut legend */}
      <div className="relative z-10 hidden shrink-0 items-center justify-center gap-4 px-6 pb-5 pt-2 text-[11px] text-subtle sm:flex">
        {[
          ["Space", "start / pause"],
          ["N", "skip"],
          ["D", "distraction"],
          ["S", "sound"],
          ["Esc", "exit"],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>

      <Presence
        show={showSound}
        enter="slide-in-right"
        exit="slide-out-right"
        className="absolute right-4 top-16 z-20 w-[280px]"
      >
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold">Ambient sound</p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSound(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <SoundPicker compact />
        </div>
      </Presence>

      <DistractionLogger
        open={showDistraction}
        onOpenChange={setShowDistraction}
      />
    </div>
  );
}
