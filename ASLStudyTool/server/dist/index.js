"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const winston_1 = __importDefault(require("winston"));
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const db_1 = require("./db");
// Load environment variables
dotenv_1.default.config();
// Logger setup
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console()
    ]
});
// Environment Variable Validation Schema
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().transform(Number).default('8888'),
    DATABASE_URL: zod_1.z.string(),
    JWT_SECRET: zod_1.z.string().min(8),
    JWT_REFRESH_SECRET: zod_1.z.string().min(8),
    AI_SERVICE_URL: zod_1.z.string().url().default('http://localhost:8000'),
    AI_SERVICE_SECRET: zod_1.z.string().min(4),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:3000')
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    logger.error("❌ Invalid environment variables configuration:", parsedEnv.error.format());
    process.exit(1);
}
const env = parsedEnv.data;
const app = (0, express_1.default)();
// Enable Helmet with custom Content Security Policy (CSP)
app.use((0, helmet_1.default)());
app.use(helmet_1.default.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", env.AI_SERVICE_URL]
    }
}));
// Set up cookies and request limits
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '10kb' })); // JSON payload capped at 10kb
// CORS configuration - White list localhost & Vercel production origin
const whitelist = [env.CORS_ORIGIN, 'http://localhost:3000'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || whitelist.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Rate Limiting
const defaultRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
const authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 15, // Limit each IP to 15 requests for auth routes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});
// Multer upload config for files (capped at 50MB)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Unsupported file MIME type. Only mp4, webm and mov files are accepted.'));
        }
    }
});
// ----------------------------------------------------
// Authentication Middleware
// ----------------------------------------------------
const authenticateJWT = (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
        logger.warn('Access token missing in request cookies');
        return res.status(401).json({ error: 'Access token is required. Please log in.' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env.JWT_SECRET);
        req.user = { id: decoded.id, email: decoded.email };
        next();
    }
    catch (err) {
        logger.warn('Access token verification failed', { error: err.message });
        return res.status(401).json({ error: 'Access token expired or invalid.' });
    }
};
// ----------------------------------------------------
// Input Validation Helper
// ----------------------------------------------------
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
// ----------------------------------------------------
// Seeding & Setup Logic
// ----------------------------------------------------
const seedData = () => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield db_1.pool.connect();
    try {
        // Check if we have decks
        const { rows: decksCount } = yield client.query('SELECT COUNT(*) FROM decks');
        if (Number(decksCount[0].count) > 0) {
            logger.info('Database already has decks. Skipping seeding.');
            return;
        }
        logger.info('Database is empty. Seeding initial decks, cards, and templates...');
        // 1. Create default demo user
        const demoEmail = 'demo@example.com';
        const demoPasswordHash = yield bcryptjs_1.default.hash('demo123', 10);
        const { rows: userRows } = yield client.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $2 RETURNING id', [demoEmail, demoPasswordHash]);
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
            let vocabularyFilePath = path_1.default.join(__dirname, `../../Videos/Beginning ASL 1/${vocabFile.filename}`);
            if (!fs_1.default.existsSync(vocabularyFilePath)) {
                vocabularyFilePath = path_1.default.join(process.cwd(), `Videos/Beginning ASL 1/${vocabFile.filename}`);
            }
            if (!fs_1.default.existsSync(vocabularyFilePath)) {
                vocabularyFilePath = path_1.default.join(process.cwd(), `../Videos/Beginning ASL 1/${vocabFile.filename}`);
            }
            if (!fs_1.default.existsSync(vocabularyFilePath)) {
                logger.warn(`Vocab seed file not found for ${vocabFile.filename}`);
                continue;
            }
            // Create Deck
            const { rows: deckRows } = yield client.query('INSERT INTO decks (title, user_id) VALUES ($1, $2) RETURNING id', [vocabFile.title, demoUser.id]);
            const deck = deckRows[0];
            // Read file cards
            const content = fs_1.default.readFileSync(vocabularyFilePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const videoUrl = parts[0].trim();
                    const answer = parts[1].trim();
                    yield client.query('INSERT INTO cards (video_url, answer, deck_id) VALUES ($1, $2, $3)', [videoUrl, answer, deck.id]);
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
            yield client.query('INSERT INTO sign_templates (sign_label, landmark_sequence) VALUES ($1, $2) ON CONFLICT (sign_label) DO NOTHING', [sign, JSON.stringify(mockSequence)]);
        }
        logger.info('Database seeding operations completed successfully.');
    }
    catch (err) {
        logger.error('Error during data seeding:', err);
    }
    finally {
        client.release();
    }
});
// ----------------------------------------------------
// Public APIs & Health
// ----------------------------------------------------
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ----------------------------------------------------
// Auth Routes
// ----------------------------------------------------
app.post('/api/auth/register', authRateLimiter, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Provide a valid email').normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validateRequest, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        // Check if user already exists
        const { rows: existingUsers } = yield db_1.pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'Email is already registered' });
        }
        // Hash password and insert
        const passwordHash = yield bcryptjs_1.default.hash(password, 10);
        const { rows: userRows } = yield db_1.pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, passwordHash]);
        const user = userRows[0];
        logger.info('New user registered successfully', { email: user.email });
        return res.status(201).json({ id: user.id, email: user.email });
    }
    catch (error) {
        next(error);
    }
}));
app.post('/api/auth/login', authRateLimiter, [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty()
], validateRequest, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        const { rows: users } = yield db_1.pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const user = users[0];
        const validPassword = yield bcryptjs_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Sign JWT Tokens
        const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
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
    }
    catch (error) {
        next(error);
    }
}));
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return res.status(200).json({ message: 'Logged out successfully' });
});
app.post('/api/auth/refresh', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ error: 'Refresh token is missing' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env.JWT_REFRESH_SECRET);
        // Check if user still exists
        const { rows: users } = yield db_1.pool.query('SELECT id, email FROM users WHERE id = $1', [decoded.id]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'User no longer exists' });
        }
        const user = users[0];
        // Generate new tokens
        const newAccessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '15m' });
        const newRefreshToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
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
    }
    catch (err) {
        logger.warn('Refresh token verification failed', { error: err.message });
        return res.status(401).json({ error: 'Refresh token expired or invalid. Please log in again.' });
    }
}));
app.get('/api/auth/me', authenticateJWT, (req, res) => {
    return res.status(200).json({ user: req.user });
});
// ----------------------------------------------------
// Authenticated Core Endpoints
// ----------------------------------------------------
// Get all decks for the logged-in user
app.get('/api/decks/:userId', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== req.params.userId) {
            return res.status(403).json({ error: 'Access Denied: Cannot view decks for another user.' });
        }
        const { rows } = yield db_1.pool.query('SELECT * FROM decks WHERE user_id = $1 ORDER BY title ASC', [req.params.userId]);
        return res.status(200).json(rows);
    }
    catch (error) {
        next(error);
    }
}));
// Get all cards in a deck
app.get('/api/cards/:deckId', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Basic deck ownership validation can be done, but for now we query cards
        const { rows } = yield db_1.pool.query('SELECT * FROM cards WHERE deck_id = $1 ORDER BY answer ASC', [req.params.deckId]);
        return res.status(200).json(rows);
    }
    catch (error) {
        next(error);
    }
}));
// Search for cards or decks
app.get('/api/search', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const searchTerm = (_a = req.query.term) === null || _a === void 0 ? void 0 : _a.toString().trim();
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        const searchQuery = `%${searchTerm}%`;
        // 1. Search cards
        const { rows: matchingCards } = yield db_1.pool.query(`SELECT c.*, d.title as deck_title 
       FROM cards c 
       JOIN decks d ON c.deck_id = d.id 
       WHERE c.answer ILIKE $1`, [searchQuery]);
        // 2. Search decks
        const { rows: matchingDecks } = yield db_1.pool.query('SELECT * FROM decks WHERE title ILIKE $1 AND user_id = $2', [searchQuery, (_b = req.user) === null || _b === void 0 ? void 0 : _b.id]);
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
    }
    catch (error) {
        next(error);
    }
}));
// Star a card
app.post('/api/cards/:cardId/star', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { cardId } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        // Verify card exists
        const { rows: cards } = yield db_1.pool.query('SELECT id FROM cards WHERE id = $1', [cardId]);
        if (cards.length === 0) {
            return res.status(404).json({ error: 'Card not found' });
        }
        yield db_1.pool.query('INSERT INTO starred_cards (user_id, card_id) VALUES ($1, $2) ON CONFLICT (user_id, card_id) DO NOTHING', [userId, cardId]);
        return res.status(201).json({ message: 'Card starred successfully' });
    }
    catch (error) {
        next(error);
    }
}));
// Unstar a card
app.delete('/api/cards/:cardId/star', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { cardId } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        yield db_1.pool.query('DELETE FROM starred_cards WHERE user_id = $1 AND card_id = $2', [userId, cardId]);
        return res.status(200).json({ message: 'Card unstarred successfully' });
    }
    catch (error) {
        next(error);
    }
}));
// Get all starred cards for a user
app.get('/api/users/:userId/starred-cards', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { userId } = req.params;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== userId) {
            return res.status(403).json({ error: 'Access Denied: Cannot view starred cards for another user' });
        }
        const { rows } = yield db_1.pool.query(`SELECT c.*, d.title as deck_title 
       FROM starred_cards sc
       JOIN cards c ON sc.card_id = c.id
       JOIN decks d ON c.deck_id = d.id
       WHERE sc.user_id = $1`, [userId]);
        const formattedCards = rows.map(c => (Object.assign(Object.assign({}, c), { deck: { id: c.deck_id, title: c.deck_title } })));
        return res.status(200).json({ cards: formattedCards });
    }
    catch (error) {
        next(error);
    }
}));
// Get all starred card IDs for a user (lightweight)
app.get('/api/users/:userId/starred-card-ids', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { userId } = req.params;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== userId) {
            return res.status(403).json({ error: 'Access Denied: Cannot retrieve data for another user' });
        }
        const { rows } = yield db_1.pool.query('SELECT card_id FROM starred_cards WHERE user_id = $1', [userId]);
        const cardIds = rows.map(r => r.card_id);
        return res.status(200).json({ cardIds });
    }
    catch (error) {
        next(error);
    }
}));
// ----------------------------------------------------
// AI pipeline practice endpoints
// ----------------------------------------------------
// POST /api/practice/analyze
app.post('/api/practice/analyze', authenticateJWT, upload.single('video'), [
    (0, express_validator_1.body)('sign_attempted').isString().trim().notEmpty().isLength({ max: 50 }).withMessage('Sign attempted must be string between 1 and 50 chars')
], validateRequest, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    if (!req.file) {
        return res.status(400).json({ error: 'Video file upload is required' });
    }
    const { sign_attempted } = req.body;
    logger.info('Starting AI analysis pipeline', { user: (_a = req.user) === null || _a === void 0 ? void 0 : _a.email, sign: sign_attempted });
    try {
        // 1. Forward video file buffer to AI service to extract landmarks
        const extractFormData = new FormData();
        const videoBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
        extractFormData.append('file', videoBlob, req.file.originalname);
        let landmarks;
        try {
            const landmarkRes = yield axios_1.default.post(`${env.AI_SERVICE_URL}/extract-landmarks`, extractFormData, {
                headers: {
                    'X-Internal-Secret': env.AI_SERVICE_SECRET
                },
                timeout: 60000 // 60s timeout
            });
            landmarks = landmarkRes.data;
        }
        catch (err) {
            logger.error('Failed landmark extraction call to AI microservice', { error: err.message });
            return res.status(503).json({ error: 'AI service temporarily unavailable (landmark extraction)' });
        }
        // 2. Classify the sign from landmark sequence
        let classification;
        try {
            const classRes = yield axios_1.default.post(`${env.AI_SERVICE_URL}/classify-sign`, {
                landmarks,
                expected_sign: sign_attempted
            }, {
                headers: {
                    'X-Internal-Secret': env.AI_SERVICE_SECRET,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });
            classification = classRes.data;
        }
        catch (err) {
            logger.error('Failed classification call to AI microservice', { error: err.message });
            return res.status(503).json({ error: 'AI service temporarily unavailable (sign classification)' });
        }
        // 3. Fetch reference landmarks from the database
        const { rows: templates } = yield db_1.pool.query('SELECT landmark_sequence FROM sign_templates WHERE LOWER(sign_label) = LOWER($1)', [sign_attempted.toLowerCase().trim()]);
        let referenceLandmarks = null;
        if (templates.length > 0) {
            referenceLandmarks = templates[0].landmark_sequence;
        }
        else {
            // Fallback mock template if sign does not exist in DB (e.g. 60 frames, 21 joints, 3 coordinates)
            referenceLandmarks = Array(60).fill(Array(21).fill([0.5, 0.4, 0.1]));
        }
        // 4. Generate AI biomechanical coach feedback
        let feedback;
        try {
            const feedbackRes = yield axios_1.default.post(`${env.AI_SERVICE_URL}/generate-feedback`, {
                sign_attempted,
                predicted_sign: classification.predicted_sign,
                confidence: classification.confidence,
                landmark_data: landmarks,
                reference_landmarks: referenceLandmarks
            }, {
                headers: {
                    'X-Internal-Secret': env.AI_SERVICE_SECRET,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });
            feedback = feedbackRes.data;
        }
        catch (err) {
            logger.error('Failed feedback generator call to AI microservice', { error: err.message });
            return res.status(503).json({ error: 'AI service temporarily unavailable (feedback generation)' });
        }
        // 5. Save the session history to database
        yield db_1.pool.query(`INSERT INTO practice_sessions 
         (user_id, sign_attempted, landmark_data, ai_score, ai_feedback, improvement_areas)
         VALUES ($1, $2, $3, $4, $5, $6)`, [
            (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
            sign_attempted,
            JSON.stringify(landmarks),
            feedback.overall_score,
            feedback.summary,
            feedback.improvements
        ]);
        logger.info('Practice session analysis saved successfully', { user: (_c = req.user) === null || _c === void 0 ? void 0 : _c.email, score: feedback.overall_score });
        // 6. Return response
        return res.status(200).json(feedback);
    }
    catch (err) {
        logger.error('Error during practice session analysis flow', { error: err.message });
        return res.status(500).json({ error: 'Internal server error processing practice attempt.' });
    }
}));
// GET /api/practice/history (authenticated)
app.get('/api/practice/history', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    try {
        const { rows } = yield db_1.pool.query(`SELECT id, sign_attempted, ai_score, ai_feedback, improvement_areas, created_at
       FROM practice_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`, [(_a = req.user) === null || _a === void 0 ? void 0 : _a.id, limit, offset]);
        return res.status(200).json(rows);
    }
    catch (error) {
        next(error);
    }
}));
// GET /api/practice/stats (authenticated)
app.get('/api/practice/stats', authenticateJWT, defaultRateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        // 1. Total sessions
        const { rows: sessionCount } = yield db_1.pool.query('SELECT COUNT(*) FROM practice_sessions WHERE user_id = $1', [userId]);
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
        const { rows: averageRes } = yield db_1.pool.query('SELECT AVG(ai_score) as avg_score FROM practice_sessions WHERE user_id = $1', [userId]);
        const averageScore = parseFloat(parseFloat(averageRes[0].avg_score || '0').toFixed(1));
        // 3. Most practiced sign
        const { rows: mostPracticedRes } = yield db_1.pool.query(`SELECT sign_attempted, COUNT(*) as count 
       FROM practice_sessions 
       WHERE user_id = $1 
       GROUP BY sign_attempted 
       ORDER BY count DESC 
       LIMIT 1`, [userId]);
        const mostPracticedSign = mostPracticedRes.length > 0 ? mostPracticedRes[0].sign_attempted : 'None';
        // 4. Most improved sign
        const { rows: mostImprovedRes } = yield db_1.pool.query(`WITH first_last AS (
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
       LIMIT 1`, [userId]);
        const mostImprovedSign = mostImprovedRes.length > 0 && parseFloat(mostImprovedRes[0].improvement) > 0
            ? mostImprovedRes[0].sign_attempted
            : 'None';
        // 5. Streak days
        const { rows: dates } = yield db_1.pool.query(`SELECT DISTINCT DATE(created_at) as practice_date 
       FROM practice_sessions 
       WHERE user_id = $1 
       ORDER BY practice_date DESC`, [userId]);
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
                    }
                    else {
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
    }
    catch (error) {
        next(error);
    }
}));
// ----------------------------------------------------
// Global Error Handler & 404
// ----------------------------------------------------
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
app.use((err, req, res, next) => {
    logger.error('Unhandled server error', { message: err.message, stack: err.stack });
    res.status(err.status || 500).json({ error: err.message || 'Internal server error occurred' });
});
// Start the server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Verify/Bootstrap DB Tables
        logger.info('Initializing PostgreSQL database schema...');
        yield (0, db_1.initDatabase)();
        // 2. Import Seed Decks and Cards if empty
        logger.info('Running database seed checker...');
        yield seedData();
        // 3. Start listening
        app.listen(env.PORT, () => {
            logger.info(`🚀 Server running on port ${env.PORT} in ${process.env.NODE_ENV || 'development'} mode`);
        });
    }
    catch (err) {
        logger.error('Failed to start server:', { error: err.message });
        process.exit(1);
    }
});
startServer();
