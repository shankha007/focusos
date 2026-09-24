import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingShell } from './chrome';

/**
 * A guide to the Pomodoro technique itself, rather than to this app.
 *
 * It exists because the search that brings people here is often "what is the
 * pomodoro technique", not "pomodoro timer" — they want to understand the
 * method before they run one. A page that answers that honestly earns the link
 * from the timer pages phase 4 adds next, and gives the site something to rank
 * for that is not a timer.
 *
 * The rule the landing copy is held to applies here too: every claim has to be
 * true, including the ones that are inconvenient. The technique has no
 * randomised trials behind it, the twenty-five minutes is arbitrary, and this
 * page says so.
 */

interface Section {
  id: string;
  heading: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'where-it-came-from',
    heading: 'Where it came from',
    body: (
      <>
        <p>
          Francesco Cirillo devised it as a university student in the late 1980s, using a
          tomato-shaped kitchen timer — <em>pomodoro</em> is Italian for tomato. The problem he was
          solving was not a shortage of hours. It was that he could not tell where they went.
        </p>
        <p>
          That origin explains the method&rsquo;s shape. It is not a productivity system with
          projects, contexts and reviews. It is a way of turning an amorphous afternoon into a
          countable number of finished units, so that at the end of it you know what happened.
        </p>
      </>
    ),
  },
  {
    id: 'the-rules',
    heading: 'The method, in four rules',
    body: (
      <>
        <ol>
          <li>
            <strong>Pick one task.</strong> Not a list — one. If it is too big to finish, pick the
            part you can start.
          </li>
          <li>
            <strong>Work for 25 minutes without switching.</strong> No email, no messages, no
            &ldquo;quick check&rdquo;. If something arrives, write it down and keep going.
          </li>
          <li>
            <strong>Take a 5-minute break.</strong> Away from the screen if you can. This is part of
            the method, not a reward for completing it.
          </li>
          <li>
            <strong>After four rounds, take a longer break</strong> — 15 to 30 minutes.
          </li>
        </ol>
        <p>
          One completed 25-minute stretch is a <em>pomodoro</em>. The unit matters more than it
          looks: it gives you something to count, and counting is what turns &ldquo;I worked on it
          for a while&rdquo; into a number you can plan with next week.
        </p>
      </>
    ),
  },
  {
    id: 'why-it-works',
    heading: 'Why a timer changes anything',
    body: (
      <>
        <p>
          Three things happen when the clock is running, and none of them require believing anything
          exotic about the brain.
        </p>
        <p>
          <strong>Starting gets cheaper.</strong> Committing to 25 minutes is a smaller decision than
          committing to a task of unknown length, and starting is where most of the resistance lives.
        </p>
        <p>
          <strong>Interruptions become visible.</strong> The rule against switching does not stop
          distractions; it makes you notice them. Most people are surprised by how many there are the
          first time they count.
        </p>
        <p>
          <strong>Breaks stop being negotiable.</strong> Left alone, most of us work until we flag and
          then rest badly — a scroll, a feed, nothing that restores much. A scheduled break is taken
          before you need it, which is when it is worth most.
        </p>
        <p>
          A caveat worth stating plainly: there is no body of controlled trials showing that 25/5
          beats other intervals. What is well supported is narrower — that switching between tasks
          costs you, and that rest before exhaustion beats rest after it. The specific numbers are a
          sensible starting point, not a finding.
        </p>
      </>
    ),
  },
  {
    id: 'variations',
    heading: 'Variations worth knowing',
    body: (
      <>
        <p>
          Twenty-five minutes was chosen because it suited one student and one kitchen timer. Treat
          it as a default to move away from once you know your own numbers.
        </p>
        <table>
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Focus / break</th>
              <th>Suits</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Classic Pomodoro</td>
              <td>25 / 5</td>
              <td>Admin, study, anything you keep putting off</td>
            </tr>
            <tr>
              <td>Long-form</td>
              <td>50 / 10</td>
              <td>Writing, coding, work with a slow warm-up</td>
            </tr>
            <tr>
              <td>52/17</td>
              <td>52 / 17</td>
              <td>Reported from one company&rsquo;s time-tracking data, not a study</td>
            </tr>
            <tr>
              <td>Ultradian block</td>
              <td>90 / 20</td>
              <td>Deep work, when nothing can interrupt you</td>
            </tr>
          </tbody>
        </table>
        <p>
          The useful question is not which pattern is best but which one you <em>finish</em>. A
          50-minute session you abandon half the time is worth less than a 25-minute one you
          complete, and the difference only shows up once you track it.
        </p>
      </>
    ),
  },
  {
    id: 'mistakes',
    heading: 'Where it usually goes wrong',
    body: (
      <>
        <p>
          <strong>Skipping the break because the work is going well.</strong> Understandable, and it
          is how the method stops working by the third hour. The break is what makes the next session
          possible.
        </p>
        <p>
          <strong>Counting pomodoros as a score.</strong> Eight shallow sessions is not a better day
          than four that moved something. The count is a measurement, not a target.
        </p>
        <p>
          <strong>Choosing a task too big to start.</strong> &ldquo;Write the report&rdquo; is not a
          session. &ldquo;Draft the opening section&rdquo; is.
        </p>
        <p>
          <strong>Using it for work that cannot be interrupted.</strong> A conversation, a workshop or
          anything collaborative does not fit a countdown. The method is for solo work with a clear
          finish line.
        </p>
        <p>
          <strong>Never changing the interval.</strong> The numbers are a starting point. If you
          consistently run over or stall at eighteen minutes, that is information.
        </p>
      </>
    ),
  },
  {
    id: 'start',
    heading: 'How to start today',
    body: (
      <>
        <p>
          You need a timer and one task. Nothing else, and no setup — the{' '}
          <Link to="/25-minute-timer" className="font-medium text-accent hover:brightness-110">
            25-minute timer
          </Link>{' '}
          runs in one click and keeps time correctly if you switch tabs.
        </p>
        <ol>
          <li>Write down the single thing you will work on.</li>
          <li>Start a 25-minute session and leave everything else alone.</li>
          <li>
            When something pulls at you, note it rather than following it, and carry on until the
            chime.
          </li>
          <li>Take the five minutes. Properly — away from the screen.</li>
          <li>Do it four times, then take a longer break.</li>
        </ol>
        <p>
          Do that for a week and you will know two things you almost certainly do not know now: how
          many focused sessions a working day actually holds for you, and what interrupts them.
        </p>
      </>
    ),
  },
];

