import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPage, StudyTimerPage, preloadMarketingPage } from '../pages';

/**
 * The marketing pages are pre-rendered, so the browser has to be able to render
 * one without suspending — suspending during hydration discards the markup the
 * page was served with. These pin down both halves of how pages.tsx gets there.
 */

describe('marketing pages', () => {
  it('renders a preloaded page synchronously, with no Suspense fallback in between', async () => {
    await preloadMarketingPage('/privacy/');

    render(
      <MemoryRouter>
        <Suspense fallback={<p>loading</p>}>
          <PrivacyPage />
        </Suspense>
      </MemoryRouter>,
    );

    // Present on the very first render — not after a later commit.
    expect(screen.queryByText('loading')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/never leaves your browser/i);
  });

  it('still arrives through Suspense when it was never preloaded', async () => {
    render(
      <MemoryRouter>
        <Suspense fallback={<p>loading</p>}>
          <StudyTimerPage />
        </Suspense>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: /study timer/i })).toBeInTheDocument();
  });

  it('resolves at once for a route that is not one of these pages', async () => {
    await expect(preloadMarketingPage('/dashboard')).resolves.toBeUndefined();
  });
});
