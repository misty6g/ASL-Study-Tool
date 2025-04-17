import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

// Additional styles for search results
const searchResultsStyles = `
  .search-results-container {
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    max-height: 80vh;
    overflow-y: auto;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    margin: 0 16px;
    display: none;
  }

  .search-results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
  }

  .search-results-header h3 {
    margin: 0;
    font-size: 16px;
  }

  .clear-search-btn {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 14px;
  }

  .results-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .result-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    justify-content: space-between;
  }

  .result-item:hover {
    background-color: #f5f5f5;
  }

  .result-sign {
    font-weight: 500;
  }

  .result-deck {
    color: #666;
    font-size: 14px;
  }
`;

interface Deck {
  id: string;
  title: string;
  user_id: string;
}

interface User {
  id: string;
  email: string;
}

interface Card {
  id: string;
  answer: string;
  video_url: string;
  deck_id: string;
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
}

const Home: React.FC = () => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

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
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    try {
      // Use the server-side search API
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/search`, {
        params: { term: searchTerm.trim() }
      });
      
      console.log('Search API response:', response.data);
      setSearchResults(response.data);
    } catch (err: any) {
      console.error('Error searching:', err);
      // Show an empty result set on error
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (deckId: string, cardId: string) => {
    navigate(`/deck/${deckId}`, { state: { fromSearch: true, highlightCardId: cardId }});
    setSearchResults([]);
    setSearchTerm('');
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };

  if (loading) {
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

  return (
    <div className="home-container">
      <style>{searchResultsStyles}</style>
      <h1 className="home-title">ASL Study Decks</h1>
      
      <div className="search-container">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value.trim()) {
                setSearchResults([]);
              }
            }}
            placeholder="Search for a sign..."
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
        
        {searchResults.length > 0 && (
          <div className="search-results">
            <div className="search-results-header">
              <h3>Search Results</h3>
              <button onClick={clearSearch} className="clear-search-btn">Clear</button>
            </div>
            <ul className="results-list">
              {searchResults.map(result => (
                <li key={result.id} className="result-item" onClick={() => handleResultClick(result.deck.id, result.id)}>
                  <span className="result-sign">{result.answer}</span>
                  <span className="result-deck">{result.deck.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {searchResults.length === 0 && searchTerm.trim() && !isSearching && (
          <div className="no-results">
            <p>No signs found matching "{searchTerm}"</p>
          </div>
        )}
      </div>
      
      <div className="deck-grid">
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