import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

const LOCAL_STORAGE_STARRED_KEY = 'asl_study_tool_starred_cards';

type CategoryFilter = 'all' | 'decks' | 'practice' | 'starred';

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
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchResults, setSearchResults] = useState<{ cards: SearchResult[]; decks: Deck[] }>({
    cards: [],
    decks: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [starredCards, setStarredCards] = useState<SearchResult[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  // Helper to read starred cards from localStorage safely
  const readStarredFromLocalStorage = useCallback((): SearchResult[] => {
    const localStarredStr = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
    if (!localStarredStr) return [];
    try {
      const localStarredIds = JSON.parse(localStarredStr);
      if (Array.isArray(localStarredIds) && localStarredIds.length > 0) {
        return localStarredIds.map((id: string) => ({
          id: String(id),
          answer: 'Starred Card',
          video_url: '',
          deck_id: 'unknown',
          deck: { id: 'unknown', title: 'Unknown Deck' },
          type: 'card'
        }));
      }
      return [];
    } catch (e) {
      return [];
    }
  }, []);

  // Synchronize starred cards across API, localStorage, and events
  const syncStarredCards = useCallback(async () => {
    const demoUserId = 'demo-user-id';
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${demoUserId}/starred-cards`);
      if (response.data && Array.isArray(response.data.cards) && response.data.cards.length > 0) {
        setStarredCards(response.data.cards);
        return;
      }
    } catch (serverErr) {
      // Fallback to localStorage on server error
    }

    const localCards = readStarredFromLocalStorage();
    setStarredCards(localCards);
  }, [readStarredFromLocalStorage]);

  // Initial starred cards load and cross-tab storage / focus listeners
  useEffect(() => {
    let isMounted = true;

    const initStarred = async () => {
      await syncStarredCards();
      if (isMounted) {
        setLoadingStarred(false);
      }
    };
    initStarred();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_STARRED_KEY) {
        syncStarredCards();
      }
    };

    const handleFocus = () => {
      const localCards = readStarredFromLocalStorage();
      setStarredCards(prev => {
        if (prev.length !== localCards.length) {
          return localCards;
        }
        return prev;
      });
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncStarredCards, readStarredFromLocalStorage]);

  // Sync initial query and category from URL on mount
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const qParam = queryParams.get('q');
    const catParam = queryParams.get('category') as CategoryFilter | null;

    if (qParam) {
      setSearchTerm(qParam);
    }
    if (catParam && ['all', 'decks', 'practice', 'starred'].includes(catParam)) {
      setActiveCategory(catParam);
    }
  }, [location.search]);

  // Safe URL update helper using replaceState
  const updateUrlParams = (newTerm: string, newCat: CategoryFilter) => {
    const params = new URLSearchParams();
    if (newTerm.trim()) params.set('q', newTerm.trim());
    if (newCat !== 'all') params.set('category', newCat);
    const searchStr = params.toString() ? `?${params.toString()}` : '';
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', `${window.location.pathname}${searchStr}`);
    }
  };

  // Fetch decks for user
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        let demoUserId = 'demo-user-id';
        try {
          const usersResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`);
          if (Array.isArray(usersResponse.data) && usersResponse.data.length > 0) {
            const found = usersResponse.data.find((user: User) => user.email === 'demo@example.com');
            if (found) {
              demoUserId = found.id;
            } else {
              demoUserId = usersResponse.data[0].id;
            }
          }
        } catch (uErr) {
          // Use default demo user id
        }

        const decksResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/decks/${demoUserId}`);
        if (!decksResponse.data) {
          throw new Error('No decks data received');
        }

        setDecks(decksResponse.data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load decks');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Server-side search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) {
      setSearchResults({ cards: [], decks: [] });
      return;
    }

    setIsSearching(true);

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/search`, {
        params: { term: searchTerm.trim() }
      });

      if (Array.isArray(response.data)) {
        setSearchResults({
          cards: response.data,
          decks: []
        });
      } else if (response.data && typeof response.data === 'object') {
        setSearchResults({
          cards: Array.isArray(response.data.cards) ? response.data.cards : [],
          decks: Array.isArray(response.data.decks) ? response.data.decks : []
        });
      } else {
        setSearchResults({ cards: [], decks: [] });
      }
    } catch (err: any) {
      setSearchResults({ cards: [], decks: [] });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCardResultClick = (deckId: string, cardId: string) => {
    navigate(`/deck/${deckId}`, { state: { fromSearch: true, highlightCardId: cardId } });
  };

  const handleDeckResultClick = (deckId: string) => {
    navigate(`/deck/${deckId}`);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults({ cards: [], decks: [] });
    updateUrlParams('', activeCategory);
  };

  const handleCategoryClick = (category: CategoryFilter) => {
    setActiveCategory(category);
    updateUrlParams(searchTerm, category);
  };

  const hasStarredCards = starredCards.length > 0;

  // Real-time client-side filtered decks based on search term and category
  const displayedDecks = useMemo(() => {
    if (activeCategory === 'practice' || activeCategory === 'starred') {
      return [];
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return decks;
    return decks.filter(deck => deck.title.toLowerCase().includes(term));
  }, [decks, searchTerm, activeCategory]);

  // Visibility flags for feature cards in the grid
  const showFingerspellingCard =
    (activeCategory === 'all' || activeCategory === 'practice') &&
    (!searchTerm.trim() ||
      'fingerspelling'.includes(searchTerm.toLowerCase().trim()) ||
      'practice'.includes(searchTerm.toLowerCase().trim()) ||
      'asl.ms'.includes(searchTerm.toLowerCase().trim()));

  const showStarredCard =
    hasStarredCards &&
    (activeCategory === 'all' || activeCategory === 'starred') &&
    (!searchTerm.trim() || 'starred cards'.includes(searchTerm.toLowerCase().trim()));

  // Navigate to virtual starred deck view
  const viewStarredCards = () => {
    if (starredCards.length > 0) {
      navigate('/deck/all-starred', {
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

  const hasSearchResults =
    searchResults?.cards?.length > 0 || searchResults?.decks?.length > 0;

  return (
    <div className="home-container">
      {/* Feature 11: Calibrated Home Hero Banner */}
      <header className="home-hero">
        <div className="home-hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true"></span>
          INTERACTIVE ASL PLATFORM
        </div>
        <h1 className="home-title home-hero-title">ASL Study Decks</h1>
        <p className="home-hero-subtext">
          Master American Sign Language vocabulary with video flashcards, real-time testing, and interactive letter drills.
        </p>
        <div className="home-hero-actions">
          <a
            href="#deck-grid-section"
            className="tactile-btn tactile-btn-primary"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('deck-grid-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Explore Decks
          </a>
          <Link
            to="/fingerspelling"
            className="tactile-btn tactile-btn-secondary"
            aria-label="Fingerspelling Trainer"
          >
            <span>Finger</span><span>spelling</span> Trainer
          </Link>
          <Link
            to="/"
            className="tactile-btn tactile-btn-secondary"
            aria-label="Welcome Hub"
          >
            <span>Interactive Sign Hub</span>
          </Link>
        </div>
      </header>

      {/* Feature 12: Real-Time Search & Category Filters */}
      <section className="search-container" aria-label="Search and filter study decks">
        <form onSubmit={handleSearch} className="search-form" role="search">
          <div className="search-input-wrapper">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                updateUrlParams(val, activeCategory);
                if (!val.trim()) {
                  setSearchResults({ cards: [], decks: [] });
                }
              }}
              placeholder="Search for signs or decks..."
              className="search-input"
              aria-label="Search for signs or decks"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                }}
                className="search-clear-inline-btn"
                aria-label="Clear"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="search-button tactile-btn tactile-btn-primary">
            Search
          </button>
        </form>

        {/* Category Filter Pills */}
        <div className="category-filters" role="tablist" aria-label="Filter decks by category">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryClick('all')}
          >
            All Items
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'decks'}
            className={`category-pill ${activeCategory === 'decks' ? 'active' : ''}`}
            onClick={() => handleCategoryClick('decks')}
          >
            Study Decks ({decks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-label="Fingerspelling"
            aria-selected={activeCategory === 'practice'}
            className={`category-pill ${activeCategory === 'practice' ? 'active' : ''}`}
            onClick={() => handleCategoryClick('practice')}
          >
            <span>Finger</span><span>spelling</span>
          </button>
          {hasStarredCards && (
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'starred'}
              className={`category-pill category-pill-starred ${activeCategory === 'starred' ? 'active' : ''}`}
              onClick={() => handleCategoryClick('starred')}
            >
              ★ Starred ({starredCards.length})
            </button>
          )}
        </div>

        {isSearching && (
          <div className="search-loading" role="status">
            <div className="loading-spinner-small" aria-hidden="true"></div>
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
      </section>

      {/* Feature 15: Responsive Deck Grid */}
      <main id="deck-grid-section" className="deck-grid" aria-label="Available ASL Study Decks">
        {/* Feature 14: Fingerspelling Quick-Launch Card */}
        {showFingerspellingCard && (
          <Link
            to="/fingerspelling"
            className="deck-link fingerspelling-deck-link"
            aria-label="Fingerspelling, asl.ms Practice"
          >
            <div className="deck-card fingerspelling-deck tactile-card">
              <div className="fingerspelling-deck-content">
                <div className="deck-card-top-row">
                  <span className="deck-card-glyph fingerspelling-glyph" aria-hidden="true">🤟</span>
                  <span className="fingerspelling-deck-badge">asl.ms Practice</span>
                </div>
                <h2>🤟 Fingerspelling</h2>
                <p className="deck-card-subtext">Interactive speed trainer with Lifeprint vocabulary</p>
              </div>
            </div>
          </Link>
        )}

        {/* Feature 13: Starred Cards Quick Access Card */}
        {showStarredCard && (
          <Link
            to="/deck/all-starred"
            state={{
              allStarred: true,
              starredCardIds: localStorage.getItem(LOCAL_STORAGE_STARRED_KEY)
            }}
            className="deck-link starred-deck-link"
            aria-label={`Starred Cards (${starredCards.length})`}
          >
            <div
              className="deck-card starred-deck tactile-card"
              onClick={viewStarredCards}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  viewStarredCards();
                }
              }}
            >
              <div className="starred-deck-content">
                <div className="deck-card-top-row">
                  <span className="deck-card-glyph star-glyph" aria-hidden="true">★</span>
                  <span className="starred-deck-badge">★ Practice Review</span>
                </div>
                <h2>Starred Cards ({starredCards.length})</h2>
                <p className="deck-card-subtext">Personal focus collection across all decks</p>
              </div>
            </div>
          </Link>
        )}

        {/* Standard Decks */}
        {(activeCategory === 'all' || activeCategory === 'decks') &&
          displayedDecks.map(deck => (
            <Link key={deck.id} to={`/deck/${deck.id}`} className="deck-link">
              <div className="deck-card standard-deck tactile-card">
                <div className="deck-card-header">
                  <h2>{deck.title}</h2>
                  <span className="deck-card-badge">Study Deck</span>
                </div>
                <p className="deck-card-subtext">Interactive video flashcards & testing</p>
              </div>
            </Link>
          ))}
      </main>
    </div>
  );
};

export default Home;