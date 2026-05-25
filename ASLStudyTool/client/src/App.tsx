import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './components/Home';
import Deck from './components/Deck';
import TestMode from './components/TestMode';
import Dashboard from './pages/Dashboard';
import Auth from './components/Auth';
import Footer from './components/Footer';
import './App.css';

const DeckWrapper = () => {
  const params = useParams<{ deckId: string }>();
  return <Deck deckId={params.deckId || ''} />;
};

const TestModeWrapper = () => {
  const params = useParams<{ deckId: string }>();
  return <TestMode deckId={params.deckId || ''} />;
};

// Component to wrap routing and guard against unauthenticated access
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="app-spinner"></div>
        <p>Loading ASL Study Tool...</p>
      </div>
    );
  }

  // Enforce authentication gate
  if (!user) {
    return <Auth />;
  }

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deck/:deckId" element={<DeckWrapper />} />
        <Route path="/test/all-decks" element={<TestMode deckId="all-decks" />} />
        <Route path="/test/:deckId" element={<TestModeWrapper />} />
        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
