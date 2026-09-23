import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MarketingShell } from '../chrome';
import { MARKETING_ROUTES } from '../routes';

/**
 * The shell is one component instance for every marketing page — React keeps it
 * and swaps the children when the route changes. Anything it does on mount
 * therefore happens on the first page only, which is how the tab title and the
 * section links both ended up stuck on whichever page a visitor opened first.
 */

const titleFor = (path: string) => MARKETING_ROUTES.find((route) => route.path === path)!.title;

function Shell({ initial }: { initial: string }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/"
          element={
            <MarketingShell>
              <h1>Landing</h1>
              <section id="features">Features</section>
            </MarketingShell>
          }
        />
        <Route
          path="/privacy"
          element={
            <MarketingShell>
              <h1>Privacy</h1>
            </MarketingShell>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('MarketingShell', () => {
  it('titles the tab from the route table', () => {
    render(<Shell initial="/" />);
    expect(document.title).toBe(titleFor('/'));
  });

  it('retitles the tab when the route changes without a reload', async () => {
    const user = userEvent.setup();
    render(<Shell initial="/" />);

    await user.click(screen.getAllByRole('link', { name: 'Privacy' })[0]);

    expect(await screen.findByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
    // A pre-rendered page carries the right title in its HTML, but moving
    // between pages in the browser never reloads the document.
    expect(document.title).toBe(titleFor('/privacy'));
  });

  it('links to a section of the landing page from another page', async () => {
    const user = userEvent.setup();
    render(<Shell initial="/privacy" />);

    const features = screen.getByRole('link', { name: 'Features' });
    // From elsewhere it has to be a navigation, not a fragment jump into a page
    // that has no such section.
    expect(features).toHaveAttribute('href', '/#features');

    await user.click(features);
    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument();
  });

  it('scrolls rather than navigates when already on the landing page', () => {
    render(<Shell initial="/" />);
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features');
  });
});
