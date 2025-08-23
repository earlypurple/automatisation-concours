import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import Layout from './Layout';

describe('Layout Component', () => {
  it('renders children correctly', () => {
    const childText = 'Hello from child component';
    render(
      <MemoryRouter>
        <Layout>
          <div>{childText}</div>
        </Layout>
      </MemoryRouter>
    );

    // Check if the navigation links are present
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Check if the child component's text is rendered
    expect(screen.getByText(childText)).toBeInTheDocument();
  });
});
