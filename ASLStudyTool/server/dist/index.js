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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
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
        // Allow requests with no origin (curl/mobile/local), localhost, any Vercel preview/prod domain, or configured CORS_ORIGIN
        if (!origin ||
            origin.startsWith('http://localhost') ||
            origin.startsWith('http://127.0.0.1') ||
            origin.endsWith('.vercel.app') ||
            origin === corsOrigin ||
            (corsOrigin && corsOrigin.split(',').map(s => s.trim()).includes(origin)) ||
            corsOrigin === '*') {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
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
const isSupabaseConfigured = Boolean(supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('your-project') &&
    supabaseUrl.startsWith('http'));
const supabase = isSupabaseConfigured ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey) : null;
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
const JWT_SECRET = process.env.JWT_SECRET || 'asl-study-tool-jwt-dev-secret-key-change-in-prod';
const generateToken = (user) => {
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email, displayName: user.displayName || 'Learner' }, JWT_SECRET, { expiresIn: '30d' });
};
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired session token' });
        }
        req.user = user;
        next();
    });
};
const optionalAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
        req.user = null;
        return next();
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (!err && user) {
            req.user = user;
        }
        else {
            req.user = null;
        }
        next();
    });
};
const getStarredSetForUser = (userId) => {
    const safeId = userId || 'demo-user-id';
    if (!localStore.starredCardIdsByUser.has(safeId)) {
        localStore.starredCardIdsByUser.set(safeId, new Set());
    }
    return localStore.starredCardIdsByUser.get(safeId);
};
const localStore = {
    users: [
        {
            id: 'demo-user-id',
            email: 'demo@example.com',
            passwordHash: bcryptjs_1.default.hashSync('demo123', 10),
            displayName: 'Demo Student',
            createdAt: new Date().toISOString(),
        },
    ],
    decks: [],
    cards: [],
    starredCardIdsByUser: new Map([
        ['demo-user-id', new Set()]
    ]),
    userPreferences: new Map([
        ['demo-user-id', { dominantHand: 'right', soundEnabled: false }]
    ]),
    practiceAttempts: new Map(),
    testResults: new Map(),
    get starredCardIds() {
        return getStarredSetForUser('demo-user-id');
    }
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
            user_id: demoUserId,
            is_global: true
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
    loadLocalData();
};
const dataDir = path_1.default.join(__dirname, '../../data');
if (!fs_1.default.existsSync(dataDir)) {
    try {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    catch (err) {
        console.warn('Could not create data directory:', err);
    }
}
const dbFilePath = path_1.default.join(dataDir, 'local_db.json');
let saveTimeout = null;
const persistLocalData = () => {
    if (saveTimeout)
        clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const dataToSave = {
                users: localStore.users,
                starredCardIdsByUser: Object.fromEntries(Array.from(localStore.starredCardIdsByUser.entries()).map(([k, v]) => [k, Array.from(v)])),
                userPreferences: Object.fromEntries(localStore.userPreferences.entries()),
                practiceAttempts: Object.fromEntries(localStore.practiceAttempts.entries()),
                testResults: Object.fromEntries(localStore.testResults.entries()),
                customDecks: localStore.decks.filter(d => !d.is_global),
                customCards: localStore.cards.filter(c => !c.id.startsWith('card-'))
            };
            fs_1.default.writeFileSync(dbFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
        }
        catch (err) {
            console.warn('Failed to persist local DB to disk:', err);
        }
    }, 100);
};
const loadLocalData = () => {
    try {
        if (fs_1.default.existsSync(dbFilePath)) {
            const raw = fs_1.default.readFileSync(dbFilePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.users)) {
                for (const u of parsed.users) {
                    if (!localStore.users.some(existing => existing.id === u.id || existing.email === u.email)) {
                        localStore.users.push(u);
                    }
                }
            }
            if (parsed.starredCardIdsByUser && typeof parsed.starredCardIdsByUser === 'object') {
                for (const [userId, ids] of Object.entries(parsed.starredCardIdsByUser)) {
                    if (Array.isArray(ids)) {
                        localStore.starredCardIdsByUser.set(userId, new Set(ids));
                    }
                }
            }
            if (parsed.userPreferences && typeof parsed.userPreferences === 'object') {
                for (const [userId, prefs] of Object.entries(parsed.userPreferences)) {
                    localStore.userPreferences.set(userId, prefs);
                }
            }
            if (parsed.practiceAttempts && typeof parsed.practiceAttempts === 'object') {
                for (const [userId, attempts] of Object.entries(parsed.practiceAttempts)) {
                    if (Array.isArray(attempts)) {
                        localStore.practiceAttempts.set(userId, attempts);
                    }
                }
            }
            if (parsed.testResults && typeof parsed.testResults === 'object') {
                for (const [userId, results] of Object.entries(parsed.testResults)) {
                    if (Array.isArray(results)) {
                        localStore.testResults.set(userId, results);
                    }
                }
            }
            if (Array.isArray(parsed.customDecks)) {
                for (const cd of parsed.customDecks) {
                    if (!localStore.decks.some(d => d.id === cd.id)) {
                        localStore.decks.push(cd);
                    }
                }
            }
            if (Array.isArray(parsed.customCards)) {
                for (const cc of parsed.customCards) {
                    if (!localStore.cards.some(c => c.id === cc.id)) {
                        localStore.cards.push(cc);
                    }
                }
            }
            console.log(`Loaded persisted local data from disk: ${localStore.users.length} users, ${localStore.starredCardIdsByUser.size} user star collections.`);
        }
    }
    catch (err) {
        console.warn('Failed to load persisted local data from disk:', err);
    }
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
// --- Authentication Endpoints ---
// Register a new user
app.post('/api/auth/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password, displayName } = req.body;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email address is required' });
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = (displayName && typeof displayName === 'string' ? displayName.trim() : '') || cleanEmail.split('@')[0];
        // Attempt Supabase Auth if cloud project is configured
        if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
            try {
                const { data: authData, error: authError } = yield supabase.auth.signUp({
                    email: cleanEmail,
                    password: password,
                    options: {
                        data: { display_name: cleanName }
                    }
                });
                if (!authError && authData.user) {
                    const userId = authData.user.id;
                    yield supabase.from('users').upsert({
                        id: userId,
                        email: cleanEmail,
                        password_hash: bcryptjs_1.default.hashSync(password, 10),
                        display_name: cleanName
                    });
                    const token = ((_a = authData.session) === null || _a === void 0 ? void 0 : _a.access_token) || generateToken({ id: userId, email: cleanEmail, displayName: cleanName });
                    return res.status(201).json({
                        token,
                        user: { id: userId, email: cleanEmail, displayName: cleanName }
                    });
                }
            }
            catch (sbErr) {
                console.warn('Supabase sign-up failed or offline, falling back to local multi-user store:', sbErr);
            }
        }
        // Local in-memory multi-user fallback
        const exists = localStore.users.some(u => u.email === cleanEmail);
        if (exists) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }
        const newUser = {
            id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            email: cleanEmail,
            passwordHash: bcryptjs_1.default.hashSync(password, 10),
            displayName: cleanName,
            createdAt: new Date().toISOString()
        };
        localStore.users.push(newUser);
        persistLocalData();
        const token = generateToken({ id: newUser.id, email: newUser.email, displayName: newUser.displayName });
        return res.status(201).json({
            token,
            user: { id: newUser.id, email: newUser.email, displayName: newUser.displayName }
        });
    }
    catch (err) {
        res.status(500).json({ error: (err === null || err === void 0 ? void 0 : err.message) || 'Registration failed' });
    }
}));
// Login existing user
app.post('/api/auth/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const cleanEmail = email.trim().toLowerCase();
        // Attempt Supabase Auth if cloud project is configured
        if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
            try {
                const { data: authData, error: authError } = yield supabase.auth.signInWithPassword({
                    email: cleanEmail,
                    password: password
                });
                if (!authError && authData.user) {
                    const userMeta = authData.user.user_metadata || {};
                    const displayName = userMeta.display_name || cleanEmail.split('@')[0];
                    const token = ((_a = authData.session) === null || _a === void 0 ? void 0 : _a.access_token) || generateToken({ id: authData.user.id, email: cleanEmail, displayName });
                    return res.json({
                        token,
                        user: { id: authData.user.id, email: cleanEmail, displayName }
                    });
                }
            }
            catch (sbErr) {
                console.warn('Supabase login failed or offline, falling back to local multi-user store:', sbErr);
            }
        }
        // Local in-memory multi-user fallback
        const user = localStore.users.find(u => u.email === cleanEmail);
        if (!user || !user.passwordHash || !bcryptjs_1.default.compareSync(password, user.passwordHash)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = generateToken({ id: user.id, email: user.email, displayName: user.displayName });
        return res.json({
            token,
            user: { id: user.id, email: user.email, displayName: user.displayName }
        });
    }
    catch (err) {
        res.status(500).json({ error: (err === null || err === void 0 ? void 0 : err.message) || 'Login failed' });
    }
}));
// Get current authenticated user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const localUser = localStore.users.find(u => u.id === userId);
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            displayName: (localUser === null || localUser === void 0 ? void 0 : localUser.displayName) || req.user.displayName || req.user.email.split('@')[0]
        }
    });
});
// Guest session initialization
app.post('/api/auth/guest', (req, res) => {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const guestUser = {
        id: guestId,
        email: `${guestId}@guest.local`,
        passwordHash: '',
        displayName: 'Guest Learner',
        createdAt: new Date().toISOString()
    };
    localStore.users.push(guestUser);
    persistLocalData();
    const token = generateToken({ id: guestUser.id, email: guestUser.email, displayName: guestUser.displayName });
    res.json({
        token,
        user: { id: guestUser.id, email: guestUser.email, displayName: guestUser.displayName, isGuest: true }
    });
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
// Get all decks (global curriculum + user custom decks)
app.get('/api/decks', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        try {
            let query = supabase.from('decks').select('*');
            if (userId) {
                query = query.or(`is_global.eq.true,user_id.eq.${userId}`);
            }
            else {
                query = query.or('is_global.eq.true,user_id.not.is.null');
            }
            const { data, error } = yield query;
            if (!error && data && data.length > 0) {
                return res.json(data);
            }
        }
        catch (e) {
            // Supabase query failed, fallback to local store
        }
    }
    catch (err) {
        // Fallback to local store
    }
    res.json(localStore.decks);
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
app.post('/api/cards/:cardId/star', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { cardId } = req.params;
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userId) || 'demo-user-id';
        try {
            yield supabase.from('starred_cards').insert([{ card_id: cardId, user_id: userId }]);
        }
        catch (e) {
            // Fallback to local
        }
        getStarredSetForUser(userId).add(cardId);
        persistLocalData();
        res.status(201).json({ message: 'Card starred successfully', cardId, userId });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Unstar a card
app.delete('/api/cards/:cardId/star', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { cardId } = req.params;
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userId) || ((_c = req.query) === null || _c === void 0 ? void 0 : _c.userId) || 'demo-user-id';
        try {
            yield supabase.from('starred_cards').delete().eq('card_id', cardId).eq('user_id', userId);
        }
        catch (e) {
            // Fallback
        }
        getStarredSetForUser(userId).delete(cardId);
        persistLocalData();
        res.status(200).json({ message: 'Card unstarred successfully', cardId, userId });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Get all starred cards for a user
app.get('/api/users/:userId/starred-cards', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const targetUserId = req.params.userId === 'me' ? (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'demo-user-id') : req.params.userId;
        try {
            const { data, error } = yield supabase
                .from('starred_cards')
                .select('card_id, cards(*)')
                .eq('user_id', targetUserId);
            if (!error && data && data.length > 0) {
                const cardsWithDecks = data
                    .filter((item) => item.cards)
                    .map((item) => (Object.assign(Object.assign({}, item.cards), { video_url: formatVideoUrl(item.cards.video_url) })));
                if (cardsWithDecks.length > 0) {
                    return res.json({ cards: cardsWithDecks });
                }
            }
        }
        catch (e) {
            // Fallback to local store
        }
        const userStarredSet = getStarredSetForUser(targetUserId);
        const cardIds = Array.from(userStarredSet);
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
app.get('/api/users/:userId/starred-card-ids', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const targetUserId = req.params.userId === 'me' ? (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'demo-user-id') : req.params.userId;
    try {
        const { data, error } = yield supabase
            .from('starred_cards')
            .select('card_id')
            .eq('user_id', targetUserId);
        if (!error && data && data.length > 0) {
            return res.json({ cardIds: data.map((d) => d.card_id) });
        }
    }
    catch (e) {
        // Fallback to local store
    }
    const userStarredSet = getStarredSetForUser(targetUserId);
    res.json({ cardIds: Array.from(userStarredSet) });
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
// GET user practice preferences (dominant hand & sound)
app.get('/api/users/:userId/preferences', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const targetUserId = req.params.userId === 'me' ? (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'demo-user-id') : req.params.userId;
    try {
        const { data, error } = yield supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', targetUserId)
            .single();
        if (!error && data) {
            return res.json({
                dominantHand: data.dominant_hand || 'right',
                soundEnabled: Boolean(data.sound_enabled)
            });
        }
    }
    catch (e) {
        // Fallback to local store
    }
    const prefs = localStore.userPreferences.get(targetUserId) || userPreferencesStore.get(targetUserId) || { dominantHand: 'right', soundEnabled: false };
    res.json(prefs);
}));
// POST user practice preferences
app.post('/api/users/:userId/preferences', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const targetUserId = req.params.userId === 'me' ? (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'demo-user-id') : req.params.userId;
    const { dominantHand, soundEnabled } = req.body;
    const validHand = dominantHand === 'left' ? 'left' : 'right';
    const existing = localStore.userPreferences.get(targetUserId) || { dominantHand: 'right', soundEnabled: false };
    const updated = {
        dominantHand: validHand,
        soundEnabled: typeof soundEnabled === 'boolean' ? soundEnabled : existing.soundEnabled
    };
    try {
        yield supabase.from('user_preferences').upsert({
            user_id: targetUserId,
            dominant_hand: updated.dominantHand,
            sound_enabled: updated.soundEnabled,
            updated_at: new Date().toISOString()
        });
    }
    catch (e) {
        // Fallback to local store
    }
    localStore.userPreferences.set(targetUserId, updated);
    userPreferencesStore.set(targetUserId, { dominantHand: validHand });
    persistLocalData();
    res.json(Object.assign({ success: true }, updated));
}));
// POST a practice attempt summary (no raw video)
app.post('/api/practice/attempts', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userId) || 'demo-user-id';
        const { signId, overallScore, dominantHand, durationMs, dimensionResults } = req.body;
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
        try {
            yield supabase.from('practice_sessions').insert([{
                    user_id: userId,
                    sign_attempted: signId,
                    ai_score: attempt.overallScore,
                    landmark_data: dimensionResults,
                    created_at: attempt.createdAt
                }]);
        }
        catch (e) {
            // Fallback
        }
        const existing = practiceAttemptsStore.get(userId) || [];
        existing.push(attempt);
        practiceAttemptsStore.set(userId, existing);
        localStore.practiceAttempts.set(userId, existing);
        persistLocalData();
        res.status(201).json({ success: true, attempt });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to save practice attempt' });
    }
}));
// GET past practice attempts for a user
app.get('/api/users/:userId/practice-attempts', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const targetUserId = req.params.userId === 'me' ? (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'demo-user-id') : req.params.userId;
    try {
        const { data, error } = yield supabase
            .from('practice_sessions')
            .select('*')
            .eq('user_id', targetUserId)
            .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
            const attempts = data.map((item) => ({
                id: item.id,
                userId: item.user_id,
                signId: item.sign_attempted,
                overallScore: Number(item.ai_score) || 0,
                dimensionResults: item.landmark_data || {},
                createdAt: item.created_at
            }));
            return res.json({ attempts });
        }
    }
    catch (e) {
        // Fallback
    }
    const attempts = practiceAttemptsStore.get(targetUserId) || localStore.practiceAttempts.get(targetUserId) || [];
    res.json({ attempts });
}));
// Save test quiz result
app.post('/api/test/results', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userId) || 'demo-user-id';
        const { deckId, score, totalQuestions, correctCount } = req.body;
        const record = {
            id: `result_${Date.now()}`,
            userId,
            deckId: deckId || 'all-decks',
            score: Number(score) || 0,
            totalQuestions: Number(totalQuestions) || 0,
            correctCount: Number(correctCount) || 0,
            completedAt: new Date().toISOString()
        };
        try {
            yield supabase.from('test_results').insert([{
                    user_id: userId,
                    deck_id: record.deckId,
                    score: record.score,
                    total_questions: record.totalQuestions,
                    correct_count: record.correctCount,
                    completed_at: record.completedAt
                }]);
        }
        catch (e) {
            // Fallback
        }
        if (!localStore.testResults.has(userId)) {
            localStore.testResults.set(userId, []);
        }
        localStore.testResults.get(userId).push(record);
        persistLocalData();
        res.status(201).json({ success: true, result: record });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to save test result' });
    }
}));
// GET past test results for a user
app.get('/api/users/:userId/test-results', optionalAuthenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const targetUserId = req.params.userId === 'me' ? (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'demo-user-id') : req.params.userId;
    try {
        const { data, error } = yield supabase
            .from('test_results')
            .select('*')
            .eq('user_id', targetUserId)
            .order('completed_at', { ascending: false });
        if (!error && data && data.length > 0) {
            return res.json({ results: data });
        }
    }
    catch (e) {
        // Fallback
    }
    const results = localStore.testResults.get(targetUserId) || [];
    res.json({ results });
}));
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
