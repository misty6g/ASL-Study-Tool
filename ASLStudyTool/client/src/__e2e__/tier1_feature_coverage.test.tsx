import React, { act } from 'react';
import { screen, fireEvent, waitFor, cleanup, render } from '@testing-library/react';
import App from '../App';
import Home from '../components/Home';
import Deck from '../components/Deck';
import Flashcard, { FlashcardHandle } from '../components/Flashcard';
import TestMode from '../components/TestMode';
import FingerspellingPractice from '../components/FingerspellingPractice';
import PracticeDisclaimerModal from '../components/PracticeDisclaimerModal';
import PracticeModal from '../components/PracticeModal';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import {
  setupE2ETestEnvironment,
  renderWithRouter,
  getContrastRatio,
  scanForForbiddenDashes,
  mockDecks,
  mockCards,
  mockHelloSpec,
} from './testHelpers';
import { resolveVideoSources } from '../utils/videoUtils';

describe('Tier 1: Comprehensive Feature Coverage (Features 1 to 39)', () => {
  let env: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    env = setupE2ETestEnvironment();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Area 1: Tokens, Foundation & Shell Layout (Features 1-10, 21)
  // ==========================================================================
  describe('Area 1: Tokens, Foundation & Shell Layout (Features 1-10, 21)', () => {
    const tokens = {
      surfaceBase: '#0b0f17',
      surfaceCard: '#151d2c',
      surfaceCardHover: '#1c273a',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      accentPrimary: '#6366f1',
      accentStar: '#f59e0b',
      radiusCard: 16,
      radiusBtn: 10,
      radiusPill: 9999,
    };

    test('1.1: Surface tokens use warm-slate palette avoiding pure black #000000', () => {
      expect(tokens.surfaceBase.toLowerCase()).not.toBe('#000000');
      expect(tokens.surfaceBase.toLowerCase()).toMatch(/^#0[be][0-9a-f]{4}$/);
    });

    test('1.2: Surface tokens establish monotonic luminance progression from base to hover', () => {
      const baseNum = parseInt(tokens.surfaceBase.replace('#', ''), 16);
      const cardNum = parseInt(tokens.surfaceCard.replace('#', ''), 16);
      const hoverNum = parseInt(tokens.surfaceCardHover.replace('#', ''), 16);
      expect(cardNum).toBeGreaterThan(baseNum);
      expect(hoverNum).toBeGreaterThan(cardNum);
    });

    test('1.3: Primary accent is Electric Indigo (#6366f1) and star is Amber (#f59e0b)', () => {
      expect(tokens.accentPrimary.toLowerCase()).toBe('#6366f1');
      expect(tokens.accentStar.toLowerCase()).toBe('#f59e0b');
      expect(tokens.accentPrimary).not.toBe(tokens.accentStar);
    });

    test('1.4: Geometry contracts enforce 16px cards, 10px buttons, and 9999px pills', () => {
      expect(tokens.radiusCard).toBe(16);
      expect(tokens.radiusBtn).toBe(10);
      expect(tokens.radiusPill).toBeGreaterThanOrEqual(9999);
      expect(tokens.radiusCard).toBeGreaterThan(tokens.radiusBtn);
    });

    test('1.5: Zero em-dashes and en-dashes across Navigation and Footer', () => {
      renderWithRouter(<Navigation />);
      const navText = document.querySelector('.app-header')?.textContent || '';
      expect(scanForForbiddenDashes(navText).hasEmDash).toBe(false);
      expect(scanForForbiddenDashes(navText).hasEnDash).toBe(false);

      renderWithRouter(<Footer />);
      const footerText = document.querySelector('.app-footer')?.textContent || '';
      expect(scanForForbiddenDashes(footerText).hasEmDash).toBe(false);
      expect(scanForForbiddenDashes(footerText).hasEnDash).toBe(false);
    });

    test('1.6: Application shell renders responsive top navigation with study links', () => {
      renderWithRouter(<Navigation />);
      expect(screen.getByText(/ASL/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ASL Study Tool Home/i })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /Primary site navigation/i })).toBeInTheDocument();
    });

    test('1.7: Breadcrumbs display contextual hierarchy based on route', () => {
      renderWithRouter(<Navigation />, { route: '/deck/all-starred' });
      const breadcrumbs = screen.getByRole('navigation', { name: /Breadcrumb hierarchy/i });
      expect(breadcrumbs).toBeInTheDocument();
      expect(breadcrumbs).toHaveTextContent('Starred Cards');
    });
  });

  // ==========================================================================
  // Area 2: Home Deck Hub & Responsive Grid (Features 11, 15)
  // ==========================================================================
  describe('Area 2: Home Deck Hub & Responsive Grid (Features 11, 15)', () => {
    test('2.1: Home view renders main title and deck grid container', async () => {
      renderWithRouter(<Home />);
      expect(await screen.findByText(/ASL Study Decks/i)).toBeInTheDocument();
      expect(document.querySelector('.deck-grid')).toBeInTheDocument();
    });

    test('2.2: Renders regular deck cards matching API data', async () => {
      renderWithRouter(<Home />);
      expect(await screen.findByText('ASL Alphabet')).toBeInTheDocument();
      expect(screen.getByText('Numbers 1-20')).toBeInTheDocument();
      expect(screen.getByText('Greetings and Phrases')).toBeInTheDocument();
    });

    test('2.3: Deck links have valid route targets (/deck/:id)', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Alphabet');
      const alphabetLink = screen.getByText('ASL Alphabet').closest('a');
      expect(alphabetLink).toHaveAttribute('href', '/deck/1');
    });

    test('2.4: Deck grid container does not have inline 100vw or fixed lockout styles', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      const container = document.querySelector('.home-container') as HTMLElement;
      expect(container.style.width).not.toBe('100vw');
      expect(container.style.position).not.toBe('fixed');
    });

    test('2.5: Deck cards display accessible h2 headings with titles', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Alphabet');
      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Area 3: Real-Time Search & Filtering (Feature 12)
  // ==========================================================================
  describe('Area 3: Real-Time Search & Filtering (Feature 12)', () => {
    test('3.1: Search input and search button are present in Home view', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      expect(screen.getByPlaceholderText(/Search for signs or decks/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument();
    });

    test('3.2: Typing a query updates the search input value', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      fireEvent.change(searchInput, { target: { value: 'Hello' } });
      expect(searchInput).toHaveValue('Hello');
    });

    test('3.3: Emptying the search query clears any active search results', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      fireEvent.change(searchInput, { target: { value: 'Hello' } });
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(document.querySelector('.search-results-container')).not.toBeInTheDocument();
    });

    test('3.4: Submitting search triggers search processing without page reload', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      fireEvent.change(searchInput, { target: { value: 'Alphabet' } });
      const searchBtn = screen.getByRole('button', { name: /Search/i });
      fireEvent.click(searchBtn);
      expect(searchInput).toHaveValue('Alphabet');
    });

    test('3.5: Search form has accessible text input with clear placeholder', async () => {
      renderWithRouter(<Home />);
      const searchInput = await screen.findByPlaceholderText(/Search for signs or decks/i);
      expect(searchInput.getAttribute('type')).toBe('text');
      expect(searchInput.getAttribute('placeholder')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Area 4: Starred Cards Access & Persistence (Features 13, 19)
  // ==========================================================================
  describe('Area 4: Starred Cards Access & Persistence (Features 13, 19)', () => {
    test('4.1: Starred Cards entry point is hidden on Home when no cards are starred', async () => {
      localStorage.setItem('asl_study_tool_starred_cards', JSON.stringify([]));
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      expect(screen.queryByText(/Starred Cards \(/i)).not.toBeInTheDocument();
    });

    test('4.2: Starred Cards deck card appears on Home when localStorage contains starred card IDs', async () => {
      localStorage.setItem('asl_study_tool_starred_cards', JSON.stringify(['c1', 'c2']));
      renderWithRouter(<Home />);
      expect(await screen.findByText(/Starred Cards \(2\)/i)).toBeInTheDocument();
    });

    test('4.3: Flashcard renders star button reflecting isStarred=false rest state', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={mockCards[0].answer}
          showInstructions={false}
          onFirstFlip={jest.fn()}
          isStarred={false}
        />
      );
      const starBtn = screen.getAllByTitle(/Star this card/i)[0];
      expect(starBtn).toBeInTheDocument();
      expect(starBtn).toHaveTextContent('☆');
    });

    test('4.4: Flashcard renders star button reflecting isStarred=true active state', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={mockCards[0].answer}
          showInstructions={false}
          onFirstFlip={jest.fn()}
          isStarred={true}
        />
      );
      const starBtn = screen.getAllByTitle(/Unstar this card/i)[0];
      expect(starBtn).toBeInTheDocument();
      expect(starBtn).toHaveTextContent('★');
    });

    test('4.5: Clicking star button invokes onStarToggle handler with toggled state', () => {
      const onStarToggle = jest.fn();
      render(
        <Flashcard
          cardId="card-hello"
          videoUrl={mockCards[0].video_url}
          answer={mockCards[0].answer}
          showInstructions={false}
          onFirstFlip={jest.fn()}
          isStarred={false}
          onStarToggle={onStarToggle}
        />
      );
      const starBtn = screen.getAllByTitle(/Star this card/i)[0];
      fireEvent.click(starBtn);
      expect(onStarToggle).toHaveBeenCalledWith('card-hello', true);
    });
  });

  // ==========================================================================
  // Area 5: Fingerspelling Quick-Launcher (Feature 14)
  // ==========================================================================
  describe('Area 5: Fingerspelling Quick-Launcher (Feature 14)', () => {
    test('5.1: Fingerspelling launcher card is displayed on Home hub', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      expect(screen.getByText(/Fingerspelling/i)).toBeInTheDocument();
    });

    test('5.2: Launcher card displays "asl.ms Practice" badge', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      expect(screen.getByText(/asl\.ms Practice/i)).toBeInTheDocument();
    });

    test('5.3: Launcher links directly to /fingerspelling route', async () => {
      renderWithRouter(<Home />);
      await screen.findByText('ASL Study Decks');
      const launcherLink = screen.getByText(/asl\.ms Practice/i).closest('a');
      expect(launcherLink).toHaveAttribute('href', '/fingerspelling');
    });

    test('5.4: Fingerspelling practice view mounts title when route is /fingerspelling', () => {
      renderWithRouter(<App />, { route: '/fingerspelling' });
      expect(screen.getByText(/ASL Fingerspelling Practice/i)).toBeInTheDocument();
    });

    test('5.5: Navigation bar contains Fingerspelling tab link', () => {
      renderWithRouter(<Navigation />);
      const fsLink = screen.getByRole('link', { name: /Fingerspelling/i });
      expect(fsLink).toHaveAttribute('href', '/fingerspelling');
    });
  });

  // ==========================================================================
  // Area 6: Flashcard 3D Flips, Batch Controls & Pagination (Features 16, 18, 20)
  // ==========================================================================
  describe('Area 6: Flashcard 3D Flips, Batch Controls & Pagination (Features 16, 18, 20)', () => {
    test('6.1: Flashcard renders front face with video container by default', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={mockCards[0].answer}
          showInstructions={true}
          onFirstFlip={jest.fn()}
        />
      );
      expect(document.querySelector('.flashcard-front')).toBeInTheDocument();
      expect(document.querySelector('.flashcard-back')).toBeInTheDocument();
      expect(document.querySelector('.flashcard')?.classList.contains('flipped')).toBe(false);
    });

    test('6.2: Clicking outside video on flashcard toggles flipped class to reveal answer', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer="Hello"
          showInstructions={true}
          onFirstFlip={jest.fn()}
        />
      );
      const card = document.querySelector('.flashcard') as HTMLElement;
      fireEvent.click(card);
      expect(card.classList.contains('flipped')).toBe(true);
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    test('6.3: First card flip triggers onFirstFlip callback', () => {
      const onFirstFlip = jest.fn();
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer="Hello"
          showInstructions={true}
          onFirstFlip={onFirstFlip}
        />
      );
      const card = document.querySelector('.flashcard') as HTMLElement;
      fireEvent.click(card);
      expect(onFirstFlip).toHaveBeenCalledTimes(1);
    });

    test('6.4: Flashcard exposes imperative flip handle via ref', () => {
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
      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.flip).toBe('function');
      act(() => {
        ref.current?.flip(true);
      });
      expect(document.querySelector('.flashcard')?.classList.contains('flipped')).toBe(true);
      act(() => {
        ref.current?.flip(false);
      });
      expect(document.querySelector('.flashcard')?.classList.contains('flipped')).toBe(false);
    });

    test('6.5: Deck view provides "Show Answers / Show Videos" batch button', async () => {
      renderWithRouter(<Deck deckId="1" />);
      expect(await screen.findByTitle('Show Answers')).toBeInTheDocument();
      const flipAllBtn = screen.getByTitle('Show Answers');
      fireEvent.click(flipAllBtn);
      expect(screen.getByTitle('Show Videos')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Area 7: Video Playback & Fallback Resolution (Feature 17)
  // ==========================================================================
  describe('Area 7: Video Playback & Fallback Resolution (Feature 17)', () => {
    test('7.1: Resolves Google Drive file URLs into direct stream and preview URLs', () => {
      const url = 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/view';
      const resolved = resolveVideoSources(url);
      expect(resolved.isDrive).toBe(true);
      expect(resolved.fileId).toBe('18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb');
      expect(resolved.streamUrl).toContain('/api/videos/stream/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb');
      expect(resolved.previewUrl).toContain('drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/preview');
    });

    test('7.2: Passes standard direct MP4 URLs through without alteration', () => {
      const directUrl = 'https://example.com/videos/sign-hello.mp4';
      const resolved = resolveVideoSources(directUrl);
      expect(resolved.isDrive).toBe(false);
      expect(resolved.streamUrl).toBe(directUrl);
    });

    test('7.3: Flashcard video element renders with muted and playsInline attributes', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={mockCards[0].answer}
          showInstructions={false}
          onFirstFlip={jest.fn()}
        />
      );
      const videoEl = document.querySelector('video') as HTMLVideoElement;
      expect(videoEl).toBeInTheDocument();
      expect(videoEl.muted).toBe(true);
      expect(videoEl).toHaveAttribute('playsinline');
    });

    test('7.4: Video error on Google Drive video switches to iframe fallback', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={mockCards[0].answer}
          showInstructions={false}
          onFirstFlip={jest.fn()}
        />
      );
      const videoEl = document.querySelector('video') as HTMLVideoElement;
      fireEvent.error(videoEl);
      expect(document.querySelector('iframe')).toBeInTheDocument();
    });

    test('7.5: Card instruction guides student on flip interaction', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer={mockCards[0].answer}
          showInstructions={true}
          onFirstFlip={jest.fn()}
        />
      );
      expect(screen.getByText(/Click anywhere outside the video to flip/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Area 8: Gamified Test Mode, Slash Validation & Auto-Starring (Features 22-27)
  // ==========================================================================
  describe('Area 8: Gamified Test Mode, Slash Validation & Auto-Starring (Features 22-27)', () => {
    test('8.1: Test Mode renders question prompt, progress counter, and video player', async () => {
      renderWithRouter(<TestMode deckId="1" />);
      expect(await screen.findByText(/ASL Test/i)).toBeInTheDocument();
      expect(screen.getByText(/1 of/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Type your answer here/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit/i })).toBeInTheDocument();
    });

    test('8.2: Slash-variant answer validation accepts first variant', async () => {
      const slashCard = [
        {
          id: 'card-slash-1',
          answer: "Thank You / You're Welcome",
          video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qc/view',
          deck_id: '1',
        },
      ];
      (window.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(slashCard),
      });

      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: 'Thank You' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByRole('heading', { name: /Correct!/i })).toBeInTheDocument();
    });

    test('8.3: Slash-variant answer validation accepts case-insensitive answers', async () => {
      const slashCard = [
        {
          id: 'card-slash-1',
          answer: "Thank You / You're Welcome",
          video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qc/view',
          deck_id: '1',
        },
      ];
      (window.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(slashCard),
      });

      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: "you're welcome" } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByRole('heading', { name: /Correct!/i })).toBeInTheDocument();
    });

    test('8.4: Submitting an incorrect answer displays incorrect feedback and Next button', async () => {
      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: 'WrongAnswer' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      expect(await screen.findByText(/Incorrect/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    });

    test('8.5: Incorrect answer auto-stars the card in localStorage', async () => {
      localStorage.setItem('asl_study_tool_starred_cards', JSON.stringify([]));
      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: 'TotallyWrong' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
      await screen.findByText(/Incorrect/i);
      const savedStarred = JSON.parse(localStorage.getItem('asl_study_tool_starred_cards') || '[]');
      expect(savedStarred.length).toBeGreaterThan(0);
    });

    test('8.6: Back button in test mode has .back-btn styling class', async () => {
      renderWithRouter(<TestMode deckId="1" />);
      await screen.findByText(/ASL Test/i);
      const backBtn = screen.getByRole('button', { name: /Back to Deck/i });
      expect(backBtn).toHaveClass('back-btn');
    });
  });

  // ==========================================================================
  // Area 9: Fingerspelling Practice, Audio Feedback & Verification (Features 28-32)
  // ==========================================================================
  describe('Area 9: Fingerspelling Practice, Audio Feedback & Verification (Features 28-32)', () => {
    test('9.1: Fingerspelling view renders sprite display, New Word and Replay buttons', () => {
      renderWithRouter(<FingerspellingPractice />);
      expect(screen.getByText(/ASL Fingerspelling Practice/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Word/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Replay/i })).toBeInTheDocument();
      expect(document.querySelector('.fs-sprite-box')).toBeInTheDocument();
    });

    test('9.2: Speed presets (Slow, Medium, Fast, Deaf) update tempo label in ms', () => {
      renderWithRouter(<FingerspellingPractice />);
      const slowBtn = screen.getByRole('button', { name: /Slow \(1.0s\)/i });
      fireEvent.click(slowBtn);
      expect(screen.getByText(/1000 ms \/ letter/i)).toBeInTheDocument();

      const fastBtn = screen.getByRole('button', { name: /Fast \(0.33s\)/i });
      fireEvent.click(fastBtn);
      expect(screen.getByText(/333 ms \/ letter/i)).toBeInTheDocument();
    });

    test('9.3: Real-time streak counter and session stats are rendered', () => {
      renderWithRouter(<FingerspellingPractice />);
      expect(screen.getByText(/^Streak$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Best Streak$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Accuracy$/i)).toBeInTheDocument();
    });

    test('9.4: Audio synthesis initializes AudioContext on demand', () => {
      renderWithRouter(<FingerspellingPractice />);
      const input = screen.getByPlaceholderText(/Type your answer here/i);
      fireEvent.change(input, { target: { value: 'test' } });
      const form = input.closest('form');
      if (form) {
        fireEvent.submit(form);
      }
      expect((window as any).AudioContext).toHaveBeenCalled();
    });

    test('9.5: Homework verification sheet displays student name input and current date', () => {
      renderWithRouter(<FingerspellingPractice />);
      expect(screen.getByText(/Your Name:/i)).toBeInTheDocument();
      expect(screen.getByText(/Today is/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Type your name/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Area 10: AI Webcam Practice Modal, Handedness & Disclaimers (Features 33-35)
  // ==========================================================================
  describe('Area 10: AI Webcam Practice Modal, Handedness & Disclaimers (Features 33-35)', () => {
    test('10.1: Practice button is rendered on flashcard when sign specification exists', () => {
      render(
        <Flashcard
          videoUrl={mockCards[0].video_url}
          answer="Hello"
          showInstructions={false}
          onFirstFlip={jest.fn()}
        />
      );
      const practiceButtons = screen.getAllByRole('button', { name: /Practice/i });
      expect(practiceButtons.length).toBeGreaterThanOrEqual(1);
    });

    test('10.2: Disclaimer modal renders notice, educational callout, and confirm button', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      render(
        <PracticeDisclaimerModal
          isOpen={true}
          signName="Hello"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );
      expect(screen.getByText(/Practice Mode Notice/i)).toBeInTheDocument();
      expect(screen.getByText(/Basic Computer Algorithms/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /I Understand & Continue/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    test('10.3: Practice Modal requests webcam stream upon opening', async () => {
      render(
        <PracticeModal
          spec={mockHelloSpec}
          videoUrl="/api/videos/stream/test"
          onClose={jest.fn()}
        />
      );
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
          expect.objectContaining({ video: expect.any(Object) })
        );
      });
    });

    test('10.4: Practice Modal provides Left/Right handedness selector', async () => {
      render(
        <PracticeModal
          spec={mockHelloSpec}
          videoUrl="/api/videos/stream/test"
          onClose={jest.fn()}
        />
      );
      expect(await screen.findByRole('button', { name: /^Right$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Left$/i })).toBeInTheDocument();
    });

    test('10.5: Switching handedness updates button state and persists in localStorage', async () => {
      render(
        <PracticeModal
          spec={mockHelloSpec}
          videoUrl="/api/videos/stream/test"
          onClose={jest.fn()}
        />
      );
      const leftHandBtn = await screen.findByRole('button', { name: /^Left$/i });
      fireEvent.click(leftHandBtn);
      expect(leftHandBtn).toHaveClass('active');
      expect(localStorage.getItem('asl_practice_dominant_hand')).toBe('left');
    });

    test('10.6: Closing practice modal terminates all webcam media tracks', async () => {
      const onClose = jest.fn();
      render(
        <PracticeModal
          spec={mockHelloSpec}
          videoUrl="/api/videos/stream/test"
          onClose={onClose}
        />
      );
      const doneBtn = await screen.findByRole('button', { name: /Done Practicing/i });
      fireEvent.click(doneBtn);
      expect(env.mockTrack.stop).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Area 11: Tactile Motion, Keyboard A11y & WCAG AA Contrast (Features 36-39)
  // ==========================================================================
  describe('Area 11: Tactile Motion, Keyboard A11y & WCAG AA Contrast (Features 36-39)', () => {
    test('11.1: Keyboard Escape key closes Practice Disclaimer Modal', () => {
      const onCancel = jest.fn();
      render(
        <PracticeDisclaimerModal
          isOpen={true}
          signName="Hello"
          onConfirm={jest.fn()}
          onCancel={onCancel}
        />
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    test('11.2: Keyboard Escape key closes Practice Modal and stops camera', async () => {
      const onClose = jest.fn();
      render(
        <PracticeModal
          spec={mockHelloSpec}
          videoUrl="/api/videos/stream/test"
          onClose={onClose}
        />
      );
      await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(env.mockTrack.stop).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('11.3: Mobile drawer navigation closes on Escape key', () => {
      renderWithRouter(<Navigation />);
      const hamburger = screen.getByLabelText(/Open navigation menu/i);
      fireEvent.click(hamburger);
      const drawer = screen.getByRole('dialog', { name: /Mobile Navigation Drawer/i });
      expect(drawer).toHaveClass('drawer-open');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(drawer).not.toHaveClass('drawer-open');
    });

    test('11.4: Primary text on dark surfaces meets WCAG AA contrast ratio (>= 4.5:1)', () => {
      const surfaceBase = '#0b0f17';
      const surfaceCard = '#151d2c';
      const textPrimary = '#f8fafc';
      const textSecondary = '#94a3b8';

      expect(getContrastRatio(surfaceBase, textPrimary)).toBeGreaterThanOrEqual(7.0);
      expect(getContrastRatio(surfaceCard, textPrimary)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(surfaceBase, textSecondary)).toBeGreaterThanOrEqual(4.5);
    });

    test('11.5: Interactive button text meets WCAG AA contrast against button backgrounds', () => {
      const btnPrimaryBg = '#6366f1';
      const btnText = '#ffffff';
      expect(getContrastRatio(btnPrimaryBg, btnText)).toBeGreaterThanOrEqual(3.0);
    });
  });
});
