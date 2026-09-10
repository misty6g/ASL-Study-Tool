import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FingerspellingPractice from './FingerspellingPractice';
import {
  ASL_WORDS,
  getWordsByMaxLength,
  getWordsByExactLength,
  getRandomFingerspellingWord,
} from '../data/fingerspellingWords';

describe('Fingerspelling word bank utilities', () => {
  test('has more than 5,000 words loaded from Lifeprint', () => {
    expect(ASL_WORDS.length).toBeGreaterThan(5000);
  });

  test('filters words by maximum length correctly', () => {
    const threeLetterOrLess = getWordsByMaxLength(3);
    expect(threeLetterOrLess.length).toBeGreaterThan(0);
    threeLetterOrLess.forEach((w) => {
      expect(w.length).toBeLessThanOrEqual(3);
    });
  });

  test('filters words by exact length correctly', () => {
    const fourLetterWords = getWordsByExactLength(4);
    expect(fourLetterWords.length).toBeGreaterThan(0);
    fourLetterWords.forEach((w) => {
      expect(w.length).toBe(4);
    });
  });

  test('picks random words adhering to max length constraints', () => {
    for (let i = 0; i < 20; i++) {
      const word = getRandomFingerspellingWord(4);
      expect(word.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('FingerspellingPractice component', () => {
  beforeEach(() => {
    // Mock Web Audio API
    (window as any).AudioContext = jest.fn().mockImplementation(() => ({
      createOscillator: () => ({
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      }),
      createGain: () => ({
        connect: jest.fn(),
        gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      }),
      destination: {},
      currentTime: 0,
      state: 'running',
      resume: jest.fn(),
    }));
  });

  test('renders fingerspelling title, controls, and student verification', () => {
    render(
      <BrowserRouter>
        <FingerspellingPractice />
      </BrowserRouter>
    );

    expect(screen.getByText(/ASL Fingerspelling Practice/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Word/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Replay/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your answer here/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Name:/i)).toBeInTheDocument();
    expect(screen.getByText(/Today is/i)).toBeInTheDocument();
  });

  test('expands and displays alphabet reference tiles', () => {
    render(
      <BrowserRouter>
        <FingerspellingPractice />
      </BrowserRouter>
    );

    const toggleBtn = screen.getByText(/ASL Alphabet Reference/i);
    fireEvent.click(toggleBtn);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  test('allows changing speed presets', () => {
    render(
      <BrowserRouter>
        <FingerspellingPractice />
      </BrowserRouter>
    );

    const slowBtn = screen.getByText(/Slow \(1.0s\)/i);
    fireEvent.click(slowBtn);
    expect(screen.getByText(/1000 ms \/ letter/i)).toBeInTheDocument();

    const fastBtn = screen.getByText(/Fast \(0.33s\)/i);
    fireEvent.click(fastBtn);
    expect(screen.getByText(/333 ms \/ letter/i)).toBeInTheDocument();
  });

  test('allows switching to custom words mode', () => {
    render(
      <BrowserRouter>
        <FingerspellingPractice />
      </BrowserRouter>
    );

    const customBtn = screen.getByText('Custom Words');
    fireEvent.click(customBtn);

    expect(screen.getByPlaceholderText(/cat, dog, student/i)).toBeInTheDocument();
  });
});
