import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingShell } from './chrome';
import { QuickTimer } from './QuickTimer';

/**
 * A page for people searching "study timer".
 *
 * A different audience from the other timer pages, with different needs:
 * revision rather than work, a syllabus rather than a task list, and sessions
 * that run into an evening. It opens on 50/10 rather than 25/5 for that reason,
 * and the reading below is about studying — what the breaks are for, when to
 * switch subject — rather than about the Pomodoro method, which has its own
 * page to link to.
 *
 * The honesty rule applies with more force here than anywhere else on the site.
 * Study advice is an industry built on confident claims about learning, most of
 * which are not supported. Where something is well evidenced — retrieval
 * practice, spaced repetition — this says so. Where it is a convention, it says
 * that instead.
 */

interface Section {
  id: string;
  heading: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'how-long',
    heading: 'How long should a study session be?',
    body: (
      <>
        <p>
          Long enough to get past the settling-in, short enough that you can hold attention to the
          end. For most people reading, solving problems or writing, that lands somewhere between 45
          and 60 minutes — which is why this timer opens on 50 with a 10-minute break rather than the
          25/5 the Pomodoro method is known for.
        </p>
        <p>
          Twenty-five minutes suits a different job: material you have been avoiding, flashcards,
          past papers in short bursts, or any evening where starting at all is the obstacle. Both
          are on the timer above, and the honest answer is that the right length is the one you
          finish without drifting.
        </p>
      </>
    ),
  },
  {
    id: 'breaks',
    heading: 'What the breaks are actually for',
    body: (
      <>
        <p>
          Not a reward, and not a chance to check your phone. The break is when the material settles
          — and a break spent scrolling gives your attention nothing to recover from, because it is
          still working.
        </p>
        <p>
          Stand up. Look out of a window. Get water. Ten minutes of that beats ten minutes of feed,
          and you will notice the difference in the session after it, which is the only place the
          difference shows.
        </p>
      </>
    ),
  },
  {
    id: 'what-works',
    heading: 'What the evidence actually supports',
    body: (
      <>
        <p>
          A timer organises your attention. It does not decide whether the studying works — what you
          do inside the session does. Two things have serious evidence behind them, and neither is
          about intervals:
        </p>
        <p>
          <strong>Retrieval practice.</strong> Testing yourself on material beats re-reading it, by a
          wide margin and consistently across studies. Close the book and write down what you
          remember; the effort of recall is what does the work.
        </p>
        <p>
          <strong>Spaced repetition.</strong> Reviewing across several days beats the same total time
          in one sitting. A session that revisits last week&rsquo;s topic before starting today&rsquo;s
          is worth more than a longer one that only moves forward.
        </p>
        <p>
          By comparison, the specific session length is a convention. Use the timer to protect the
          hour; use retrieval and spacing to make the hour count.
        </p>
      </>
    ),
  },
  {
    id: 'a-session',
    heading: 'A session that holds up',
    body: (
      <>
        <ol>
          <li>
            <strong>Decide the one thing</strong> before you start the clock. &ldquo;Revise
            biology&rdquo; is not a session; &ldquo;work through the enzymes questions&rdquo; is.
          </li>
          <li>
            <strong>Five minutes of recall first.</strong> What do you remember from last time? Write
            it down without looking. This is the highest-value part of the hour and the part most
            often skipped.
          </li>
          <li>
            <strong>Then the new material</strong>, until the timer rings.
          </li>
          <li>
            <strong>Take the break away from the screen.</strong>
          </li>
          <li>
            <strong>End the day by writing down where you stopped</strong>, so tomorrow does not
            start with ten minutes of remembering.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'switching',
    heading: 'When to switch subject',
    body: (
      <p>
        At a break, not mid-session — switching costs you the context you just built. Two or three
        sessions on one subject before moving on is a reasonable rhythm, and on a heavy revision day
        alternating subjects between blocks keeps the day survivable without fragmenting any of it.
      </p>
    ),
  },
  {
    id: 'phone',
    heading: 'The phone',
    body: (
      <p>
        In another room, face down, on silent — whichever you will actually do. Every study guide
        says this because it is the single largest variable, and no timer can compensate for a phone
        within reach. If you want to know how much it costs you, log the interruptions for a week:
        FocusOS counts them and shows how far into a session they tend to land.
      </p>
    ),
  },
];

