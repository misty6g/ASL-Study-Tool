import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();
//test
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
    // Delete data from tables in reverse order of dependencies
    try {
      await supabase.from('starred_cards').delete().neq('id', 0);
    } catch (error) {
      console.log('No starred_cards table to clear or error clearing:', error);
    }
    
    await supabase.from('cards').delete().neq('id', 0);
    await supabase.from('decks').delete().neq('id', 0);
    await supabase.from('users').delete().neq('id', 0);
    
    // Create tables if they don't exist
    const createStarredCardsTable = async () => {
      try {
        // Try creating the table directly with a SQL query
        const { error: sqlError } = await supabase.rpc('exec_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS starred_cards (
              id SERIAL PRIMARY KEY,
              user_id TEXT NOT NULL,
              card_id TEXT NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              UNIQUE(user_id, card_id)
            );
          `
        });
        
        if (sqlError) {
          console.error('Error creating starred_cards table via SQL:', sqlError);
        } else {
          console.log('Successfully created or verified starred_cards table');
        }
      } catch (error) {
        console.error('Error in createStarredCardsTable:', error);
      }
    };
    
    await createStarredCardsTable();
    
    console.log('Existing data cleared.');
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

    // List of vocabulary files to process
    const vocabFiles = [
      { filename: 'VocabularyRelatedToConversation.txt', title: 'ASL Conversation Vocabulary' },
      { filename: 'VocabularyRelatedToLocations.txt', title: 'ASL Location Vocabulary' },
      { filename: 'VocabularyRelatedToClass.txt', title: 'ASL Class Vocabulary' },
      { filename: 'PronounsWithNumeralIncorporation.txt', title: 'ASL Pronouns With Numeral Incorporation' },
      { filename: 'VocabularyRelatedToNegatingVerbs.txt', title: 'ASL Negating Verbs' },
      { filename: 'VocabularyRelatingToDeafCulture.txt', title: 'ASL Deaf Culture Vocabulary' },
      { filename: 'WH-Questions.txt', title: 'ASL WH-Questions' },
      { filename: 'VocabularyRelatedToPronouns.txt', title: 'ASL Pronouns' },
      { filename: 'VocabularyRelatingToMajors.txt', title: 'ASL Majors Vocabulary' }
    ];

    // Process each vocabulary file
    for (const vocabFile of vocabFiles) {
      try {
        // Create a deck for this vocabulary file
        const { data: deck, error: deckError } = await supabase
          .from('decks')
          .insert([
            { title: vocabFile.title, user_id: user.id }
          ])
          .select()
          .single();

        if (deckError) {
          console.error(`Error creating deck for ${vocabFile.filename}:`, deckError.message);
          continue;
        }

        // Read the vocabulary file
        const vocabularyFilePath = path.join(__dirname, `../../Videos/Beginning ASL 1/${vocabFile.filename}`);
        
        try {
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
          if (videoEntries.length > 0) {
            const { error: cardsError } = await supabase
              .from('cards')
              .insert(videoEntries);

            if (cardsError) {
              console.error(`Error inserting cards for ${vocabFile.filename}:`, cardsError.message);
            } else {
              console.log(`Successfully added ${videoEntries.length} cards to deck "${vocabFile.title}"`);
            }
          } else {
            console.log(`No entries found in ${vocabFile.filename}`);
          }
        } catch (fileError: any) {
          console.error(`Error reading ${vocabFile.filename}:`, fileError.message);
        }
      } catch (deckError: any) {
        console.error(`Error processing ${vocabFile.filename}:`, deckError.message);
      }
    }

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

    // Search for matching cards
    const { data: matchingCards, error: cardsError } = await supabase
      .from('cards')
      .select('*, deck_id')
      .ilike('answer', `%${searchTerm}%`);

    if (cardsError) {
      console.error('Error searching cards:', cardsError);
      throw cardsError;
    }
    
    console.log(`Found ${matchingCards ? matchingCards.length : 0} matching cards`);

    // Search for matching decks by title
    const { data: matchingDecks, error: decksSearchError } = await supabase
      .from('decks')
      .select('*')
      .ilike('title', `%${searchTerm}%`);

    if (decksSearchError) {
      console.error('Error searching decks:', decksSearchError);
      throw decksSearchError;
    }

    console.log(`Found ${matchingDecks ? matchingDecks.length : 0} matching decks`);

    // If no matching cards or decks, return empty array
    if ((!matchingCards || matchingCards.length === 0) && (!matchingDecks || matchingDecks.length === 0)) {
      return res.json({ cards: [], decks: [] });
    }

    // Get unique deck IDs from the matching cards
    const deckIds = [...new Set(matchingCards.map(card => card.deck_id))];
    
    // Fetch only the decks we need for cards that match
    let relevantDecks = [];
    if (deckIds.length > 0) {
      const { data: cardDecks, error: decksError } = await supabase
        .from('decks')
        .select('*')
        .in('id', deckIds);

      if (decksError) {
        console.error('Error fetching relevant decks:', decksError);
        throw decksError;
      }
      
      relevantDecks = cardDecks || [];
    }
    
    // Create map of deck IDs to deck objects
    const decksMap: { [key: string]: any } = {};
    if (relevantDecks) {
      relevantDecks.forEach(deck => {
        decksMap[deck.id] = deck;
      });
    }
    
    // Map cards to include deck info
    const cardResults = matchingCards.map(card => {
      const deckInfo = decksMap[card.deck_id] || { id: card.deck_id, title: 'Unknown Deck' };
      return {
        id: card.id,
        answer: card.answer,
        video_url: card.video_url,
        deck_id: card.deck_id,
        deck: deckInfo,
        type: 'card'
      };
    });
    
    // Map decks to search results format
    const deckResults = matchingDecks ? matchingDecks.map(deck => ({
      id: deck.id,
      title: deck.title,
      user_id: deck.user_id,
      type: 'deck'
    })) : [];
    
    console.log(`Returning ${cardResults.length} card results and ${deckResults.length} deck results`);
    res.json({ cards: cardResults, decks: deckResults });
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

// Star a card
app.post('/api/cards/:cardId/star', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { userId } = req.body;
    
    console.log(`Starring card ${cardId} for user ${userId}`);
    
    // Check if the starring already exists to avoid duplicates
    const { data: existingStars, error: checkError } = await supabase
      .from('starred_cards')
      .select('*')
      .eq('card_id', cardId)
      .eq('user_id', userId);
      
    if (checkError) {
      console.error('Error checking for existing star:', checkError);
      throw checkError;
    }
    
    // If not already starred, add it
    if (!existingStars || existingStars.length === 0) {
      const { data, error } = await supabase
        .from('starred_cards')
        .insert([
          { card_id: cardId, user_id: userId }
        ]);
        
      if (error) {
        console.error('Error starring card:', error);
        throw error;
      }
      
      return res.status(201).json({ message: 'Card starred successfully' });
    }
    
    // Already starred
    return res.status(200).json({ message: 'Card was already starred' });
  } catch (error: any) {
    console.error('Error in star card API:', error);
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Unstar a card
app.delete('/api/cards/:cardId/star', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { userId } = req.body;
    
    console.log(`Unstarring card ${cardId} for user ${userId}`);
    
    const { error } = await supabase
      .from('starred_cards')
      .delete()
      .eq('card_id', cardId)
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error unstarring card:', error);
      throw error;
    }
    
    return res.status(200).json({ message: 'Card unstarred successfully' });
  } catch (error: any) {
    console.error('Error in unstar card API:', error);
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Get all starred cards for a user
app.get('/api/users/:userId/starred-cards', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`Getting starred cards for user ${userId}`);
    
    // First get the starred card IDs
    const { data: starredRelations, error: starError } = await supabase
      .from('starred_cards')
      .select('card_id')
      .eq('user_id', userId);
      
    if (starError) {
      console.error('Error fetching starred relations:', starError);
      throw starError;
    }
    
    if (!starredRelations || starredRelations.length === 0) {
      return res.json({ cards: [] });
    }
    
    // Extract the card IDs
    const cardIds = starredRelations.map(item => item.card_id);
    
    // Get the actual card data
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .in('id', cardIds);
      
    if (cardsError) {
      console.error('Error fetching starred cards:', cardsError);
      throw cardsError;
    }
    
    // Get the relevant decks for these cards
    const deckIds = [...new Set(cards.map(card => card.deck_id))];
    
    const { data: decks, error: decksError } = await supabase
      .from('decks')
      .select('*')
      .in('id', deckIds);
      
    if (decksError) {
      console.error('Error fetching decks for starred cards:', decksError);
      throw decksError;
    }
    
    // Create a map of deck IDs to deck objects
    const decksMap: { [key: string]: any } = {};
    if (decks) {
      decks.forEach(deck => {
        decksMap[deck.id] = deck;
      });
    }
    
    // Add deck info to each card
    const cardsWithDecks = cards.map(card => {
      const deckInfo = decksMap[card.deck_id] || { id: card.deck_id, title: 'Unknown Deck' };
      return {
        ...card,
        deck: deckInfo
      };
    });
    
    res.json({ cards: cardsWithDecks });
  } catch (error: any) {
    console.error('Error in get starred cards API:', error);
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Get all starred card IDs for a user (lighter-weight endpoint)
app.get('/api/users/:userId/starred-card-ids', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`Getting starred card IDs for user ${userId}`);
    
    const { data: starredRelations, error } = await supabase
      .from('starred_cards')
      .select('card_id')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error fetching starred card IDs:', error);
      throw error;
    }
    
    const cardIds = starredRelations.map(item => item.card_id);
    
    res.json({ cardIds });
  } catch (error: any) {
    console.error('Error in get starred card IDs API:', error);
    res.status(500).json({ error: error?.message || 'An error occurred' });
  }
});

// Main function to start the server
const startServer = async () => {
  try {
    // Create database tables first
    console.log('Creating and initializing database tables...');
    await clearExistingData();
    
    // Then initialize sample data
    console.log('Loading sample data...');
    await createSampleData();
    console.log('Data initialized successfully.');

    // Then start the server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('API is ready to accept requests');
    });
  } catch (error: any) {
    console.error('Failed to start server:', error.message);
    process.exit(1); // Exit if server fails to start
  }
};

// Start the application
startServer(); 