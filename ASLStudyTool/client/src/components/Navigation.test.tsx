import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navigation from './Navigation';

describe('Navigation Component', () => {
  test('renders brand title and primary navigation links on home', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navigation />
      </MemoryRouter>
    );

    // Brand check
    expect(screen.getByText('ASL')).toBeInTheDocument();
    expect(screen.getByText('Study Tool')).toBeInTheDocument();

    // Desktop nav links check
    expect(screen.getAllByText('Decks').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Starred Cards').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fingerspelling').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Test Mode').length).toBeGreaterThanOrEqual(1);

    // Skip link for accessibility
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  test('renders contextual back button and breadcrumbs on deck routes', () => {
    render(
      <MemoryRouter initialEntries={['/deck/asl-alphabet']}>
        <Navigation />
      </MemoryRouter>
    );

    // Should show back button
    const backButtons = screen.getAllByRole('button', { name: /Back to Home/i });
    expect(backButtons.length).toBeGreaterThanOrEqual(1);
    expect(backButtons[0]).toBeInTheDocument();

    // Should show formatted breadcrumb
    expect(screen.getByText('Asl Alphabet')).toBeInTheDocument();
  });

  test('toggles mobile drawer when hamburger button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navigation />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /Open navigation menu/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Click open
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Drawer dialog visible
    const drawer = screen.getByRole('dialog', { name: /Mobile Navigation Drawer/i });
    expect(drawer).toHaveClass('drawer-open');

    // Click close button inside drawer
    const closeBtn = screen.getByRole('button', { name: /Close navigation drawer/i });
    fireEvent.click(closeBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('closes mobile drawer on Escape key', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navigation />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /Open navigation menu/i });
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('contains zero em-dashes or en-dashes in rendered text', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/deck/all-starred']}>
        <Navigation />
      </MemoryRouter>
    );

    const textContent = container.textContent || '';
    expect(textContent).not.toMatch(/\u2014/); // em-dash
    expect(textContent).not.toMatch(/\u2013/); // en-dash
  });
});
