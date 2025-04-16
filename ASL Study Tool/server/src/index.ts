import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

    // Create sample cards with actual video links
    const cards = [
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/hello.mp4',
        answer: 'Hello',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/good-morning.mp4',
        answer: 'Good Morning',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/good-afternoon.mp4',
        answer: 'Good Afternoon',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/good-evening.mp4',
        answer: 'Good Evening',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/good-night.mp4',
        answer: 'Good Night',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/how-are-you.mp4',
        answer: 'How Are You?',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/fine.mp4',
        answer: 'Fine',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/so-so.mp4',
        answer: 'So-So',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/tired.mp4',
        answer: 'Tired',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/good.mp4',
        answer: 'Good',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/bad.mp4',
        answer: 'Bad',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/happy.mp4',
        answer: 'Happy',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/sad.mp4',
        answer: 'Sad',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/angry.mp4',
        answer: 'Angry',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/excited.mp4',
        answer: 'Excited',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/scared.mp4',
        answer: 'Scared',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/surprised.mp4',
        answer: 'Surprised',
        deck_id: deck.id
      },
      {
        video_url: 'https://storage.googleapis.com/asl-study-tool/confused.mp4',
        answer: 'Confused',
        deck_id: deck.id
      }
    ];

    const { error: cardsError } = await supabase
      .from('cards')
      .insert(cards);

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

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 