export function PomodoroTechniquePage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Guide</p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[44px]">
          The Pomodoro technique, explained
        </h1>

        {/* The answer first, in one paragraph. Someone who reads nothing else —
            or an answer engine quoting the page — should still come away with
            the method rather than a preamble about its history. */}
        <p className="mt-5 text-[16px] leading-relaxed text-muted sm:text-[17px]">
          The Pomodoro technique is a way of working in fixed intervals: 25 minutes on one task
          without switching, then a 5-minute break, and a longer break after every fourth round. It
          was devised by Francesco Cirillo in the late 1980s and named after the tomato-shaped
          kitchen timer he used. Its value is less about the specific numbers than about having a
          finish line you can see and a break you did not have to justify.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button asChild className="gap-2">
            <Link to="/">
              Try a 25-minute session
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-[13px] text-subtle">No account, nothing to install.</span>
        </div>

        <nav aria-label="On this page" className="mt-10 rounded-2xl border border-border bg-surface/40 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            On this page
          </p>
          <ul className="mt-2.5 grid gap-1.5 text-[14px] sm:grid-cols-2">
            {SECTIONS.map(({ id, heading }) => (
              <li key={id}>
                <a href={`#${id}`} className="text-muted transition-colors hover:text-accent">
                  {heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className="mt-12 grid gap-11 text-[15px] leading-relaxed text-muted
            [&_em]:italic
            [&_li]:pl-1.5
            [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-2.5 [&_ol]:pl-5
            [&_strong]:font-semibold [&_strong]:text-fg
            [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px]
            [&_td]:border-t [&_td]:border-border [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top
            [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold
            [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-subtle"
        >
          {SECTIONS.map(({ id, heading, body }) => (
            <section key={id} id={id} className="scroll-mt-20">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-fg sm:text-[26px]">
                {heading}
              </h2>
              {/* The table is the one thing here that can outgrow a phone. */}
              <div className="mt-3 grid gap-3 [&>table]:block [&>table]:overflow-x-auto">{body}</div>
            </section>
          ))}
        </div>

        <aside className="mt-14 rounded-2xl border border-accent/25 bg-accent/8 px-6 py-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-fg">
            When the default stops fitting
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
            FocusOS is a Pomodoro timer that reads your own history after about ten sessions: the
            session length you actually finish, the break length that leaves you sharp, and the
            three-hour window where your focus is strongest. It runs offline, stores everything in
            your browser, and needs no account.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/">
                Start a session
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/privacy">How your data is handled</Link>
            </Button>
          </div>
        </aside>
      </article>
    </MarketingShell>
  );
}
