import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimerStore } from '@/store/useTimerStore';
import { remainingMs, type TimerState } from '@/engine/timerEngine';
import { formatClock } from '@/lib/utils';

/** What the floating window shows, derived from the timer. */
export interface PipFrame {
  clock: string;
  label: string;
  /** 0–1, how far through the session. */
  progress: number;
  isFocus: boolean;
}

/** The floating window's contents at `now`. */
export function pipFrame(timer: TimerState, taskTitle: string | null, now = Date.now()): PipFrame {
  const remaining = remainingMs(timer, now);
  const total = timer.durationMs || 1;
  const isFocus = timer.type === 'focus';
  return {
    clock: formatClock(remaining),
    progress: Math.min(1, Math.max(0, 1 - remaining / total)),
    isFocus,
    label:
      timer.status === 'paused'
        ? 'Paused'
        : isFocus
          ? (taskTitle ?? 'Focus').slice(0, 24)
          : 'Break',
  };
}

/**
 * Identifies a frame by what is visibly different about it.
 *
 * Progress is left out on purpose. Across a 25-minute session the ring advances
 * about a third of a pixel a second, so repainting it between clock changes
 * draws nothing anyone can see.
 */
export function pipFrameKey(frame: PipFrame): string {
  return `${frame.clock}|${frame.label}|${frame.isFocus}`;
}

/**
 * How often to check whether the frame has changed. Short enough that a second
 * ticks over within a quarter-second of the real one. A browser may slow
 * intervals in a hidden tab — to once a second, or less after a long while —
 * which is still enough for a clock, and unlike animation frames they do not
 * stop. Measured with the page hidden: over six seconds, 24 interval ticks and
 * a single animation frame.
 */
const PAINT_CHECK_MS = 250;

/**
 * Floats the countdown over other windows by painting it to a canvas, capturing
 * that canvas as a video stream, and handing the stream to the browser's
 * picture-in-picture window. It's the only way to get an always-on-top timer
 * from a web page without a native shell.
 *
 * The canvas used to be redrawn from a requestAnimationFrame loop: sixty full
 * redraws a second for digits that change once. Browsers also pause animation
 * frames while a page is hidden — and a floating timer is used precisely when
 * the tab behind it is not the one being looked at. An interval keeps running
 * in the background, and the canvas is only redrawn when what it shows changes.
 */
export function usePictureInPicture() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number>(0);
  const lastKeyRef = useRef('');
  const [active, setActive] = useState(false);

  const supported =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    document.pictureInPictureEnabled;

  /** Draws the progress ring, countdown and label — but only when they would look different from the last frame. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { timer, taskTitle } = useTimerStore.getState();
    const frame = pipFrame(timer, taskTitle);
    const key = pipFrameKey(frame);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0b0c14';
    ctx.fillRect(0, 0, w, h);

    // Progress ring
    const cx = w / 2;
    const cy = h / 2 - 10;
    const r = 78;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frame.progress);
    ctx.strokeStyle = frame.isFocus ? '#7886ff' : '#40ceb2';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 44px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frame.clock, cx, cy);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 16px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(frame.label, cx, cy + r + 26);
  }, []);

  /** Stops checking for changes. Safe to call when nothing is running. */
  const stopPainting = useCallback(() => {
    window.clearInterval(intervalRef.current);
    intervalRef.current = 0;
  }, []);

  /** Paints immediately, then keeps the canvas current. Restarting clears any previous loop first. */
  const startPainting = useCallback(() => {
    stopPainting();
    lastKeyRef.current = '';
    paint();
    intervalRef.current = window.setInterval(paint, PAINT_CHECK_MS);
  }, [paint, stopPainting]);

  const onEnter = useCallback(() => setActive(true), []);

  /** The floating window is gone; stop painting frames for it. */
  const onLeave = useCallback(() => {
    setActive(false);
    stopPainting();
  }, [stopPainting]);

  /** Opens the floating window, creating the canvas and video on first use, or closes it if it is already open. */
  const toggle = useCallback(async () => {
    if (!supported) return;

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }

    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 220;
      canvasRef.current = canvas;
    }
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      // Bound here rather than in an effect: the element does not exist until
      // the first toggle, so an effect running at mount has nothing to listen
      // to — and the leave handler is what stops the paint loop, which would
      // otherwise keep drawing a canvas nobody can see for the rest of the
      // session.
      video.addEventListener('enterpictureinpicture', onEnter);
      video.addEventListener('leavepictureinpicture', onLeave);
      videoRef.current = video;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    startPainting();

    try {
      if (!video.srcObject) {
        video.srcObject = canvas.captureStream(30);
      }
      await video.play();
      await video.requestPictureInPicture();
    } catch {
      // Blocked, or the gesture expired. Nothing is floating, so stop painting
      // frames for a window that never opened.
      stopPainting();
    }
  }, [supported, onEnter, onLeave, startPainting, stopPainting]);

  useEffect(
    () => () => {
      const video = videoRef.current;
      video?.removeEventListener('enterpictureinpicture', onEnter);
      video?.removeEventListener('leavepictureinpicture', onLeave);
      stopPainting();
      if (document.pictureInPictureElement) void document.exitPictureInPicture();
    },
    [onEnter, onLeave, stopPainting],
  );

  return { supported, active, toggle };
}
