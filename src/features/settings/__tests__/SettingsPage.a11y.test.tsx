import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsPage } from '../SettingsPage';
import { TooltipProvider } from '@/components/ui/primitives';
import { bootStores, resetApp } from '@/test/helpers';

function renderSettings() {
  return render(
    <TooltipProvider>
      <SettingsPage />
    </TooltipProvider>,
  );
}

describe('SettingsPage — what a screen reader hears', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('names every switch after the setting it controls', () => {
    renderSettings();

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
    // Every one of these used to be an anonymous "switch, on".
    for (const control of switches) expect(control).toHaveAccessibleName();

    const autoBreaks = screen.getByRole('switch', { name: 'Auto-start breaks' });
    expect(autoBreaks).toBeChecked();
    expect(autoBreaks).toHaveAccessibleDescription('Roll into a break the moment focus ends.');
  });

  it('says which count each stepper button changes', () => {
    renderSettings();

    expect(screen.getByRole('button', { name: 'Increase daily session goal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease sessions until a long break' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Daily water goal' })).toBeInTheDocument();
  });
});
