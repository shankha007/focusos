import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeCard } from '../WelcomeCard';
import { shouldShowWelcome } from '../onboarding';
import { useSettingsStore } from '@/store/useSettingsStore';
import { settingsRepo } from '@/db/repositories';
import { bootStores, resetApp } from '@/test/helpers';

describe('shouldShowWelcome', () => {
  it('greets someone on their first run', () => {
    expect(shouldShowWelcome(false, 0)).toBe(true);
  });

  it('does not greet an existing user, even though their flag was never set', () => {
    // `onboarded` defaulted to false for everyone. Keying on it alone would show
    // every current user an introduction to an app they already use.
    expect(shouldShowWelcome(false, 12)).toBe(false);
  });

  it('stays dismissed once read', () => {
    expect(shouldShowWelcome(true, 0)).toBe(false);
  });
});

describe('WelcomeCard', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('is dismissed for good', async () => {
    const user = userEvent.setup();
    render(<WelcomeCard />);

    expect(screen.getByText('Welcome to FocusOS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    await vi.waitFor(async () => expect((await settingsRepo.get())?.onboarded).toBe(true));
    expect(useSettingsStore.getState().settings.onboarded).toBe(true);
  });
});
