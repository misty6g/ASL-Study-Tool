import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import axios from 'axios';
import { pool, initDatabase } from './db';

// Load environment variables
dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Environment Variable Validation Schema
const envSchema = z.object({
  PORT: z.string().transform(Number).default('8888'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_SERVICE_SECRET: z.string().min(4),
  CORS_ORIGIN: z.string().default('http://localhost:3000')
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  logger.error("❌ Invalid environment variables configuration:", parsedEnv.error.format());
  process.exit(1);
}
const env = parsedEnv.data;

const app = express();

// Enable Helmet with custom Content Security Policy (CSP)
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'", env.AI_SERVICE_URL]
  }
}));

// Set up cookies and request limits
app.use(cookieParser());
app.use(express.json({ limit: '10kb' })); // JSON payload capped at 10kb

// CORS configuration - White list localhost & Vercel production origin
const whitelist = [env.CORS_ORIGIN, 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // Limit each IP to 15 requests for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

// Multer upload config for files (capped at 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file MIME type. Only mp4, webm and mov files are accepted.'));
    }
  }
});

// JSDoc: Type extensions for request context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

// ----------------------------------------------------
// Authentication Middleware
// ----------------------------------------------------
const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken;

  if (!token) {
    logger.warn('Access token missing in request cookies');
    return res.status(401).json({ error: 'Access token is required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err: any) {
    logger.warn('Access token verification failed', { error: err.message });
    return res.status(401).json({ error: 'Access token expired or invalid.' });
  }
};

// ----------------------------------------------------
// Input Validation Helper
// ----------------------------------------------------
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ----------------------------------------------------
// Seeding & Setup Logic
// ----------------------------------------------------
const seedData = async () => {
  const client = await pool.connect();
  try {
    // Check if we have decks
    const { rows: decksCount } = await client.query('SELECT COUNT(*) FROM decks');
    if (Number(decksCount[0].count) > 0) {
      logger.info('Database already has decks. Skipping seeding.');
      return;
    }

    logger.info('Database is empty. Seeding initial decks, cards, and templates...');

    // 1. Create default demo user
    const demoEmail = 'demo@example.com';
    const demoPasswordHash = await bcrypt.hash('demo123', 10);
    const { rows: userRows } = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $2 RETURNING id',
      [demoEmail, demoPasswordHash]
    );
    const demoUser = userRows[0];

    // 2. Seeding vocabulary lists
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

    for (const vocabFile of vocabFiles) {
      const vocabularyFilePath = path.join(__dirname, `../../Videos/Beginning ASL 1/${vocabFile.filename}`);
      if (!fs.existsSync(vocabularyFilePath)) {
        logger.warn(`Vocab seed file not found: ${vocabularyFilePath}`);
        continue;
      }

      // Create Deck
      const { rows: deckRows } = await client.query(
        'INSERT INTO decks (title, user_id) VALUES ($1, $2) RETURNING id',
        [vocabFile.title, demoUser.id]
      );
      const deck = deckRows[0];

      // Read file cards
      const content = fs.readFileSync(vocabularyFilePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const videoUrl = parts[0].trim();
          const answer = parts[1].trim();

          await client.query(
            'INSERT INTO cards (video_url, answer, deck_id) VALUES ($1, $2, $3)',
            [videoUrl, answer, deck.id]
          );
        }
      }
      logger.info(`Seeded deck "${vocabFile.title}" successfully.`);
    }

    // 3. Seed mock sign templates (hello, thank you, goodbye, yes, no)
    const commonSigns = ['hello', 'thank you', 'goodbye', 'yes', 'no'];
    for (const sign of commonSigns) {
      // Generate a mock sequence of 60 frames, 21 joints, 3 coordinates
      const mockSequence = [];
      for (let f = 0; f < 60; f++) {
        const frame = [];
        const offset = f * 0.002;
        for (let j = 0; j < 21; j++) {
          frame.push([0.5 + offset, 0.4 - offset, 0.1]);
        }
        mockSequence.push(frame);
      }

      await client.query(
        'INSERT INTO sign_templates (sign_label, landmark_sequence) VALUES ($1, $2) ON CONFLICT (sign_label) DO NOTHING',
        [sign, JSON.stringify(mockSequence)]
      );
    }
    logger.info('Database seeding operations completed successfully.');

  } catch (err) {
    logger.error('Error during data seeding:', err);
  } finally {
    client.release();
  }
};

