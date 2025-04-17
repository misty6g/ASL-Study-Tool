import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // React app's default port
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve video files
const videosDir = path.join(__dirname, '../../Videos');
app.use('/videos', express.static(videosDir));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to clear existing data
const clearExistingData = async () => {
  try {
    // Delete all cards
    await supabase
      .from('cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete all decks
    await supabase
      .from('decks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete all users
    await supabase
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Existing data cleared successfully');
  } catch (error: any) {
    console.error('Error clearing existing data:', error.message);
  }
};

// Function to create sample data
const createSampleData = async () => {
  try {
    // Clear existing data first
    await clearExistingData();

    // Create a sample user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([
        { email: 'demo@example.com', password: 'demo123' }
      ])
      .select()
      .single();

    if (userError) throw userError;

    // Create a sample deck
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .insert([
        { title: 'ASL Conversation Vocabulary', user_id: user.id }
      ])
      .select()
      .single();

    if (deckError) throw deckError;

    // Read the vocabulary file
    const vocabularyFilePath = path.join(__dirname, '../../Videos/Beginning ASL 1/VocabularyRealtedtoConversation.txt');
    const fileContent = fs.readFileSync(vocabularyFilePath, 'utf-8');
    
    // Parse the file content
    const videoEntries = fileContent.split('\n')
      .filter(line => line.trim()) // Remove empty lines
      .map(line => {
        const [url, answer] = line.split(',').map(item => item.trim());
        return {
          video_url: url,
          answer: answer,
          deck_id: deck.id
        };
      });

    // Insert the cards with correct answers
    const { error: cardsError } = await supabase
      .from('cards')
      .insert(videoEntries);

    if (cardsError) throw cardsError;

    console.log('Sample data created successfully');
  } catch (error: any) {
    console.error('Error creating sample data:', error.message);
  }
};

// Initialize data when server starts
const initializeData = async () => {
  try {
    console.log('Clearing existing data and creating fresh sample data...');
    await createSampleData();
  } catch (error: any) {
    console.error('Error initializing data:', error.message);
  }
};

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    console.log('Fetching users...');
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
    
    console.log('Users found:', data);
    res.json(data);
  } catch (error: any) {
    console.error('Error in /api/users:', error);
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Get all decks for a user
app.get('/api/decks/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', req.params.userId);

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Get all cards in a deck
app.get('/api/cards/:deckId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', req.params.deckId);

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Serve a test video file for checking if videos are loading
app.get('/api/test-video', (req, res) => {
  res.json({ 
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' 
  });
});

// Search for cards by answer text
app.get('/api/search', async (req, res) => {
  try {
    console.log('Search API called with query:', req.query);
    const searchTerm = req.query.term?.toString().toLowerCase();
    
    if (!searchTerm) {
      console.log('No search term provided');
      return res.status(400).json({ error: 'Search term is required' });
    }
    
    console.log(`Searching for term: "${searchTerm}"`);

    // Step 1: Get all cards
    console.log('Fetching all cards...');
    const { data: allCards, error: cardsError } = await supabase
      .from('cards')
      .select('*');

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      throw cardsError;
    }
    
    console.log(`Retrieved ${allCards ? allCards.length : 0} cards`);
    if (allCards && allCards.length > 0) {
      console.log('Sample card:', allCards[0]);
    }

    // Step 2: Get all decks
    console.log('Fetching all decks...');
    const { data: allDecks, error: decksError } = await supabase
      .from('decks')
      .select('*');

    if (decksError) {
      console.error('Error fetching decks:', decksError);
      throw decksError;
    }
    
    console.log(`Retrieved ${allDecks ? allDecks.length : 0} decks`);
    if (allDecks && allDecks.length > 0) {
      console.log('Sample deck:', allDecks[0]);
    }

    // Step 3: Create a map of deck IDs to deck objects for quick lookup
    console.log('Creating decks map...');
    const decksMap: { [key: string]: any } = {};
    if (allDecks) {
      allDecks.forEach(deck => {
        decksMap[deck.id] = deck;
      });
    }
    console.log('Decks map created:', Object.keys(decksMap));

    // Step 4: Filter cards based on search term and combine with deck data
    console.log('Filtering cards and mapping to decks...');
    const filteredCards = allCards ? allCards.filter(card => 
      card.answer && card.answer.toLowerCase().includes(searchTerm)
    ) : [];
    
    console.log(`Found ${filteredCards.length} cards matching "${searchTerm}"`);
    
    const searchResults = filteredCards.map(card => {
      const deckInfo = decksMap[card.deck_id] || { id: card.deck_id, title: 'Unknown Deck' };
      console.log(`Card "${card.answer}" belongs to deck: ${deckInfo.title} (${card.deck_id})`);
      
      return {
        id: card.id,
        answer: card.answer,
        video_url: card.video_url,
        deck_id: card.deck_id,
        deck: deckInfo
      };
    });

    console.log(`Returning ${searchResults.length} search results`);
    if (searchResults.length > 0) {
      console.log('Sample result:', searchResults[0]);
    }
    
    res.json(searchResults);
  } catch (error: any) {
    console.error('Error in search API:', error);
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Simple test search endpoint with static data
app.get('/api/search-test', (req, res) => {
  try {
    console.log('Search test API called with query:', req.query);
    const searchTerm = req.query.term?.toString().toLowerCase() || '';
    
    // Static test data
    const testData = [
      { 
        id: '1', 
        answer: 'hello', 
        video_url: 'test.mp4', 
        deck_id: 'deck1',
        deck: { id: 'deck1', title: 'Greetings Deck' } 
      },
      { 
        id: '2', 
        answer: 'goodbye', 
        video_url: 'test2.mp4', 
        deck_id: 'deck1',
        deck: { id: 'deck1', title: 'Greetings Deck' } 
      },
      { 
        id: '3', 
        answer: 'thank you', 
        video_url: 'test3.mp4', 
        deck_id: 'deck2',
        deck: { id: 'deck2', title: 'Polite Phrases' } 
      }
    ];
    
    const results = searchTerm ? 
      testData.filter(item => item.answer.includes(searchTerm)) : 
      testData;
    
    console.log(`Test search for "${searchTerm}" found ${results.length} results`);
    res.json(results);
  } catch (error: any) {
    console.error('Error in test search:', error);
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Main function to start the server
const startServer = async () => {
  try {
    // Initialize data first
    await initializeData();
    console.log('Data initialized successfully.');

    // Then start the server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error: any) {
    console.error('Failed to start server:', error.message);
    process.exit(1); // Exit if server fails to start
  }
};

// Start the application
startServer(); 