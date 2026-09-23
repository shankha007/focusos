import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Sparkles, WifiOff, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/Logo';
import { FeedbackForm } from './FeedbackForm';
import { QuickTimer } from './QuickTimer';
import { MarketingShell } from './chrome';
import { scrollToId } from './scroll';
import { FEATURES, STATS, STEPS } from './content';

/** Fade-and-rise used on each section as it enters. Honours reduced motion via
 *  the global CSS override, which zeroes every animation duration. */
const rise = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export function LandingPage() {
  return (
    <MarketingShell>
      <Hero />
      <StatStrip />
      <Features />
      <Privacy />
      <HowItWorks />
      <CtaBand />
      <FeedbackSection />
    </MarketingShell>
  );
}


/* ── Hero ──────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient wash — decorative, sits behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/12 blur-[120px]" />
        <div className="absolute -bottom-32 right-[10%] h-[360px] w-[360px] rounded-full bg-break/10 blur-[100px]" />
      </div>

      {/*
        Three blocks, not two columns of prose and a picture: heading, timer,
        then the rest of the copy.

        On a phone — where most search traffic lands — a two-column layout
        stacks in source order, which put the timer 765px down the page behind
        the whole pitch. Someone who searched "pomodoro timer" had to scroll
        past an argument for the product to reach the product. Here the DOM
        order is heading, timer, copy, so the phone gets the timer immediately
        and the H1 still comes first for a crawler; at lg the explicit row and
        column placement rebuilds the original side-by-side.
      */}
      <div className="relative mx-auto grid max-w-6xl gap-6 px-5 pb-20 pt-10 sm:gap-7 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-[auto_auto] lg:items-center lg:gap-x-12 lg:gap-y-5 lg:pb-28 lg:pt-24">
        {/* Movement only, no fade. An element at opacity 0 does not count as
            painted, so fading the headline and the paragraph in over 600ms
            pushed Largest Contentful Paint out by the length of the animation —
            on the one page the whole site is ranked on. Sliding up from 20px
            reads as the same entrance and is visible from the first frame.
            Sections further down still fade (see `rise`): they are below the
            fold, so they cannot be the LCP element. */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-start-1 lg:row-start-1 lg:self-end"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[12px] font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Offline-first · No account · No tracking
          </span>

          {/* Keep this heading word for word in step with the #seo-shell H1 in
              index.html — that markup is the same page to a crawler that does
              not run JavaScript, and to anyone whose bundle is still loading.
              "Pomodoro timer" is the phrase people search for, so it leads; the
              old headline survives as the first line of the paragraph below. */}
          <h1 className="mt-5 text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-fg sm:text-[52px] lg:text-[58px]">
            {/* The space is load-bearing: without it the two text nodes either
                side of the <br> concatenate to "timerthat" for anything reading
                textContent, which is not the heading the shell in index.html
                carries. */}
            The free Pomodoro timer{' '}
            <br />
            <span className="bg-gradient-to-r from-accent to-break bg-clip-text text-transparent">
              that learns how you focus
            </span>
          </h1>
        </motion.div>

        <motion.div
          // Movement only here too: after the reorder above this panel is the
          // largest thing in a phone's first screen, which makes it a Largest
          // Contentful Paint candidate — and an element at opacity 0 does not
          // count as painted.
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[420px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
        >
          <QuickTimer />
        </motion.div>

        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-start-1 lg:row-start-2 lg:self-start"
        >
          <p className="max-w-xl text-[16px] leading-relaxed text-muted sm:text-[17px]">
            Not just a timer — the whole focus workflow. Plan the day, run deep-focus sessions, log
            what pulls you away, and get real analysis back. FocusOS learns the session length you
            actually finish, not the one you optimistically planned.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* "Start focusing" now belongs to the timer beside this copy —
                the page would otherwise carry two differently-behaved buttons
                with the same label. This one is the way into the workspace. */}
            <Button asChild size="lg" className="gap-2 px-7 shadow-glow">
              <Link to="/dashboard">
                Open the workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" onClick={() => scrollToId('features')}>
              See what it does
            </Button>
          </div>

          <p className="mt-4 text-[12.5px] text-subtle">
            Free and open in your browser. Nothing to install, nothing to sign up for.
          </p>
        </motion.div>

      </div>
    </section>
  );
}

/* ── Stats ─────────────────────────────────────────────────── */

