import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScrapingSettings from './ScrapingSettings';

describe('ScrapingSettings Component', () => {
  it('calls handleInputChange when an input value changes', () => {
    const handleInputChange = vi.fn();
    const config = {
      scraping: {
        interval_minutes: 60,
        start_time: '09:00',
        max_threads: 4,
        timeout: 30,
      },
    };

    render(<ScrapingSettings config={config} handleInputChange={handleInputChange} />);

    const intervalInput = screen.getByLabelText(/Interval/);
    fireEvent.change(intervalInput, { target: { value: '45' } });

    expect(handleInputChange).toHaveBeenCalledTimes(1);
    expect(handleInputChange).toHaveBeenCalledWith(expect.any(Object));
  });
});
