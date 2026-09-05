import type { Rating } from '@/types';
import { cn } from '@/lib/utils';

const SCALES = {
  mood: ['Rough', 'Low', 'Okay', 'Good', 'Great'],
  energy: ['Drained', 'Tired', 'Steady', 'Fresh', 'Wired'],
  productivity: ['Wasted', 'Scattered', 'Okay', 'Focused', 'In the zone'],
} as const;

const EMOJI = {
  mood: ['😞', '🙁', '😐', '🙂', '😄'],
  energy: ['🪫', '😴', '⚡', '💪', '🔥'],
  productivity: ['🌪️', '😕', '👌', '🎯', '🚀'],
} as const;

/** A 1–5 picker rendered as five labelled faces. The scale chooses the wording — mood, energy, or how productive the session felt. */
export function RatingPicker({
  scale,
  value,
  onChange,
  label,
}: {
  scale: keyof typeof SCALES;
  value: Rating | null;
  onChange: (value: Rating) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-fg">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {SCALES[scale].map((text, i) => {
          const rating = (i + 1) as Rating;
          const active = value === rating;
          return (
            <button
              key={text}
              type="button"
              onClick={() => onChange(rating)}
              aria-pressed={active}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition-all',
                active
                  ? 'border-accent bg-accent/10 scale-[1.03]'
                  : 'border-border hover:border-subtle/40 hover:bg-elevated',
              )}
            >
              {/* Decoration. Without this a screen reader reads the label as
                  "disappointed face Rough" — the word already says it. */}
              <span aria-hidden="true" className="text-base leading-none">
                {EMOJI[scale][i]}
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium leading-tight',
                  active ? 'text-accent' : 'text-subtle',
                )}
              >
                {text}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
