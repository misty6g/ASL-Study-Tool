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
const supabase_js_1 = require("@supabase/supabase-js");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
// Security headers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
}));
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl/mobile/local) or from any localhost/127.0.0.1 port
        if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin === corsOrigin) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
// API Rate Limiting to prevent scraping and denial of service
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);
// Specific stricter rate limit for video streaming endpoint
const videoStreamLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Video stream rate limit exceeded, please try again later.' }
});
// Video cache directory
const videoCacheDir = path_1.default.join(__dirname, '../../Videos/.cache');
if (!fs_1.default.existsSync(videoCacheDir)) {
    try {
        fs_1.default.mkdirSync(videoCacheDir, { recursive: true });
    }
    catch (err) {
        console.warn('Could not create video cache directory:', err);
    }
}
// SECURITY NOTE: The static mount of the Videos directory (app.use('/videos', express.static(...)))
// has been deliberately removed to prevent unauthorized access and link harvesting.
// Video streaming is handled securely and selectively via /api/videos/stream/:fileId.
// Whitelist of approved video file IDs to prevent arbitrary SSRF and cache exhaustion
const whitelistedFileIds = new Set();
const extractDriveId = (url) => {
    if (!url || typeof url !== 'string')
        return null;
    const trimmed = url.trim();
    // Support both raw Google Drive file IDs and full Drive URLs
    if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
        return trimmed;
    }
    const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};
