import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpportunitiesGrid from './OpportunitiesGrid';

const mockOpportunities = [
  { id: 1, title: 'Alpha Project', description: 'Desc 1', value: 100, priority: 1, score: 95 },
  { id: 2, title: 'Beta Challenge', description: 'Desc 2', value: 200, priority: 2, score: 90 },
  { id: 3, title: 'Gamma Initiative', description: 'Desc 3', value: 150, priority: 3, score: 85 },
];

describe('OpportunitiesGrid Component', () => {

  beforeEach(() => {
    // Mock the global fetch function
    vi.spyOn(window, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays a loading message initially', () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ opportunities: [] }),
    });
    render(<OpportunitiesGrid />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays an error message if the API call fails', async () => {
    window.fetch.mockRejectedValueOnce(new Error('API is down'));
    render(<OpportunitiesGrid />);

    // Wait for the error message to appear
    const errorElement = await screen.findByText(/Error: API is down/);
    expect(errorElement).toBeInTheDocument();
  });

  it('displays opportunities after a successful API call', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ opportunities: mockOpportunities }),
    });
    render(<OpportunitiesGrid />);

    // Wait for the opportunities to be rendered
    await waitFor(() => {
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      expect(screen.getByText('Beta Challenge')).toBeInTheDocument();
    });

    // Check that loading message is gone
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('filters opportunities based on search term', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ opportunities: mockOpportunities }),
    });
    render(<OpportunitiesGrid />);

    // Wait for initial render
    await screen.findByText('Alpha Project');

    const searchInput = screen.getByPlaceholderText(/Search by title.../);
    fireEvent.change(searchInput, { target: { value: 'Beta' } });

    expect(screen.getByText('Beta Challenge')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument();
  });

  it('sorts opportunities by value', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ opportunities: mockOpportunities }),
    });
    render(<OpportunitiesGrid />);

    // Wait for initial render
    await screen.findByText('Alpha Project');

    const sortSelect = screen.getByDisplayValue(/Sort by Score/);
    fireEvent.change(sortSelect, { target: { value: 'value' } });

    const opportunityCards = screen.getAllByText(/Value:/);
    expect(opportunityCards[0].textContent).toBe('Value: 200€'); // Beta Challenge
    expect(opportunityCards[1].textContent).toBe('Value: 150€'); // Gamma Initiative
    expect(opportunityCards[2].textContent).toBe('Value: 100€'); // Alpha Project
  });
});
