import React, { useEffect, useState, useRef, createRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Flashcard, { FlashcardHandle } from './Flashcard';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
import './Deck.css';
import { LOCAL_STORAGE_STARRED_KEY } from './constants';

interface Card {
  id: string;
  video_url: string;
  answer: string;
  deck_id: string;
}

interface DeckProps {
  deckId: string;
}

const CARDS_PER_PAGE = 20;

const Deck: React.FC<DeckProps> = ({ deckId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [cards, setCards] = useState<Card[]>([]);
  const [visibleCards, setVisibleCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(() => {
    const savedPreference = localStorage.getItem('showFlipInstructions');
    return savedPreference === null ? true : savedPreference === 'true';
  });
  const [areAllFlipped, setAreAllFlipped] = useState(false);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [starredCardIds, setStarredCardIds] = useState<string[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(true);

  const cardRefs = useRef<(React.RefObject<FlashcardHandle>)[]>([]);
  const cardContainerRefs = useRef<(React.RefObject<HTMLDivElement>)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Load starred cards
  useEffect(() => {
    if (!user) return;

    const fetchStarredCards = async () => {
      try {
        // Read local storage first for immediate rendering
        const localStarred = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
        if (localStarred) {
          try {
            const parsedStarred = JSON.parse(localStarred);
            if (parsedStarred && parsedStarred.length > 0) {
              setStarredCardIds(parsedStarred);
            }
          } catch (parseErr) {
            console.error('Error parsing starred cards from localStorage:', parseErr);
          }
        }

        // Fetch from API
        const response = await apiClient.get(`/api/users/${user.id}/starred-card-ids`);
        if (response.data && response.data.cardIds) {
          setStarredCardIds(response.data.cardIds);
          localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(response.data.cardIds));
        }
      } catch (err) {
        console.error('Error loading starred cards:', err);
      } finally {
        setLoadingStarred(false);
      }
    };

    fetchStarredCards();
  }, [user]);

  const refreshStarredCards = async () => {
    if (!user) return;
    try {
      const response = await apiClient.get(`/api/users/${user.id}/starred-card-ids`);
      if (response.data && response.data.cardIds) {
        setStarredCardIds(response.data.cardIds);
        localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(response.data.cardIds));
      }
    } catch (err) {
      console.error('Error refreshing starred cards:', err);
    }
  };

  const handleStarToggle = async (cardId: string, isStarred: boolean) => {
    if (!user) return;

    const previousStarredIds = [...starredCardIds];
    localStorage.setItem('asl_study_tool_starred_cards_backup', JSON.stringify(previousStarredIds));

    // Update UI immediately
    let newStarredIds;
    if (isStarred) {
      newStarredIds = [...starredCardIds, cardId];
    } else {
      newStarredIds = starredCardIds.filter(id => id !== cardId);
    }
    setStarredCardIds(newStarredIds);
    localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(newStarredIds));

    // Sync with backend API
    try {
      if (isStarred) {
        await apiClient.post(`/api/cards/${cardId}/star`);
      } else {
        await apiClient.delete(`/api/cards/${cardId}/star`);
      }
    } catch (err) {
      console.error('Failed to sync star status with backend:', err);
    }
  };

  const loadMoreCards = useCallback(() => {
    if (!loading && hasMoreCards) {
      const nextPage = currentPage + 1;
      const startIndex = (nextPage - 1) * CARDS_PER_PAGE;
      const endIndex = startIndex + CARDS_PER_PAGE;
      
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
    if (!user) return;

    const fetchCards = async () => {
      try {
        setLoading(true);
        if (deckId === 'all-starred') {
          document.title = "All Starred Cards";
          
          let starredIds: string[] = [];
          if (location.state && (location.state as any).starredCardIds) {
            try {
              const stateStarredIds = (location.state as any).starredCardIds;
              starredIds = typeof stateStarredIds === 'string' ? 
                JSON.parse(stateStarredIds) : stateStarredIds;
            } catch (e) {
              console.error('Error parsing starred IDs:', e);
            }
          }
          
          if (starredIds.length === 0) {
            starredIds = starredCardIds;
          }

          // Fetch user decks
          const decksResponse = await apiClient.get<any[]>(`/api/decks/${user.id}`);
          const allDecks = decksResponse.data;
          
          let allCards: Card[] = [];
          for (const deck of allDecks) {
            try {
              const deckCardsResponse = await apiClient.get<Card[]>(`/api/cards/${deck.id}`);
              allCards = [...allCards, ...deckCardsResponse.data];
            } catch (deckErr) {
              console.error(`Error loading cards for deck ${deck.id}:`, deckErr);
            }
          }

          const filteredCards = allCards.filter(card => starredIds.includes(card.id));
          setCards(filteredCards);
          
          const initialCards = filteredCards.slice(0, CARDS_PER_PAGE);
          setVisibleCards(initialCards);
          setHasMoreCards(filteredCards.length > CARDS_PER_PAGE);
          
          cardRefs.current = Array(filteredCards.length)
            .fill(null)
            .map(() => createRef<FlashcardHandle>() as React.RefObject<FlashcardHandle>);

          cardContainerRefs.current = Array(filteredCards.length)
            .fill(null)
            .map(() => createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>);

          setLoading(false);
          return;
        }

        // Fetch regular deck cards
        const response = await apiClient.get<Card[]>(`/api/cards/${deckId}`);
        const fetchedCards = response.data;
        setCards(fetchedCards);
        
        const initialCards = fetchedCards.slice(0, CARDS_PER_PAGE);
        setVisibleCards(initialCards);
        setHasMoreCards(fetchedCards.length > CARDS_PER_PAGE);
        
        cardRefs.current = Array(fetchedCards.length)
          .fill(null)
          .map(() => createRef<FlashcardHandle>() as React.RefObject<FlashcardHandle>);

        cardContainerRefs.current = Array(fetchedCards.length)
          .fill(null)
          .map(() => createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>);
        
        setLoading(false);

        if (location.state) {
          const { highlightCardId } = location.state as { highlightCardId?: string };
          if (highlightCardId) {
            setHighlightedCardId(highlightCardId);
            const cardIndex = fetchedCards.findIndex((c: Card) => c.id === highlightCardId);
            if (cardIndex !== -1) {
              const cardPage = Math.floor(cardIndex / CARDS_PER_PAGE) + 1;
              if (cardPage > 1) {
                const cardsToShow = fetchedCards.slice(0, cardPage * CARDS_PER_PAGE);
                setVisibleCards(cardsToShow);
                setCurrentPage(cardPage);
                setHasMoreCards(cardPage * CARDS_PER_PAGE < fetchedCards.length);
              }
              
              setTimeout(() => {
                cardContainerRefs.current[cardIndex]?.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center'
                });
              }, 300);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load cards:', err);
        setError('Failed to load flashcards');
        setLoading(false);
      }
    };

    fetchCards();
  }, [deckId, user, location.state]);

  const handleBackClick = () => {
    navigate('/');
  };

  const handleTestClick = () => {
    navigate(`/test/${deckId}`, {
      state: { 
        testMode: 'all',
        cards: cards,
        deckId: deckId
      }
    });
  };

  const handleStarredTestClick = () => {
    localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(starredCardIds));
    const starredCards = cards.filter(card => starredCardIds.includes(card.id));
    navigate(`/test/${deckId}`, { 
      state: { 
        starredOnly: true,
        cards: starredCards,
        starredCardIds: starredCardIds,
        deckId: deckId
      } 
    });
  };

  const handleFirstFlip = () => {
    setShowInstructions(false);
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

  const handleCardInteraction = () => {
    setHighlightedCardId(null);
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading flashcards...</p>
    </div>
  );
  
  if (error) return (
    <div className="error-container">
      <div className="error-message">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={handleBackClick}>Back to Decks</button>
      </div>
    </div>
  );

  return (
    <div className="deck-container">
      <div className="back-button-container">
        <button className="back-button" onClick={handleBackClick} title="Back to Home">
          &#8592;
        </button>
      </div>
      
      {deckId === 'all-starred' && (
        <h1 className="deck-title">All Starred Cards</h1>
      )}
      
      <div className="deck-actions">
        <div className="action-buttons">
          <button className="deck-button" onClick={handleFlipAll} title={areAllFlipped ? "Show Videos" : "Show Answers"}>
            {areAllFlipped ? "Show Videos" : "Show Answers"}
          </button>
          <button className="deck-button" onClick={handleTestClick} title="Start Test">
            Test All
          </button>
          {starredCardIds.length > 0 && (
            <button 
              className="deck-button starred-test-button" 
              onClick={handleStarredTestClick} 
              title="Test Starred Cards Only"
            >
              Test Starred
            </button>
          )}
          <button 
            className="deck-button debug-button" 
            onClick={refreshStarredCards}
            title="Refresh Starred Status" 
          >
            Refresh Stars
          </button>
        </div>
      </div>
      
      <div className="cards-grid">
        {visibleCards.map((card, index) => {
          const cardIndex = cards.findIndex(c => c.id === card.id);
          const isCardStarred = starredCardIds.includes(card.id);
          
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
                isStarred={isCardStarred}
                onStarToggle={handleStarToggle}
              />
            </div>
          );
        })}
        
        {hasMoreCards && (
          <div ref={loadMoreTriggerRef} className="load-more-trigger">
            <div className="loading-spinner-small"></div>
            <p>Loading more flashcards...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Deck;