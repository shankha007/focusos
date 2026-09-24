/**
 * Every page that exists for a search engine rather than for the app.
 *
 * One table, read by three things that would otherwise drift apart: the
 * pre-renderer (which pages to render and what head tags to give each),
 * `scripts/build-sitemap.mjs` (which URLs to list and how fresh they are), and
 * the router itself once phase 4 adds the pages below `/`.
 *
 * It is a `.ts` file with no imports so the build scripts can read it through
 * a plain esbuild transform rather than standing up a whole Vite pipeline.
 */

export const ORIGIN = 'https://focusos.pro';

export interface MarketingRoute {
  /** Path as served, always with a leading slash and no trailing one (except "/"). */
  path: string;
  /** Under 60 characters, keyword first — it is the search result's headline. */
  title: string;
  /** 140–160 characters. The search result's second line, and the reason to click. */
  description: string;
  /**
   * Source files whose last commit dates this page. `lastmod` lies when it is
   * hand-written, and a date that claims a page is older than it is tells a
   * crawler not to bother coming back.
   */
  sources: string[];
  changefreq: 'daily' | 'weekly' | 'monthly';
  /**
   * Extra schema.org markup for this page, added alongside the site-wide graph
   * in index.html rather than replacing it. A guide is an Article; the site and
   * the application are the same entities whichever page you are on.
   */
  schema?: Record<string, unknown>;
  /** Relative to the other pages here, not an absolute claim about the site. */
  priority: string;
}

export const MARKETING_ROUTES: MarketingRoute[] = [
  {
    path: '/',
    title: 'Free Offline Pomodoro Timer with Analytics · FocusOS',
    description:
      'A free Pomodoro timer that works offline and learns the session length you actually finish. Deep focus mode, distraction tracking, analytics. No account.',
    sources: [
      'index.html',
      'src/features/landing/LandingPage.tsx',
      'src/features/landing/QuickTimer.tsx',
      'src/features/landing/content.ts',
    ],
    changefreq: 'weekly',
    priority: '1.0',
  },
  {
    path: '/privacy',
    title: 'Privacy — no server, no account, no tracking · FocusOS',
    description:
      'FocusOS stores your sessions and tasks in your own browser. No backend, no analytics, no cookies. What the host can see, and how to export or delete everything.',
    sources: ['src/features/landing/PrivacyPage.tsx'],
    changefreq: 'monthly',
    priority: '0.5',
  },
  {
    path: '/pomodoro-technique',
    title: 'The Pomodoro Technique, Explained · FocusOS',
    description:
      'What the Pomodoro technique is, where 25 minutes came from, the variations worth trying, and where it usually goes wrong. With a timer you can start in one click.',
    sources: ['src/features/landing/PomodoroTechniquePage.tsx'],
    changefreq: 'monthly',
    priority: '0.8',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'The Pomodoro technique, explained',
      description:
        'A guide to the Pomodoro technique: the four rules, why a timer helps, the variations worth trying, and the mistakes that stop it working.',
      inLanguage: 'en',
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${ORIGIN}/pomodoro-technique` },
      author: { '@id': `${ORIGIN}/#author` },
      publisher: { '@id': `${ORIGIN}/#author` },
      isPartOf: { '@id': `${ORIGIN}/#website` },
      about: { '@type': 'Thing', name: 'Pomodoro Technique' },
    },
  },
];

/** Where a route's pre-rendered HTML is written, relative to the build output. */
export function outputPath(path: string): string {
  return path === '/' ? 'index.html' : `${path.replace(/^\//, '')}/index.html`;
}

/** The absolute URL a route's canonical and og:url point at. */
export function canonicalUrl(path: string): string {
  return `${ORIGIN}${path}`;
}
