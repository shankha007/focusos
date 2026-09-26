import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '../AppShell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { bootStores, resetApp } from '@/test/helpers';

function renderShell() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AppShell onOpenFocus={() => {}} />}>
            <Route path="/dashboard" element={<h1>Good afternoon.</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe('AppShell — getting around by keyboard and screen reader', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('offers a skip link before anything else', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.tab();

    // Every page used to open with the logo, five nav links and the command
    // button standing between a keyboard and the content.
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to content' }));
  });

  it('takes focus straight to the content when used', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.tab();
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('names its navigation', () => {
    renderShell();
    // jsdom applies no media queries, so both breakpoints' navigation render
    // here; in a browser only one exists at a time, which is why they share a name.
    const navs = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(navs.length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('navigation').every((nav) => nav.getAttribute('aria-label'))).toBe(true);
  });
});
