import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Welcome from './components/Welcome';
import Deck from './components/Deck';
import TestMode from './components/TestMode';
import FingerspellingPractice from './components/FingerspellingPractice';
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
        <Navigation />
        <main id="main-content" className="app-main-content">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/home" element={<Home />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/deck/:deckId" element={<DeckWrapper />} />
            <Route path="/test/all-decks" element={<TestMode deckId="all-decks" />} />
            <Route path="/test/:deckId" element={<TestModeWrapper />} />
            <Route path="/fingerspelling" element={<FingerspellingPractice />} />
            <Route path="/asl-ms" element={<FingerspellingPractice />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
