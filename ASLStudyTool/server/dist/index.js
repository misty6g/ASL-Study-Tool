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
                        return {
                            video_url: url,
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
// Search for cards by answer text
app.get('/api/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log('Search API called with query:', req.query);
        const searchTerm = (_a = req.query.term) === null || _a === void 0 ? void 0 : _a.toString().toLowerCase();
        if (!searchTerm) {
            console.log('No search term provided');
            return res.status(400).json({ error: 'Search term is required' });
        }
        console.log(`Searching for term: "${searchTerm}"`);
        // Step 1: Get all cards
        console.log('Fetching all cards...');
        const { data: allCards, error: cardsError } = yield supabase
            .from('cards')
            .select('*');
        if (cardsError) {
            console.error('Error fetching cards:', cardsError);
            throw cardsError;
        }
        console.log(`Retrieved ${allCards ? allCards.length : 0} cards`);
        if (allCards && allCards.length > 0) {
            console.log('Sample card:', allCards[0]);
        }
        // Step 2: Get all decks
        console.log('Fetching all decks...');
        const { data: allDecks, error: decksError } = yield supabase
            .from('decks')
            .select('*');
        if (decksError) {
            console.error('Error fetching decks:', decksError);
            throw decksError;
        }
        console.log(`Retrieved ${allDecks ? allDecks.length : 0} decks`);
        if (allDecks && allDecks.length > 0) {
            console.log('Sample deck:', allDecks[0]);
        }
        // Step 3: Create a map of deck IDs to deck objects for quick lookup
        console.log('Creating decks map...');
        const decksMap = {};
        if (allDecks) {
            allDecks.forEach(deck => {
                decksMap[deck.id] = deck;
            });
        }
        console.log('Decks map created:', Object.keys(decksMap));
        // Step 4: Filter cards based on search term and combine with deck data
        console.log('Filtering cards and mapping to decks...');
        const filteredCards = allCards ? allCards.filter(card => card.answer && card.answer.toLowerCase().includes(searchTerm)) : [];
        console.log(`Found ${filteredCards.length} cards matching "${searchTerm}"`);
        const searchResults = filteredCards.map(card => {
            const deckInfo = decksMap[card.deck_id] || { id: card.deck_id, title: 'Unknown Deck' };
            console.log(`Card "${card.answer}" belongs to deck: ${deckInfo.title} (${card.deck_id})`);
            return {
                id: card.id,
                answer: card.answer,
                video_url: card.video_url,
                deck_id: card.deck_id,
                deck: deckInfo
            };
        });
        console.log(`Returning ${searchResults.length} search results`);
        if (searchResults.length > 0) {
            console.log('Sample result:', searchResults[0]);
        }
        res.json(searchResults);
    }
    catch (error) {
        console.error('Error in search API:', error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
}));
// Simple test search endpoint with static data
app.get('/api/search-test', (req, res) => {
    var _a;
    try {
        console.log('Search test API called with query:', req.query);
        const searchTerm = ((_a = req.query.term) === null || _a === void 0 ? void 0 : _a.toString().toLowerCase()) || '';
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
    }
    catch (error) {
        console.error('Error in test search:', error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || 'An error occurred' });
    }
});
// Main function to start the server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize data first
        yield initializeData();
        console.log('Data initialized successfully.');
        // Then start the server
        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1); // Exit if server fails to start
    }
});
// Start the application
startServer();
