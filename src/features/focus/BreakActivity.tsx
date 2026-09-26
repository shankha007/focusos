import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import type { SessionType } from '@/types';
import { BREATH_PATTERN, suggestBreak } from '@/engine/breaks';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from '@/components/DynamicIcon';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Suggests something to actually do with the break, matched to its length and how long the user has been sitting. The refresh button rolls a different suggestion. */
export function BreakActivity({
  type,
  cycleCount,
}: {
  type: SessionType;
  cycleCount: number;
}) {
  const [seed, setSeed] = useState(() => Date.now());
  const suggestion = useMemo(() => suggestBreak(type, cycleCount, seed), [type, cycleCount, seed]);

  return (
    <div className="mt-10 w-full max-w-sm">
      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-break/12 text-break">
            <DynamicIcon name={suggestion.icon} className="h-4 w-4" fallback={Sparkles} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold">{suggestion.title}</p>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSeed(Date.now() + Math.random() * 100000)}
                aria-label="Suggest something else"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{suggestion.detail}</p>
          </div>
        </div>

        {suggestion.kind === 'breathe' && <BreathingGuide />}
      </div>
    </div>
  );
}

/** A breathing circle's size and timing, as the custom properties .breath reads. */
function breathStyle(reduced: boolean, scale: number, seconds: number, delay: number): React.CSSProperties {
  if (reduced) return {};
  return {
    transform: `scale(${scale})`,
    '--breath-duration': `${seconds}s`,
    '--breath-delay': `${delay}s`,
  } as React.CSSProperties;
}

/** Paced 4-7-8 breathing. The circle's scale is the instruction. */
function BreathingGuide() {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const seconds = BREATH_PATTERN[phase].seconds;
    const id = window.setTimeout(() => setPhase((p) => (p + 1) % BREATH_PATTERN.length), seconds * 1000);
    return () => window.clearTimeout(id);
  }, [phase]);

  const current = BREATH_PATTERN[phase];
  const scale = phase === 0 ? 1.35 : phase === 1 ? 1.35 : 0.75;

  return (
    <div className="mt-5 flex flex-col items-center gap-4 border-t border-border pt-5">
      <div className="relative grid h-28 w-28 place-items-center">
        {/* Each eases to this phase's size over this phase's length (see
            .breath). With motion reduced they hold still at rest size. */}
        <div
          className="breath absolute inset-0 rounded-full bg-break/20"
          style={breathStyle(reducedMotion, scale, current.seconds, 0)}
        />
        <div
          className="breath absolute inset-3 rounded-full bg-break/25"
          style={breathStyle(reducedMotion, scale, current.seconds, 0.1)}
        />
        <span className="relative text-[13px] font-medium text-fg">{current.label}</span>
      </div>
      <div className="flex gap-1.5">
        {BREATH_PATTERN.map((p, i) => (
          <span
            key={p.label}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === phase ? 'w-6 bg-break' : 'w-1.5 bg-subtle/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