// ----------------------------------------------------
// Public APIs & Health
// ----------------------------------------------------
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ----------------------------------------------------
// Auth Routes
// ----------------------------------------------------
app.post(
  '/api/auth/register',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Provide a valid email').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    try {
      // Check if user already exists
      const { rows: existingUsers } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUsers.length > 0) {
        return res.status(409).json({ error: 'Email is already registered' });
      }

      // Hash password and insert
      const passwordHash = await bcrypt.hash(password, 10);
      const { rows: userRows } = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash]
      );
      
      const user = userRows[0];
      logger.info('New user registered successfully', { email: user.email });
      return res.status(201).json({ id: user.id, email: user.email });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/auth/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    try {
      const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (users.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = users[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Sign JWT Tokens
      const accessToken = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ id: user.id, email: user.email }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      // Set httpOnly secure cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 mins
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh', // Refresh token cookie only sent to refresh endpoint
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      logger.info('User logged in successfully', { email: user.email });
      return res.status(200).json({ id: user.id, email: user.email });
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  return res.status(200).json({ message: 'Logged out successfully' });
});

app.post('/api/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ error: 'Refresh token is missing' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string; email: string };
    
    // Check if user still exists
    const { rows: users } = await pool.query('SELECT id, email FROM users WHERE id = $1', [decoded.id]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const user = users[0];

    // Generate new tokens
    const newAccessToken = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ id: user.id, email: user.email }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    logger.warn('Refresh token verification failed', { error: err.message });
    return res.status(401).json({ error: 'Refresh token expired or invalid. Please log in again.' });
  }
});

app.get('/api/auth/me', authenticateJWT, (req: Request, res: Response) => {
  return res.status(200).json({ user: req.user });
});

// ----------------------------------------------------
// Authenticated Core Endpoints
// ----------------------------------------------------

// Get all decks for the logged-in user
app.get('/api/decks/:userId', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access Denied: Cannot view decks for another user.' });
    }

    const { rows } = await pool.query('SELECT * FROM decks WHERE user_id = $1 ORDER BY title ASC', [req.params.userId]);
    return res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
});

// Get all cards in a deck
app.get('/api/cards/:deckId', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic deck ownership validation can be done, but for now we query cards
    const { rows } = await pool.query('SELECT * FROM cards WHERE deck_id = $1 ORDER BY answer ASC', [req.params.deckId]);
    return res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
});

// Search for cards or decks
app.get('/api/search', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.query.term?.toString().trim();
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchQuery = `%${searchTerm}%`;

    // 1. Search cards
    const { rows: matchingCards } = await pool.query(
      `SELECT c.*, d.title as deck_title 
       FROM cards c 
       JOIN decks d ON c.deck_id = d.id 
       WHERE c.answer ILIKE $1`,
      [searchQuery]
    );

    // 2. Search decks
    const { rows: matchingDecks } = await pool.query(
      'SELECT * FROM decks WHERE title ILIKE $1 AND user_id = $2',
      [searchQuery, req.user?.id]
    );

    const formattedCards = matchingCards.map(c => ({
      id: c.id,
      answer: c.answer,
      video_url: c.video_url,
      deck_id: c.deck_id,
      deck: { id: c.deck_id, title: c.deck_title },
      type: 'card'
    }));

    const formattedDecks = matchingDecks.map(d => ({
      id: d.id,
      title: d.title,
      user_id: d.user_id,
      type: 'deck'
    }));

    return res.status(200).json({ cards: formattedCards, decks: formattedDecks });
  } catch (error) {
    next(error);
  }
});

// Star a card
app.post('/api/cards/:cardId/star', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { cardId } = req.params;
  const userId = req.user?.id;
  try {
    // Verify card exists
    const { rows: cards } = await pool.query('SELECT id FROM cards WHERE id = $1', [cardId]);
    if (cards.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    await pool.query(
      'INSERT INTO starred_cards (user_id, card_id) VALUES ($1, $2) ON CONFLICT (user_id, card_id) DO NOTHING',
      [userId, cardId]
    );

    return res.status(201).json({ message: 'Card starred successfully' });
  } catch (error) {
    next(error);
  }
});

