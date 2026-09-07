import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MoodCheckDialog } from '../MoodCheckDialog';

/** Renders the check-in open, and hands back the spy the dialog reports through. */
function renderDialog() {
  const onConfirm = vi.fn();
  render(
    <MoodCheckDialog open onOpenChange={() => {}} onConfirm={onConfirm} taskTitle="Write the report" />,
  );
  return { onConfirm, user: userEvent.setup() };
}

const startButton = () => screen.getByRole('button', { name: 'Start session' });
const skipButton = () => screen.getByRole('button', { name: 'Skip' });

/** The five faces belong to two scales; pick one from each by its label. */
const choose = (label: string) => screen.getByRole('button', { name: new RegExp(label, 'i') });

describe('MoodCheckDialog', () => {
  it('reports nothing at all when the check-in is skipped', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(skipButton());

    // The bug this replaces: "Skip" and "Start session" shared a handler that
    // defaulted both scales to 3, so a skipped check-in was indistinguishable
    // from someone answering "Okay / Steady".
    expect(onConfirm).toHaveBeenCalledWith(null, null);
  });

  it('will not start a recorded session until both scales are answered', async () => {
    const { user } = renderDialog();

    expect(startButton()).toBeDisabled();
    expect(screen.getByText(/answer both to record the check-in/i)).toBeInTheDocument();

    await user.click(choose('Good'));
    // Half an answer is no more usable in a correlation than none.
    expect(startButton()).toBeDisabled();

    await user.click(choose('Tired'));
    expect(startButton()).toBeEnabled();
  });

  it('reports both answers once they are given', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(choose('Good')); // 4th on the mood scale
    await user.click(choose('Tired')); // 2nd on the energy scale
    await user.click(startButton());

    expect(onConfirm).toHaveBeenCalledWith(4, 2);
  });

  it('names the task being started, so the check-in has context', () => {
    renderDialog();
    expect(screen.getByText(/focusing on write the report/i)).toBeInTheDocument();
  });
});
