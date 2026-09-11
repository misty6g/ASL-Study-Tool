import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './Welcome.css';

const PRESET_WORDS = ['WELCOME', 'HELLO', 'ASL', 'LEARN', 'FRIEND', 'PEACE', 'SIGNS'];

const LETTER_DESCRIPTIONS: Record<string, string> = {
  A: 'Fist with thumb resting alongside index finger',
  B: 'Flat hand with fingers together, thumb tucked across palm',
  C: 'Curved hand forming a C shape',
  D: 'Index finger pointing up, thumb touching middle finger tip',
  E: 'Curled fingers with thumb folded across lower fingertips',
  F: 'Index finger and thumb forming a circle, other three extended',
  G: 'Index finger and thumb extended horizontally pointing forward',
  H: 'Index and middle fingers extended horizontally together',
  I: 'Pinky finger extended upright, others folded into a fist',
  J: 'Pinky extended tracing a small J curve in the air',
  K: 'Index up, middle forward, thumb resting between them',
  L: 'Index and thumb extended forming an L shape',
  M: 'Three fingers folded over the thumb resting on palm',
  N: 'Two fingers folded over the thumb resting on palm',
  O: 'All fingers curved touching thumb forming an O shape',
  P: 'Like K pointing downward toward the ground',
  Q: 'Like G pointing downward toward the ground',
  R: 'Index and middle fingers crossed over each other',
  S: 'Fist with thumb wrapped across the front of fingers',
  T: 'Thumb tucked between index and middle fingers',
  U: 'Index and middle fingers extended upright together',
  V: 'Index and middle fingers extended in a V shape',
  W: 'Index, middle, and ring fingers extended upward in a W',
  X: 'Index finger bent into a small hook shape',
  Y: 'Thumb and pinky extended, middle three folded (hang loose)',
  Z: 'Index finger tracing a Z shape in the air',
};

const STORAGE_NAME_KEY = 'asl_student_name';
const STORAGE_STARRED_KEY = 'asl_study_tool_starred_cards';

