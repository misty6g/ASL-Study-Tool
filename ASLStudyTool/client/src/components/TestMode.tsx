import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactPlayer from 'react-player';
import './TestMode.css';

interface Card {
  id: string;
  video_url: string;
  answer: string;
}

interface TestModeProps {
  deckId: string;
}

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
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/cards/${deckId}`);
        // Shuffle the cards for the test
        const shuffledCards = [...response.data].sort(() => Math.random() - 0.5);
        setCards(shuffledCards);
        setLoading(false);
      } catch (err) {
        setError('Failed to load cards');
        setLoading(false);
      }
    };

    fetchCards();
  }, [deckId]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentCard = cards[currentCardIndex];
    
    // Check if the answer contains slashes (multiple correct options)
    const correctAnswers = currentCard.answer.split('/').map(ans => ans.trim().toLowerCase());
    const normalizedUserAnswer = userAnswer.trim().toLowerCase();
    
    // Check if the answer is exactly correct or off by 1 character
    const isCorrect = correctAnswers.some(answer => 
      answer === normalizedUserAnswer || isWithinEditDistance(answer, normalizedUserAnswer, 1)
    );

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
    }

    setSubmitted(true);
  };

  // Function to check if two strings are within a certain edit distance
  const isWithinEditDistance = (s1: string, s2: string, maxDistance: number): boolean => {
    // If the difference in length is already greater than maxDistance, return false
    if (Math.abs(s1.length - s2.length) > maxDistance) return false;
    
    // For single character difference, we can do simple checks
    if (maxDistance === 1) {
      // If strings are equal, edit distance is 0
      if (s1 === s2) return true;
      
      // If length is the same, check for a single character substitution
      if (s1.length === s2.length) {
        let diffCount = 0;
        for (let i = 0; i < s1.length; i++) {
          if (s1[i] !== s2[i]) {
            diffCount++;
            if (diffCount > maxDistance) return false;
          }
        }
        return true;
      }
      
      // Check for a single insertion or deletion
      if (Math.abs(s1.length - s2.length) === 1) {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        
        let longIndex = 0;
        let shortIndex = 0;
        let diffCount = 0;
        
        while (longIndex < longer.length && shortIndex < shorter.length) {
          if (longer[longIndex] !== shorter[shortIndex]) {
            diffCount++;
            if (diffCount > maxDistance) return false;
            // Move only the longer string's index (skip the extra character)
            longIndex++;
          } else {
            // Characters match, move both indices
            longIndex++;
            shortIndex++;
          }
        }
        
        return true;
      }
    }
    
    // For more complex cases, we'd implement a full Levenshtein distance algorithm
    // But for maxDistance=1, the above checks are sufficient
    return false;
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
    navigate(`/deck/${deckId}`);
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

  if (loading) {
    return (
      <div className="test-container loading">
        <div className="loading-spinner"></div>
        <p>Loading test...</p>
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
        <p>This deck doesn't have any cards to test with.</p>
        <button onClick={handleBackToDeck} className="back-to-deck-btn">
          Back to Deck
        </button>
      </div>
    );
  }

  if (testComplete) {
    const totalCards = results.correct.length + results.incorrect.length;
    const percentCorrect = Math.round((results.correct.length / totalCards) * 100);
    
    return (
      <div className="test-container results">
        <h1>Test Results</h1>
        <div className="results-summary">
          <h2>Score: {percentCorrect}%</h2>
          <p>
            {results.correct.length} out of {totalCards} correct
          </p>
        </div>

        {results.incorrect.length > 0 && (
          <div className="incorrect-answers">
            <h3>Review Incorrect Answers:</h3>
            <ul className="review-list">
              {results.incorrect.map((card, index) => {
                const userAnswerIndex = results.correct.length + index;
                return (
                  <li key={card.id} className="review-item">
                    <p><strong>Sign:</strong> {card.answer}</p>
                    <p><strong>Your answer:</strong> {results.userAnswers[userAnswerIndex]}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="results-actions">
          <button onClick={handleStartOver} className="start-over-btn">
            Start Over
          </button>
          <button onClick={handleBackToDeck} className="back-to-deck-btn">
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const isGoogleDriveEmbed = videoSource.includes('/preview');
  
  // Prepare variables for answer checking
  const correctAnswers = currentCard.answer.split('/').map(ans => ans.trim().toLowerCase());
  const normalizedUserAnswer = userAnswer.trim().toLowerCase();
  const isAnswerCorrect = correctAnswers.some(answer => 
    answer === normalizedUserAnswer || isWithinEditDistance(answer, normalizedUserAnswer, 1)
  );

  return (
    <div className="test-container">
      <div className="test-header">
        <button onClick={handleBackToDeck} className="back-to-deck-btn">
          ← Back to Deck
        </button>
        <h1>ASL Test</h1>
        <div className="progress">
          {currentCardIndex + 1} of {cards.length}
        </div>
      </div>

      <div className="test-content">
        <div className="video-container">
          {isGoogleDriveEmbed ? (
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
          <div className={`feedback ${isAnswerCorrect ? 'correct' : 'incorrect'}`}>
            <h2>
              {isAnswerCorrect 
                ? 'Correct!' 
                : 'Incorrect'}
            </h2>
            <p>
              The correct answer is: <strong>{currentCard.answer}</strong>
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