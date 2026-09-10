import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRandomFingerspellingWord, ASL_WORDS } from '../data/fingerspellingWords';
import './FingerspellingPractice.css';

type SpeedPreset = 'slow' | 'medium' | 'fast' | 'deaf' | 'custom';

const SPEED_MAP: Record<'slow' | 'medium' | 'fast' | 'deaf', number> = {
  slow: 1000,
  medium: 666,
  fast: 333,
  deaf: 200,
};

const STORAGE_NAME_KEY = 'asl_ms_student_name';
const STORAGE_SOUND_KEY = 'asl_ms_sound_enabled';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export const FingerspellingPractice: React.FC = () => {
  const navigate = useNavigate();

  // Settings & Configuration
  const [speed, setSpeed] = useState<number>(SPEED_MAP.medium);
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>('medium');
  const [lengthLimit, setLengthLimit] = useState<number>(99); // 99 means any length
  const [practiceMode, setPracticeMode] = useState<'lifeprint' | 'custom'>('lifeprint');
  const [customWordsText, setCustomWordsText] = useState<string>('');

  // Practice State
  const [currentWord, setCurrentWord] = useState<string>('');
  const [currentFrameKey, setCurrentFrameKey] = useState<string>('blank');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Input & Scoring
  const [userGuess, setUserGuess] = useState<string>('');
  const [isWordChecked, setIsWordChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);

  // Session Statistics
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [usedWords, setUsedWords] = useState<string[]>([]);

  // Student Homework Info
  const [studentName, setStudentName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_NAME_KEY) || '';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_SOUND_KEY);
    return saved === null ? true : saved === 'true';
  });
  const [showAlphabet, setShowAlphabet] = useState<boolean>(false);

  // References
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Parse custom words list
  const customWordsList = useMemo(() => {
    if (!customWordsText.trim()) return [];
    return customWordsText
      .split(/[,\n]/)
      .map((w) => w.trim().toLowerCase().replace(/[^a-z]/g, ''))
      .filter((w) => w.length > 0);
  }, [customWordsText]);

  // Generate frame sequence for a given word
  const getWordFrames = useCallback((word: string): string[] => {
    const frames: string[] = [];
    const cleanWord = word.toLowerCase();
    for (let i = 0; i < cleanWord.length; i++) {
      const char = cleanWord[i];
      if (char >= 'a' && char <= 'z') {
        if (i > 0 && cleanWord[i] === cleanWord[i - 1]) {
          // Double letter handshape
          frames.push(char + char);
        } else {
          frames.push(char);
        }
      } else {
        frames.push('blank');
      }
    }
    return frames;
  }, []);

  const activeFrames = useMemo(() => getWordFrames(currentWord), [currentWord, getWordFrames]);

  // Audio effects using Web Audio API
  const playSound = useCallback((type: 'correct' | 'incorrect') => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.linearRampToValueAtTime(164.81, now + 0.18); // E3
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, [soundEnabled]);

  // Clear animation interval
  const stopAnimation = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Frame display animation step
  const startPlaybackFromIndex = useCallback((startIndex: number, framesToPlay: string[]) => {
    if (framesToPlay.length === 0) return;
    stopAnimation();
    setIsPlaying(true);
    setIsPaused(false);

    let idx = startIndex;

    const playNextFrame = () => {
      if (idx >= framesToPlay.length) {
        // Finished word, display blank
        setCurrentFrameKey('blank');
        setCurrentStepIndex(framesToPlay.length);
        setIsPlaying(false);
        return;
      }

      setCurrentFrameKey(framesToPlay[idx]);
      setCurrentStepIndex(idx);
      idx++;

      timerRef.current = setTimeout(playNextFrame, speed);
    };

    playNextFrame();
  }, [speed, stopAnimation]);

  // Replay current word
  const replayCurrentWord = useCallback(() => {
    if (!currentWord) return;
    setIsWordChecked(false);
    setIsCorrect(null);
    setIsRevealed(false);
    setUserGuess('');
    startPlaybackFromIndex(0, activeFrames);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentWord, activeFrames, startPlaybackFromIndex]);

  // Generate new word and start playback
  const pickNewWord = useCallback(() => {
    let nextWord = '';
    if (practiceMode === 'custom' && customWordsList.length > 0) {
      const remaining = customWordsList.filter((w) => !usedWords.includes(w));
      const pool = remaining.length > 0 ? remaining : customWordsList;
      nextWord = pool[Math.floor(Math.random() * pool.length)];
    } else {
      nextWord = getRandomFingerspellingWord(lengthLimit, usedWords);
    }

    if (!nextWord) nextWord = 'asl';

    setCurrentWord(nextWord);
    setIsWordChecked(false);
    setIsCorrect(null);
    setIsRevealed(false);
    setUserGuess('');

    const newFrames = getWordFrames(nextWord);
    startPlaybackFromIndex(0, newFrames);

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [practiceMode, customWordsList, lengthLimit, usedWords, getWordFrames, startPlaybackFromIndex]);

  // Handle speed changes
  const handleSetSpeedPreset = (preset: 'slow' | 'medium' | 'fast' | 'deaf') => {
    const newSpeed = SPEED_MAP[preset];
    setSpeed(newSpeed);
    setSpeedPreset(preset);
  };

  const handleFineTuneSpeed = (factor: number) => {
    setSpeed((prev) => {
      const updated = Math.max(100, Math.min(2000, Math.round(prev * factor)));
      setSpeedPreset('custom');
      return updated;
    });
  };

  // Pause / Resume
  const togglePause = () => {
    if (isPlaying) {
      stopAnimation();
      setIsPaused(true);
    } else if (isPaused) {
      const nextIndex = currentStepIndex >= activeFrames.length ? 0 : currentStepIndex;
      startPlaybackFromIndex(nextIndex, activeFrames);
    } else {
      replayCurrentWord();
    }
  };

  // Frame step controls
  const handleStep = (direction: 'prev' | 'next') => {
    stopAnimation();
    setIsPaused(true);
    if (activeFrames.length === 0) return;

    let targetIndex = currentStepIndex;
    if (direction === 'prev') {
      targetIndex = Math.max(0, currentStepIndex - 1);
    } else {
      targetIndex = Math.min(activeFrames.length - 1, currentStepIndex + 1);
    }

    setCurrentStepIndex(targetIndex);
    setCurrentFrameKey(activeFrames[targetIndex]);
  };

  // Check the submitted answer
  const handleCheckWord = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentWord) return;

    const trimmedGuess = userGuess.trim().toLowerCase();

    // If user already got it correct and presses enter again: next word!
    if (isWordChecked && isCorrect) {
      pickNewWord();
      return;
    }

    // If user already checked, was wrong, and presses enter again: replay word!
    if (isWordChecked && !isCorrect) {
      replayCurrentWord();
      return;
    }

    stopAnimation();
    setIsWordChecked(true);
    setAttempts((prev) => prev + 1);

    if (trimmedGuess === currentWord) {
      setIsCorrect(true);
      setCurrentFrameKey('blank');
      playSound('correct');

      if (!usedWords.includes(currentWord)) {
        setScore((prev) => prev + 1);
        setUsedWords((prev) => [...prev, currentWord]);
      }

      setStreak((prev) => {
        const next = prev + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setIsCorrect(false);
      setCurrentFrameKey('blank');
      playSound('incorrect');
      setStreak(0);
    }

    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  // Reveal answer
  const handleRevealAnswer = () => {
    setIsRevealed(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Preview an alphabet letter
  const handleAlphabetPreview = (letter: string) => {
    stopAnimation();
    setIsPaused(true);
    setCurrentFrameKey(letter);
  };

  // Save student name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStudentName(val);
    localStorage.setItem(STORAGE_NAME_KEY, val);
  };

  // Toggle audio
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(STORAGE_SOUND_KEY, String(next));
  };

  // Initialize first word on mount
  useEffect(() => {
    pickNewWord();
    return () => {
      stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute CSS background position for sprite
  const spritePosition = useMemo(() => {
    const k = currentFrameKey.toLowerCase();
    let index = 52; // blank by default

    if (k === 'blank') {
      index = 52;
    } else if (k.length === 2 && k[0] === k[1]) {
      // Double letter (aa -> 26, bb -> 27, etc.)
      index = 26 + (k.charCodeAt(0) - 97);
    } else if (k.length >= 1) {
      // Single letter (a -> 0, b -> 1, etc.)
      index = k.charCodeAt(0) - 97;
    }

    if (index < 0 || index > 54) index = 52;

    const col = index % 8;
    const row = Math.floor(index / 8);
    const x = (col * 100) / 7;
    const y = (row * 100) / 6;

    return `${x}% ${y}%`;
  }, [currentFrameKey]);

  // Formatted date string for student verification
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Accuracy calculation
  const accuracyPercent = useMemo(() => {
    if (attempts === 0) return 100;
    return Math.round((score / attempts) * 100);
  }, [score, attempts]);

  return (
    <div className="fs-container">
      {/* Navigation & Header Bar */}
      <nav className="fs-nav">
        <button className="fs-back-button" onClick={() => navigate('/')} title="Return to ASL Study Tool Home">
          <span>&larr;</span> Back to Decks
        </button>

        <span className="fs-brand-tag">asl.ms Practice</span>

        <button
          className="fs-sound-toggle"
          onClick={handleToggleSound}
          title={soundEnabled ? 'Mute audio' : 'Enable audio'}
        >
          {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
        </button>
      </nav>

      {/* Main Header */}
      <header className="fs-header">
        <h1 className="fs-title">
          <span>🤟</span> ASL Fingerspelling Practice
        </h1>
        <p className="fs-subtitle">
          Interactive receptive fingerspelling speed trainer based on{' '}
          <a href="https://asl.ms/" target="_blank" rel="noopener noreferrer">
            asl.ms
          </a>{' '}
          by Dr. Bill Vicars (
          <a href="https://www.lifeprint.com" target="_blank" rel="noopener noreferrer">
            Lifeprint.com
          </a>
          ).
        </p>
      </header>

      {/* Student Verification / Homework Bar */}
      <section className="fs-student-bar" style={{ width: '100%', maxWidth: '900px', marginBottom: '20px' }}>
        <div className="fs-student-name-field">
          <label htmlFor="fs-student-name">Your Name:</label>
          <input
            id="fs-student-name"
            type="text"
            className="fs-student-name-input"
            placeholder="Type your name (for homework screenshot)..."
            value={studentName}
            onChange={handleNameChange}
          />
        </div>

        <div className="fs-student-stats">
          <div className="fs-stat-badge">
            <span className="fs-stat-label">Score</span>
            <span className="fs-stat-value">{score}</span>
          </div>
          <div className="fs-stat-badge">
            <span className="fs-stat-label">Streak</span>
            <span className="fs-stat-value">{streak}</span>
          </div>
          <div className="fs-stat-badge">
            <span className="fs-stat-label">Best Streak</span>
            <span className="fs-stat-value">{bestStreak}</span>
          </div>
          <div className="fs-stat-badge">
            <span className="fs-stat-label">Speed</span>
            <span className="fs-stat-value">{speed}ms</span>
          </div>
          <div className="fs-stat-badge">
            <span className="fs-stat-label">Accuracy</span>
            <span className="fs-stat-value">{accuracyPercent}%</span>
          </div>
        </div>

        <div className="fs-date-display">Today is {todayFormatted}</div>
      </section>

      {/* Main Practice Layout */}
      <main className="fs-main-layout">
        {/* Left Column: Hand Sign Viewer Stage */}
        <div className="fs-stage-card">
          <div
            className={`fs-sprite-wrapper ${
              isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : ''
            }`}
          >
            <div
              className="fs-sprite-box"
              style={{
                backgroundImage: `url(${process.env.PUBLIC_URL}/images/fs-sprite-240.webp)`,
                backgroundPosition: spritePosition,
              }}
              role="img"
              aria-label={`ASL Fingerspelling frame: ${currentFrameKey}`}
            />

            {/* Standard Theme-Consistent Result Overlays */}
            {isCorrect === true && (
              <div className="fs-result-overlay correct" role="status" aria-label="Correct answer">
                <div className="fs-result-icon-circle correct">
                  <svg
                    viewBox="0 0 24 24"
                    width="44"
                    height="44"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="fs-result-title correct">Correct!</div>
                <div className="fs-result-sub">Press Enter for next word</div>
              </div>
            )}

            {isCorrect === false && (
              <div className="fs-result-overlay incorrect" role="status" aria-label="Incorrect answer">
                <div className="fs-result-icon-circle incorrect">
                  <svg
                    viewBox="0 0 24 24"
                    width="44"
                    height="44"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <div className="fs-result-title incorrect">Incorrect</div>
                <div className="fs-result-sub">Press Enter to replay word</div>
              </div>
            )}

            {/* Status overlay badge */}
            {isPlaying && <div className="fs-viewer-badge playing">Playing...</div>}
            {isPaused && <div className="fs-viewer-badge">Paused</div>}
          </div>

          <div className="fs-letter-counter">
            {isPlaying || isPaused
              ? `Letter ${Math.min(currentStepIndex + 1, activeFrames.length)} of ${activeFrames.length}`
              : isCorrect
              ? 'Great recognition!'
              : isRevealed
              ? `Answer: ${currentWord}`
              : `${currentWord.length} letters`}
          </div>

          {/* Core Action Buttons */}
          <div className="fs-playback-controls">
            <button className="fs-btn fs-btn-primary" onClick={pickNewWord} title="Get a new word [Accesskey: N]">
              ✨ New Word
            </button>
            <button className="fs-btn fs-btn-secondary" onClick={replayCurrentWord} title="Replay current word [Accesskey: R]">
              🔄 Replay
            </button>
          </div>

          {/* Step Controls */}
          <div className="fs-step-controls">
            <button
              className="fs-step-btn"
              onClick={() => handleStep('prev')}
              disabled={currentStepIndex <= 0}
              title="Step backward"
            >
              ⏮ Step Back
            </button>
            <button className="fs-step-btn" onClick={togglePause} title="Pause or Resume animation">
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              className="fs-step-btn"
              onClick={() => handleStep('next')}
              disabled={currentStepIndex >= activeFrames.length - 1}
              title="Step forward"
            >
              ⏭ Step Next
            </button>
          </div>
        </div>

        {/* Right Column: Interaction, Input & Settings */}
        <div className="fs-interactive-panel">
          {/* Answer Input Card */}
          <div className="fs-input-card">
            <form onSubmit={handleCheckWord} className="fs-input-form">
              <div className="fs-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  className={`fs-text-input ${
                    isCorrect === true ? 'success' : isCorrect === false ? 'fail' : ''
                  }`}
                  placeholder="Type your answer here..."
                  value={userGuess}
                  onChange={(e) => setUserGuess(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  autoFocus
                />
                <button type="submit" className="fs-check-btn">
                  {isWordChecked && isCorrect ? 'Next →' : isWordChecked && !isCorrect ? 'Retry ↺' : 'Check'}
                </button>
              </div>

              <div className="fs-feedback-row">
                {isCorrect === true && (
                  <span className="fs-feedback-message success">
                    🎉 Excellent! Press Enter for next word.
                  </span>
                )}
                {isCorrect === false && (
                  <span className="fs-feedback-message error">
                    ❌ Incorrect. Press Enter to replay and try again.
                  </span>
                )}
                {!isWordChecked && !isRevealed && (
                  <span style={{ color: '#79869c' }}>Tip: Press Enter to submit answer.</span>
                )}

                {isRevealed ? (
                  <span className="fs-revealed-text">
                    Word was: <strong>{currentWord.toUpperCase()}</strong>
                  </span>
                ) : (
                  <button type="button" className="fs-reveal-btn" onClick={handleRevealAnswer}>
                    Reveal answer?
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Settings & Configuration Card */}
          <div className="fs-settings-card">
            {/* Speed Selection */}
            <div className="fs-control-group">
              <div className="fs-control-header">
                <span className="fs-control-label">Speed</span>
                <span className="fs-control-value">{speed} ms / letter</span>
              </div>
              <div className="fs-pill-group">
                <button
                  type="button"
                  className={`fs-pill-btn ${speedPreset === 'slow' ? 'active' : ''}`}
                  onClick={() => handleSetSpeedPreset('slow')}
                >
                  Slow (1.0s)
                </button>
                <button
                  type="button"
                  className={`fs-pill-btn ${speedPreset === 'medium' ? 'active' : ''}`}
                  onClick={() => handleSetSpeedPreset('medium')}
                >
                  Medium (0.67s)
                </button>
                <button
                  type="button"
                  className={`fs-pill-btn ${speedPreset === 'fast' ? 'active' : ''}`}
                  onClick={() => handleSetSpeedPreset('fast')}
                >
                  Fast (0.33s)
                </button>
                <button
                  type="button"
                  className={`fs-pill-btn ${speedPreset === 'deaf' ? 'active' : ''}`}
                  onClick={() => handleSetSpeedPreset('deaf')}
                >
                  Deaf / Native (0.2s)
                </button>
              </div>

              <div className="fs-speed-fine-tune">
                <button
                  type="button"
                  className="fs-fine-btn"
                  onClick={() => handleFineTuneSpeed(1.25)}
                  title="Make playback slower"
                >
                  🐢 Slower
                </button>
                <input
                  type="range"
                  className="fs-speed-slider"
                  min="100"
                  max="1500"
                  step="25"
                  value={speed}
                  onChange={(e) => {
                    setSpeed(Number(e.target.value));
                    setSpeedPreset('custom');
                  }}
                />
                <button
                  type="button"
                  className="fs-fine-btn"
                  onClick={() => handleFineTuneSpeed(0.8)}
                  title="Make playback faster"
                >
                  ⚡ Faster
                </button>
              </div>
            </div>

            {/* Word Length Filter */}
            <div className="fs-control-group">
              <div className="fs-control-header">
                <span className="fs-control-label">Maximum Letters</span>
                <span className="fs-control-value">
                  {lengthLimit >= 99 ? 'Any length' : `${lengthLimit} letters or fewer`}
                </span>
              </div>
              <div className="fs-pill-group">
                {[3, 4, 5, 6].map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`fs-pill-btn ${lengthLimit === len ? 'active' : ''}`}
                    onClick={() => {
                      setLengthLimit(len);
                      setTimeout(pickNewWord, 50);
                    }}
                  >
                    {len}
                  </button>
                ))}
                <button
                  type="button"
                  className={`fs-pill-btn ${lengthLimit >= 99 ? 'active' : ''}`}
                  onClick={() => {
                    setLengthLimit(99);
                    setTimeout(pickNewWord, 50);
                  }}
                >
                  Any Length
                </button>
              </div>
            </div>

            {/* Practice Mode Selector */}
            <div className="fs-control-group">
              <div className="fs-control-header">
                <span className="fs-control-label">Word Source</span>
                <span className="fs-control-value">
                  {practiceMode === 'lifeprint'
                    ? `${ASL_WORDS.length.toLocaleString()} Lifeprint words`
                    : `${customWordsList.length} custom words`}
                </span>
              </div>
              <div className="fs-pill-group">
                <button
                  type="button"
                  className={`fs-pill-btn ${practiceMode === 'lifeprint' ? 'active' : ''}`}
                  onClick={() => setPracticeMode('lifeprint')}
                >
                  Lifeprint Word Bank
                </button>
                <button
                  type="button"
                  className={`fs-pill-btn ${practiceMode === 'custom' ? 'active' : ''}`}
                  onClick={() => setPracticeMode('custom')}
                >
                  Custom Words
                </button>
              </div>

              {practiceMode === 'custom' && (
                <div className="fs-custom-mode-box">
                  <span style={{ fontSize: '13px', color: '#9aa5b8' }}>
                    Enter words separated by commas or lines (e.g. your class vocabulary):
                  </span>
                  <textarea
                    className="fs-custom-textarea"
                    placeholder="cat, dog, student, teacher, library, book"
                    value={customWordsText}
                    onChange={(e) => setCustomWordsText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="fs-btn fs-btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                    onClick={pickNewWord}
                    disabled={customWordsList.length === 0}
                  >
                    Load & Practice Custom List
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ASL Alphabet Reference Drawer */}
      <section className="fs-alphabet-card">
        <button
          type="button"
          className="fs-accordion-toggle"
          onClick={() => setShowAlphabet((prev) => !prev)}
        >
          <span>📖 ASL Alphabet Reference (Click letter to preview handshape)</span>
          <span>{showAlphabet ? '▲ Collapse' : '▼ Expand'}</span>
        </button>

        {showAlphabet && (
          <div className="fs-alphabet-grid">
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                type="button"
                className="fs-letter-tile"
                onClick={() => handleAlphabetPreview(letter)}
                title={`Click to preview ASL sign for '${letter.toUpperCase()}'`}
              >
                {letter.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Keyboard Shortcuts Hint */}
      <div className="fs-keyboard-hints">
        <span>
          <span className="fs-kbd">Enter</span> Check / Next / Replay
        </span>
        <span>
          <span className="fs-kbd">N</span> New Word
        </span>
        <span>
          <span className="fs-kbd">R</span> Replay
        </span>
      </div>

      {/* Lifeprint & Dr. Bill Vicars Attribution */}
      <footer className="fs-credits">
        Special thanks to <strong>Dr. William Vicars</strong> and{' '}
        <a href="https://www.lifeprint.com" target="_blank" rel="noopener noreferrer">
          Lifeprint.com
        </a>{' '}
        for the original ASL fingerspelling tool (
        <a href="https://asl.ms" target="_blank" rel="noopener noreferrer">
          asl.ms
        </a>
        ) and sprite assets that have helped countless ASL students learn fingerspelling for decades.
      </footer>
    </div>
  );
};

export default FingerspellingPractice;
