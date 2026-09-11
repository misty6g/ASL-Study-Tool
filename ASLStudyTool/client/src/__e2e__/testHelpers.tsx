import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { Card } from '../types/Card';
import { Deck as DeckType } from '../types/Deck';
import { SignSpecification, NormalizedFrame } from '../practice/types';
import { visionService } from '../practice/visionService';

/**
 * Fixture: Mock ASL Decks
 */
export const mockDecks: DeckType[] = [
  { id: 'deck-alphabet', title: 'ASL Alphabet', user_id: 'user-1' },
  { id: 'deck-numbers', title: 'Numbers 1-20', user_id: 'user-1' },
  { id: 'deck-greetings', title: 'Greetings and Phrases', user_id: 'user-1' },
  { id: 'deck-family', title: 'Family Members', user_id: 'user-1' },
];

/**
 * Fixture: Mock Flashcards
 */
export const mockCards: Card[] = [
  {
    id: 'card-hello',
    answer: 'Hello',
    video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/view',
    deck_id: 'deck-greetings',
  },
  {
    id: 'card-thank-you',
    answer: "Thank You / You're Welcome",
    video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qc/view',
    deck_id: 'deck-greetings',
  },
  {
    id: 'card-good',
    answer: 'Good',
    video_url: '/api/videos/stream/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qd',
    deck_id: 'deck-greetings',
  },
  {
    id: 'card-yes',
    answer: 'Yes',
    video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qe/view',
    deck_id: 'deck-greetings',
  },
  {
    id: 'card-no',
    answer: 'No',
    video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qf/view',
    deck_id: 'deck-greetings',
  },
];

/**
 * Fixture: 25 cards for infinite scroll & pagination testing
 */
export const mockManyCards: Card[] = Array.from({ length: 25 }, (_, i) => ({
  id: `card-page-${i + 1}`,
  answer: `Sign ${i + 1}`,
  video_url: `https://drive.google.com/file/d/drive-file-id-${i + 1}/view`,
  deck_id: 'deck-alphabet',
}));

/**
 * Fixture: Mock Practice Specification for "Hello"
 */
export const mockHelloSpec: SignSpecification = {
  id: 'hello',
  name: 'Hello',
  aliases: ['hello', 'hi'],
  version: '1.0.0',
  description: 'Open hand salute at temple moving outward',
  requiredHands: 'one',
  instructions: 'Start with an open B-hand near your temple and move it outward in a salute motion.',
  expectedHandshape: 'flat-B',
  expectedLocationZone: 'forehead',
  expectedPalmDirection: 'away',
  rules: [
    {
      id: 'hello-handshape',
      dimension: 'handshape',
      description: 'Fingers should be extended together in a flat-B shape',
      weight: 1.5,
      feedbackOnFail: 'Fingers should be extended together in a flat-B shape',
      feedbackOnSuccess: 'Good handshape',
      evaluate: () => ({ passed: true, score: 1.0 }),
    },
    {
      id: 'hello-location',
      dimension: 'location',
      description: 'Hand should begin near temple or forehead level',
      weight: 1.5,
      feedbackOnFail: 'Hand should begin near temple or forehead level',
      feedbackOnSuccess: 'Good location',
      evaluate: () => ({ passed: true, score: 1.0 }),
    },
    {
      id: 'hello-movement',
      dimension: 'movement',
      description: 'Hand should move outward away from head',
      weight: 1.5,
      feedbackOnFail: 'Hand should move outward away from head',
      feedbackOnSuccess: 'Good movement',
      evaluate: () => ({ passed: true, score: 1.0 }),
    },
    {
      id: 'hello-palm',
      dimension: 'orientation',
      description: 'Palm should face outward or forward',
      weight: 1.0,
      feedbackOnFail: 'Palm should face outward or forward',
      feedbackOnSuccess: 'Good orientation',
      evaluate: () => ({ passed: true, score: 1.0 }),
    },
  ],
};

/**
 * Fixture: Mock Normalized Frames for Practice Evaluation
 */
