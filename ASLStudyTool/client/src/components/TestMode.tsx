import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactPlayer from 'react-player';
import './TestMode.css';
import { LOCAL_STORAGE_STARRED_KEY } from './constants';
import { Card } from '../types/Card';

interface TestModeProps {
  deckId: string;
}

const shuffleArray = <T extends unknown>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const TestMode: React.FC<TestModeProps> = ({ deckId }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [results, setResults] = useState<{ correct: Card[], incorrect: Card[], userAnswers: string[] }>({
    correct: [],
    incorrect: [],
    userAnswers: []
  });
  const [videoSource, setVideoSource] = useState<string>('');
  const [starredCardIds, setStarredCardIds] = useState<string[]>([]);
  const [testMode, setTestMode] = useState<'all' | 'starred'>('all');
  const [loadingStarred, setLoadingStarred] = useState(true);
  const [viewOnly, setViewOnly] = useState(false);
  const [noCardsFeedback, setNoCardsFeedback] = useState<string | null>(null);
  const [showCancelButton, setShowCancelButton] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Timer to show cancel button after 5 seconds of loading
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (loading || loadingStarred) {
      // Start timer to show cancel button after 5 seconds
      timeoutId = setTimeout(() => {
        setShowCancelButton(true);
        console.log('Loading taking too long, showing cancel button');
      }, 5000);
    } else {
      setShowCancelButton(false);
    }
    
    return () => {
      // Clear timeout when component unmounts or loading state changes
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, loadingStarred]);

  // Fetch starred cards - simplified to prioritize local data
  useEffect(() => {
    const fetchStarredCards = async () => {
      try {
        console.log("TestMode: Fetching starred cards...");
        
        // NEW: Check session storage first (fastest option)
        const sessionStarred = sessionStorage.getItem('starred_card_ids');
        if (sessionStarred) {
          try {
            const parsedSessionStarred = JSON.parse(sessionStarred);
            console.log('TestMode: Using starred cards from session storage:', parsedSessionStarred);
            setStarredCardIds(parsedSessionStarred);
            
            // Set test mode if needed
            if (location.state && (location.state as any).starredOnly) {
              console.log("TestMode: Setting test mode to starred from navigation state");
              setTestMode('starred');
            }
            
            if (location.state && (location.state as any).viewOnly) {
              setViewOnly(true);
            }
            
            // Exit early with session storage data
            setLoadingStarred(false);
            return;
          } catch (err) {
            console.error('TestMode: Error parsing session storage starred cards:', err);
          }
        }
        
        // Then check location state
        if (location.state && (location.state as any).starredCardIds) {
          const passedStarredIds = (location.state as any).starredCardIds;
          console.log('TestMode: Using starred cards passed from navigation:', passedStarredIds);
          setStarredCardIds(passedStarredIds);
          
          // Set test mode if starredOnly flag is set
          if ((location.state as any).starredOnly) {
            console.log("TestMode: Setting test mode to starred from navigation state");
            setTestMode('starred');
          }
          
          if ((location.state as any).viewOnly) {
            console.log("TestMode: Setting view-only mode from navigation state");
            setViewOnly(true);
          }
        } 
        // Finally check localStorage
        else {
          const localStarred = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
          if (localStarred) {
            try {
              const parsedStarred = JSON.parse(localStarred);
              console.log('TestMode: Using localStorage starred cards:', parsedStarred);
              setStarredCardIds(parsedStarred);
              
              // Check if we should only test starred cards
              if (location.state) {
                const state = location.state as any;
                if (state.starredOnly) {
                  console.log("TestMode: Setting test mode to starred");
                  setTestMode('starred');
                }
                if (state.viewOnly) {
                  console.log("TestMode: Setting view-only mode");
                  setViewOnly(true);
                }
              }
            } catch (parseErr) {
              console.error('TestMode: Error parsing starred cards from localStorage:', parseErr);
              setStarredCardIds([]);
            }
          } else {
            console.log('TestMode: No starred cards found in local storage');
            setStarredCardIds([]);
          }
        }
      } catch (err) {
        console.error("TestMode: Error in starred card fetching logic:", err);
        setStarredCardIds([]);
      } finally {
        // Always set loading to false
        setLoadingStarred(false);
      }
    };

    // Add a failsafe timeout of 3 seconds
    const timeoutId = setTimeout(() => {
      if (loadingStarred) {
        console.log("TestMode: Starred cards loading timed out, forcing completion");
        setLoadingStarred(false);
      }
    }, 3000);

    fetchStarredCards();
    
    return () => clearTimeout(timeoutId);
  }, [location.state]);

  useEffect(() => {
    // Don't fetch if we don't have a deckId, starred card status is unclear, or already fetching
    if (!deckId || loadingStarred || loading) {
      return;
    }

    const fetchCards = async () => {
      setLoading(true);
      setError(null);
      
      // Add a timeout to prevent infinite loading
      const fetchTimeoutId = setTimeout(() => {
        console.error('Card fetching timed out after 8 seconds');
        setError('Loading timed out. Please try again.');
        setLoading(false);
      }, 8000);
      
      try {
        console.log(`TestMode: Fetching cards for deck ${deckId}, mode: ${testMode}`);
        
        // NEW: First try to get cards from session storage
        let data = [];
        const sessionCards = sessionStorage.getItem('current_deck_cards');
        
        if (sessionCards) {
          try {
            console.log('TestMode: Using cards from session storage');
            data = JSON.parse(sessionCards);
            console.log(`TestMode: Found ${data.length} cards in session storage`);
          } catch (err) {
            console.error('TestMode: Error parsing session storage cards:', err);
            // Continue to fetch from API
          }
        }
        
        // If no session data, try API
        if (!data || data.length === 0) {
          console.log('TestMode: No session data, falling back to API fetch');
          
          // SIMPLIFIED: Just use direct fetch call to the working endpoint
          const fallbackUrl = `/api/cards/${deckId}`;
          console.log(`TestMode: Fetching from: ${fallbackUrl}`);
          const fetchResponse = await fetch(fallbackUrl);
          
          if (!fetchResponse.ok) {
            throw new Error(`Failed to fetch cards (${fetchResponse.status})`);
          }
          
          data = await fetchResponse.json();
        }
        
        console.log(`TestMode: Total cards in deck: ${data.length}`);
        console.log(`TestMode: Current mode: ${testMode}`);
        console.log(`TestMode: Starred card IDs: ${JSON.stringify(starredCardIds)}`);

        // Filter cards based on the testMode
        let filteredCards = [...data];

        if (testMode === 'starred') {
          if (!starredCardIds || starredCardIds.length === 0) {
            console.log('TestMode: No starred cards found, showing empty set');
            setNoCardsFeedback('No starred cards found. Please star some cards and try again.');
            filteredCards = [];
          } else {
            console.log(`TestMode: Filtering for ${starredCardIds.length} starred cards`);
            filteredCards = data.filter((card: Card) => starredCardIds.includes(card.id));
            console.log(`TestMode: Found ${filteredCards.length} starred cards in deck`);
            
            if (filteredCards.length === 0) {
              setNoCardsFeedback('No starred cards found in this deck. Please star some cards and try again.');
            }
          }
        }

        // Shuffle the cards
        const shuffledCards = shuffleArray(filteredCards);
        console.log(`TestMode: Final count of cards for testing: ${shuffledCards.length}`);
        
        setCards(shuffledCards);
        clearTimeout(fetchTimeoutId); // Clear the timeout since we got a response
        setLoading(false);

      } catch (error: any) {
        console.error('TestMode: Error fetching cards:', error);
        setError(error.message || 'Failed to load cards. Please try again.');
        setLoading(false);
        clearTimeout(fetchTimeoutId); // Clear the timeout since we got an error response
      }
    };

    fetchCards();
  }, [deckId, testMode, starredCardIds, loadingStarred]);

  useEffect(() => {
    if (cards.length > 0 && currentCardIndex < cards.length) {
      const currentCard = cards[currentCardIndex];
      // Transform Google Drive URL if needed (similar to Flashcard component)
      if (currentCard.video_url.includes('drive.google.com')) {
        const transformedUrl = transformGoogleDriveUrl(currentCard.video_url);
        setVideoSource(transformedUrl);
      } else {
        setVideoSource(currentCard.video_url);
      }
    }
  }, [cards, currentCardIndex]);

  // Add keyboard event listener for Enter key to navigate to next card
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && submitted && !testComplete) {
        handleNextCard();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [submitted, testComplete, currentCardIndex, cards.length]);

  const transformGoogleDriveUrl = (url: string): string => {
    // Check if it's a Google Drive URL
    if (url.includes('drive.google.com')) {
      // Extract file ID from URL
      let fileId = '';
      
      // Handle different Google Drive URL formats
      if (url.includes('drive.google.com/file/d/')) {
        // Format: https://drive.google.com/file/d/{fileId}/view
        const match = url.match(/\/file\/d\/([^\/]+)/);
        if (match && match[1]) {
          fileId = match[1];
        }
      } else if (url.includes('drive.google.com/open?id=')) {
        // Format: https://drive.google.com/open?id={fileId}
        const match = url.match(/open\?id=([^&]+)/);
        if (match && match[1]) {
          fileId = match[1];
        }
      } else if (url.includes('id=')) {
        // Format: https://drive.google.com/uc?id={fileId}
        const match = url.match(/id=([^&]+)/);
        if (match && match[1]) {
          fileId = match[1];
        }
      }
      
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    
    return url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!submitted && cards.length > 0) {
      const currentCard = cards[currentCardIndex];
      const isCorrect = userAnswer.trim().toLowerCase() === currentCard.answer.trim().toLowerCase();
      
      // Update results
      if (isCorrect) {
        setResults(prevResults => ({
          ...prevResults,
          correct: [...prevResults.correct, currentCard],
          userAnswers: [...prevResults.userAnswers, userAnswer]
        }));
      } else {
        setResults(prevResults => ({
          ...prevResults,
          incorrect: [...prevResults.incorrect, currentCard],
          userAnswers: [...prevResults.userAnswers, userAnswer]
        }));
        
        // Auto-star incorrect answers
        if (!starredCardIds.includes(currentCard.id)) {
          try {
            // In a real app, you'd get the actual user ID from auth
            const demoUserId = "demo-user-id"; // Hardcoded for demo
            
            // Update local state first
            const newStarredIds = [...starredCardIds, currentCard.id];
            setStarredCardIds(newStarredIds);
            
            // Save to localStorage
            localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(newStarredIds));
            
            // Try to star on server (but don't fail if it doesn't work)
            await axios.post(`${process.env.REACT_APP_API_URL}/api/cards/${currentCard.id}/star`, { 
              userId: demoUserId 
            });
          } catch (err) {
            console.error("Error starring incorrect card on server:", err);
            // Already updated localStorage, so we don't need to do anything else
          }
        }
      }
      
      setSubmitted(true);
    }
  };

  const handleNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setUserAnswer('');
      setSubmitted(false);
    } else {
      setTestComplete(true);
    }
  };

  const handleBackToDeck = () => {
    // If we're testing all decks, go back to home
    if (deckId === 'all-decks') {
      navigate('/');
    } else {
      // Otherwise go back to the specific deck
      navigate(`/deck/${deckId}`);
    }
  };

  const handleStartOver = () => {
    setCurrentCardIndex(0);
    setUserAnswer('');
    setSubmitted(false);
    setTestComplete(false);
    setResults({
      correct: [],
      incorrect: [],
      userAnswers: []
    });
  };

  const handleCancel = () => {
    console.log('User canceled loading, returning to deck');
    handleBackToDeck();
  };

  if (loading) {
    return (
      <div className="test-container loading">
        <div className="loading-spinner"></div>
        <p>Loading test...</p>
        {showCancelButton && (
          <button 
            onClick={handleCancel} 
            className="cancel-btn"
            style={{
              marginTop: '20px',
              padding: '8px 16px',
              background: '#999999',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-container error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={handleBackToDeck} className="back-to-deck-btn">
          Back to Deck
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="test-container error">
        <h2>No Cards Available</h2>
        {testMode === 'starred' ? (
          <>
            <p>{noCardsFeedback || 'You don\'t have any starred cards in this deck yet. Star some cards first or try the full test.'}</p>
            {/* Debug information */}
            <div style={{ 
              background: '#333', 
              padding: '10px', 
              borderRadius: '5px', 
              margin: '20px 0', 
              fontSize: '12px',
              textAlign: 'left'
            }}>
              <p>Debug Info:</p>
              <p>Starred Card IDs: {starredCardIds.length > 0 ? starredCardIds.join(', ') : 'None'}</p>
              <p>Deck ID: {deckId}</p>
              <p>Test Mode: {testMode}</p>
              <p>Loading Starred: {loadingStarred ? 'true' : 'false'}</p>
              <button onClick={() => {
                // Check localStorage
                const local = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
                console.log('localStorage starred cards:', local);
                alert('localStorage starred cards: ' + (local || 'none'));
              }}>Check Local Storage</button>
            </div>
          </>
        ) : (
          <p>This deck doesn't have any cards to test with.</p>
        )}
        <button onClick={handleBackToDeck} className="back-to-deck-btn">
          Back to Deck
        </button>
      </div>
    );
  }

  if (testComplete || viewOnly) {
    const totalCards = results.correct.length + results.incorrect.length;
    const score = Math.round((results.correct.length / totalCards) * 100);
    
    return (
      <div className="test-container results">
        {viewOnly ? (
          <h2>All Starred Cards</h2>
        ) : (
          <h2>Test Complete!</h2>
        )}
        
        {!viewOnly && (
          <div className="test-summary">
            <div className="score">Score: {score}%</div>
            <div className="stats">
              <div className="correct-count">{results.correct.length} correct</div>
              <div className="incorrect-count">{results.incorrect.length} incorrect</div>
            </div>
          </div>
        )}
        
        {/* Show all cards in view mode */}
        {viewOnly && cards.length > 0 && (
          <div className="all-cards">
            <h3>Your Starred Cards ({cards.length})</h3>
            <ul className="results-list">
              {cards.map((card) => (
                <li key={card.id} className="result-item">
                  <div className="result-answer">
                    <strong>{card.answer}</strong>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Show incorrect answers in test mode */}
        {!viewOnly && results.incorrect.length > 0 && (
          <div className="incorrect-cards">
            <h3>Incorrect Answers (Automatically Starred)</h3>
            <ul className="results-list">
              {results.incorrect.map((card, index) => (
                <li key={card.id} className="result-item">
                  <div className="result-answer">
                    <strong>Correct answer:</strong> {card.answer}
                  </div>
                  <div className="result-user-answer">
                    <strong>Your answer:</strong> {results.userAnswers[results.correct.length + index]}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="test-actions">
          {!viewOnly && (
            <button onClick={handleStartOver} className="start-over-btn">
              Start Over
            </button>
          )}
          <button onClick={handleBackToDeck} className="back-to-deck-btn">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const isCorrect = submitted && userAnswer.trim().toLowerCase() === currentCard.answer.trim().toLowerCase();
  
  return (
    <div className="test-container">
      <div className="test-header">
        <button onClick={handleBackToDeck} className="back-btn">
          &larr; Back to Deck
        </button>
        <h1>ASL Test</h1>
        <div className="progress">
          {currentCardIndex + 1} of {cards.length}
          {testMode === 'starred' && ' (Starred Cards Only)'}
        </div>
      </div>

      <div className="test-content">
        <div className="video-container">
          {videoSource && (
            videoSource.includes('/preview') ? (
              <iframe 
                src={videoSource}
                width="100%" 
                height="100%" 
                allow="autoplay" 
                allowFullScreen
                style={{ border: 'none' }}
              ></iframe>
            ) : (
              <ReactPlayer
                url={videoSource}
                width="100%"
                height="100%"
                controls
                playing={!submitted}
                config={{
                  file: {
                    attributes: {
                      controlsList: 'nodownload',
                      disablePictureInPicture: true
                    },
                    forceVideo: true
                  }
                }}
              />
            )
          )}
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="answer-form">
            <div className="input-group">
              <label htmlFor="answer">What is the sign?</label>
              <input
                id="answer"
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer here"
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            <button type="submit" className="submit-btn">
              Submit
            </button>
          </form>
        ) : (
          <div className={`feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
            <h2>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </h2>
            <p>
              The correct answer is: <strong>{currentCard.answer}</strong>
              {!isCorrect && <span className="auto-starred"> (Auto-starred for review)</span>}
            </p>
            <button onClick={handleNextCard} className="next-btn">
              {currentCardIndex < cards.length - 1 ? 'Next Sign' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestMode; 