import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';

describe('Footer Component', () => {
  test('renders brand title and mission statement', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('ASL Study Tool')).toBeInTheDocument();
    expect(
      screen.getByText(/Interactive sign language learning with real-time feedback/i)
    ).toBeInTheDocument();
  });

  test('renders all study links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'All Decks' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Starred Cards' })).toHaveAttribute(
      'href',
      '/deck/all-starred'
    );
    expect(screen.getByRole('link', { name: 'Fingerspelling Trainer' })).toHaveAttribute(
      'href',
      '/fingerspelling'
    );
    expect(screen.getByRole('link', { name: 'Test Mode' })).toHaveAttribute(
      'href',
      '/test/all-decks'
    );
  });

  test('renders external resources links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const lifeprintLink = screen.getByRole('link', { name: 'Lifeprint ASL' });
    expect(lifeprintLink).toHaveAttribute('href', 'https://www.lifeprint.com');
    expect(lifeprintLink).toHaveAttribute('target', '_blank');

    const aslMsLink = screen.getByRole('link', { name: 'asl.ms Fingerspelling' });
    expect(aslMsLink).toHaveAttribute('href', 'https://asl.ms');
    expect(aslMsLink).toHaveAttribute('target', '_blank');
  });

  test('preserves author credit "gyanmistry" with Instagram link', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const authorSpans = screen.getAllByText(/gyanmistry/i);
    expect(authorSpans.length).toBeGreaterThanOrEqual(1);

    const igLink = screen.getByRole('link', { name: /DM gyanmistry on Instagram/i });
    expect(igLink).toHaveAttribute('href', 'https://instagram.com/gyanmistry');
  });

  test('contains zero em-dashes or en-dashes in rendered text', () => {
    const { container } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const textContent = container.textContent || '';
    expect(textContent).not.toMatch(/\u2014/); // em-dash
    expect(textContent).not.toMatch(/\u2013/); // en-dash
  });
});