export const createMockFrames = (
  count = 10,
  handshape = 'flat-B',
  deltaX = 0.02,
  bodyZone: 'forehead' | 'chest' | 'chin' = 'forehead'
): NormalizedFrame[] => {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: i * 150,
    poseLandmarks: null,
    origin: { x: 0.5, y: 0.5, z: 0 },
    scale: 0.3,
    hands: [
      {
        handedness: 'Right',
        isDominant: true,
        wrist: { x: 0.2 + i * deltaX, y: bodyZone === 'forehead' ? -0.45 : 0.2, z: 0 },
        fingertips: {
          thumb: { x: 0.2, y: -0.5, z: 0 },
          index: { x: 0.22, y: -0.65, z: 0 },
          middle: { x: 0.24, y: -0.65, z: 0 },
          ring: { x: 0.26, y: -0.65, z: 0 },
          pinky: { x: 0.28, y: -0.65, z: 0 },
        },
        fingerStates: {
          thumb: 'half',
          index: handshape === 'fist' ? 'curled' : 'extended',
          middle: handshape === 'fist' ? 'curled' : 'extended',
          ring: handshape === 'fist' ? 'curled' : 'extended',
          pinky: handshape === 'fist' ? 'curled' : 'extended',
        },
        palmNormal: { x: 0, y: 0, z: -1 },
        palmDirection: 'away',
        handshapeName: handshape,
        velocity: { x: deltaX, y: 0, z: 0 },
        bodyZone,
      },
    ],
    quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
  }));
};

/**
 * Global Test Harness Setup & Teardown
 */
export function setupE2ETestEnvironment() {
  // Web Audio API mock
  const mockOscillator = {
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
    type: 'sine',
  };
  const mockGain = {
    connect: jest.fn(),
    gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
  };

  (window as any).AudioContext = jest.fn().mockImplementation(() => ({
    createOscillator: jest.fn().mockReturnValue(mockOscillator),
    createGain: jest.fn().mockReturnValue(mockGain),
    destination: {},
    currentTime: 0,
    state: 'running',
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }));

  // HTMLMediaElement mock
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = jest.fn();
  window.HTMLMediaElement.prototype.load = jest.fn();

  // IntersectionObserver mock
  let observerCallback: IntersectionObserverCallback | null = null;
  (window as any).IntersectionObserver = jest.fn().mockImplementation((callback) => {
    observerCallback = callback;
    return {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
  });

  // ResizeObserver mock
  (window as any).ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // window.matchMedia mock
  (window as any).matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion: reduce') ? false : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  // Canvas 2D context mock
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    drawImage: jest.fn(),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
  }) as any;

  // Global fetch mock
  const mockFetch = jest.fn((url: string = '') => {
    const urlStr = String(url || '');
    if (urlStr.includes('/api/cards') || urlStr.includes('cards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockCards),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
  });
  window.fetch = mockFetch as any;
  (global as any).fetch = mockFetch;

  // Mock navigator.mediaDevices.getUserMedia
  const mockTrack = {
    stop: jest.fn(),
    kind: 'video',
    enabled: true,
  };
  if (!navigator.mediaDevices) {
    (navigator as any).mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue({
    getTracks: () => [mockTrack],
  });

  // MediaPipe VisionService spy mocks
  jest.spyOn(visionService, 'initialize').mockResolvedValue(undefined);
  jest.spyOn(visionService, 'processFrame').mockReturnValue({
    frame: createMockFrames(1)[0],
    rawPoseLandmarks: null,
    rawHandLandmarks: [],
  });
  jest.spyOn(visionService, 'drawLandmarks').mockImplementation(() => {});

  // In-memory localStorage mock
  const store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) {
          delete store[k];
        }
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (i: number) => Object.keys(store)[i] || null,
    },
    writable: true,
  });

  return {
    mockOscillator,
    mockGain,
    mockTrack,
    triggerIntersection: (entries: Partial<IntersectionObserverEntry>[]) => {
      if (observerCallback) {
        observerCallback(entries as IntersectionObserverEntry[], {} as IntersectionObserver);
      }
    },
  };
}

/**
 * Custom renderer with MemoryRouter support
 */
export function renderWithRouter(
  ui: React.ReactElement,
  { route = '/' }: { route?: string } = {}
): RenderResult {
  window.history.pushState({}, 'Test', route);
  // If the element is App, App already includes BrowserRouter, so render directly
  if (ui.type === App || (ui.type as any)?.name === 'App') {
    return render(ui);
  }
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
}

/**
 * Calculate relative luminance and WCAG AA contrast ratio between two hex colors
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string): number => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const sRGB = [r, g, b].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Scans a string for forbidden em-dashes (U+2014) or en-dashes (U+2013)
 */
export function scanForForbiddenDashes(content: string): {
  hasEmDash: boolean;
  hasEnDash: boolean;
  emDashCount: number;
  enDashCount: number;
} {
  const emMatches = content.match(/\u2014/g) || [];
  const enMatches = content.match(/\u2013/g) || [];
  return {
    hasEmDash: emMatches.length > 0,
    hasEnDash: enMatches.length > 0,
    emDashCount: emMatches.length,
    enDashCount: enMatches.length,
  };
}
