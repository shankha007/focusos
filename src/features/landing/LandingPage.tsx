import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Github,
  Linkedin,
  Mail,
  ShieldCheck,
  Sparkles,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo, LogoMark } from '@/components/Logo';
import { TimerRing } from '@/components/TimerRing';
import { FeedbackForm } from './FeedbackForm';
import { CREATOR, FEATURES, STATS, STEPS } from './content';

/** The page's scroll container. Addressed by id so the scroll helpers below can
 *  stay plain functions rather than threading a ref through every section. */
const SCROLLER_ID = 'landing-scroll';

/** Height of the sticky header, so a section does not land underneath it. */
const HEADER_OFFSET = 72;

function getScroller(): HTMLElement | null {
  return document.getElementById(SCROLLER_ID);
}

/** Whether the visitor has asked for less movement, by OS setting or the app's
 *  own Accessibility toggle. */
function prefersNoMotion(): boolean {
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

let animation = 0;

/** Bumped by every scroll, so a scroll that has been superseded can tell. */
let sequence = 0;

/** Stops any tween in flight. Called on unmount so a scroll that was still
 *  running does not keep firing frames against a detached element. */
function cancelScroll() {
  cancelAnimationFrame(animation);
  animation = 0;
}

/**
 * Scrolls the container with a hand-rolled tween.
 *
 * Native smooth scrolling is not dependable here: `scrollIntoView`,
 * `scrollTo({behavior:'smooth'})` and CSS `scroll-behavior` are all silently
 * ignored on this container by some engines, which turns every in-page nav
 * click into a dead button with nothing logged. Driving the position ourselves
 * always moves, and lets the app's own reduced-motion setting opt out — which
 * the CSS media query alone would not cover.
 */
function scrollTo(top: number) {
  const scroller = getScroller();
  if (!scroller) return;

  const target = Math.max(0, Math.min(top, scroller.scrollHeight - scroller.clientHeight));
  const start = scroller.scrollTop;
  const distance = target - start;

  cancelAnimationFrame(animation);
  if (prefersNoMotion() || Math.abs(distance) < 2) {
    scroller.scrollTop = target;
    return;
  }

  const duration = Math.min(700, 220 + Math.abs(distance) * 0.35);
  const startedAt = performance.now();
  let framed = false;

  const step = (now: number) => {
    framed = true;
    const t = Math.min(1, (now - startedAt) / duration);
    // easeOutCubic — quick departure, soft landing.
    scroller.scrollTop = start + distance * (1 - Math.pow(1 - t, 3));
    if (t < 1) animation = requestAnimationFrame(step);
  };
  animation = requestAnimationFrame(step);

  // requestAnimationFrame is not guaranteed to fire: a background tab, an
  // embedded webview or a hidden preview pane can withhold frames while the
  // document still reports itself visible. The tween would then never start and
  // the link would do nothing at all — which is exactly the dead-button
  // behaviour this tween exists to avoid. If no frame has arrived shortly, jump
  // there instead. `sequence` makes a newer scroll win, so a late fallback
  // cannot drag the page back to an abandoned target.
  const mine = ++sequence;
  setTimeout(() => {
    if (framed || sequence !== mine) return;
    cancelScroll();
    scroller.scrollTop = target;
  }, 250);
}

/**
 * Scrolls to a section by element id. The offset is measured against the scroll
 * container rather than handed to `scrollIntoView`, which is one of the APIs the
 * tween above avoids.
 *
 * This is what `SectionLink` calls instead of letting the browser jump to the
 * fragment. The links themselves are real anchors — a `<button>` is invisible to
 * a crawler, which then sees a page with no internal links at all.
 */
function scrollToId(id: string) {
  const scroller = getScroller();
  const target = document.getElementById(id);
  if (!scroller || !target) return;

  scrollTo(
    target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      HEADER_OFFSET,
  );
}

function scrollToTop() {
  scrollTo(0);
}

/**
 * An in-page link to one of the sections below.
 *
 * It is a real `<a href="#id">`, so a crawler can follow it and a visitor can
 * copy or open it in a new tab, but a plain left click is handled here: the
 * browser's own fragment jump is instant and ignores the sticky header, and it
 * would push a history entry for every section a reader visits. `replaceState`
 * puts the fragment in the address bar without that. Modified clicks — new tab,
 * new window, download — are left to the browser.
 */
function SectionLink({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`#${id}`}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        scrollToId(id);
        window.history.replaceState(null, '', `#${id}`);
      }}
    >
      {children}
    </a>
  );
}

/** Fade-and-rise used on each section as it enters. Honours reduced motion via
 *  the global CSS override, which zeroes every animation duration. */
const rise = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export function LandingPage() {
  // The page scrolls inside its own container rather than the window, because
  // #root is a fixed-height flex shell. The nav needs that element to know when
  // content has passed under it.
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Leaving for /dashboard mid-scroll would otherwise leave the tween running
  // against an element that is no longer in the document.
  useEffect(() => cancelScroll, []);

  // The section links are shareable now that they are real anchors, so an
  // arriving /#features has to land on that section. The browser cannot do it
  // itself: the scroll container and the sections do not exist until this
  // renders, and the sticky header would cover the heading anyway.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = requestAnimationFrame(() => scrollToId(id));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div id={SCROLLER_ID} ref={scrollerRef} className="h-full overflow-y-auto bg-bg">
      <LandingNav scrollerRef={scrollerRef} />
      <main>
        <Hero />
        <StatStrip />
        <Features />
        <Privacy />
        <HowItWorks />
        <CtaBand />
        <FeedbackSection />
      </main>
      <Footer />
    </div>
  );
}

