import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScrapingSettings from './ScrapingSettings';

describe('ScrapingSettings Component', () => {
  const baseConfig = {
    scraping: {
      interval_minutes: 60,
      start_time: '09:00',
      max_threads: 4,
      timeout: 30,
    },
  };

  it('renders with initial values from config', () => {
    render(<ScrapingSettings config={baseConfig} handleInputChange={() => {}} />);

    expect(screen.getByLabelText(/Interval/).value).toBe('60');
    expect(screen.getByLabelText(/Start Time/).value).toBe('09:00');
    expect(screen.getByLabelText(/Max Threads/).value).toBe('4');
    expect(screen.getByLabelText(/Timeout/).value).toBe('30');
  });

  it('calls handleInputChange and updates input value on change', () => {
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

    const { rerender } = render(<ScrapingSettings config={config} handleInputChange={handleInputChange} />);

    const intervalInput = screen.getByLabelText(/Interval/);
    fireEvent.change(intervalInput, { target: { name: 'scraping.interval_minutes', value: '45' } });

    // Check if the handler was called
    expect(handleInputChange).toHaveBeenCalledTimes(1);

    // Re-render the component with the new config
    rerender(<ScrapingSettings config={config} handleInputChange={handleInputChange} />);

    // Check if the input value has been updated
    expect(screen.getByLabelText(/Interval/).value).toBe('45');
  });

  it('updates start time correctly', () => {
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

    const { rerender } = render(<ScrapingSettings config={config} handleInputChange={handleInputChange} />);

    const startTimeInput = screen.getByLabelText(/Start Time/);
    fireEvent.change(startTimeInput, { target: { name: 'scraping.start_time', value: '10:00' } });

    expect(handleInputChange).toHaveBeenCalledTimes(1);

    rerender(<ScrapingSettings config={config} handleInputChange={handleInputChange} />);

    expect(screen.getByLabelText(/Start Time/).value).toBe('10:00');
  });
});
