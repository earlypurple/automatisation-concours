import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsChart from './AnalyticsChart';
import { describe, it, expect, vi } from 'vitest';

global.fetch = vi.fn();

function createFetchResponse(data) {
  return { json: () => new Promise((resolve) => resolve(data)), ok: true };
}

describe('AnalyticsChart', () => {
  it('renders chart after fetching data', async () => {
    const mockData = {
      stats: {
        opportunities_over_time: [
          { name: 'Jan', opportunités: 10 },
          { name: 'Feb', opportunités: 20 },
        ],
      },
    };
    fetch.mockResolvedValue(createFetchResponse(mockData));

    render(<AnalyticsChart />);

    await waitFor(() => {
      expect(screen.getByText(/Aperçu des Opportunités par Mois/i)).toBeInTheDocument();
    });
  });
});
