import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeneralSettings from './GeneralSettings';

import { vi } from 'vitest';

// Mock the child components to isolate the GeneralSettings component
vi.mock('./ScrapingSettings', () => () => <div>ScrapingSettings</div>);
vi.mock('./ServerSettings', () => () => <div>ServerSettings</div>);
vi.mock('./NotificationSettings', () => () => <div>NotificationSettings</div>);
vi.mock('./FilterSettings', () => () => <div>FilterSettings</div>);
vi.mock('./AutoParticipationSettings', () => () => <div>AutoParticipationSettings</div>);
vi.mock('./PuppeteerSettings', () => () => <div>PuppeteerSettings</div>);
vi.mock('./ProxiesSettings', () => () => <div>ProxiesSettings</div>);
vi.mock('./CaptchaSolverSettings', () => () => <div>CaptchaSolverSettings</div>);
vi.mock('./EmailHandlerSettings', () => () => <div>EmailHandlerSettings</div>);
vi.mock('./ExportSettings', () => () => <div>ExportSettings</div>);


describe('GeneralSettings', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    global.alert = vi.fn();
  });

  it('should display a loading message while fetching the config', () => {
    global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<GeneralSettings />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display an error message if the fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('Failed to fetch'));
    render(<GeneralSettings />);
    await waitFor(() => {
      expect(screen.getByText('Error: Failed to fetch')).toBeInTheDocument();
    });
  });

  it('should display the form when the fetch is successful', async () => {
    const mockConfig = {
      scraping: {},
      server: {},
      notifications: {},
      filter: {},
      auto_participation: {},
      puppeteer: {},
      proxies: {},
      captcha_solver: {},
      email_handler: {},
      export: {},
    };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });
    render(<GeneralSettings />);
    await waitFor(() => {
      expect(screen.getByText('General Settings')).toBeInTheDocument();
      expect(screen.getByText('ScrapingSettings')).toBeInTheDocument();
      expect(screen.getByText('ServerSettings')).toBeInTheDocument();
      // ... and so on for the other mocked components
    });
  });

  it('should call the save endpoint when the save button is clicked', async () => {
    const mockConfig = {
      scraping: {},
      server: {},
      notifications: {},
      filter: {},
      auto_participation: {},
      puppeteer: {},
      proxies: {},
      captcha_solver: {},
      email_handler: {},
      export: {},
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });
    render(<GeneralSettings />);
    await waitFor(() => {
      expect(screen.getByText('General Settings')).toBeInTheDocument();
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
    });

    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockConfig),
      });
      expect(global.alert).toHaveBeenCalledWith('Settings saved successfully!');
    });
  });
});
