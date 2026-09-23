import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Github, Linkedin, Mail, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { CREATOR } from './content';
import { MARKETING_ROUTES } from './routes';
import { SCROLLER_ID, cancelScroll, scrollToId, scrollToTop } from './scroll';

/**
 * The chrome every marketing page shares: the scroll container, the sticky
 * header and the footer.
 *
 * It lives apart from LandingPage because the landing page is no longer the
 * only page of its kind — phase 4 of the SEO plan adds a set of them, and a
 * second copy of this header is a second place for a link to go stale.
 */

/**
 * A link to one of the landing page's sections.
 *
 * On the landing page it scrolls: the browser's own fragment jump is instant,
 * ignores the sticky header, and pushes a history entry for every section a
 * reader visits, which `replaceState` avoids. From any other marketing page
 * there is nothing to scroll to, so it navigates to `/#id` and the shell's
 * arrival effect finishes the job.
 *
 * Either way it is a real anchor. A <button> is invisible to a crawler, which
 * then sees a set of pages with no links between them.
 */
export function SectionLink({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const onLanding = useLocation().pathname === '/';

  if (!onLanding) {
    return (
      <Link to={`/#${id}`} className={className}>
        {children}
      </Link>
    );
  }

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


/** One style for every item in the header's nav, whether it scrolls or navigates. */
const NAV_LINK =
  'rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-elevated hover:text-fg';

function MarketingNav({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement> }) {
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
        {/* On the landing page the logo returns to the top; anywhere else it is
            the way home, and has to be a real link for a crawler to follow. */}
        <LogoHome />

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {/* Privacy is a page of its own now, so it is a route rather than a
              section jump — and the one nav item that points somewhere a
              crawler can index separately. */}
          <Link to="/privacy" className={NAV_LINK}>
            Privacy
          </Link>
          {[
            ['Features', 'features'],
            ['How it works', 'how'],
            ['Feedback', 'feedback'],
          ].map(([label, id]) => (
            <SectionLink
              key={id}
              id={id}
              className={NAV_LINK}
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
            <Link to="/privacy" className="transition-colors hover:text-muted">
              Privacy
            </Link>
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

/** The header's logo: a scroll on the landing page, a link to it from anywhere else. */
function LogoHome() {
  const onLanding = useLocation().pathname === '/';
  const className =
    '-mx-2 rounded-2xl px-2 py-1 text-left transition-colors hover:bg-elevated';

  if (!onLanding) {
    return (
      <Link to="/" aria-label="FocusOS — home" className={className}>
        <Logo size={36} />
      </Link>
    );
  }

  return (
    <button onClick={scrollToTop} aria-label="FocusOS — back to top" className={className}>
      <Logo size={36} />
    </button>
  );
}

/**
 * Wraps a marketing page in the shared chrome.
 *
 * The scroll container is this element rather than the window: #root is a
 * fixed-height flex shell, so the page scrolls inside it and the header watches
 * it to decide when to grow a border.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { pathname, hash } = useLocation();

  // Leaving mid-scroll would otherwise leave the tween running against an
  // element that is no longer in the document.
  useEffect(() => cancelScroll, []);

  /*
    The tab's title, per page.

    A pre-rendered page arrives with the right <title> in its HTML, but moving
    between pages in the browser never reloads the document — so /privacy kept
    the landing page's title, and a reader who then went home kept the privacy
    one. The route table already holds the titles the pre-renderer writes, which
    makes it the one place they are defined.
  */
  useEffect(() => {
    const route = MARKETING_ROUTES.find((entry) => entry.path === pathname);
    if (route) document.title = route.title;
  }, [pathname]);

  /*
    Where the page opens.

    Keyed on the location rather than run once on mount: this shell is the same
    component at the same position for every marketing page, so React keeps the
    instance and swaps the children — a mount effect fires on the first page
    only, and "Features" clicked from /privacy arrived at /#features without
    ever scrolling.

    A timeout rather than requestAnimationFrame because frames are not
    guaranteed to arrive in a background tab or an embedded webview, and a link
    that silently does nothing is the failure this is here to prevent.
  */
  useEffect(() => {
    const id = hash.slice(1);
    const at = window.setTimeout(() => {
      if (id) scrollToId(id);
      // Assigning scrollTop rather than calling scrollTo: the method is absent
      // in jsdom and in older embedded webviews, and this is the line that
      // decides where every page opens.
      else if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    }, 0);
    return () => window.clearTimeout(at);
  }, [pathname, hash]);

  return (
    <div id={SCROLLER_ID} ref={scrollerRef} className="h-full overflow-y-auto bg-bg">
      <MarketingNav scrollerRef={scrollerRef} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
