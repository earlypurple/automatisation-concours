import { render, screen, waitFor } from '@testing-library/react';
import OpportunitiesGrid from './OpportunitiesGrid';
import { describe, it, expect, vi } from 'vitest';

global.fetch = vi.fn();

function createFetchResponse(data) {
  return { json: () => new Promise((resolve) => resolve(data)), ok: true };
}

describe('OpportunitiesGrid', () => {
  it('renders the correct number of opportunities', async () => {
    const mockData = {
      opportunities: [
        { id: 1, title: 'Opportunity 1', description: 'Description 1' },
        { id: 2, title: 'Opportunity 2', description: 'Description 2' },
      ],
    };
    fetch.mockResolvedValue(createFetchResponse(mockData));

    const { container } = render(<OpportunitiesGrid />);

    await waitFor(() => {
      const opportunityCards = container.querySelectorAll('.opportunity-card');
      expect(opportunityCards).toHaveLength(2);
    });
  });
});
