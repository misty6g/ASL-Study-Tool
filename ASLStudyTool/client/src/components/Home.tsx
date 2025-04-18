import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

// Define the constant here since the import is not working
const LOCAL_STORAGE_STARRED_KEY = 'asl_study_tool_starred_cards';

// Removing the conflicting inline styles entirely - using only the CSS file styles

interface User {
  id: string;
  email: string;
}

interface Deck {
  id: string;
  title: string;
  user_id: string;
  type?: string;
}

interface SearchResult {
  id: string;
  answer: string;
  video_url: string;
  deck_id: string;
  deck: {
    id: string;
    title: string;
  };
  type: string;
}

const Home: React.FC = () => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ cards: SearchResult[], decks: Deck[] }>({
    cards: [],
    decks: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [starredCards, setStarredCards] = useState<SearchResult[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(true);
  
  const navigate = useNavigate();

  // Fetch starred cards
  useEffect(() => {
    const fetchStarredCards = async () => {
      try {
        // In a real app, you'd get the actual user ID from auth
        const demoUserId = "demo-user-id"; // Hardcoded for demo
        
        // Try server first
        try {
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${demoUserId}/starred-cards`);
          if (response.data && response.data.cards && response.data.cards.length > 0) {
            console.log(`Loaded ${response.data.cards.length} starred cards from server`);
            setStarredCards(response.data.cards);
          } else {
            // If server returns no data, try localStorage
            console.log('No starred cards from server, checking localStorage');
            const localStarredStr = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
            if (localStarredStr) {
              try {
                const localStarredIds = JSON.parse(localStarredStr);
                console.log(`Found ${localStarredIds.length} starred card IDs in localStorage`);
                
                // We need to convert IDs to card objects, so fetch all cards from all decks
                if (localStarredIds.length > 0) {
                  // Create placeholder cards with just IDs for now (better than nothing)
                  const placeholderStarredCards = localStarredIds.map((id: string) => ({
                    id,
                    answer: "Starred Card",
                    video_url: "",
                    deck_id: "unknown",
                    deck: { id: "unknown", title: "Unknown Deck" },
                    type: "card"
                  }));
                  setStarredCards(placeholderStarredCards);
                  console.log(`Created ${placeholderStarredCards.length} placeholder cards for starred IDs`);
                }
              } catch (e) {
                console.error('Error parsing localStorage starred cards:', e);
                setStarredCards([]);
              }
            } else {
              console.log('No starred cards in localStorage either');
              setStarredCards([]);
            }
          }
        } catch (serverErr) {
          console.error('Error fetching starred cards from server:', serverErr);
          
          // If server fails, try localStorage
          const localStarredStr = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
          if (localStarredStr) {
            try {
              const localStarredIds = JSON.parse(localStarredStr);
              console.log(`Found ${localStarredIds.length} starred card IDs in localStorage`);
              
              // Create placeholder cards from IDs
              if (localStarredIds.length > 0) {
                const placeholderStarredCards = localStarredIds.map((id: string) => ({
                  id,
                  answer: "Starred Card",
                  video_url: "",
                  deck_id: "unknown",
                  deck: { id: "unknown", title: "Unknown Deck" },
                  type: "card"
                }));
                setStarredCards(placeholderStarredCards);
              }
            } catch (e) {
              console.error('Error parsing localStorage starred cards:', e);
              setStarredCards([]);
            }
          } else {
            setStarredCards([]);
          }
        }
      } catch (err) {
        console.error('Error in starred cards logic:', err);
        setStarredCards([]);
      } finally {
        setLoadingStarred(false);
      }
    };

    fetchStarredCards();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('Starting data fetch...');
        // First, get the demo user
        const usersResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`);
        
        console.log('Users API response:', usersResponse.data);
        
        if (!usersResponse.data || usersResponse.data.length === 0) {
          throw new Error('No users found');
        }
        
        const demoUser = usersResponse.data.find((user: User) => user.email === 'demo@example.com');
        console.log('Found demo user:', demoUser);
        
        if (!demoUser) {
          throw new Error('Demo user not found');
        }

        // Then fetch decks for that user
        console.log('Fetching decks for user:', demoUser.id);
        const decksResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/decks/${demoUser.id}`);
        
        console.log('Decks API response:', decksResponse.data);
        
        if (!decksResponse.data) {
          throw new Error('No decks data received');
        }
        
        const fetchedDecks = decksResponse.data;
        setDecks(fetchedDecks);
        console.log(`Fetched ${fetchedDecks.length} decks`);
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load decks');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Search triggered with term:', searchTerm);
    
    if (!searchTerm.trim()) {
      console.log('Empty search term, clearing results');
      setSearchResults({ cards: [], decks: [] });
      return;
    }
    
    setIsSearching(true);
    
    try {
      // Use the server-side search API
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/search`, {
        params: { term: searchTerm.trim() }
      });
      
      console.log('Search API response:', response.data);
      
      // Handle the case when API returns an array instead of {cards, decks} object
      if (Array.isArray(response.data)) {
        // If the response is an array, assume it's an array of cards
        setSearchResults({ 
          cards: response.data, 
          decks: [] 
        });
      } else if (response.data && typeof response.data === 'object') {
        // Ensure cards and decks properties exist
        const formattedResults = {
          cards: Array.isArray(response.data.cards) ? response.data.cards : [],
          decks: Array.isArray(response.data.decks) ? response.data.decks : []
        };
        setSearchResults(formattedResults);
      } else {
        // Fallback if response has unexpected format
        setSearchResults({ cards: [], decks: [] });
      }
    } catch (err: any) {
      console.error('Error searching:', err);
      // Show an empty result set on error
      setSearchResults({ cards: [], decks: [] });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCardResultClick = (deckId: string, cardId: string) => {
    navigate(`/deck/${deckId}`, { state: { fromSearch: true, highlightCardId: cardId }});
  };
  
  const handleDeckResultClick = (deckId: string) => {
    navigate(`/deck/${deckId}`);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults({ cards: [], decks: [] });
  };

  const hasStarredCards = starredCards.length > 0;
  console.log('Has starred cards:', hasStarredCards, 'Count:', starredCards.length);

  // Handler for when a starred card is clicked
  const handleStarredCardClick = (cardId: string, deckId: string) => {
    navigate(`/deck/${deckId}`, { state: { fromSearch: true, highlightCardId: cardId }});
  };

  // Create a virtual starred deck
  const viewStarredCards = () => {
    if (starredCards.length > 0) {
      // Instead of using a test view, send to the deck component with a special flag
      console.log("Viewing all starred cards in deck view");
      navigate(`/deck/all-starred`, { 
        state: { 
          allStarred: true,
          starredCardIds: localStorage.getItem(LOCAL_STORAGE_STARRED_KEY)
        }
      });
    }
  };
  
  // Test all starred cards across all decks
  const testAllStarredCards = () => {
    if (starredCards.length > 0) {
      // Navigate to test mode with a special flag indicating we want to test all starred cards
      navigate(`/test/all-decks`, { state: { starredOnly: true, allDecks: true }});
    }
  };

  if (loading && loadingStarred) {
    return (
      <div className="home-container loading">
        <div className="loading-spinner"></div>
        <p>Loading decks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-container error">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  const hasSearchResults = 
    (searchResults?.cards?.length > 0) || 
    (searchResults?.decks?.length > 0);

  return (
    <div className="home-container">
      <h1 className="home-title">ASL Study Decks</h1>
      
      {/* Debug section - hidden in production */}
      {false && (
        <div style={{ 
          background: '#333', 
          padding: '10px', 
          borderRadius: '5px', 
          margin: '0 0 20px 0',
          fontSize: '12px'
        }}>
          <p>Starred Cards: {starredCards.length}</p>
          <p>hasStarredCards: {hasStarredCards ? 'true' : 'false'}</p>
          <p>Loading: {loading ? 'true' : 'false'}, Loading Starred: {loadingStarred ? 'true' : 'false'}</p>
          <button onClick={() => {
            // Check localStorage
            const local = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
            console.log('localStorage starred cards:', local);
            alert('localStorage starred cards: ' + (local || 'none'));
          }}>Check Local Storage</button>
        </div>
      )}
      
      <div className="search-container">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value.trim()) {
                setSearchResults({ cards: [], decks: [] });
              }
            }}
            placeholder="Search for signs or decks..."
            className="search-input"
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>
        
        {isSearching && (
          <div className="search-loading">
            <div className="loading-spinner-small"></div>
            <p>Searching...</p>
          </div>
        )}
        
        {hasSearchResults && (
          <div className="search-results-container">
            <div className="search-results-header">
              <h3>Search Results</h3>
              <button onClick={clearSearch} className="clear-search-btn">Clear</button>
            </div>
            
            {searchResults.decks.length > 0 && (
              <div className="search-section">
                <h4 className="search-section-title">Decks</h4>
                <ul className="results-list">
                  {searchResults.decks.map(deck => (
                    <li key={deck.id} className="result-item" onClick={() => handleDeckResultClick(deck.id)}>
                      <span className="result-sign">{deck.title}</span>
                      <span className="result-deck">Deck</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {searchResults.cards.length > 0 && (
              <div className="search-section">
                <h4 className="search-section-title">Signs</h4>
                <ul className="results-list">
                  {searchResults.cards.map(result => (
                    <li key={result.id} className="result-item" onClick={() => handleCardResultClick(result.deck.id, result.id)}>
                      <span className="result-sign">{result.answer}</span>
                      <span className="result-deck">{result.deck.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {!hasSearchResults && searchTerm.trim() && !isSearching && (
          <div className="no-results">
            <p>No results found matching "{searchTerm}"</p>
          </div>
        )}
      </div>
      
      <div className="deck-grid">
        {/* Starred Cards "Deck" - only show if there are starred cards */}
        {hasStarredCards && (
          <div className="deck-link starred-deck-link">
            <div className="deck-card starred-deck" onClick={viewStarredCards}>
              <h2>Starred Cards ({starredCards.length})</h2>
            </div>
          </div>
        )}
        
        {/* Regular decks */}
        {decks.map(deck => (
          <Link 
            key={deck.id}
            to={`/deck/${deck.id}`}
            className="deck-link"
          >
            <div className="deck-card">
              <h2>{deck.title}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;