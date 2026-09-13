import { Sparkles } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/store/useSettingsStore';

/** The parts of the app a new user is most likely to miss, and what each is for. */
const POINTS = [
  {
    title: 'Answer the check-ins',
    body: 'Two taps before a session and one after. They are what your analytics and suggested session length are built from.',
  },
  {
    title: 'Give tasks a category',
    body: 'Analytics splits your focus by category, and a category can switch the timer to its own rhythm.',
  },
  {
    title: 'Drive it from the keyboard',
    body: 'Space starts and pauses, D logs a distraction in Deep Focus, and ⌘K reaches everything else.',
  },
];

/** A short first-run introduction, dismissed for good once read. See `shouldShowWelcome` for who sees it. */
export function WelcomeCard() {
  const update = useSettingsStore((s) => s.update);

  return (
    <Card className="mb-4">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>Welcome to FocusOS</CardTitle>
          <p className="mt-1 text-[13px] text-muted">Three things that make the rest of it work.</p>

          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {POINTS.map((point) => (
              <li key={point.title}>
                <p className="text-[13px] font-medium">{point.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{point.body}</p>
              </li>
            ))}
          </ul>

          <Button size="sm" className="mt-4" onClick={() => void update({ onboarded: true })}>
            Got it
          </Button>
        </div>
      </div>
    </Card>
  );
}
