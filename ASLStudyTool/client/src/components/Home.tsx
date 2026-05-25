import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
import './Home.css';

const LOCAL_STORAGE_STARRED_KEY = 'asl_study_tool_starred_cards';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  // Fetch starred cards
  useEffect(() => {
    if (!user) return;

    const fetchStarredCards = async () => {
      try {
        setLoadingStarred(true);
        // Load starred cards from our backend for the active user
        const response = await apiClient.get(`/api/users/${user.id}/starred-cards`);
        if (response.data && response.data.cards) {
          setStarredCards(response.data.cards);
          
          // Sync with localStorage backup
          const cardIds = response.data.cards.map((c: any) => c.id);
          localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(cardIds));
        }
      } catch (serverErr) {
        console.error('Error fetching starred cards from server, checking localStorage backup:', serverErr);
        
        // Fallback to localStorage if server is unreachable
        const localStarredStr = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
        if (localStarredStr) {
          try {
            const localStarredIds = JSON.parse(localStarredStr);
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
          }
        }
      } finally {
        setLoadingStarred(false);
      }
    };

    fetchStarredCards();
  }, [user]);

  // Fetch Decks
  useEffect(() => {
    if (!user) return;

    const fetchDecks = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<Deck[]>(`/api/decks/${user.id}`);
        if (response.data) {
          setDecks(response.data);
        }
      } catch (err: any) {
        console.error('Error fetching decks:', err);
        setError(err.response?.data?.error || 'Failed to load decks. Check server connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchDecks();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults({ cards: [], decks: [] });
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await apiClient.get('/api/search', {
        params: { term: searchTerm.trim() }
      });
      
      if (response.data) {
        setSearchResults({
          cards: Array.isArray(response.data.cards) ? response.data.cards : [],
          decks: Array.isArray(response.data.decks) ? response.data.decks : []
        });
      }
    } catch (err: any) {
      console.error('Error searching:', err);
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

  const viewStarredCards = () => {
    if (starredCards.length > 0) {
      navigate(`/deck/all-starred`, { 
        state: { 
          allStarred: true,
          starredCardIds: localStorage.getItem(LOCAL_STORAGE_STARRED_KEY)
        }
      });
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

  const hasStarredCards = starredCards.length > 0;
  const hasSearchResults = (searchResults.cards.length > 0) || (searchResults.decks.length > 0);

  return (
    <div className="home-container">
      {/* Navigation Header */}
      <header className="home-nav-header">
        <div className="nav-brand-logo">🤟 ASL Study</div>
        <div className="nav-user-controls">
          <button onClick={() => navigate('/dashboard')} className="nav-dashboard-btn">Dashboard</button>
          <button onClick={logout} className="nav-logout-btn">Logout</button>
        </div>
      </header>

      <h1 className="home-title">ASL Study Decks</h1>
      
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
        {hasStarredCards && (
          <div className="deck-link starred-deck-link" onClick={viewStarredCards}>
            <div className="deck-card starred-deck">
              <h2>Starred Cards ({starredCards.length})</h2>
            </div>
          </div>
        )}
        
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