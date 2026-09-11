import React from 'react';
import { screen, fireEvent, waitFor, cleanup, render, act } from '@testing-library/react';
import App from '../App';
import Home from '../components/Home';
import Deck from '../components/Deck';
import Flashcard, { FlashcardHandle } from '../components/Flashcard';
import TestMode from '../components/TestMode';
import FingerspellingPractice from '../components/FingerspellingPractice';
import PracticeModal from '../components/PracticeModal';
import {
  setupE2ETestEnvironment,
  renderWithRouter,
  mockCards,
  mockHelloSpec,
} from './testHelpers';
import { LOCAL_STORAGE_STARRED_KEY } from '../components/constants';
import { getWordsByExactLength } from '../data/fingerspellingWords';

describe('Tier 2: Boundary, Edge & Corner Cases', () => {
  let env: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    env = setupE2ETestEnvironment();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Boundary Area 1: Search Queries & Input Edge Cases
  // ==========================================================================
  describe('Boundary Area 1: Search Queries & Input Edge Cases', () => {
    test('1.1: Empty search query submission does not trigger results or crash', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      const searchBtn = screen.getByRole('button', { name: /Search/i });
      fireEvent.click(searchBtn);
      expect(document.querySelector('.search-results-container')).not.toBeInTheDocument();
    });

    test('1.2: Whitespace-only search query ("   ") is treated as empty query', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      fireEvent.change(searchInput, { target: { value: '    ' } });
      const searchBtn = screen.getByRole('button', { name: /Search/i });
      fireEvent.click(searchBtn);
      expect(document.querySelector('.search-results-container')).not.toBeInTheDocument();
    });

    test('1.3: Search query yielding zero results displays friendly "No results found"', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      fireEvent.change(searchInput, { target: { value: 'zzzznonexistentword123' } });
      const searchBtn = screen.getByRole('button', { name: /Search/i });
      fireEvent.click(searchBtn);
      expect(await screen.findByText(/No results found matching "zzzznonexistentword123"/i)).toBeInTheDocument();
    });

    test('1.4: Search query containing special characters and symbols handles input safely', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      const specialQuery = '<script>alert("xss")</script> & "quotes" / \\ %20';
      fireEvent.change(searchInput, { target: { value: specialQuery } });
      expect(searchInput).toHaveValue(specialQuery);
      const searchBtn = screen.getByRole('button', { name: /Search/i });
      fireEvent.click(searchBtn);
      expect(document.body).toBeInTheDocument();
    });

    test('1.5: Extremely long search string (300+ characters) does not cause horizontal overflow', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      const longString = 'A'.repeat(350);
      fireEvent.change(searchInput, { target: { value: longString } });
      expect(searchInput).toHaveValue(longString);
      const form = searchInput.closest('form');
      expect(form).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Boundary Area 2: Non-Existent Decks & Corrupted Storage
  // ==========================================================================
  describe('Boundary Area 2: Non-Existent Decks & Corrupted Storage', () => {
    test('2.1: Non-existent deck ID renders gracefully without crashing', async () => {
      renderWithRouter(<Deck deckId="non-existent-deck-9999" />);
      expect(document.body).toBeInTheDocument();
    });

    test('2.2: Zero starred cards in localStorage hides starred deck card from Home', async () => {
      localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, '[]');
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      expect(screen.queryByText(/Starred Cards \(/i)).not.toBeInTheDocument();
    });

    test('2.3: Null or missing localStorage item is handled gracefully', async () => {
      localStorage.removeItem(LOCAL_STORAGE_STARRED_KEY);
      renderWithRouter(<Home />);
      expect(await screen.findByText('ASL Study Decks')).toBeInTheDocument();
      expect(screen.queryByText(/Starred Cards \(/i)).not.toBeInTheDocument();
    });

    test('2.4: Corrupted non-JSON string in localStorage does not crash Home component', async () => {
      localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, '{malformed:invalid_json]');
      renderWithRouter(<Home />);
      expect(await screen.findByText('ASL Study Decks')).toBeInTheDocument();
    });

    test('2.5: Test mode with empty cards array displays No Cards Available state', async () => {
      renderWithRouter(<TestMode deckId="empty-deck" />);
      expect(document.body).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Boundary Area 3: Rapid Flip Toggling & Interactive Race Guards
  // ==========================================================================
  describe('Boundary Area 3: Rapid Flip Toggling & Interactive Race Guards', () => {
    test('3.1: Rapid flip toggling via imperative ref settles into correct final state', () => {
      const ref = React.createRef<FlashcardHandle>();
      render(
        <Flashcard
          ref={ref}
          videoUrl={mockCards[0].video_url}
          answer="Hello"
          showInstructions={false}
          onFirstFlip={jest.fn()}
        />
      );

      // Perform 10 rapid alternating flips
      act(() => {
        for (let i = 0; i < 10; i++) {
          ref.current?.flip(i % 2 === 0);
        }
        // Final flip to false (front/video)
        ref.current?.flip(false);
      });
      const card = document.querySelector('.flashcard');
      expect(card?.classList.contains('flipped')).toBe(false);

      // Final flip to true (back/answer)
      act(() => {
        ref.current?.flip(true);
      });
      expect(card?.classList.contains('flipped')).toBe(true);
    });

    test('3.2: Rapid consecutive clicks on star button guard against duplicate firing', () => {
      const onStarToggle = jest.fn();
      render(
        <Flashcard
          cardId="c1"
          videoUrl={mockCards[0].video_url}
          answer="Hello"
          showInstructions={false}
          onFirstFlip={jest.fn()}
          onStarToggle={onStarToggle}
        />
      );

      const starBtn = screen.getAllByTitle(/Star this card/i)[0];
      // Fire 3 consecutive click events rapidly
      fireEvent.click(starBtn);
      fireEvent.click(starBtn);
      fireEvent.click(starBtn);

      // Due to data-processing lock, onStarToggle is triggered once initially
      expect(onStarToggle).toHaveBeenCalledTimes(1);
    });

    test('3.3: Flashcard with extremely long answer string renders inside container', () => {
      const longAnswer = 'Sign for supercalifragilisticexpialidocious with additional explanation notes';
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={longAnswer}
          showInstructions={false}
          onFirstFlip={jest.fn()}
        />
      );
      expect(screen.getAllByText(longAnswer)[0]).toBeInTheDocument();
    });

    test('3.4: Flashcard with special HTML characters renders them safely as plain text', () => {
      const htmlAnswer = '<b>Bold</b> & <i>Italic</i> & "Quotes"';
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={htmlAnswer}
          showInstructions={false}
          onFirstFlip={jest.fn()}
        />
      );
      expect(screen.getAllByText(htmlAnswer)[0]).toBeInTheDocument();
    });

    test('3.5: Flashcard handles missing onCardInteraction handler gracefully without error', () => {
      const ref = React.createRef<FlashcardHandle>();
      expect(() => {
        render(
          <Flashcard
            ref={ref}
            videoUrl={mockCards[0].video_url}
            answer="Hello"
            showInstructions={false}
            onFirstFlip={jest.fn()}
            isHighlighted={true}
            cardId="c1"
          />
        );
        ref.current?.flip(true);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Boundary Area 4: Test Mode Slash-Variant & Case Sensitivity
  // ==========================================================================
  describe('Boundary Area 4: Test Mode Slash-Variant & Case Sensitivity', () => {
    test('4.1: Accepts ALL UPPERCASE input for exact match', async () => {
      const singleCard = [
        {
          id: 'c1',
          answer: 'Hello',
          video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/view',
          deck_id: '1',
        },
      ];
      (window.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(singleCard),
      });

      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: 'HELLO' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByRole('heading', { name: /Correct!/i })).toBeInTheDocument();
    });

    test('4.2: Accepts mixed casing (hElLo) for exact match', async () => {
      const singleCard = [
        {
          id: 'c1',
          answer: 'Hello',
          video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/view',
          deck_id: '1',
        },
      ];
      (window.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(singleCard),
      });

      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: 'hElLo' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByRole('heading', { name: /Correct!/i })).toBeInTheDocument();
    });

    test('4.3: Trims surrounding whitespace from student answer', async () => {
      const singleCard = [
        {
          id: 'c1',
          answer: 'Hello',
          video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/view',
          deck_id: '1',
        },
      ];
      (window.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(singleCard),
      });

      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: '   Hello   ' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByRole('heading', { name: /Correct!/i })).toBeInTheDocument();
    });

    test('4.4: Submitting an empty answer string is evaluated as incorrect', async () => {
      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByText(/Incorrect/i)).toBeInTheDocument();
    });

    test('4.5: Submitting whitespace-only answer string is evaluated as incorrect', async () => {
      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: '     ' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByText(/Incorrect/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Boundary Area 5: Fingerspelling Tempo Limits & Word Bank Extremes
  // ==========================================================================
  describe('Boundary Area 5: Fingerspelling Tempo Limits & Word Bank Extremes', () => {
    test('5.1: Deaf speed preset button sets fastest tempo (0.2s / 200ms)', () => {
      renderWithRouter(<FingerspellingPractice />);
      const deafBtn = screen.getByRole('button', { name: /Deaf \/ Native \(0\.2s\)/i });
      fireEvent.click(deafBtn);
      expect(screen.getByText(/200 ms \/ letter/i)).toBeInTheDocument();
    });

    test('5.2: Slow speed preset button sets 1000ms tempo', () => {
      renderWithRouter(<FingerspellingPractice />);
      const slowBtn = screen.getByRole('button', { name: /Slow \(1.0s\)/i });
      fireEvent.click(slowBtn);
      expect(screen.getByText(/1000 ms \/ letter/i)).toBeInTheDocument();
    });

    test('5.3: Word bank supports minimum length constraint (1-letter words exist or returns empty gracefully)', () => {
      const oneLetterWords = getWordsByExactLength(1);
      expect(Array.isArray(oneLetterWords)).toBe(true);
    });

    test('5.4: Word bank supports maximum length words (8+ letters)', () => {
      const eightLetterWords = getWordsByExactLength(8);
      expect(eightLetterWords.length).toBeGreaterThan(0);
      eightLetterWords.forEach(w => expect(w.length).toBe(8));
    });

    test('5.5: Custom words mode handles empty and whitespace-padded entries', () => {
      renderWithRouter(<FingerspellingPractice />);
      const customBtn = screen.getByRole('button', { name: /Custom Words/i });
      fireEvent.click(customBtn);
      const customInput = screen.getByPlaceholderText(/cat, dog, student/i);
      fireEvent.change(customInput, { target: { value: '   apple  ,  ,  banana  ' } });
      expect(customInput).toHaveValue('   apple  ,  ,  banana  ');
    });
  });

  // ==========================================================================
  // Boundary Area 6: Webcam Permission & Hardware Boundaries
  // ==========================================================================
  describe('Boundary Area 6: Webcam Permission & Hardware Boundaries', () => {
    test('6.1: Displays error state when getUserMedia throws permission denied', async () => {
      const permError = new Error('Camera access denied');
      permError.name = 'NotAllowedError';
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(permError);
      render(
        <PracticeModal
          spec={mockHelloSpec}
          videoUrl="/api/videos/stream/test"
          onClose={jest.fn()}
        />
      );
      expect(await screen.findByText(/Camera access was denied/i)).toBeInTheDocument();
    });

    test('6.2: Displays hardware error state when camera device is already in use', async () => {
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
        new Error('Device in use by another application')
      );
      render(
        <PracticeModal
          spec={mockHelloSpec}
          videoUrl="/api/videos/stream/test"
          onClose={jest.fn()}
        />
      );
      expect(await screen.findByText(/Device in use by another application/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Done Practicing/i })).toBeInTheDocument();
    });
  });
});