const FAQ = [
  {
    q: 'How long should I study without a break?',
    a: 'Between 45 and 60 minutes suits most reading, problem-solving and writing. Shorter blocks of 25 minutes work better for flashcards, past papers, or any evening where starting is the hard part. The best length is the one you finish without drifting.',
  },
  {
    q: 'Is the Pomodoro technique good for studying?',
    a: 'It is a reasonable default, particularly when you are struggling to start. Its 25-minute interval is a convention rather than a research finding, so treat it as a starting point and lengthen it if you find yourself stopping mid-flow.',
  },
  {
    q: 'Does this study timer work on a phone?',
    a: 'Yes. It runs in the browser on any device, keeps correct time if you lock the screen or switch apps, and needs no account or install. FocusOS can also be installed as an app and used with no internet connection.',
  },
];

export function StudyTimerPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[42px]">
          Study timer
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted sm:text-[17px]">
          A free study timer set to 50 minutes with a 10-minute break — the rhythm that suits
          revision. It keeps correct time if you lock your phone or close the laptop, and there is
          nothing to sign up for.
        </p>

        {/* 50/10 rather than 25/5: this page is for revision sessions, and the
            classic Pomodoro interval is one click away on the same timer. */}
        <div className="mt-8 max-w-[440px]">
          <QuickTimer initialPresetId="deep" />
        </div>

        <div
          className="mt-14 grid gap-11 text-[15px] leading-relaxed text-muted
            [&_li]:pl-1.5
            [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-2.5 [&_ol]:pl-5
            [&_strong]:font-semibold [&_strong]:text-fg"
        >
          {SECTIONS.map(({ id, heading, body }) => (
            <section key={id} id={id} className="scroll-mt-20">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-fg sm:text-[25px]">
                {heading}
              </h2>
              <div className="mt-3 grid gap-3">{body}</div>
            </section>
          ))}

          <section id="questions" className="scroll-mt-20">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-fg sm:text-[25px]">
              Questions
            </h2>
            <dl className="mt-4 grid gap-5">
              {FAQ.map(({ q, a }) => (
                <div key={q}>
                  <dt className="text-[15px] font-semibold text-fg">{q}</dt>
                  <dd className="mt-1.5">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="shorter" className="scroll-mt-20">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-fg sm:text-[25px]">
              If fifty minutes is too long
            </h2>
            <div className="mt-3 grid gap-3">
              <p>
                Start with the{' '}
                <Link to="/25-minute-timer" className="font-medium text-accent hover:brightness-110">
                  25-minute timer
                </Link>{' '}
                instead, or read the{' '}
                <Link
                  to="/pomodoro-technique"
                  className="font-medium text-accent hover:brightness-110"
                >
                  guide to the Pomodoro technique
                </Link>{' '}
                for where the interval came from and which variations are worth trying.
              </p>
            </div>
          </section>
        </div>

        <aside className="mt-14 rounded-2xl border border-accent/25 bg-accent/8 px-6 py-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-fg">
            Through an exam period
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
            Over a few weeks the useful questions change: which subjects are getting the hours, when
            in the day you actually focus, what keeps interrupting you. FocusOS keeps every session
            with its subject, shows your strongest three-hour window, and writes an end-of-day
            summary from your own numbers. It runs offline and stores everything in your browser.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/dashboard">
                Open the workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/privacy">How your data is handled</Link>
            </Button>
          </div>
        </aside>
      </div>
    </MarketingShell>
  );
}