export const Welcome: React.FC = () => {
  // Learner greeting state
  const [studentName, setStudentName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_NAME_KEY) || 'Learner';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(studentName);

  // Active word and active hovered letter
  const [selectedWord, setSelectedWord] = useState<string>('WELCOME');
  const [activeLetter, setActiveLetter] = useState<string>('W');
  const [hoveredSource, setHoveredSource] = useState<string>('word');
  const [isPlayingWord, setIsPlayingWord] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  // Sound toggle (synthesized Web Audio clicks)
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Starred card count for quick stats
  const [starredCount, setStarredCount] = useState<number>(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_STARRED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setStarredCount(parsed.length);
        }
      }
    } catch {
      setStarredCount(0);
    }
  }, []);

  // Play subtle tick on letter hover if sound enabled
  const playTick = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // Ignore audio synthesis errors on autoplay policy
    }
  }, [soundEnabled]);

  // Compute sprite position for 240px sprite sheet (8 cols, 7 rows)
  const spritePosition = useMemo(() => {
    const letter = activeLetter.toLowerCase();
    let index = 52; // Default resting / blank position

    if (letter >= 'a' && letter <= 'z') {
      index = letter.charCodeAt(0) - 97;
    }

    if (index < 0 || index > 54) index = 52;

    const col = index % 8;
    const row = Math.floor(index / 8);
    const x = (col * 100) / 7;
    const y = (row * 100) / 6;

    return `${x}% ${y}%`;
  }, [activeLetter]);

  // Handle letter hover
  const handleLetterHover = (letter: string, source: string) => {
    if (isPlayingWord) return;
    const upper = letter.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') {
      setActiveLetter(upper);
      setHoveredSource(source);
      playTick();
    }
  };

  // Auto-play word spell sequence
  useEffect(() => {
    if (!isPlayingWord) return;

    if (playbackIndex >= selectedWord.length) {
      setIsPlayingWord(false);
      setPlaybackIndex(0);
      return;
    }

    const currentLetter = selectedWord[playbackIndex];
    setActiveLetter(currentLetter.toUpperCase());
    playTick();

    const timer = setTimeout(() => {
      setPlaybackIndex(prev => prev + 1);
    }, 700);

    return () => clearTimeout(timer);
  }, [isPlayingWord, playbackIndex, selectedWord, playTick]);

  const handleStartPlayWord = () => {
    setPlaybackIndex(0);
    setIsPlayingWord(true);
  };

  const handleStopPlayWord = () => {
    setIsPlayingWord(false);
    setPlaybackIndex(0);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'Learner';
    setStudentName(trimmed);
    localStorage.setItem(STORAGE_NAME_KEY, trimmed);
    setIsEditingName(false);
  };

  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);

  return (
    <div className="welcome-container" data-testid="welcome-screen">
      {/* 1. Learner Greeting & Stats Banner */}
      <section className="welcome-hero-banner" aria-label="Welcome Overview">
        <div className="welcome-eyebrow">
          <span className="welcome-status-dot" aria-hidden="true" />
          AUTHENTICATED LEARNER HUB
        </div>

        <div className="welcome-greeting-row">
          <div className="welcome-greeting-text">
            <h1 className="welcome-title">
              Welcome back,{' '}
              {isEditingName ? (
                <span className="welcome-name-edit-box">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="welcome-name-input"
                    aria-label="Edit learner name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    className="welcome-name-save-btn"
                  >
                    Save
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="welcome-name-pill"
                  onClick={() => {
                    setNameInput(studentName);
                    setIsEditingName(true);
                  }}
                  title="Click to edit name"
                  aria-label={`Student name: ${studentName}. Click to edit.`}
                >
                  <span className="welcome-name-highlight">{studentName}</span>
                  <span className="welcome-edit-icon" aria-hidden="true">✎</span>
                </button>
              )}
            </h1>
            <p className="welcome-subtitle">
              Interactive ASL study dashboard. Hover over any letter to see its handshape transform in real time.
            </p>
          </div>

          {/* Micro Stats Cluster */}
          <div className="welcome-stats-cluster" aria-label="Study Progress Stats">
            <div className="welcome-stat-card">
              <span className="stat-card-icon" aria-hidden="true">🔥</span>
              <div className="stat-card-data">
                <span className="stat-card-number">5</span>
                <span className="stat-card-label">Day Streak</span>
              </div>
            </div>

            <Link to="/deck/all-starred" className="welcome-stat-card stat-link" aria-label={`${starredCount} starred signs to review`}>
              <span className="stat-card-icon star-gold" aria-hidden="true">⭐</span>
              <div className="stat-card-data">
                <span className="stat-card-number">{starredCount}</span>
                <span className="stat-card-label">Starred Cards</span>
              </div>
            </Link>

            <div className="welcome-stat-card">
              <span className="stat-card-icon" aria-hidden="true">🎯</span>
              <div className="stat-card-data">
                <span className="stat-card-number">10</span>
                <span className="stat-card-label">Decks Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Hand Sign Showcase */}
      <section className="welcome-showcase-card" aria-label="Interactive Hand Sign Visualizer">
        <div className="showcase-header">
          <div className="showcase-header-left">
            <span className="showcase-badge">Interactive Sign Demo</span>
            <h2 className="showcase-title">Hover-Reactive Hand Signs</h2>
          </div>

          <button
            type="button"
            className={`welcome-sound-toggle ${soundEnabled ? 'sound-on' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? 'Disable hover sound' : 'Enable hover sound'}
          >
            <span aria-hidden="true">{soundEnabled ? '🔊' : '🔈'}</span>
            <span>{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
          </button>
        </div>

        <div className="showcase-body-grid">
          {/* Left Column: Live Hand Sign Viewer */}
          <div className="showcase-hand-viewer-panel">
            <div className="showcase-hand-frame" data-testid="hand-sprite-frame">
              <div
                className="showcase-hand-sprite"
                style={{
                  backgroundImage: `url(${process.env.PUBLIC_URL}/images/fs-sprite-240.webp)`,
                  backgroundPosition: spritePosition,
                }}
                role="img"
                aria-label={`ASL hand sign for letter ${activeLetter}`}
              />
              <div className="hand-letter-badge" aria-hidden="true">
                {activeLetter}
              </div>
            </div>

            <div className="showcase-sign-meta">
              <div className="sign-meta-letter-row">
                <span className="sign-meta-letter">Letter {activeLetter}</span>
                <span className="sign-meta-source">From {hoveredSource}</span>
              </div>
              <p className="sign-meta-desc">
                {LETTER_DESCRIPTIONS[activeLetter] || 'ASL manual alphabet sign.'}
              </p>
            </div>
          </div>

          {/* Right Column: Wordboard and Scrubbers */}
          <div className="showcase-controls-panel">
            {/* Word Selection Tabs */}
            <div className="word-presets-cluster" role="group" aria-label="Sample Words to Spell">
              <span className="cluster-label">Choose Word:</span>
              <div className="preset-buttons-row">
                {PRESET_WORDS.map(word => (
                  <button
                    key={word}
                    type="button"
                    className={`preset-word-btn ${selectedWord === word ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedWord(word);
                      setActiveLetter(word[0]);
                      setIsPlayingWord(false);
                    }}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Word Hover Board */}
            <div className="word-hover-board" aria-label={`Interactive spelling tiles for ${selectedWord}`}>
              <div className="board-top-row">
                <span className="board-instruction">Hover over each letter tile to see it signed:</span>
                <button
                  type="button"
                  className={`btn-play-word ${isPlayingWord ? 'playing' : ''}`}
                  onClick={isPlayingWord ? handleStopPlayWord : handleStartPlayWord}
                  aria-label={isPlayingWord ? 'Stop spelling sequence' : 'Play spelling sequence'}
                >
                  <span aria-hidden="true">{isPlayingWord ? '⏸' : '▶'}</span>
                  <span>{isPlayingWord ? 'Stop' : 'Spell Word'}</span>
                </button>
              </div>

              <div className="word-tiles-row" data-testid="word-tiles-row">
                {selectedWord.split('').map((char, idx) => {
                  const isCurrentActive = activeLetter === char && (hoveredSource === 'word' || (isPlayingWord && playbackIndex === idx));
                  return (
                    <button
                      key={`${char}-${idx}`}
                      type="button"
                      className={`letter-tile ${isCurrentActive ? 'tile-active' : ''}`}
                      onMouseEnter={() => handleLetterHover(char, 'word')}
                      onFocus={() => handleLetterHover(char, 'word')}
                      aria-label={`Letter ${char}`}
                      data-testid={`letter-tile-${char}-${idx}`}
                    >
                      <span className="tile-char">{char}</span>
                      <span className="tile-index">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* A to Z Alphabet Glide Scrub Bar */}
            <div className="alphabet-scrub-section" aria-label="Alphabet Glide Scrub Bar">
              <div className="scrub-header">
                <span className="cluster-label">Alphabet Quick-Scrub (A to Z):</span>
                <span className="scrub-hint">Glide cursor to morph signs</span>
              </div>
              <div className="alphabet-ribbon-grid" data-testid="alphabet-ribbon">
                {alphabet.map(letter => (
                  <button
                    key={letter}
                    type="button"
                    className={`alphabet-chip ${activeLetter === letter ? 'chip-active' : ''}`}
                    onMouseEnter={() => handleLetterHover(letter, 'alphabet')}
                    onFocus={() => handleLetterHover(letter, 'alphabet')}
                    aria-label={`Letter ${letter}`}
                    data-testid={`alphabet-chip-${letter}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Study Surfaces Hub (Quick Launchers) */}
      <section className="welcome-launchers-section" aria-label="Study Surface Hub">
        <div className="launchers-section-header">
          <h2 className="launchers-title">Jump Into Study Mode</h2>
          <p className="launchers-subtitle">Select a study module to start learning vocabulary and drills.</p>
        </div>

        <div className="launchers-grid">
          {/* Card 1: Deck Flashcards */}
          <div className="launcher-card">
            <div className="launcher-card-icon-box indigo">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="M7 8h10M7 12h6M7 16h8" />
              </svg>
            </div>
            <h3 className="launcher-card-title">Vocabulary Decks</h3>
            <p className="launcher-card-desc">
              Explore 10 curated sign language decks with HD video examples, 3D flip flashcards, and infinite scroll.
            </p>
            <Link to="/home" className="launcher-action-btn primary" aria-label="Open Vocabulary Decks">
              <span>Browse Decks</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Card 2: Fingerspelling Practice */}
          <div className="launcher-card">
            <div className="launcher-card-icon-box emerald">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
              </svg>
            </div>
            <h3 className="launcher-card-title">Fingerspelling Drill</h3>
            <p className="launcher-card-desc">
              High-speed asl.ms style letter drill with 5,400+ words, adjustable tempo sliders, and sound feedback.
            </p>
            <Link to="/fingerspelling" className="launcher-action-btn" aria-label="Open Fingerspelling Drill">
              <span>Launch Drill</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Card 3: Starred Signs */}
          <div className="launcher-card">
            <div className="launcher-card-icon-box amber">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <h3 className="launcher-card-title">Starred Flashcards</h3>
            <p className="launcher-card-desc">
              Focus specifically on signs you have marked for extra review with targeted flashcard sessions.
            </p>
            <Link to="/deck/all-starred" className="launcher-action-btn" aria-label="Review Starred Cards">
              <span>Study Starred ({starredCount})</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Card 4: Quiz & Test Mode */}
          <div className="launcher-card">
            <div className="launcher-card-icon-box rose">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h3 className="launcher-card-title">Test Mode</h3>
            <p className="launcher-card-desc">
              Challenge yourself with randomized sign video questions and slash-variant answer validation.
            </p>
            <Link to="/test/all-decks" className="launcher-action-btn" aria-label="Start Test Mode">
              <span>Start All-Deck Test</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Cultural ASL Tip Callout */}
      <section className="welcome-tip-callout" aria-label="ASL Sign Tip of the Day">
        <div className="tip-icon-box" aria-hidden="true">💡</div>
        <div className="tip-content">
          <span className="tip-tag">ASL Culture & Grammar Tip</span>
          <h4 className="tip-heading">Facial Expressions Are Essential Grammar</h4>
          <p className="tip-text">
            In American Sign Language, non-manual markers like eyebrow position and mouth morphemes are grammatical components, not just emotion. Furrow your eyebrows for WH-questions (who, what, where) and raise them for Yes/No questions!
          </p>
        </div>
      </section>
    </div>
  );
};

export default Welcome;
