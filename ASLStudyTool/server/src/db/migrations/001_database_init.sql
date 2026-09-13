-- Enable uuid-ossp extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decks table (supports both system-wide global curriculum and user-created decks)
CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_url VARCHAR(255) NOT NULL,
  answer VARCHAR(255) NOT NULL,
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Starred cards table (per user)
CREATE TABLE IF NOT EXISTS starred_cards (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dominant_hand VARCHAR(10) DEFAULT 'right',
  sound_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test results table (gamified scoring history)
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deck_id VARCHAR(255) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  total_questions INT NOT NULL,
  correct_count INT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practice sessions table
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sign_attempted VARCHAR(255) NOT NULL,
  video_url TEXT,
  landmark_data JSONB,
  ai_score NUMERIC(5,2),
  ai_feedback TEXT,
  improvement_areas TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference landmark templates
CREATE TABLE IF NOT EXISTS sign_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sign_label VARCHAR(255) UNIQUE NOT NULL,
  landmark_sequence JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_is_global ON decks(is_global);
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_starred_cards_user_id ON starred_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_created_at ON practice_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);

-- Row Level Security (RLS) policies for Supabase
ALTER TABLE starred_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own starred cards') THEN
    CREATE POLICY "Users can manage their own starred cards" ON starred_cards
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own practice sessions') THEN
    CREATE POLICY "Users can manage their own practice sessions" ON practice_sessions
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own preferences') THEN
    CREATE POLICY "Users can manage their own preferences" ON user_preferences
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own test results') THEN
    CREATE POLICY "Users can view their own test results" ON test_results
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
