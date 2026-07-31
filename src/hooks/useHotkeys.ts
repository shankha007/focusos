import { useEffect } from 'react';

export interface Hotkey {
  /** Lowercase key, e.g. 'k', 'escape', ' '. */
  key: string;
  meta?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
  /** Fire even while a text field has focus. Off by default. */
  allowInInput?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      for (const hk of hotkeys) {
        if (key !== hk.key.toLowerCase()) continue;
        if (!!hk.meta !== (e.metaKey || e.ctrlKey)) continue;
        if (!!hk.shift !== e.shiftKey) continue;
        if (!hk.allowInInput && isTypingTarget(e.target)) continue;
        e.preventDefault();
        hk.handler(e);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeys, enabled]);
}
