import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DeepFocusMode } from '../DeepFocusMode';
import { Presence } from '@/components/Presence';
import { TooltipProvider } from '@/components/ui/tooltip';
import { bootStores, resetApp } from '@/test/helpers';

/**
 * Deep Focus covers the page, and marks everything beside it inert so keyboard
 * and screen-reader users cannot wander into the app underneath. Live regions
 * at the same level are spared, so their announcements still get through.
 *
 * The app shell holds live regions of its own — drag-and-drop's announcer on
 * the Tasks page — and sparing any element that merely *contained* one spared
 * the whole shell there.
 */

function Page({ open }: { open: boolean }) {
  return (
    <TooltipProvider>
      <div id="page">
        <div data-testid="shell">
          <button>Tasks</button>
          {/* As dnd-kit renders its announcer, inside the shell. */}
          <div aria-live="assertive" />
        </div>
        <p data-testid="announcer" aria-live="polite" />
        <section data-testid="toasts" aria-live="polite" />
        <Presence show={open}>
          <DeepFocusMode onClose={() => {}} />
        </Presence>
      </div>
    </TooltipProvider>
  );
}

describe('Deep Focus — what it covers', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('makes the shell inert even when the shell contains a live region of its own', () => {
    const { getByTestId } = render(<Page open />);
    const shell = getByTestId('shell');
    expect(shell).toHaveAttribute('inert');
    expect(shell).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves the page-level live regions announceable', () => {
    const { getByTestId } = render(<Page open />);
    for (const id of ['announcer', 'toasts']) {
      expect(getByTestId(id)).not.toHaveAttribute('inert');
      expect(getByTestId(id)).not.toHaveAttribute('aria-hidden');
    }
  });

  it('hands the page back untouched when it closes', async () => {
    const { getByTestId, rerender } = render(<Page open />);
    expect(getByTestId('shell')).toHaveAttribute('inert');

    rerender(<Page open={false} />);
    // Presence removes it once its exit is over — at once here, with no CSS.
    await act(() => Promise.resolve());

    expect(document.querySelector('[aria-label="Deep focus mode"]')).toBeNull();
    expect(getByTestId('shell')).not.toHaveAttribute('inert');
    expect(getByTestId('shell')).not.toHaveAttribute('aria-hidden');
  });
});
