import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteAnnouncer } from '../RouteAnnouncer';

function Layout() {
  return (
    <>
      <nav>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/tasks">Tasks</Link>
      </nav>
      <main id="main">
        <Outlet />
      </main>
      <RouteAnnouncer />
    </>
  );
}

function renderApp(initial = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<h1>Good afternoon.</h1>} />
          <Route path="/tasks" element={<h1>Tasks</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const liveRegion = () => document.querySelector('[aria-live="polite"]')!;

describe('RouteAnnouncer', () => {
  it('leaves an ordinary page load alone', async () => {
    renderApp();
    // Give it every chance to act.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.activeElement).toBe(document.body);
    expect(liveRegion()).toHaveTextContent('');
  });

  it('moves focus to the new page heading and announces the page', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('link', { name: 'Tasks' }));

    // Following a nav link used to leave focus on the link, with nothing said.
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Tasks' })));
    expect(liveRegion()).toHaveTextContent('Tasks');
  });

  it('announces the page by the name the navigation uses, not its greeting', async () => {
    const user = userEvent.setup();
    renderApp('/tasks');

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));

    await vi.waitFor(() => expect(liveRegion()).toHaveTextContent('Dashboard'));
    // Focus still lands on what is on screen.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Good afternoon.' }));
  });
});