/* ── Nav ───────────────────────────────────────────────────── */

function LandingNav({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement> }) {
  const [scrolled, setScrolled] = useState(false);

  // The bar starts transparent over the hero and gains a border and blur once
  // content passes under it, so it never floats on nothing.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => setScrolled(scroller.scrollTop > 12);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [scrollerRef]);

  return (
    <header
      className={
        'sticky top-0 z-40 transition-colors duration-300 ' +
        (scrolled ? 'border-b border-border bg-bg/85 backdrop-blur-lg' : 'border-b border-transparent')
      }
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        {/* Already home, so the logo returns to the top rather than navigating. */}
        <button
          onClick={scrollToTop}
          aria-label="FocusOS — back to top"
          // text-left: a <button> centres its text, which would centre the
          // wordmark over the wider tagline beneath it.
          className="-mx-2 rounded-2xl px-2 py-1 text-left transition-colors hover:bg-elevated"
        >
          <Logo size={36} />
        </button>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {[
            ['Features', 'features'],
            ['Privacy', 'privacy'],
            ['How it works', 'how'],
            ['Feedback', 'feedback'],
          ].map(([label, id]) => (
            <SectionLink
              key={id}
              id={id}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              {label}
            </SectionLink>
          ))}
        </nav>

        <Button asChild size="sm" className="ml-auto gap-1.5 md:ml-2">
          <Link to="/dashboard">
            Open app
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </header>
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

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-24">
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

          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted sm:text-[17px]">
            Not just a timer — the whole focus workflow. Plan the day, run deep-focus sessions, log
            what pulls you away, and get real analysis back. FocusOS learns the session length you
            actually finish, not the one you optimistically planned.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2 px-7 shadow-glow">
              <Link to="/dashboard">
                Start focusing
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

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[420px]"
        >
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

/** A still of Deep Focus Mode — the screen the app is really about. */
function HeroPreview() {
  return (
    <div className="panel relative overflow-hidden p-7 shadow-lift">
      <div aria-hidden className="lit pointer-events-none absolute inset-0" />

      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-subtle">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Focus session
        </span>
        <LogoMark size={26} />
      </div>

      <div className="relative mt-6 grid place-items-center">
        {/* The numbers have to agree: 18 minutes elapsed of a 25-minute
            session is 72% of the ring and 7:00 left on the clock. */}
        <TimerRing progress={0.72} size={216} strokeWidth={9} glow>
          <div className="text-center">
            <p className="tabular text-[42px] font-semibold leading-none tracking-tight text-fg">
              07:00
            </p>
            <p className="mt-2 text-[12px] text-subtle">18 minutes in</p>
          </div>
        </TimerRing>
      </div>

      <div className="relative mt-6 rounded-xl border border-border bg-elevated px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-subtle">Working on</p>
        <p className="mt-0.5 text-[14px] font-medium text-fg">Draft the Q3 proposal</p>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2">
        {[
          ['4', 'sessions'],
          ['1h 40m', 'focused'],
          ['0', 'distractions'],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border border-border px-3 py-2 text-center">
            <p className="tabular text-[15px] font-semibold text-fg">{value}</p>
            <p className="text-[10.5px] text-subtle">{label}</p>
          </div>
        ))}
      </div>
    </div>
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
const CONTACT_LINKS: {
  icon: LucideIcon;
  label: string;
  href: string;
  external?: boolean;
}[] = [
  { icon: Mail, label: 'Email', href: `mailto:${CREATOR.email}` },
  { icon: Linkedin, label: 'LinkedIn', href: CREATOR.linkedin, external: true },
  { icon: Github, label: 'GitHub', href: CREATOR.github, external: true },
];

function Footer() {
  return (
    <footer className="border-t border-border bg-surface/40 px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <Logo size={40} />
            <p className="mt-4 text-[13px] leading-relaxed text-muted">{CREATOR.blurb}</p>
          </div>

          <div className="md:text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Built by</p>
            <p className="mt-1.5 text-[16px] font-semibold tracking-tight text-fg">{CREATOR.name}</p>
            <p className="mt-0.5 text-[13px] text-muted">{CREATOR.role}</p>

            <div className="mt-4 flex flex-wrap gap-2 md:justify-end">
              {CONTACT_LINKS.map(({ icon: Icon, label, href, external }) => (
                <a
                  key={label}
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-elevated px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-fg"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-[12.5px] text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {CREATOR.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <SectionLink id="privacy" className="transition-colors hover:text-muted">
              Privacy
            </SectionLink>
            <SectionLink id="feedback" className="transition-colors hover:text-muted">
              Feedback
            </SectionLink>
            <Link to="/dashboard" className="font-medium text-muted transition-colors hover:text-accent">
              Open app
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Shared bits ───────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
      {children}
    </span>
  );
}
