import React, { useEffect, useState, useRef, createRef, useCallback } from 'react';
import Flashcard, { FlashcardHandle } from './Flashcard';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import './Deck.css'; // We'll create this for the back button

interface Card {
  id: string;
  video_url: string;
  answer: string;
}

interface DeckProps {
  deckId: string;
}

const CARDS_PER_PAGE = 20; // Number of cards to display at once

const Deck: React.FC<DeckProps> = ({ deckId }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [visibleCards, setVisibleCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(() => {
    // Check localStorage for saved preference
    const savedPreference = localStorage.getItem('showFlipInstructions');
    return savedPreference === null ? true : savedPreference === 'true';
  });
  const [areAllFlipped, setAreAllFlipped] = useState(false);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const cardRefs = useRef<(React.RefObject<FlashcardHandle>)[]>([]);
  const cardContainerRefs = useRef<(React.RefObject<HTMLDivElement>)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Load more cards when user scrolls near the bottom
  const loadMoreCards = useCallback(() => {
    if (!loading && hasMoreCards) {
      const nextPage = currentPage + 1;
      const startIndex = (nextPage - 1) * CARDS_PER_PAGE;
      const endIndex = startIndex + CARDS_PER_PAGE;
      
      // Check if we have more cards to load
      if (startIndex < cards.length) {
        const nextBatch = cards.slice(startIndex, endIndex);
        setVisibleCards(prevCards => [...prevCards, ...nextBatch]);
        setCurrentPage(nextPage);
        setHasMoreCards(endIndex < cards.length);
      } else {
        setHasMoreCards(false);
      }
    }
  }, [loading, hasMoreCards, currentPage, cards]);

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMoreCards();
      }
    }, options);
    
    if (loadMoreTriggerRef.current) {
      observerRef.current.observe(loadMoreTriggerRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreCards]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/cards/${deckId}`);
        const fetchedCards = response.data;
        setCards(fetchedCards);
        
        // Initialize with first page of cards
        const initialCards = fetchedCards.slice(0, CARDS_PER_PAGE);
        setVisibleCards(initialCards);
        setHasMoreCards(fetchedCards.length > CARDS_PER_PAGE);
        
        // Create refs for visible cards
        cardRefs.current = Array(fetchedCards.length)
          .fill(null)
          .map(() => createRef<FlashcardHandle>() as React.RefObject<FlashcardHandle>);

        cardContainerRefs.current = Array(fetchedCards.length)
          .fill(null)
          .map(() => createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>);
        
        setLoading(false);
        
        // Check if coming from search with a highlight card ID
        if (location.state) {
          const { highlightCardId } = location.state as { fromSearch?: boolean, highlightCardId?: string };
          
          if (highlightCardId) {
            setHighlightedCardId(highlightCardId);
            
            // Find the card index
            const cardIndex = fetchedCards.findIndex((card: Card) => card.id === highlightCardId);
            
            // Calculate what page the card is on
            if (cardIndex !== -1) {
              const cardPage = Math.floor(cardIndex / CARDS_PER_PAGE) + 1;
              
              // Load all pages up to the card's page
              if (cardPage > 1) {
                const cardsToShow = fetchedCards.slice(0, cardPage * CARDS_PER_PAGE);
                setVisibleCards(cardsToShow);
                setCurrentPage(cardPage);
                setHasMoreCards(cardPage * CARDS_PER_PAGE < fetchedCards.length);
              }
              
              // Wait for rendering then scroll to the highlighted card
              setTimeout(() => {
                if (cardContainerRefs.current[cardIndex]?.current) {
                  cardContainerRefs.current[cardIndex].current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  });
                }
              }, 300);
            }
          }
        }
      } catch (err) {
        setError('Failed to load cards');
        setLoading(false);
      }
    };

    fetchCards();
  }, [deckId, location.state]);

  const handleBackClick = () => {
    navigate('/');
  };

  const handleTestClick = () => {
    navigate(`/test/${deckId}`);
  };

  const handleFirstFlip = () => {
    // When any card is flipped for the first time, hide instructions on all cards
    setShowInstructions(false);
    // Save preference to localStorage
    localStorage.setItem('showFlipInstructions', 'false');
  };

  const handleFlipAll = () => {
    const newFlipState = !areAllFlipped;
    cardRefs.current.forEach(ref => {
      if (ref.current) {
        ref.current.flip(newFlipState);
      }
    });
    setAreAllFlipped(newFlipState);
  };

  const handleCardInteraction = (cardId: string) => {
    // Remove the highlighting when card is interacted with
    setHighlightedCardId(null);
  };

  if (loading) return (
    <div className="loading-container">
      <div>Loading...</div>
    </div>
  );
  
  if (error) return (
    <div className="error-container">
      <div>Error: {error}</div>
    </div>
  );

  return (
    <div className="deck-container">
      <div className="back-button-container">
        <button className="back-button" onClick={handleBackClick} title="Back to Home">
          &#8592;
        </button>
      </div>
      <div className="flip-all-button-container">
        <button className="test-button" onClick={handleFlipAll} title={areAllFlipped ? "Show Videos" : "Show Answers"}>
          {areAllFlipped ? "Show Videos" : "Show Answers"}
        </button>
      </div>
      <div className="test-button-container">
        <button className="test-button" onClick={handleTestClick} title="Start Test">
          Test
        </button>
      </div>
      
      <div className="cards-grid">
        {visibleCards.map((card, index) => {
          const cardIndex = cards.findIndex(c => c.id === card.id);
          return (
            <div key={card.id} ref={cardContainerRefs.current[cardIndex]}>
              <Flashcard
                ref={cardRefs.current[cardIndex]}
                videoUrl={card.video_url}
                answer={card.answer}
                showInstructions={showInstructions}
                onFirstFlip={handleFirstFlip}
                isHighlighted={card.id === highlightedCardId}
                onCardInteraction={handleCardInteraction}
                cardId={card.id}
              />
            </div>
          );
        })}
        
        {/* Loading trigger element */}
        {hasMoreCards && (
          <div 
            ref={loadMoreTriggerRef} 
            className="load-more-trigger"
            style={{ width: '100%', height: '20px', margin: '20px 0' }}
          >
            {loading && <div className="loading-indicator">Loading more cards...</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Deck; 