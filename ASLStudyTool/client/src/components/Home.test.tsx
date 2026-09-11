import React from 'react';
import { screen, fireEvent, waitFor, cleanup, render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

const LOCAL_STORAGE_STARRED_KEY = 'asl_study_tool_starred_cards';

const renderHome = (route = '/') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Home />
    </MemoryRouter>
  );
};

describe('Home Component (Features 11 to 15)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Feature 11: Home Hero Banner', () => {
    test('renders hero eyebrow with INTERACTIVE ASL PLATFORM text', async () => {
      renderHome();
      expect(await screen.findByText('INTERACTIVE ASL PLATFORM')).toBeInTheDocument();
    });

    test('renders headline containing ASL Study Decks verbatim', async () => {
      renderHome();
      const headline = await screen.findByRole('heading', { level: 1 });
      expect(headline).toHaveTextContent('ASL Study Decks');
    });

    test('renders hero subtext with under 20 words and zero em-dashes', async () => {
      renderHome();
      const subtext = await screen.findByText(/Master American Sign Language vocabulary/i);
      expect(subtext).toBeInTheDocument();
      const words = subtext.textContent?.trim().split(/\s+/) || [];
      expect(words.length).toBeLessThanOrEqual(20);
      expect(subtext.textContent).not.toMatch(/[\u2014\u2013]/);
    });

    test('renders tactile CTAs for exploring decks and fingerspelling', async () => {
      renderHome();
      await screen.findByText('ASL Study Decks');
      const exploreBtn = screen.getByText('Explore Decks');
      expect(exploreBtn).toBeInTheDocument();
      expect(exploreBtn).toHaveAttribute('href', '#deck-grid-section');

      const trainerBtn = screen.getByRole('link', { name: /^Fingerspelling Trainer$/i });
      expect(trainerBtn).toBeInTheDocument();
      expect(trainerBtn).toHaveAttribute('href', '/fingerspelling');
    });
  });

  describe('Feature 12: Real-Time Search and Category Filters', () => {
    test('filters decks in real-time as user types in the search input', async () => {
      renderHome();
      await screen.findByText('ASL Alphabet');
      const searchInput = screen.getByPlaceholderText(/Search for signs or decks/i);

      fireEvent.change(searchInput, { target: { value: 'Alphabet' } });
      expect(screen.getByText('ASL Alphabet')).toBeInTheDocument();
      expect(screen.queryByText('Numbers 1-20')).not.toBeInTheDocument();
      expect(screen.queryByText('Greetings and Phrases')).not.toBeInTheDocument();
    });

    test('renders category filter pills for All Items, Study Decks, and Fingerspelling', async () => {
      renderHome();
      await screen.findByText('ASL Alphabet');
      expect(screen.getByRole('tab', { name: /All Items/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Study Decks/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Fingerspelling/i })).toBeInTheDocument();
    });

    test('clicking category filter pills switches active tab and filters items', async () => {
      renderHome();
      await screen.findByText('ASL Alphabet');

      const decksTab = screen.getByRole('tab', { name: /Study Decks/i });
      fireEvent.click(decksTab);
      expect(decksTab).toHaveClass('active');
      expect(screen.getByText('ASL Alphabet')).toBeInTheDocument();

      const fingerspellingTab = screen.getByRole('tab', { name: /Fingerspelling/i });
      fireEvent.click(fingerspellingTab);
      expect(fingerspellingTab).toHaveClass('active');
      expect(screen.queryByText('ASL Alphabet')).not.toBeInTheDocument();
      expect(screen.getByText(/🤟 Fingerspelling/i)).toBeInTheDocument();
    });

    test('inline clear button clears search text and restores all items', async () => {
      renderHome();
      await screen.findByText('ASL Alphabet');
      const searchInput = screen.getByPlaceholderText(/Search for signs or decks/i);

      fireEvent.change(searchInput, { target: { value: 'Greetings' } });
      expect(screen.queryByText('ASL Alphabet')).not.toBeInTheDocument();

      const clearBtn = screen.getByRole('button', { name: 'Clear' });
      fireEvent.click(clearBtn);

      expect(searchInput).toHaveValue('');
      expect(screen.getByText('ASL Alphabet')).toBeInTheDocument();
    });
  });

  describe('Feature 13: Starred Cards Quick Access', () => {
    test('hides starred cards deck when zero cards are saved', async () => {
      localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify([]));
      renderHome();
      await screen.findByText('ASL Study Decks');
      expect(screen.queryByText(/Starred Cards \(/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Starred/i })).not.toBeInTheDocument();
    });

    test('renders starred cards deck with count when cards exist in localStorage', async () => {
      localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(['c1', 'c2']));
      renderHome();
      expect(await screen.findByText(/Starred Cards \(2\)/i)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Starred/i })).toBeInTheDocument();
    });

    test('starred cards card links to /deck/all-starred', async () => {
      localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(['c1']));
      renderHome();
      await screen.findByText(/Starred Cards \(1\)/i);
      const starredLink = screen.getByRole('link', { name: /Starred Cards \(1\)/i });
      expect(starredLink).toHaveAttribute('href', '/deck/all-starred');
    });

    test('updates starred cards count when storage event is dispatched', async () => {
      localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(['c1']));
      renderHome();
      await screen.findByText(/Starred Cards \(1\)/i);

      act(() => {
        localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(['c1', 'c2', 'c3']));
        window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_STORAGE_STARRED_KEY }));
      });

      expect(await screen.findByText(/Starred Cards \(3\)/i)).toBeInTheDocument();
    });
  });

  describe('Feature 14: Fingerspelling Quick-Launch', () => {
    test('renders fingerspelling card with asl.ms Practice badge', async () => {
      renderHome();
      await screen.findByText('ASL Study Decks');
      expect(screen.getByText(/asl\.ms Practice/i)).toBeInTheDocument();
      expect(screen.getByText(/🤟 Fingerspelling/i)).toBeInTheDocument();
    });

    test('fingerspelling card links to /fingerspelling route', async () => {
      renderHome();
      await screen.findByText('ASL Study Decks');
      const link = screen.getByRole('link', { name: /Fingerspelling, asl\.ms Practice/i });
      expect(link).toHaveAttribute('href', '/fingerspelling');
    });
  });

  describe('Feature 15: Responsive Deck Grid and Anti-Slop Discipline', () => {
    test('renders .deck-grid container containing deck cards with h2 headers', async () => {
      renderHome();
      await screen.findByText('ASL Alphabet');
      const grid = document.querySelector('.deck-grid');
      expect(grid).toBeInTheDocument();

      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThanOrEqual(4);
    });

    test('renders Study Deck badges on regular deck cards', async () => {
      renderHome();
      await screen.findByText('ASL Alphabet');
      const badges = screen.getAllByText('Study Deck');
      expect(badges.length).toBeGreaterThanOrEqual(3);
    });

    test('entire Home component output contains zero em-dashes and en-dashes', async () => {
      renderHome();
      await screen.findByText('ASL Alphabet');
      const rootText = document.querySelector('.home-container')?.textContent || '';
      expect(rootText).not.toMatch(/[\u2014\u2013]/);
    });
  });
});