function StatStrip() {
  return (
    <section className="border-y border-border bg-surface/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 sm:px-8 md:grid-cols-4">
        {STATS.map(({ value, label }) => (
          <div key={label} className="px-2 py-7 text-center">
            <p className="tabular text-[28px] font-semibold tracking-tight text-fg">{value}</p>
            <p className="mt-1 text-[12.5px] text-muted">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Features ──────────────────────────────────────────────── */

function Features() {
  return (
    <section id="features" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div {...rise} className="max-w-2xl">
          <SectionLabel>Features</SectionLabel>
          <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.025em] text-fg sm:text-[38px]">
            Everything the focus loop needs
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Eight parts that feed each other: what you plan shapes what you run, what you run shapes
            what it learns, and what it learns shapes tomorrow&rsquo;s plan.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, tag }, i) => (
            <motion.div
              key={title}
              {...rise}
              transition={{ ...rise.transition, delay: Math.min(i, 3) * 0.06 }}
              className="panel panel-hover group flex flex-col p-5"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent transition-colors group-hover:bg-accent/20">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-fg">{title}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{body}</p>
              <span className="mt-4 inline-flex w-fit rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] font-medium text-subtle">
                {tag}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Privacy ───────────────────────────────────────────────── */

const PRIVACY_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: WifiOff, label: 'Works with the network off' },
  { icon: ShieldCheck, label: 'No telemetry, ever' },
  { icon: Sparkles, label: 'Installable as an app' },
];

function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
      <motion.div
        {...rise}
        className="panel relative mx-auto max-w-6xl overflow-hidden px-6 py-12 sm:px-12"
      >
        <div aria-hidden className="lit pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl text-center">
          {/* This is the section's only visual anchor, so the badge carries a
              ring and a halo rather than sitting as a bare glyph. */}
          <span className="relative mx-auto grid h-20 w-20 place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-[28%] bg-accent/25 blur-xl"
            />
            <span className="relative grid h-20 w-20 place-items-center rounded-[28%] bg-accent/15 text-accent ring-1 ring-inset ring-accent/30">
              <ShieldCheck className="h-9 w-9" strokeWidth={1.75} />
            </span>
          </span>
          <h2 className="mt-5 text-[26px] font-semibold tracking-[-0.02em] text-fg sm:text-[32px]">
            Your focus data never leaves your browser
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            There is no server, no account, and no analytics. Sessions, tasks and reflections live in
            your browser&rsquo;s own storage, insights are computed on your device with plain rules,
            and ambient sound is synthesized locally rather than streamed. Export everything to JSON
            whenever you want it elsewhere.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            {PRIVACY_CHIPS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1.5 text-[12.5px] text-muted"
              >
                <Icon className="h-3.5 w-3.5 text-accent" />
                {label}
              </span>
            ))}
          </div>
          <p className="mt-6 text-[13.5px]">
            <Link
              to="/privacy"
              className="font-medium text-accent transition-colors hover:brightness-110"
            >
              Read the full privacy note →
            </Link>
          </p>
        </div>
      </motion.div>
    </section>
  );
}

/* ── How it works ──────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
      <div className="mx-auto max-w-6xl">
        <motion.div {...rise} className="max-w-2xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.025em] text-fg sm:text-[38px]">
            Three steps, then it compounds
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ n, title, body }, i) => (
            <motion.div
              key={n}
              {...rise}
              transition={{ ...rise.transition, delay: i * 0.08 }}
              className="panel p-6"
            >
              <span className="tabular text-[13px] font-semibold text-accent">{n}</span>
              <h3 className="mt-3 text-[16px] font-semibold tracking-tight text-fg">{title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Closing CTA ───────────────────────────────────────────── */

function CtaBand() {
  return (
    <section className="px-5 pb-20 sm:px-8 lg:pb-28">
      <motion.div
        {...rise}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-accent/25 bg-accent/[0.07] px-6 py-14 text-center sm:px-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-accent/20 blur-[90px]"
        />
        <div className="relative">
          <LogoMark size={52} className="mx-auto" />
          <h2 className="mt-6 text-[28px] font-semibold tracking-[-0.02em] text-fg sm:text-[36px]">
            Your first session is 25 minutes away
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
            No sign-up, no setup, no credit card. Open it and start — the workspace builds itself on
            first load.
          </p>
          <Button asChild size="lg" className="mt-8 gap-2 px-8 shadow-glow">
            <Link to="/dashboard">
              Open the dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

/* ── Feedback ──────────────────────────────────────────────── */

function FeedbackSection() {
  return (
    <section id="feedback" className="scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
      <motion.div {...rise} className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <SectionLabel>Feedback</SectionLabel>
          <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.025em] text-fg sm:text-[36px]">
            Built by one person, shaped by you
          </h2>
        </div>
        <FeedbackForm />
      </motion.div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────── */

/** `external` opens in a new tab; the mailto hand-off must not, or the browser
 *  is left holding an empty tab after the mail client takes over. */

/* ── Shared bits ───────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
      {children}
    </span>
  );
}
