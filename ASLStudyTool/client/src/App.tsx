import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import Home from './components/Home';
import Deck from './components/Deck';
import TestMode from './components/TestMode';
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

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deck/:deckId" element={<DeckWrapper />} />
          <Route path="/test/:deckId" element={<TestModeWrapper />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
