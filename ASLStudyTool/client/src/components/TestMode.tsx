import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
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
  const { user } = useAuth();
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
      timeoutId = setTimeout(() => {
        setShowCancelButton(true);
      }, 5000);
    } else {
      setShowCancelButton(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, loadingStarred]);

  // Card loading logic
  useEffect(() => {
    if (!user) return;

    if (location.state && (location.state as any).cards) {
      try {
        const stateCards = (location.state as any).cards;
        const passedCards: Card[] = stateCards.map((card: any) => ({
          id: card.id,
          video_url: card.video_url,
          answer: card.answer,
          deck_id: card.deck_id
        }));
        
        if (location.state && (location.state as any).starredCardIds) {
          const passedStarredIds = (location.state as any).starredCardIds;
          if (passedStarredIds && passedStarredIds.length > 0) {
            setStarredCardIds(passedStarredIds);
          }
        }
        
        if (testMode === 'starred' || (location.state as any).starredOnly) {
          setTestMode('starred');
        }
        
        if ((location.state as any).viewOnly) {
          setViewOnly(true);
        }
        
        const shuffledCards = shuffleArray(passedCards);
        setCards(shuffledCards);
        setLoading(false);
        return;
      } catch (err) {
        console.error('Error processing cards from navigation state:', err);
      }
    }
    
    // API fallback
    const fetchCardsFromAPI = async () => {
      setError(null);
      
      const fetchTimeoutId = setTimeout(() => {
        setError('Loading cards timed out.');
        setLoading(false);
      }, 10000);
      
      try {
        if (location.state) {
          if ((location.state as any).starredOnly) {
            setTestMode('starred');
          }
          if ((location.state as any).viewOnly) {
            setViewOnly(true);
          }
        }
        
        let starredIds: string[] = [];
        if (testMode === 'starred' || (location.state && (location.state as any).starredOnly)) {
          if (location.state && (location.state as any).starredCardIds) {
            starredIds = (location.state as any).starredCardIds;
          } else {
            const localStarred = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
            if (localStarred) {
              starredIds = JSON.parse(localStarred);
            }
          }
          setStarredCardIds(starredIds);
        }
        
        const response = await apiClient.get<Card[]>(`/api/cards/${deckId}`);
        const data = response.data;
        
        let filteredCards = data;
        if (testMode === 'starred' || (location.state && (location.state as any).starredOnly)) {
          if (starredIds.length === 0) {
            setNoCardsFeedback('No starred cards found. Please star some cards first.');
            filteredCards = [];
          } else {
            filteredCards = data.filter((card: Card) => starredIds.includes(card.id));
            if (filteredCards.length === 0) {
              setNoCardsFeedback('No starred cards found in this deck.');
            }
          }
        }
        
        const shuffledCards = shuffleArray(filteredCards);
        setCards(shuffledCards);
        
      } catch (error: any) {
        console.error('Error fetching cards:', error);
        setError(error.response?.data?.error || 'Failed to load test cards.');
      } finally {
        clearTimeout(fetchTimeoutId);
        setLoading(false);
        setLoadingStarred(false);
      }
    };

    fetchCardsFromAPI();
  }, [location.state, deckId, user, testMode]);

  useEffect(() => {
    if (cards.length > 0 && currentCardIndex < cards.length) {
      const currentCard = cards[currentCardIndex];
      if (currentCard.video_url.includes('drive.google.com')) {
        setVideoSource(transformGoogleDriveUrl(currentCard.video_url));
      } else {
        setVideoSource(currentCard.video_url);
      }
    }
  }, [cards, currentCardIndex]);

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
    if (url.includes('drive.google.com')) {
      let fileId = '';
      if (url.includes('drive.google.com/file/d/')) {
        const match = url.match(/\/file\/d\/([^\/]+)/);
        if (match && match[1]) fileId = match[1];
      } else if (url.includes('drive.google.com/open?id=')) {
        const match = url.match(/open\?id=([^&]+)/);
        if (match && match[1]) fileId = match[1];
      } else if (url.includes('id=')) {
        const match = url.match(/id=([^&]+)/);
        if (match && match[1]) fileId = match[1];
      }
      
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    return url;
  };

  const checkAnswer = (userInput: string, correctAnswer: string): boolean => {
    if (!userInput || !correctAnswer) return false;
    
    const userInputClean = userInput.trim().toLowerCase();
    const correctAnswerClean = correctAnswer.trim().toLowerCase();
    
    if (userInputClean === correctAnswerClean) return true;
    
    if (correctAnswerClean.includes('/')) {
      const answerVariants = correctAnswerClean.split('/').map(part => part.trim());
      for (const variant of answerVariants) {
        if (userInputClean === variant) return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!submitted && cards.length > 0 && user) {
      const currentCard = cards[currentCardIndex];
      const isCorrect = checkAnswer(userAnswer, currentCard.answer);
      
      if (isCorrect) {
        setResults(prev => ({
          ...prev,
          correct: [...prev.correct, currentCard],
          userAnswers: [...prev.userAnswers, userAnswer]
        }));
      } else {
        setResults(prev => ({
          ...prev,
          incorrect: [...prev.incorrect, currentCard],
          userAnswers: [...prev.userAnswers, userAnswer]
        }));
        
        // Auto-star incorrect answers
        if (testMode !== 'starred' && !starredCardIds.includes(currentCard.id)) {
          try {
            const newStarredIds = [...starredCardIds, currentCard.id];
            setStarredCardIds(newStarredIds);
            localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(newStarredIds));
            
            // Call API
            await apiClient.post(`/api/cards/${currentCard.id}/star`);
          } catch (err) {
            console.error('Error auto-starring card on backend:', err);
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
    if (deckId === 'all-decks') {
      navigate('/');
    } else {
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

  const formatCorrectAnswer = (answer: string): string => {
    if (answer.includes('/')) {
      return answer.split('/').map(part => part.trim()).join(' or ');
    }
    return answer;
  };

  if (loading) {
    return (
      <div className="test-container loading">
        <div className="loading-spinner"></div>
        <p>Loading test sessions...</p>
        {showCancelButton && (
          <button onClick={handleBackToDeck} className="cancel-btn" style={{ marginTop: '20px' }}>
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
        <p>{noCardsFeedback || "This deck doesn't have any cards."}</p>
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
        <h2>{viewOnly ? 'All Starred Cards' : 'Test Complete!'}</h2>
        
        {!viewOnly && (
          <div className="test-summary">
            <div className="score">Score: {score}%</div>
            <div className="stats">
              <div className="correct-count">{results.correct.length} correct</div>
              <div className="incorrect-count">{results.incorrect.length} incorrect</div>
            </div>
          </div>
        )}
        
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
        
        {!viewOnly && results.incorrect.length > 0 && (
          <div className="incorrect-cards">
            <h3>{testMode === 'starred' ? 'Incorrect Answers' : 'Incorrect Answers (Auto-Starred)'}</h3>
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
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const isCorrect = submitted && checkAnswer(userAnswer, currentCard.answer);
  
  return (
    <div className="test-container">
      <div className="test-header">
        <button onClick={handleBackToDeck} className="back-btn">
          &larr; Back to Deck
        </button>
        <h1>ASL Test</h1>
        <div className="progress">
          {currentCardIndex + 1} of {cards.length}
          {testMode === 'starred' && ' (Starred Only)'}
        </div>
      </div>

      <div className="test-content">
        <div className="video-container">
          {videoSource && (
            videoSource.includes('/preview') ? (
              <iframe 
                src={videoSource}
                title="ASL Sign Video Preview"
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
            <h2>{isCorrect ? 'Correct!' : 'Incorrect'}</h2>
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