import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimerStore } from '@/store/useTimerStore';
import { remainingMs } from '@/engine/timerEngine';
import { formatClock } from '@/lib/utils';

/**
 * Floats the countdown over other windows by painting it to a canvas, capturing
 * that canvas as a video stream, and handing the stream to the browser's
 * picture-in-picture window. It's the only way to get an always-on-top timer
 * from a web page without a native shell.
 */
export function usePictureInPicture() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);
  const [active, setActive] = useState(false);

  const supported =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    document.pictureInPictureEnabled;

  /** Paints one frame of the floating timer — progress ring, countdown, and the task or break label — then queues the next. */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { timer, taskTitle } = useTimerStore.getState();
    const remaining = remainingMs(timer);
    const total = timer.durationMs || 1;
    const pct = 1 - remaining / total;
    const isFocus = timer.type === 'focus';

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
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = isFocus ? '#7886ff' : '#40ceb2';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 44px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatClock(remaining), cx, cy);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 16px ui-sans-serif, system-ui, sans-serif';
    const label =
      timer.status === 'paused'
        ? 'Paused'
        : isFocus
          ? (taskTitle ?? 'Focus').slice(0, 24)
          : 'Break';
    ctx.fillText(label, cx, cy + r + 26);

    rafRef.current = requestAnimationFrame(draw);
  }, []);

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
      videoRef.current = video;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    draw();

    if (!video.srcObject) {
      video.srcObject = canvas.captureStream(30);
    }
    await video.play();
    await video.requestPictureInPicture();
  }, [draw, supported]);

  useEffect(() => {
    const video = videoRef.current;
    const onEnter = () => setActive(true);
    const onLeave = () => {
      setActive(false);
      cancelAnimationFrame(rafRef.current);
    };
    video?.addEventListener('enterpictureinpicture', onEnter);
    video?.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video?.removeEventListener('enterpictureinpicture', onEnter);
      video?.removeEventListener('leavepictureinpicture', onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      if (document.pictureInPictureElement) void document.exitPictureInPicture();
    },
    [],
  );

  return { supported, active, toggle };
}
