import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingShell } from './chrome';
import { QuickTimer } from './QuickTimer';

/**
 * A page for people searching "25 minute timer".
 *
 * That search is not the same as "pomodoro timer", which is why this is not a
 * copy of the landing page with a different heading. Someone typing it wants a
 * countdown running in the next five seconds and may never have heard of
 * Cirillo — the method is context they can take or leave, so the timer comes
 * first and the reading is optional and below it.
 *
 * It deliberately does not target "pomodoro timer": the landing page owns that
 * term, and two pages competing for one keyword split the signals between them.
 */

interface Section {
  id: string;
  heading: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'why-25',
    heading: 'Why 25 minutes?',
    body: (
      <>
        <p>
          Because it is long enough to get somewhere and short enough to start. The number comes
          from Francesco Cirillo, who set a kitchen timer to 25 minutes while studying in the late
          1980s — it was the interval his tomato-shaped timer happened to make easy, and it stuck.
        </p>
        <p>
          There is no research showing 25 beats 20 or 30. What holds up is narrower: switching
          between tasks costs you, and a deadline you can see makes starting easier. Twenty-five
          minutes is a sensible default, not a finding.
        </p>
      </>
    ),
  },
  {
    id: 'how-to-use',
    heading: 'How to use it',
    body: (
      <>
        <ol>
          <li>Decide the one thing you will work on. Not a list — one.</li>
          <li>Press start and leave everything else alone until the chime.</li>
          <li>If something pulls at you, write it down rather than following it.</li>
          <li>When it rings, take five minutes away from the screen.</li>
        </ol>
        <p>
          The timer keeps correct time if you switch tabs or your machine sleeps — it reads the
          clock rather than counting ticks, so a backgrounded tab cannot lose you minutes. The
          countdown also appears in the tab title, which is where you will be looking when the timer
          itself is behind another window.
        </p>
      </>
    ),
  },
  {
    id: 'after',
    heading: 'What happens when it rings',
    body: (
      <>
        <p>
          A short chime, and the option of a five-minute break. Take it. Skipping the break because
          the work is going well is the single most common way this stops working by the third hour
          — the break is what makes the next session possible.
        </p>
        <p>
          Four rounds of 25 and 5 is about two hours of real work, which is more than most days
          contain. After the fourth, take fifteen to thirty minutes properly.
        </p>
      </>
    ),
  },
  {
    id: 'if-25-doesnt-fit',
    heading: 'If 25 minutes does not fit',
    body: (
      <>
        <p>
          It will not fit everything. Work with a slow warm-up — writing, code, anything that needs
          you to hold a lot in your head — often suits 50 minutes with a 10-minute break. Admin,
          revision and anything you have been avoiding usually suit 25 or less.
        </p>
        <p>
          The timer above takes a custom length, so you can try 50 or 15 without any setup. The
          question worth asking is not which length is best, but which one you actually{' '}
          <em>finish</em>: a 50-minute session abandoned half the time is worth less than a
          25-minute one you complete.
        </p>
      </>
    ),
  },
];

const FAQ = [
  {
    q: 'Does the timer keep running if I switch tabs?',
    a: 'Yes. It reads the wall clock rather than counting ticks, so a background tab, a sleeping laptop or a locked phone cannot lose you minutes. The countdown in the tab title keeps pace too.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. There is no sign-up, and nothing is sent anywhere — the timer runs entirely in your browser.',
  },
  {
    q: 'Will it work offline?',
    a: 'The timer needs the page to load once. After that FocusOS runs offline, including the full workspace, because everything is stored in your browser rather than on a server.',
  },
];

export function TwentyFiveMinuteTimerPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[42px]">
          25 minute timer
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted sm:text-[17px]">
          Press start and work until it rings. Free, no account, and it keeps correct time even if
          you switch tabs or your machine sleeps.
        </p>

        {/* The timer, before anything worth reading. Someone who searched for a
            25-minute countdown wants one running, not an explanation of why it
            is a good idea. */}
        <div className="mt-8 max-w-[440px]">
          <QuickTimer />
        </div>

        <div
          className="mt-14 grid gap-11 text-[15px] leading-relaxed text-muted
            [&_em]:italic
            [&_li]:pl-1.5
            [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-2.5 [&_ol]:pl-5"
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
        </div>

        <aside className="mt-14 rounded-2xl border border-accent/25 bg-accent/8 px-6 py-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-fg">
            Keep the sessions you run
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
            Finish a session here and FocusOS can keep it: sessions, tasks and a written end-of-day
            debrief, plus an engine that reads your own history and suggests the session length you
            actually finish. It runs offline, stores everything in your browser, and needs no
            account.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/dashboard">
                Open the workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/pomodoro-technique">Read the Pomodoro guide</Link>
            </Button>
          </div>
        </aside>
      </div>
    </MarketingShell>
  );
}
