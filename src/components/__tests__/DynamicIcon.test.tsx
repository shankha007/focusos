import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DynamicIcon } from '../DynamicIcon';

/**
 * Icon names arrive from stored data, which a restored backup file controls.
 * Names inherited from Object.prototype used to resolve to functions and
 * objects React cannot render, taking the whole app down with them.
 */
describe('DynamicIcon', () => {
  it('renders a registered icon', () => {
    const { container } = render(<DynamicIcon name="Coffee" />);
    expect(container.querySelector('svg.lucide-coffee')).not.toBeNull();
  });

  it('falls back for a name it does not know', () => {
    const { container } = render(<DynamicIcon name="NotAnIcon" />);
    expect(container.querySelector('svg.lucide-circle')).not.toBeNull();
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'falls back instead of crashing on the inherited property %s',
    (name) => {
      const { container } = render(<DynamicIcon name={name} />);
      expect(container.querySelector('svg.lucide-circle')).not.toBeNull();
    },
  );
});