// Unstar a card
app.delete('/api/cards/:cardId/star', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { cardId } = req.params;
  const userId = req.user?.id;
  try {
    await pool.query(
      'DELETE FROM starred_cards WHERE user_id = $1 AND card_id = $2',
      [userId, cardId]
    );
    return res.status(200).json({ message: 'Card unstarred successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all starred cards for a user
app.get('/api/users/:userId/starred-cards', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  try {
    if (req.user?.id !== userId) {
      return res.status(403).json({ error: 'Access Denied: Cannot view starred cards for another user' });
    }

    const { rows } = await pool.query(
      `SELECT c.*, d.title as deck_title 
       FROM starred_cards sc
       JOIN cards c ON sc.card_id = c.id
       JOIN decks d ON c.deck_id = d.id
       WHERE sc.user_id = $1`,
      [userId]
    );

    const formattedCards = rows.map(c => ({
      ...c,
      deck: { id: c.deck_id, title: c.deck_title }
    }));

    return res.status(200).json({ cards: formattedCards });
  } catch (error) {
    next(error);
  }
});

// Get all starred card IDs for a user (lightweight)
app.get('/api/users/:userId/starred-card-ids', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  try {
    if (req.user?.id !== userId) {
      return res.status(403).json({ error: 'Access Denied: Cannot retrieve data for another user' });
    }

    const { rows } = await pool.query('SELECT card_id FROM starred_cards WHERE user_id = $1', [userId]);
    const cardIds = rows.map(r => r.card_id);

    return res.status(200).json({ cardIds });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// AI pipeline practice endpoints
// ----------------------------------------------------

// POST /api/practice/analyze
app.post(
  '/api/practice/analyze',
  authenticateJWT,
  upload.single('video'),
  [
    body('sign_attempted').isString().trim().notEmpty().isLength({ max: 50 }).withMessage('Sign attempted must be string between 1 and 50 chars')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file upload is required' });
    }

    const { sign_attempted } = req.body;
    logger.info('Starting AI analysis pipeline', { user: req.user?.email, sign: sign_attempted });

    try {
      // 1. Forward video file buffer to AI service to extract landmarks
      const extractFormData = new FormData();
      const videoBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
      extractFormData.append('file', videoBlob, req.file.originalname);

      let landmarks: any;
      try {
        const landmarkRes = await axios.post(`${env.AI_SERVICE_URL}/extract-landmarks`, extractFormData, {
          headers: {
            'X-Internal-Secret': env.AI_SERVICE_SECRET
          },
          timeout: 60000 // 60s timeout
        });
        landmarks = landmarkRes.data;
      } catch (err: any) {
        logger.error('Failed landmark extraction call to AI microservice', { error: err.message });
        return res.status(503).json({ error: 'AI service temporarily unavailable (landmark extraction)' });
      }

      // 2. Classify the sign from landmark sequence
      let classification: any;
      try {
        const classRes = await axios.post(
          `${env.AI_SERVICE_URL}/classify-sign`,
          {
            landmarks,
            expected_sign: sign_attempted
          },
          {
            headers: {
              'X-Internal-Secret': env.AI_SERVICE_SECRET,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );
        classification = classRes.data;
      } catch (err: any) {
        logger.error('Failed classification call to AI microservice', { error: err.message });
        return res.status(503).json({ error: 'AI service temporarily unavailable (sign classification)' });
      }

      // 3. Fetch reference landmarks from the database
      const { rows: templates } = await pool.query(
        'SELECT landmark_sequence FROM sign_templates WHERE LOWER(sign_label) = LOWER($1)',
        [sign_attempted.toLowerCase().trim()]
      );

      let referenceLandmarks = null;
      if (templates.length > 0) {
        referenceLandmarks = templates[0].landmark_sequence;
      } else {
        // Fallback mock template if sign does not exist in DB (e.g. 60 frames, 21 joints, 3 coordinates)
        referenceLandmarks = Array(60).fill(Array(21).fill([0.5, 0.4, 0.1]));
      }

      // 4. Generate AI biomechanical coach feedback
      let feedback: any;
      try {
        const feedbackRes = await axios.post(
          `${env.AI_SERVICE_URL}/generate-feedback`,
          {
            sign_attempted,
            predicted_sign: classification.predicted_sign,
            confidence: classification.confidence,
            landmark_data: landmarks,
            reference_landmarks: referenceLandmarks
          },
          {
            headers: {
              'X-Internal-Secret': env.AI_SERVICE_SECRET,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );
        feedback = feedbackRes.data;
      } catch (err: any) {
        logger.error('Failed feedback generator call to AI microservice', { error: err.message });
        return res.status(503).json({ error: 'AI service temporarily unavailable (feedback generation)' });
      }

      // 5. Save the session history to database
      await pool.query(
        `INSERT INTO practice_sessions 
         (user_id, sign_attempted, landmark_data, ai_score, ai_feedback, improvement_areas)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.id,
          sign_attempted,
          JSON.stringify(landmarks),
          feedback.overall_score,
          feedback.summary,
          feedback.improvements
        ]
      );

      logger.info('Practice session analysis saved successfully', { user: req.user?.email, score: feedback.overall_score });

      // 6. Return response
      return res.status(200).json(feedback);

    } catch (err: any) {
      logger.error('Error during practice session analysis flow', { error: err.message });
      return res.status(500).json({ error: 'Internal server error processing practice attempt.' });
    }
  }
);

// GET /api/practice/history (authenticated)
app.get('/api/practice/history', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT id, sign_attempted, ai_score, ai_feedback, improvement_areas, created_at
       FROM practice_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user?.id, limit, offset]
    );

    return res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/practice/stats (authenticated)
app.get('/api/practice/stats', authenticateJWT, defaultRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  try {
    // 1. Total sessions
    const { rows: sessionCount } = await pool.query(
      'SELECT COUNT(*) FROM practice_sessions WHERE user_id = $1',
      [userId]
    );
    const totalSessions = parseInt(sessionCount[0].count);

    if (totalSessions === 0) {
      return res.status(200).json({
        total_sessions: 0,
        average_score: 0.0,
        most_practiced_sign: 'None',
        most_improved_sign: 'None',
        streak_days: 0
      });
    }

    // 2. Average score
    const { rows: averageRes } = await pool.query(
      'SELECT AVG(ai_score) as avg_score FROM practice_sessions WHERE user_id = $1',
      [userId]
    );
    const averageScore = parseFloat(parseFloat(averageRes[0].avg_score || '0').toFixed(1));

    // 3. Most practiced sign
    const { rows: mostPracticedRes } = await pool.query(
      `SELECT sign_attempted, COUNT(*) as count 
       FROM practice_sessions 
       WHERE user_id = $1 
       GROUP BY sign_attempted 
       ORDER BY count DESC 
       LIMIT 1`,
      [userId]
    );
    const mostPracticedSign = mostPracticedRes.length > 0 ? mostPracticedRes[0].sign_attempted : 'None';

    // 4. Most improved sign
    const { rows: mostImprovedRes } = await pool.query(
      `WITH first_last AS (
         SELECT DISTINCT ON (sign_attempted)
           sign_attempted,
           FIRST_VALUE(ai_score) OVER (PARTITION BY sign_attempted ORDER BY created_at ASC) as first_score,
           FIRST_VALUE(ai_score) OVER (PARTITION BY sign_attempted ORDER BY created_at DESC) as last_score
         FROM practice_sessions
         WHERE user_id = $1
       )
       SELECT sign_attempted, (last_score - first_score) as improvement
       FROM first_last
       ORDER BY improvement DESC
       LIMIT 1`,
      [userId]
    );
    const mostImprovedSign = mostImprovedRes.length > 0 && parseFloat(mostImprovedRes[0].improvement) > 0 
      ? mostImprovedRes[0].sign_attempted 
      : 'None';

    // 5. Streak days
    const { rows: dates } = await pool.query(
      `SELECT DISTINCT DATE(created_at) as practice_date 
       FROM practice_sessions 
       WHERE user_id = $1 
       ORDER BY practice_date DESC`,
      [userId]
    );

    let streakDays = 0;
    if (dates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastPractice = new Date(dates[0].practice_date);
      lastPractice.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today.getTime() - lastPractice.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Calculate sequential days if they practiced today or yesterday
      if (diffDays <= 1) {
        streakDays = 1;
        let current = lastPractice;
        for (let i = 1; i < dates.length; i++) {
          const next = new Date(dates[i].practice_date);
          next.setHours(0, 0, 0, 0);
          const diff = (current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
          if (diff === 1) {
            streakDays++;
            current = next;
          } else {
            break;
          }
        }
      }
    }

    return res.status(200).json({
      total_sessions: totalSessions,
      average_score: averageScore,
      most_practiced_sign: mostPracticedSign,
      most_improved_sign: mostImprovedSign,
      streak_days: streakDays
    });

  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Global Error Handler & 404
// ----------------------------------------------------
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled server error', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error occurred' });
});

// Start the server
const startServer = async () => {
  try {
    // 1. Verify/Bootstrap DB Tables
    logger.info('Initializing PostgreSQL database schema...');
    await initDatabase();

    // 2. Import Seed Decks and Cards if empty
    logger.info('Running database seed checker...');
    await seedData();

    // 3. Start listening
    app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (err: any) {
    logger.error('Failed to start server:', { error: err.message });
    process.exit(1);
  }
};

startServer();