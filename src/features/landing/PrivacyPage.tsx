import { Link } from 'react-router-dom';
import { ArrowRight, Database, Download, Mail, ShieldCheck, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingShell } from './chrome';
import { CREATOR } from './content';

/**
 * The full privacy note, at its own URL.
 *
 * "There is no server" is the landing page's strongest claim and it was a
 * paragraph inside a scrolling section, reachable only by an in-page jump —
 * nothing a search result, a directory listing or a school's resource page can
 * link to. It is also the page a reader goes looking for before trusting a tool
 * with their day.
 *
 * Everything below has to be true of the shipped app, including the parts that
 * are less flattering: the host sees requests, and a message sent through the
 * feedback form is an email like any other.
 */

/** Last change to what the app does with data, not to the wording of this page. */
const EFFECTIVE = '23 September 2026';

interface Section {
  id: string;
  heading: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'what-is-stored',
    heading: 'What FocusOS stores, and where',
    body: (
      <>
        <p>
          Everything you create — sessions, tasks, categories, distractions, reflections, presets
          and settings — is written to your browser&rsquo;s own storage on this device, using
          IndexedDB and a small amount of localStorage. None of it is transmitted anywhere, because
          there is nowhere for it to go: FocusOS has no backend, no database and no account system.
        </p>
        <p>
          That also means your history is tied to this browser on this device. It is not synced, and
          clearing your browser&rsquo;s site data will erase it.
        </p>
      </>
    ),
  },
  {
    id: 'no-tracking',
    heading: 'What is not collected',
    body: (
      <>
        <p>
          There is no analytics script, no tag manager, no advertising pixel, no session recorder
          and no A/B testing tool. No cookies are set. Nothing about which pages you open, which
          buttons you press or how long you stay is measured.
        </p>
        <p>
          The app loads no third-party code at all. Its Content Security Policy restricts scripts,
          styles, images, fonts and network connections to this origin, which means a third-party
          tracker could not run here even if one were added by mistake.
        </p>
      </>
    ),
  },
  {
    id: 'hosting',
    heading: 'What the host can see',
    body: (
      <>
        <p>
          The files are served by Vercel. Like any web host, its infrastructure processes the
          requests your browser makes for the page and its assets, and its logs can include your IP
          address, the time of the request and your browser&rsquo;s user-agent string. That is a
          property of being on the web rather than something FocusOS asks for, and those logs are
          not read, exported or joined to anything you do in the app — they could not be, since the
          app sends nothing back.
        </p>
        <p>
          Once the app has loaded it keeps working with no network at all. Ambient sound is
          synthesized in the browser rather than streamed, and the analytics you see are computed on
          your device from your own history.
        </p>
      </>
    ),
  },
  {
    id: 'feedback',
    heading: 'If you send feedback',
    body: (
      <>
        <p>
          The feedback form does not submit anything to a server. It opens your own email client
          with the message pre-filled, and you decide whether to send it. If you do, it arrives as an
          ordinary email to {CREATOR.email}, carrying whatever your mail provider normally carries —
          your address among it.
        </p>
        <p>
          Those messages are read to improve the app and are not added to any mailing list or shared
          with anyone.
        </p>
      </>
    ),
  },
  {
    id: 'your-controls',
    heading: 'Getting your data out, or deleting it',
    body: (
      <>
        <p>
          <strong>Settings → Export everything</strong> writes a complete JSON backup of your
          history, and the analytics page exports sessions and distractions as CSV or a PDF report.
          Nothing is locked in.
        </p>
        <p>
          <strong>Settings → Reset all data</strong> deletes everything the app has stored. Clearing
          site data in your browser does the same. Because no copy exists anywhere else, deletion is
          immediate and complete — there is no retention period and no backup to request.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    heading: 'Children',
    body: (
      <p>
        FocusOS collects no personal information from anyone, of any age. There is no sign-up, so
        there is no age gate: a student can use it exactly as anyone else does, and nothing they do
        leaves their browser.
      </p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this page',
    body: (
      <p>
        If FocusOS ever starts sending data anywhere — it has no plans to — this page will say so
        before the change ships, and the date below will move. The app&rsquo;s source is public, so
        the claims here can be checked rather than taken on trust.
      </p>
    ),
  },
];

const GUARANTEES: { icon: typeof ShieldCheck; label: string }[] = [
  { icon: Database, label: 'No server, no account' },
  { icon: Wifi, label: 'Works fully offline' },
  { icon: ShieldCheck, label: 'No analytics, no cookies' },
  { icon: Download, label: 'Export or delete anytime' },
];

export function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Privacy</p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[44px]">
          Your focus data never leaves your browser
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-muted sm:text-[17px]">
          FocusOS has no backend. Every session, task and reflection is stored by your own browser on
          your own device, and the app has no way to read it, copy it or send it anywhere. This page
          explains what that means in practice, including the parts a privacy page usually leaves
          out.
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          {GUARANTEES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1.5 text-[12.5px] text-muted"
            >
              <Icon className="h-3.5 w-3.5 text-accent" />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-12 grid gap-10">
          {SECTIONS.map(({ id, heading, body }) => (
            <section key={id} id={id} className="scroll-mt-20">
              <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-fg sm:text-[24px]">
                {heading}
              </h2>
              <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-fg">
                {body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-surface/40 px-6 py-6">
          <h2 className="text-[16px] font-semibold tracking-tight text-fg">Questions</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
            Ask the person who built it. {CREATOR.name} reads every message.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button asChild variant="secondary" size="sm" className="gap-1.5">
              <a href={`mailto:${CREATOR.email}`}>
                <Mail className="h-3.5 w-3.5" />
                {CREATOR.email}
              </a>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/dashboard">
                Open the workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-[12.5px] text-subtle">
            In effect since {EFFECTIVE}. FocusOS is free, has no business model, and sells nothing —
            including your attention.
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
