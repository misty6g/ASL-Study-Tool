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

  // Completely rewritten card fetching logic
  useEffect(() => {
    // Check if cards were passed directly in the navigation state
    if (location.state && (location.state as any).cards) {
      try {
        // Get cards from state with type assertion
        const stateCards = (location.state as any).cards;
        
        // Ensure each card has the required properties of the Card interface
        const passedCards: Card[] = stateCards.map((card: any) => ({
          id: card.id,
          video_url: card.video_url,
          answer: card.answer,
          deck_id: card.deck_id
        }));
        
        console.log(`TestMode: Using ${passedCards.length} cards passed directly from navigation`);
        
        // If we're in starred mode, make sure we have starred card IDs
        if (location.state && (location.state as any).starredCardIds) {
          const passedStarredIds = (location.state as any).starredCardIds;
          console.log(`TestMode: Got ${passedStarredIds.length} starred IDs from navigation`);
          // Only set if non-empty to prevent accidental clearing
          if (passedStarredIds && passedStarredIds.length > 0) {
            setStarredCardIds(passedStarredIds);
          }
        }
        
        // If we're in starred mode, the cards are already filtered
        if (testMode === 'starred' || (location.state as any).starredOnly) {
          console.log(`TestMode: Already filtered for starred cards (${passedCards.length} cards)`);
          setTestMode('starred');
        }
        
        // Set view-only if specified
        if ((location.state as any).viewOnly) {
          setViewOnly(true);
        }
        
        // Shuffle and set directly - skip all other fetching
        const shuffledCards = shuffleArray(passedCards);
        console.log(`TestMode: Set ${shuffledCards.length} shuffled cards for testing`);
        setCards(shuffledCards);
        setLoading(false);
        return; // Exit early - we have everything we need
      } catch (err) {
        console.error('TestMode: Error processing cards from navigation state:', err);
        // Continue to normal loading in case of error
      }
    }
    
    // Only run this if we didn't exit early above with direct cards
    if (!location.state || !(location.state as any).cards) {
      setLoading(true);
      fetchCardsFromAPI();
    }
  }, [location.state]);

  // Separate function for API fallback (legacy path)
  const fetchCardsFromAPI = async () => {
    console.log('TestMode: Attempting API fetch as fallback');
    setError(null);
    
    // Add a timeout to prevent infinite loading
    const fetchTimeoutId = setTimeout(() => {
      console.error('Card fetching timed out after 8 seconds');
      setError('Loading timed out. Please try again.');
      setLoading(false);
    }, 8000);
    
    try {
      // Set mode from navigation state if present
      if (location.state) {
        if ((location.state as any).starredOnly) {
          console.log('TestMode: Setting starred mode from state');
          setTestMode('starred');
        }
        if ((location.state as any).viewOnly) {
          setViewOnly(true);
        }
      }
      
      // Get starred card IDs first if we need them
      let starredIds: string[] = [];
      if (testMode === 'starred' || (location.state && (location.state as any).starredOnly)) {
        // Try to get from state first
        if (location.state && (location.state as any).starredCardIds) {
          starredIds = (location.state as any).starredCardIds;
          console.log(`TestMode: Using ${starredIds.length} starred IDs from navigation`);
        } else {
          // Fall back to localStorage
          const localStarred = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
          if (localStarred) {
            starredIds = JSON.parse(localStarred);
            console.log(`TestMode: Using ${starredIds.length} starred IDs from localStorage`);
          }
        }
        setStarredCardIds(starredIds);
      }
      
      console.log(`TestMode: Fetching cards for deck ${deckId}`);
      
      // Fetch the cards
      const apiUrl = `/api/cards/${deckId}`;
      console.log(`TestMode: Fetching from ${apiUrl}`);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cards (${response.status})`);
      }
      
      const rawData = await response.json();
      
      // Ensure proper Card type
      const data: Card[] = rawData.map((card: any) => ({
        id: card.id,
        video_url: card.video_url,
        answer: card.answer,
        deck_id: card.deck_id
      }));
      
      console.log(`TestMode: Got ${data.length} cards from API`);
      
      // Filter if necessary
      let filteredCards = data;
      if (testMode === 'starred' || (location.state && (location.state as any).starredOnly)) {
        if (starredIds.length === 0) {
          console.log('TestMode: No starred cards, showing empty set');
          setNoCardsFeedback('No starred cards found. Please star some cards and try again.');
          filteredCards = [];
        } else {
          filteredCards = data.filter((card: Card) => starredIds.includes(card.id));
          console.log(`TestMode: Filtered to ${filteredCards.length} starred cards`);
          
          if (filteredCards.length === 0) {
            setNoCardsFeedback('No starred cards found in this deck. Please star some cards and try again.');
          }
        }
      }
      
      // Shuffle and set cards
      const shuffledCards = shuffleArray(filteredCards);
      console.log(`TestMode: Set ${shuffledCards.length} shuffled cards for testing`);
      setCards(shuffledCards);
      
    } catch (error: any) {
      console.error('TestMode: Error fetching cards:', error);
      setError(error.message || 'Failed to load cards. Please try again.');
    } finally {
      clearTimeout(fetchTimeoutId);
      setLoading(false);
      setLoadingStarred(false); // Also mark starred as done
    }
  };

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

  // Improved helper function to check if an answer is correct, handling slash variants
  const checkAnswer = (userInput: string, correctAnswer: string): boolean => {
    if (!userInput || !correctAnswer) return false;
    
    const userInputClean = userInput.trim().toLowerCase();
    const correctAnswerClean = correctAnswer.trim().toLowerCase();
    
    console.log(`Checking answer: "${userInputClean}" against "${correctAnswerClean}"`);
    
    // Direct match
    if (userInputClean === correctAnswerClean) {
      console.log("TestMode: Exact match found!");
      return true;
    }
    
    // Check for slash in the correct answer
    if (correctAnswerClean.includes('/')) {
      console.log("TestMode: Slash detected in answer, checking variants");
      
      // Split the answer by slash and check each part
      const answerVariants = correctAnswerClean.split('/').map(part => part.trim());
      console.log("TestMode: Answer variants:", answerVariants);
      
      // Check if user's answer matches any of the variants
      for (const variant of answerVariants) {
        if (userInputClean === variant) {
          console.log(`TestMode: Match found with variant "${variant}"`);
          return true;
        }
      }
    }
    
    console.log("TestMode: No match found");
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!submitted && cards.length > 0) {
      const currentCard = cards[currentCardIndex];
      
      // Check answer using our helper function
      const isCorrect = checkAnswer(userAnswer, currentCard.answer);
      console.log(`Answer check result: ${isCorrect ? 'Correct' : 'Incorrect'}`);
      
      // Update results
      if (isCorrect) {
        console.log("Marking answer as correct");
        setResults(prevResults => ({
          ...prevResults,
          correct: [...prevResults.correct, currentCard],
          userAnswers: [...prevResults.userAnswers, userAnswer]
        }));
      } else {
        console.log("Marking answer as incorrect");
        setResults(prevResults => ({
          ...prevResults,
          incorrect: [...prevResults.incorrect, currentCard],
          userAnswers: [...prevResults.userAnswers, userAnswer]
        }));
        
        // Only auto-star incorrect answers if we're not in starred mode
        // (since these cards would already be starred)
        if (testMode !== 'starred' && !starredCardIds.includes(currentCard.id)) {
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
            
            console.log("Card auto-starred for review");
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

  // Add a function to format the correct answer for display
  const formatCorrectAnswer = (answer: string): string => {
    if (answer.includes('/')) {
      // If there are multiple accepted answers, format them nicely
      return answer.split('/').map(part => part.trim()).join(' or ');
    }
    return answer;
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
            {/* Debug information - hidden in production */}
            {false && (
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
            )}
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
            <h3>
              {testMode === 'starred' ? 
                'Incorrect Answers' : 
                'Incorrect Answers (Automatically Starred)'}
            </h3>
            <ul className="results-list">
              {results.incorrect.map((card, index) => (
                <li key={card.id} className="result-item">
                  <div className="result-answer">
                    <strong>Correct answer:</strong> {formatCorrectAnswer(card.answer)}
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
  const isCorrect = submitted && checkAnswer(userAnswer, currentCard.answer);
  
  // Debug information for the current card and answer
  if (currentCard) {
    console.log(`Current card answer: "${currentCard.answer}"`);
    console.log(`Contains slash: ${currentCard.answer.includes('/')}`);
    if (currentCard.answer.includes('/')) {
      console.log(`Variants: ${currentCard.answer.split('/').map(part => part.trim()).join(', ')}`);
    }
    console.log(`Formatted for display: "${formatCorrectAnswer(currentCard.answer)}"`);
  }
  
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
                onChange={(e) => {
                  setUserAnswer(e.target.value);
                  // Debug current input vs answer
                  if (currentCard) {
                    const input = e.target.value.trim().toLowerCase();
                    const answer = currentCard.answer.trim().toLowerCase();
                    console.log(`Current input: "${input}", Answer: "${answer}"`);
                  }
                }}
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
              The correct answer is: <strong>{formatCorrectAnswer(currentCard.answer)}</strong>
              {!isCorrect && testMode !== 'starred' && !starredCardIds.includes(currentCard.id) && 
                <span className="auto-starred"> (Auto-starred for review)</span>}
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