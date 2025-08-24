import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AutoParticipationSettings from './AutoParticipationSettings';

describe('AutoParticipationSettings Component', () => {
  const baseConfig = {
    auto__participation: {
      enabled: true,
      max_per_day: 100,
      safe_mode: false,
    },
  };

  it('renders with initial values from config', () => {
    render(<AutoParticipationSettings config={baseConfig} handleInputChange={() => {}} />);

    expect(screen.getByLabelText(/Enabled/).checked).toBe(true);
    expect(screen.getByLabelText(/Max Per Day/).value).toBe('100');
    expect(screen.getByLabelText(/Safe Mode/).checked).toBe(false);
  });

  it('updates max_per_day correctly', () => {
    let config = { ...baseConfig };
    const handleInputChange = vi.fn((e) => {
      const { name, value } = e.target;
      const [section, key] = name.split('.');
      config = {
        ...config,
        [section]: {
          ...config[section],
          [key]: value,
        },
      };
    });

    const { rerender } = render(<AutoParticipationSettings config={config} handleInputChange={handleInputChange} />);

    const maxPerDayInput = screen.getByLabelText(/Max Per Day/);
    fireEvent.change(maxPerDayInput, { target: { name: 'auto__participation.max_per_day', value: '150' } });

    expect(handleInputChange).toHaveBeenCalledTimes(1);
    rerender(<AutoParticipationSettings config={config} handleInputChange={handleInputChange} />);
    expect(screen.getByLabelText(/Max Per Day/).value).toBe('150');
  });

  it('updates enabled checkbox correctly', () => {
    let config = {
      ...baseConfig,
      auto__participation: { ...baseConfig.auto__participation, enabled: true }
    };

    const handleInputChange = vi.fn();

    const { rerender } = render(<AutoParticipationSettings config={config} handleInputChange={handleInputChange} />);

    const enabledCheckbox = screen.getByLabelText(/Enabled/);
    expect(enabledCheckbox.checked).toBe(true);

    // Simulate the user clicking the checkbox
    fireEvent.click(enabledCheckbox);

    // Check that the handler was called
    expect(handleInputChange).toHaveBeenCalledTimes(1);

    // Manually simulate the parent component updating the state
    config = {
      ...config,
      auto__participation: {
        ...config.auto__participation,
        enabled: false, // Toggle the value
      },
    };

    // Re-render with the new state
    rerender(<AutoParticipationSettings config={config} handleInputChange={handleInputChange} />);

    // Assert the checkbox is now unchecked
    expect(screen.getByLabelText(/Enabled/).checked).toBe(false);
  });
});
