import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GeneralSettings from './GeneralSettings';
import { describe, it, expect, vi } from 'vitest';

global.fetch = vi.fn();

function createFetchResponse(data) {
  return { json: () => new Promise((resolve) => resolve(data)), ok: true };
}

describe('GeneralSettings', () => {
  const mockConfig = {
    scraping: { interval_minutes: 60, start_time: '00:00', max_threads: 4, timeout: 120 },
    server: { port: 8080, host: 'localhost', enable_api: true, cors_enabled: true },
    notifications: { desktop: true, browser: true, min_priority: 3, telegram: { enabled: true, bot_token: 'token', chat_id: 'chat' } },
    filters: { min_value: 10, categories: ['test'], excluded_domains: ['domain.com'] },
    auto__participation: { enabled: true, max_per_day: 10, safe_mode: true },
    puppeteer: { headless: true, log_level: 'info' },
    proxies: { enabled: true, rotation_mode: 'random' },
    captcha_solver: { enabled: true, provider: '2captcha' },
    email_handler: { enabled: true, check_interval_minutes: 15 },
    export: { auto_backup: true, backup_interval_hours: 24, formats: ['json'] },
  };

  it('renders the form with the correct values', async () => {
    fetch.mockResolvedValue(createFetchResponse(mockConfig));

    const { container } = render(<GeneralSettings />);

    await waitFor(() => {
      const scrapingInterval = container.querySelector('input[name="scraping.interval_minutes"]');
      expect(scrapingInterval).toHaveValue(60);
      expect(screen.getByLabelText(/Start Time/i)).toHaveValue('00:00');
    });
  });

  it('updates the input value on change', async () => {
    fetch.mockResolvedValue(createFetchResponse(mockConfig));

    const { container } = render(<GeneralSettings />);

    await waitFor(() => {
      const intervalInput = container.querySelector('input[name="scraping.interval_minutes"]');
      fireEvent.change(intervalInput, { target: { value: '30' } });
      expect(intervalInput).toHaveValue(30);
    });
  });
});
