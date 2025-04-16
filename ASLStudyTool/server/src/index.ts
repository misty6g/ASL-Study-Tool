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

// Initialize data when server starts
initializeData();

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

// Start the server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 