# ASL Study Tool

A flashcard application for learning American Sign Language (ASL) using video-based cards.

## Features

- Video-based flashcards for ASL learning
- Multiple study decks
- Flip cards to reveal answers
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Supabase account (free tier)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd asl-study-tool
```

2. Install dependencies:
```bash
# Install frontend dependencies
cd client
npm install

# Install backend dependencies
cd ../server
npm install
```

3. Set up environment variables:

Backend (.env file in server directory):
```
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

Frontend (.env file in client directory):
```
REACT_APP_API_URL=http://localhost:5000
```

4. Set up the database:
- Create a new project in Supabase
- Run the following SQL in the Supabase SQL editor:

```sql
-- Users table
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  password text
);

-- Decks table
create table decks (
  id uuid primary key default uuid_generate_v4(),
  title text,
  user_id uuid references users(id)
);

-- Cards table
create table cards (
  id uuid primary key default uuid_generate_v4(),
  video_url text,
  answer text,
  deck_id uuid references decks(id)
);
```

## Running the Application

1. Start the backend server:
```bash
cd server
npm run dev
```

2. Start the frontend development server:
```bash
cd client
npm start
```

The application will be available at http://localhost:3000

## Development

- Frontend: React with TypeScript
- Backend: Node.js/Express with TypeScript
- Database: Supabase (PostgreSQL)
- Video Storage: Google Drive (public links)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 