// Formats video URLs to internal proxy paths, shielding raw Google Drive share links
const formatVideoUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string')
        return '';
    const fileId = extractDriveId(rawUrl);
    if (fileId) {
        whitelistedFileIds.add(fileId);
        return `/api/videos/stream/${fileId}`;
    }
    return rawUrl;
};
// Stream video from Google Drive with range support, CORS, and disk caching
app.get('/api/videos/stream/:fileId', videoStreamLimiter, (req, res) => {
    const fileId = req.params.fileId;
    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
        return res.status(400).json({ error: 'Invalid file ID format' });
    }
    // Security check: Only allow streaming of known, cataloged video assets
    if (whitelistedFileIds.size > 0 && !whitelistedFileIds.has(fileId)) {
        return res.status(403).json({ error: 'Access denied: video file is not authorized' });
    }
    const cachedFilePath = path_1.default.join(videoCacheDir, `${fileId}.mp4`);
    // If already cached on disk and valid size, serve using express sendFile (handles ranges automatically)
    if (fs_1.default.existsSync(cachedFilePath)) {
        try {
            const stats = fs_1.default.statSync(cachedFilePath);
            if (stats.size > 1000) {
                return res.sendFile(cachedFilePath, {
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Accept-Ranges': 'bytes',
                        'Access-Control-Allow-Origin': req.headers.origin || '*',
                        'Cache-Control': 'public, max-age=86400'
                    }
                });
            }
        }
        catch (statErr) {
            console.warn('Error reading cached video:', statErr);
        }
    }
    // Stream directly from Google Drive
    const driveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    const requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (req.headers.range) {
        requestHeaders['Range'] = req.headers.range;
    }
    const handleStreamResponse = (sourceRes) => {
        // Handle redirect (e.g. 301, 302, 303) with strict SSRF defense
        if (sourceRes.statusCode && sourceRes.statusCode >= 300 && sourceRes.statusCode < 400 && sourceRes.headers.location) {
            try {
                const redirectUrl = new URL(sourceRes.headers.location);
                // SSRF protection: Ensure redirect target is strictly an official Google Drive domain
                const allowedHosts = ['.google.com', '.googleusercontent.com'];
                const isAllowedHost = allowedHosts.some(domain => redirectUrl.hostname.endsWith(domain));
                if (redirectUrl.protocol !== 'https:' || !isAllowedHost) {
                    console.error(`Blocked unsafe video stream redirect target: ${redirectUrl.hostname}`);
                    if (!res.headersSent)
                        res.status(502).json({ error: 'Invalid video stream redirect target' });
                    return;
                }
                https_1.default.get(sourceRes.headers.location, { headers: requestHeaders }, (redirectRes) => {
                    handleStreamResponse(redirectRes);
                }).on('error', (err) => {
                    console.error('Redirect video stream error:', err);
                    if (!res.headersSent)
                        res.status(502).json({ error: 'Video stream redirect failed' });
                });
            }
            catch (urlErr) {
                console.error('Malformed redirect URL:', urlErr);
                if (!res.headersSent)
                    res.status(502).json({ error: 'Malformed video stream redirect URL' });
            }
            return;
        }
        const statusCode = sourceRes.statusCode || 200;
        if (statusCode >= 400) {
            console.error(`Google Drive responded with status ${statusCode} for file ${fileId}`);
            if (!res.headersSent) {
                return res.status(statusCode).json({ error: 'Unable to stream video from provider' });
            }
            return;
        }
        const resHeaders = {
            'Content-Type': sourceRes.headers['content-type'] || 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': req.headers.origin || '*',
            'Cache-Control': 'public, max-age=86400'
        };
        if (sourceRes.headers['content-length'])
            resHeaders['Content-Length'] = sourceRes.headers['content-length'];
        if (sourceRes.headers['content-range'])
            resHeaders['Content-Range'] = sourceRes.headers['content-range'];
        res.writeHead(statusCode, resHeaders);
        sourceRes.pipe(res);
        // If full stream without range, cache the file to disk in background (subject to size limit)
        if (statusCode === 200 && !req.headers.range) {
            try {
                const contentLength = Number(sourceRes.headers['content-length']) || 0;
                const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per video cap
                if (contentLength <= MAX_CACHE_SIZE_BYTES) {
                    const fileStream = fs_1.default.createWriteStream(cachedFilePath);
                    sourceRes.pipe(fileStream);
                }
            }
            catch (cacheErr) {
                console.warn('Cache write error:', cacheErr);
            }
        }
    };
    const driveReq = https_1.default.get(driveUrl, { headers: requestHeaders }, handleStreamResponse);
    driveReq.on('error', (err) => {
        console.error('Google Drive fetch error:', err);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Failed to fetch video stream' });
        }
    });
});
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
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
const localStore = {
    users: [{ id: 'demo-user-id', email: 'demo@example.com' }],
    decks: [],
    cards: [],
    starredCardIds: new Set(),
};
const populateLocalStore = () => {
    localStore.decks = [];
    localStore.cards = [];
    const demoUserId = localStore.users[0].id;
    let cardCounter = 1;
    for (let i = 0; i < vocabFiles.length; i++) {
        const vf = vocabFiles[i];
        const deckId = `deck-${i + 1}`;
        localStore.decks.push({
            id: deckId,
            title: vf.title,
            user_id: demoUserId
        });
        const vocabularyFilePath = path_1.default.join(__dirname, `../../Videos/Beginning ASL 1/${vf.filename}`);
        try {
            if (fs_1.default.existsSync(vocabularyFilePath)) {
                const fileContent = fs_1.default.readFileSync(vocabularyFilePath, 'utf-8');
                const lines = fileContent.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const parts = line.split(',').map(item => item.trim());
                    if (parts.length >= 2 && parts[0] && parts[1]) {
                        const rawUrl = parts[0];
                        const answer = parts[1];
                        const fileId = extractDriveId(rawUrl);
                        if (fileId) {
                            whitelistedFileIds.add(fileId);
                        }
                        localStore.cards.push({
                            id: `card-${cardCounter++}`,
                            // Protect raw Google Drive URLs by exposing internal streaming endpoints only
                            video_url: fileId ? `/api/videos/stream/${fileId}` : rawUrl,
                            answer: answer,
                            deck_id: deckId
                        });
                    }
                }
            }
        }
        catch (err) {
            console.warn(`Could not read local vocab file ${vf.filename}:`, err.message);
        }
    }
    console.log(`Local fallback store initialized: ${localStore.decks.length} decks, ${localStore.cards.length} cards, ${whitelistedFileIds.size} whitelisted video streams.`);
};
// Function to clear existing data
const clearExistingData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Delete data from tables in reverse order of dependencies
        try {
            yield supabase.from('starred_cards').delete().neq('id', 0);
        }
        catch (error) {
            console.log('No starred_cards table to clear or error clearing:', error);
        }
        yield supabase.from('cards').delete().neq('id', 0);
        yield supabase.from('decks').delete().neq('id', 0);
        yield supabase.from('users').delete().neq('id', 0);
        console.log('Existing data cleared.');
    }
    catch (error) {
        console.error('Error clearing existing data:', error.message);
    }
});
// Function to create sample data
const createSampleData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Clear existing data first
        yield clearExistingData();
        // Create a sample user with hashed password
        const hashedPassword = bcryptjs_1.default.hashSync('demo123', 10);
        const { data: user, error: userError } = yield supabase
            .from('users')
            .insert([
            { email: 'demo@example.com', password_hash: hashedPassword }
        ])
            .select()
            .single();
        if (userError)
            throw userError;
        // Process each vocabulary file
        for (const vocabFile of vocabFiles) {
            try {
                // Create a deck for this vocabulary file
                const { data: deck, error: deckError } = yield supabase
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
                const vocabularyFilePath = path_1.default.join(__dirname, `../../Videos/Beginning ASL 1/${vocabFile.filename}`);
                try {
                    const fileContent = fs_1.default.readFileSync(vocabularyFilePath, 'utf-8');
                    // Parse the file content
                    const videoEntries = fileContent.split('\n')
                        .filter(line => line.trim()) // Remove empty lines
                        .map(line => {
                        const [url, answer] = line.split(',').map(item => item.trim());
                        const fileId = extractDriveId(url);
                        if (fileId) {
                            whitelistedFileIds.add(fileId);
                        }
                        return {
                            video_url: fileId ? `/api/videos/stream/${fileId}` : url,
                            answer: answer,
                            deck_id: deck.id
                        };
                    });
                    // Insert the cards with correct answers
                    if (videoEntries.length > 0) {
                        const { error: cardsError } = yield supabase
                            .from('cards')
                            .insert(videoEntries);
                        if (cardsError) {
                            console.error(`Error inserting cards for ${vocabFile.filename}:`, cardsError.message);
                        }
                        else {
                            console.log(`Successfully added ${videoEntries.length} cards to deck "${vocabFile.title}"`);
                        }
                    }
                    else {
                        console.log(`No entries found in ${vocabFile.filename}`);
                    }
                }
                catch (fileError) {
                    console.error(`Error reading ${vocabFile.filename}:`, fileError.message);
                }
            }
            catch (deckError) {
                console.error(`Error processing ${vocabFile.filename}:`, deckError.message);
            }
        }
        console.log('Sample data created successfully');
    }
    catch (error) {
        console.error('Error creating sample data:', error.message);
    }
});
// Initialize data when server starts
const initializeData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Clearing existing data and creating fresh sample data...');
        yield createSampleData();
    }
    catch (error) {
        console.error('Error initializing data:', error.message);
    }
});
// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Get all users (sanitized, omitting passwords)
app.get('/api/users', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data, error } = yield supabase.from('users').select('id, email, created_at');
        if (!error && data && data.length > 0) {
            return res.json(data);
        }
    }
    catch (error) {
        // Supabase unavailable, fallback to local store
    }
    res.json(localStore.users.map(u => ({ id: u.id, email: u.email })));
}));
// Get all decks for a user
app.get('/api/decks/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data, error } = yield supabase
            .from('decks')
            .select('*')
            .eq('user_id', req.params.userId);
        if (!error && data && data.length > 0) {
            return res.json(data);
        }
    }
    catch (error) {
        // Supabase unavailable, fallback to local store
    }
    res.json(localStore.decks);
}));
// Get all cards in a deck
app.get('/api/cards/:deckId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data, error } = yield supabase
            .from('cards')
            .select('*')
            .eq('deck_id', req.params.deckId);
        if (!error && data && data.length > 0) {
            return res.json(data.map((card) => (Object.assign(Object.assign({}, card), { video_url: formatVideoUrl(card.video_url) }))));
        }
    }
    catch (error) {
        // Supabase unavailable, fallback to local store
    }
    const deckCards = localStore.cards.filter(c => c.deck_id === req.params.deckId);
    res.json(deckCards);
}));
// Serve a test video file for checking if videos are loading
app.get('/api/test-video', (req, res) => {
    res.json({
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4'
    });
});
// Search for cards by answer text
app.get('/api/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const searchTerm = (_a = req.query.term) === null || _a === void 0 ? void 0 : _a.toString().toLowerCase().trim();
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        try {
            const { data: matchingCards } = yield supabase
                .from('cards')
                .select('*, deck_id')
                .ilike('answer', `%${searchTerm}%`);
            const { data: matchingDecks } = yield supabase
                .from('decks')
                .select('*')
                .ilike('title', `%${searchTerm}%`);
            if ((matchingCards && matchingCards.length > 0) || (matchingDecks && matchingDecks.length > 0)) {
                const deckIds = [...new Set((matchingCards || []).map((card) => card.deck_id))];
                let relevantDecks = [];
                if (deckIds.length > 0) {
                    const { data: cardDecks } = yield supabase.from('decks').select('*').in('id', deckIds);
                    relevantDecks = cardDecks || [];
                }
                const decksMap = {};
                relevantDecks.forEach((deck) => { decksMap[deck.id] = deck; });
                const cardResults = (matchingCards || []).map((card) => ({
                    id: card.id,
                    answer: card.answer,
                    video_url: formatVideoUrl(card.video_url),
                    deck_id: card.deck_id,
                    deck: decksMap[card.deck_id] || { id: card.deck_id, title: 'Unknown Deck' },
                    type: 'card'
                }));
                const deckResults = (matchingDecks || []).map((deck) => ({
                    id: deck.id,
                    title: deck.title,
                    user_id: deck.user_id,
                    type: 'deck'
                }));
                return res.json({ cards: cardResults, decks: deckResults });
            }
        }
        catch (e) {
            // Supabase unavailable, fallback to local store
        }
        // Local in-memory search
        const localMatchedCards = localStore.cards
            .filter(c => c.answer.toLowerCase().includes(searchTerm))
            .map(card => {
            const deck = localStore.decks.find(d => d.id === card.deck_id) || { id: card.deck_id, title: 'Unknown Deck' };
            return {
                id: card.id,
                answer: card.answer,
                video_url: card.video_url,
                deck_id: card.deck_id,
                deck,
                type: 'card'
            };
        });
        const localMatchedDecks = localStore.decks
            .filter(d => d.title.toLowerCase().includes(searchTerm))
            .map(d => (Object.assign(Object.assign({}, d), { type: 'deck' })));
        res.json({ cards: localMatchedCards, decks: localMatchedDecks });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Simple test search endpoint with static data
app.get('/api/search-test', (req, res) => {
    var _a;
    try {
        const searchTerm = ((_a = req.query.term) === null || _a === void 0 ? void 0 : _a.toString().toLowerCase()) || '';
        const testData = [
            { id: '1', answer: 'hello', video_url: 'test.mp4', deck_id: 'deck1', deck: { id: 'deck1', title: 'Greetings Deck' } },
            { id: '2', answer: 'goodbye', video_url: 'test2.mp4', deck_id: 'deck1', deck: { id: 'deck1', title: 'Greetings Deck' } },
            { id: '3', answer: 'thank you', video_url: 'test3.mp4', deck_id: 'deck2', deck: { id: 'deck2', title: 'Polite Phrases' } }
        ];
        const results = searchTerm ? testData.filter(item => item.answer.includes(searchTerm)) : testData;
        res.json(results);
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
});
// Star a card
app.post('/api/cards/:cardId/star', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cardId } = req.params;
        const { userId } = req.body;
        try {
            yield supabase.from('starred_cards').insert([{ card_id: cardId, user_id: userId }]);
        }
        catch (e) {
            // Fallback to local
        }
        localStore.starredCardIds.add(cardId);
        res.status(201).json({ message: 'Card starred successfully' });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Unstar a card
app.delete('/api/cards/:cardId/star', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cardId } = req.params;
        const { userId } = req.body;
        try {
            yield supabase.from('starred_cards').delete().eq('card_id', cardId).eq('user_id', userId);
        }
        catch (e) {
            // Fallback
        }
        localStore.starredCardIds.delete(cardId);
        res.status(200).json({ message: 'Card unstarred successfully' });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Get all starred cards for a user
app.get('/api/users/:userId/starred-cards', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cardIds = Array.from(localStore.starredCardIds);
        const cardsWithDecks = localStore.cards
            .filter(card => cardIds.includes(card.id))
            .map(card => {
            const deckInfo = localStore.decks.find(d => d.id === card.deck_id) || { id: card.deck_id, title: 'Unknown Deck' };
            return Object.assign(Object.assign({}, card), { deck: deckInfo });
        });
        res.json({ cards: cardsWithDecks });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Get all starred card IDs for a user
app.get('/api/users/:userId/starred-card-ids', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({ cardIds: Array.from(localStore.starredCardIds) });
}));
// --- Practice Feedback API Endpoints ---
// In-memory fallback stores
const userPreferencesStore = new Map();
const practiceAttemptsStore = new Map();
// Curated practice specifications metadata
const PRACTICE_SPECS_DATA = {
    hello: {
        id: 'hello',
        name: 'Hello',
        aliases: ['hello', 'hi'],
        version: '1.0.0',
        description: 'Salute gesture starting at temple and moving outward.',
        requiredHands: 'one',
        instructions: 'Bring your dominant hand to your temple with fingers extended, then move outward in a smooth salute.',
        expectedHandshape: 'Flat hand (open palm)',
        expectedLocationZone: 'forehead',
        expectedPalmDirection: 'away'
    },
    thankyou: {
        id: 'thankyou',
        name: "Thank You / You're Welcome",
        aliases: ['thank you', "thank you/you're welcome", "you're welcome", 'thanks'],
        version: '1.0.0',
        description: 'Fingertips start at chin and move forward and outward.',
        requiredHands: 'one',
        instructions: 'Fingertips touch near chin with flat hand, then move outward and slightly down toward the other person.',
        expectedHandshape: 'Flat hand (open palm)',
        expectedLocationZone: 'chin',
        expectedPalmDirection: 'inward'
    },
    good: {
        id: 'good',
        name: 'Good',
        aliases: ['good', 'well'],
        version: '1.0.0',
        description: 'Dominant flat hand starts at chin and moves down to chest level.',
        requiredHands: 'one',
        instructions: 'Place your dominant flat hand at your chin and bring it down to chest level.',
        expectedHandshape: 'Flat hand',
        expectedLocationZone: 'chin',
        expectedPalmDirection: 'inward'
    },
    forgot: {
        id: 'forgot',
        name: 'Forgot',
        aliases: ['forgot', 'forget'],
        version: '1.0.0',
        description: 'Flat hand wipes across forehead from dominant to non-dominant side.',
        requiredHands: 'one',
        instructions: 'Place your flat hand against your forehead and wipe across outward.',
        expectedHandshape: 'Flat hand curling across swipe',
        expectedLocationZone: 'forehead',
        expectedPalmDirection: 'inward'
    },
    fine: {
        id: 'fine',
        name: 'Fine',
        aliases: ['fine'],
        version: '1.0.0',
        description: 'Open 5-hand with thumb touching center chest.',
        requiredHands: 'one',
        instructions: 'Open your dominant hand into a 5-handshape and touch your thumb to the center of your chest.',
        expectedHandshape: '5-hand (fingers spread)',
        expectedLocationZone: 'chest',
        expectedPalmDirection: 'left'
    }
};
// GET all practice specifications
app.get('/api/practice/specs', (req, res) => {
    res.json({
        version: '1.0.0',
        specs: Object.values(PRACTICE_SPECS_DATA)
    });
});
// GET a specific practice specification
app.get('/api/practice/specs/:signId', (req, res) => {
    const signId = req.params.signId.toLowerCase();
    const spec = PRACTICE_SPECS_DATA[signId];
    if (!spec) {
        return res.status(404).json({ error: `Practice specification not found for '${signId}'` });
    }
    res.json(spec);
});
// GET user practice preferences (dominant hand)
app.get('/api/users/:userId/preferences', (req, res) => {
    const { userId } = req.params;
    const prefs = userPreferencesStore.get(userId) || { dominantHand: 'right' };
    res.json(prefs);
});
// POST user practice preferences
app.post('/api/users/:userId/preferences', (req, res) => {
    const { userId } = req.params;
    const { dominantHand } = req.body;
    const validHand = dominantHand === 'left' ? 'left' : 'right';
    userPreferencesStore.set(userId, { dominantHand: validHand });
    res.json({ success: true, dominantHand: validHand });
});
// POST a practice attempt summary (no raw video)
app.post('/api/practice/attempts', (req, res) => {
    try {
        const { userId = 'demo-user-id', signId, overallScore, dominantHand, durationMs, dimensionResults } = req.body;
        const attempt = {
            id: `attempt_${Date.now()}`,
            userId,
            signId,
            overallScore: Number(overallScore) || 0,
            dominantHand: dominantHand === 'left' ? 'left' : 'right',
            durationMs: Number(durationMs) || 0,
            dimensionResults: dimensionResults || {},
            createdAt: new Date().toISOString()
        };
        const existing = practiceAttemptsStore.get(userId) || [];
        existing.push(attempt);
        practiceAttemptsStore.set(userId, existing);
        res.status(201).json({ success: true, attempt });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to save practice attempt' });
    }
});
// GET past practice attempts for a user
app.get('/api/users/:userId/practice-attempts', (req, res) => {
    const { userId } = req.params;
    const attempts = practiceAttemptsStore.get(userId) || [];
    res.json({ attempts });
});
// Main function to start the server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Populate resilient local in-memory database store
        populateLocalStore();
        // 2. Attempt Supabase sync if remote host is reachable (only wipe if explicit reset flag is set)
        try {
            if (process.env.RESET_DB_ON_STARTUP === 'true') {
                console.log('RESET_DB_ON_STARTUP is true: Clearing and reseeding database...');
                yield clearExistingData();
                yield createSampleData();
                console.log('Database reseeded successfully.');
            }
            else {
                console.log('Database reset on startup disabled to prevent data loss (set RESET_DB_ON_STARTUP=true to reseed).');
            }
        }
        catch (dbErr) {
            console.log('Supabase offline or unreachable. Running with resilient local in-memory store.');
        }
        // 3. Start the server
        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log('API is ready to accept requests');
        });
    }
    catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1); // Exit if server fails to start
    }
});
// Start the application
startServer();
