import React, { useEffect, useState, useRef, createRef, useCallback } from 'react';
import Flashcard, { FlashcardHandle } from './Flashcard';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import './Deck.css'; // We'll create this for the back button
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
  const [starredCardIds, setStarredCardIds] = useState<string[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const cardRefs = useRef<(React.RefObject<FlashcardHandle>)[]>([]);
  const cardContainerRefs = useRef<(React.RefObject<HTMLDivElement>)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  let isStarToggleInProgress = false;

  // Load starred cards
  useEffect(() => {
    const fetchStarredCards = async () => {
      try {
        // First try to get from localStorage for immediate UI update
        const localStarred = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
        if (localStarred) {
          try {
            const parsedStarred = JSON.parse(localStarred);
            console.log('Using starred cards from localStorage:', parsedStarred);
            // Only update if we actually have stars (prevent overwriting with empty array)
            if (parsedStarred && parsedStarred.length > 0) {
              setStarredCardIds(parsedStarred);
            }
          } catch (parseErr) {
            console.error('Error parsing starred cards from localStorage:', parseErr);
            // Don't set to empty here, just continue to server
          }
        }

        // Then try server
        try {
          const demoUserId = "demo-user-id"; // Hardcoded for demo
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${demoUserId}/starred-card-ids`);
          
          if (response.data && response.data.cardIds && response.data.cardIds.length > 0) {
            console.log('Got starred cards from server:', response.data.cardIds.length);
            setStarredCardIds(response.data.cardIds);
            // Always keep localStorage in sync with server
            localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(response.data.cardIds));
          }
          // Important: If server returns empty but localStorage has values, keep the localStorage values
          // This prevents accidentally clearing starred cards if server times out or returns empty
        } catch (serverErr) {
          console.error("Error fetching starred cards from server:", serverErr);
          // No action needed here since we already tried localStorage
        }
      } catch (err) {
        console.error("Error in starred cards fetching logic:", err);
        // Keep any existing starred cards rather than setting to empty
      } finally {
        setLoadingStarred(false);
      }
    };

    fetchStarredCards();
  }, []);

  // Function to refresh the starred cards with safeguards
  const refreshStarredCards = async () => {
    try {
      console.log('Refreshing starred cards list');
      
      // First check if we have local state with starred cards
      if (starredCardIds.length > 0) {
        console.log('Current starred cards in state:', starredCardIds);
      }
      
      // Check localStorage first
      const localStarred = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
      let localStarredIds: string[] = [];
      
      if (localStarred) {
        try {
          localStarredIds = JSON.parse(localStarred);
          console.log('Found', localStarredIds.length, 'starred cards in localStorage');
        } catch (parseErr) {
          console.error('Error parsing localStorage starred cards:', parseErr);
        }
      }
      
      // Try server 
      const demoUserId = "demo-user-id"; // Hardcoded for demo
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${demoUserId}/starred-card-ids`);
        
        if (response.data && response.data.cardIds && response.data.cardIds.length > 0) {
          console.log('Refreshed starred cards from server:', response.data.cardIds.length);
          // Only update if server returns non-empty array
          setStarredCardIds(response.data.cardIds);
          localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(response.data.cardIds));
          return;
        } else {
          console.warn('Server returned empty starred cards list');
          // If server returned empty but we have local data, keep the local data
          if (localStarredIds.length > 0 || starredCardIds.length > 0) {
            console.log('Using existing starred cards instead of empty server response');
            if (localStarredIds.length > 0) {
              setStarredCardIds(localStarredIds);
            }
            // No localStorage update needed here since we're keeping existing values
            return;
          }
        }
      } catch (serverErr) {
        console.error("Error refreshing starred cards from server:", serverErr);
        // Fall back to localStorage if server fails
      }
      
      // If we get here and have localStorage data, use it
      if (localStarredIds.length > 0) {
        console.log('Using fallback starred cards from localStorage:', localStarredIds.length);
        setStarredCardIds(localStarredIds);
      }
      // If all else fails, keep using current state - never clear starred cards accidentally
    } catch (err) {
      console.error("Error refreshing starred cards:", err);
      // Fail gracefully, don't change anything
    }
  };

  // Handle starring/unstarring cards
  const handleStarToggle = async (cardId: string, isStarred: boolean) => {
    console.log(`Toggling star for card ${cardId} to ${isStarred ? 'starred' : 'unstarred'}`);
    
    // Create a backup of the current starred IDs before making any changes
    const previousStarredIds = [...starredCardIds];
    
    // Backup current state to a different localStorage key as a safeguard
    localStorage.setItem('asl_study_tool_starred_cards_backup', JSON.stringify(previousStarredIds));
    
    // Update UI state immediately for responsiveness
    let newStarredIds;
    if (isStarred) {
      newStarredIds = [...starredCardIds, cardId];
      setStarredCardIds(newStarredIds);
    } else {
      newStarredIds = starredCardIds.filter(id => id !== cardId);
      setStarredCardIds(newStarredIds);
    }
    
    // Save to localStorage immediately
    localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(newStarredIds));
    
    // Try to update the server as well (knowing it might fail)
    try {
      const demoUserId = "demo-user-id"; // Hardcoded for demo
      
      if (isStarred) {
        // Star the card
        console.log(`Sending API request to star card ${cardId}`);
        await axios.post(`${process.env.REACT_APP_API_URL}/api/cards/${cardId}/star`, { userId: demoUserId });
        console.log('Star API request sent');
      } else {
        // Unstar the card
        console.log(`Sending API request to unstar card ${cardId}`);
        await axios.delete(`${process.env.REACT_APP_API_URL}/api/cards/${cardId}/star`, { 
          data: { userId: demoUserId } 
        });
        console.log('Unstar API request sent');
      }
    } catch (err) {
      console.error(`Error ${isStarred ? 'starring' : 'unstarring'} card on server:`, err);
      console.log('Using localStorage for persistence instead');
      // No need to revert UI state since we've already updated localStorage
    }
  };

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
        // Special handling for "all-starred" deck ID
        if (deckId === 'all-starred') {
          console.log("Handling all-starred deck view");
          
          // Set a special title
          document.title = "All Starred Cards";
          
          // Check if we were passed starred card IDs in the location state
          let starredIds: string[] = [];
          if (location.state && (location.state as any).starredCardIds) {
            try {
              const stateStarredIds = (location.state as any).starredCardIds;
              starredIds = typeof stateStarredIds === 'string' ? 
                JSON.parse(stateStarredIds) : stateStarredIds;
              console.log("Using starred IDs from location state:", starredIds);
            } catch (e) {
              console.error("Error parsing starred IDs from location state:", e);
            }
          }
          
          // If no starred IDs in state, use our loaded starredCardIds
          if (starredIds.length === 0) {
            starredIds = starredCardIds;
            console.log("Using loaded starred card IDs:", starredIds);
          }
          
          // Get all decks
          const usersResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`);
          const demoUser = usersResponse.data.find((user: any) => user.email === 'demo@example.com');
          
          if (demoUser) {
            const decksResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/decks/${demoUser.id}`);
            const allDecks = decksResponse.data;
            console.log(`Found ${allDecks.length} decks to search for starred cards`);
            
            // Collect cards from all decks
            let allCards: Card[] = [];
            for (const deck of allDecks) {
              try {
                const deckCardsResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/cards/${deck.id}`);
                allCards = [...allCards, ...deckCardsResponse.data];
              } catch (deckErr) {
                console.error(`Error fetching cards for deck ${deck.id}:`, deckErr);
              }
            }
            
            console.log(`Found total of ${allCards.length} cards across all decks`);
            
            // Filter to starred cards only
            const filteredCards = allCards.filter(card => starredIds.includes(card.id));
            console.log(`Filtered to ${filteredCards.length} starred cards across all decks`);
            
            setCards(filteredCards);
            
            // Initialize with first page of cards
            const initialCards = filteredCards.slice(0, CARDS_PER_PAGE);
            setVisibleCards(initialCards);
            setHasMoreCards(filteredCards.length > CARDS_PER_PAGE);
            
            // Create refs for visible cards
            cardRefs.current = Array(filteredCards.length)
              .fill(null)
              .map(() => createRef<FlashcardHandle>() as React.RefObject<FlashcardHandle>);

            cardContainerRefs.current = Array(filteredCards.length)
              .fill(null)
              .map(() => createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>);
          }
          
          setLoading(false);
          return; // Exit early
        }
        
        // Regular deck handling
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
    console.log("Starting test mode with all cards");
    
    // Create a direct clone of cards to avoid API calls
    try {
      // Direct navigation with cards in state (avoid storage mechanisms)
      console.log(`Directly passing ${cards.length} cards to test mode`);
      navigate(`/test/${deckId}`, {
        state: { 
          testMode: 'all',
          cards: cards,  // Pass entire card array directly
          deckId: deckId
        }
      });
    } catch (err) {
      console.error("Failed to start test mode:", err);
      // Fallback to simpler state
      navigate(`/test/${deckId}`, { state: { testMode: 'all' } });
    }
  };

  const handleStarredTestClick = () => {
    console.log("Starting test mode with starred cards only");
    
    // Save starred card IDs to localStorage for backup
    localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(starredCardIds));
    
    try {
      // Filter starred cards before navigation to avoid processing in TestMode
      const starredCards = cards.filter(card => starredCardIds.includes(card.id));
      console.log(`Found ${starredCards.length} starred cards to test`);
      
      // Direct navigation with filtered cards in state
      navigate(`/test/${deckId}`, { 
        state: { 
          starredOnly: true,
          cards: starredCards,  // Pass already filtered cards
          starredCardIds: starredCardIds,
          deckId: deckId
        } 
      });
    } catch (err) {
      console.error("Failed to start starred test mode:", err);
      // Fallback to simpler state
      navigate(`/test/${deckId}`, { 
        state: { starredOnly: true, starredCardIds: starredCardIds }
      });
    }
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

  // Add a recovery function for starred cards
  const recoverStarredCards = () => {
    try {
      console.log('Attempting to recover starred cards from backup');
      
      // Try to get the backup
      const backupStarred = localStorage.getItem('asl_study_tool_starred_cards_backup');
      if (backupStarred) {
        const parsedBackup = JSON.parse(backupStarred);
        if (parsedBackup && parsedBackup.length > 0) {
          console.log(`Found backup with ${parsedBackup.length} starred cards`);
          
          // Restore to main storage
          localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, backupStarred);
          
          // Update state
          setStarredCardIds(parsedBackup);
          
          console.log('Successfully recovered starred cards from backup');
          return true;
        }
      }
      console.log('No valid backup found');
      return false;
    } catch (err) {
      console.error('Error recovering starred cards from backup:', err);
      return false;
    }
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

  // Check if any cards are starred - add more debugging
  const hasStarredCards = cards.some(card => starredCardIds.includes(card.id));
  console.log(`Starred card IDs: ${starredCardIds.length > 0 ? starredCardIds.join(', ') : 'none'}`);
  console.log(`Has starred cards: ${hasStarredCards}`);

  return (
    <div className="deck-container">
      <div className="back-button-container">
        <button className="back-button" onClick={handleBackClick} title="Back to Home">
          &#8592;
        </button>
      </div>
      
      {/* Deck title */}
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
            title="Debug: Refresh Starred Cards" 
          >
            Refresh Stars
          </button>
        </div>
      </div>
      
      {/* Debug info - hidden in production */}
      {false && (
        <div className="debug-info" style={{ padding: "10px", background: "#333", margin: "10px", borderRadius: "5px", fontSize: "12px" }}>
          <p>Starred IDs: {starredCardIds.length > 0 ? starredCardIds.join(', ') : 'None'}</p>
          <p>Loading Starred: {loadingStarred ? 'Yes' : 'No'}</p>
          <p>Deck Cards: {cards.length}</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
            <button onClick={refreshStarredCards} style={{ padding: "5px", fontSize: "12px" }}>
              Refresh Stars
            </button>
            <button onClick={recoverStarredCards} style={{ padding: "5px", fontSize: "12px", background: "#664646", color: "white" }}>
              Recover Starred
            </button>
          </div>
        </div>
      )}
      
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