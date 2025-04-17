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
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: 'http://localhost:3000', // React app's default port
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
// Serve video files
const videosDir = path_1.default.join(__dirname, '../../Videos');
app.use('/videos', express_1.default.static(videosDir));
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// Function to clear existing data
const clearExistingData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Delete all cards
        yield supabase
            .from('cards')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        // Delete all decks
        yield supabase
            .from('decks')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        // Delete all users
        yield supabase
            .from('users')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        console.log('Existing data cleared successfully');
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
        // Create a sample user
        const { data: user, error: userError } = yield supabase
            .from('users')
            .insert([
            { email: 'demo@example.com', password: 'demo123' }
        ])
            .select()
            .single();
        if (userError)
            throw userError;
        // Create a sample deck
        const { data: deck, error: deckError } = yield supabase
            .from('decks')
            .insert([
            { title: 'ASL Conversation Vocabulary', user_id: user.id }
        ])
            .select()
            .single();
        if (deckError)
            throw deckError;
        // Read the vocabulary file
        const vocabularyFilePath = path_1.default.join(__dirname, '../../Videos/Beginning ASL 1/VocabularyRealtedtoConversation.txt');
        const fileContent = fs_1.default.readFileSync(vocabularyFilePath, 'utf-8');
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
        const { error: cardsError } = yield supabase
            .from('cards')
            .insert(videoEntries);
        if (cardsError)
            throw cardsError;
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
// Initialize data when server starts
initializeData();
// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Get all users
app.get('/api/users', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Fetching users...');
        const { data, error } = yield supabase
            .from('users')
            .select('*');
        if (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
        console.log('Users found:', data);
        res.json(data);
    }
    catch (error) {
        console.error('Error in /api/users:', error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Get all decks for a user
app.get('/api/decks/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data, error } = yield supabase
            .from('decks')
            .select('*')
            .eq('user_id', req.params.userId);
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Get all cards in a deck
app.get('/api/cards/:deckId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data, error } = yield supabase
            .from('cards')
            .select('*')
            .eq('deck_id', req.params.deckId);
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Serve a test video file for checking if videos are loading
app.get('/api/test-video', (req, res) => {
    res.json({
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4'
    });
});
// Start the server
const PORT = process.env.PORT || 8080; // Currently set to 8080
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
