# Project: ASL Study Tool Frontend Redesign & Modernization

## Architecture
- **Framework & Runtime**: React 19.1.0, React Router DOM 7.5.0, TypeScript 5.4.2, Webpack 5 via react-scripts.
- **Styling Architecture**: Semantic pure CSS with centralized custom properties token foundation (`tokens.css` / `:root` variables) adhering to `design-taste-frontend`.
- **Design Tokens**:
  - Surfaces: Rich warm-slate palette (`--surface-bg: #0b0f17`, `--surface-card: #151d2c`, `--surface-card-hover: #1c273a`, `--surface-border: #293548`).
  - Typography: High-contrast legible text (`--text-primary: #f8fafc`, `--text-secondary: #94a3b8`, `--text-muted: #64748b`).
  - Single Locked Accent: Electric Indigo (`--accent-primary: #6366f1`, `--accent-hover: #4f46e5`, `--accent-subtle: rgba(99, 102, 241, 0.12)`) and Amber Gold for starred indicators (`--accent-star: #f59e0b`).
  - Geometry: Unified rounded radii (`--radius-card: 16px`, `--radius-btn: 10px`, `--radius-pill: 9999px`).
  - Tactile Motion: `active:scale-[0.98]` physical depth, smooth transitions, full `prefers-reduced-motion` compliance.
- **Anti-Slop Hard Rule**: ZERO em-dashes (`—`) anywhere in user-facing copy, buttons, instructions, or modals.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Warm-Slate Surface Token System | Standardized CSS variables for warm-slate surfaces, borders, elevations | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Single Locked Accent Palette | Electric Indigo (#6366f1) primary interactive accent + Amber (#f59e0b) for stars | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Unified Geometry & Elevation | Standardized corner radii (16px cards, 10px buttons) and layered border shadows | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Eradication of !important Overrides | Remove all 61 `!important` declarations from index.css, App.css, Home.css, etc. | M1 | ORIGINAL_REQUEST §R2 |
| 5 | Eradication of `position: absolute` Root Lockout | Refactor `.App` to normal document flow flexbox column with `min-h-[100dvh]` | M1 | ORIGINAL_REQUEST §R2 |
| 6 | Eradication of `100vw` Layout Bugs | Replace all 12 occurrences of `100vw` with `100%` and max-w bounded containers | M1 | ORIGINAL_REQUEST §R2 |
| 7 | Application Shell & Navigation | Top responsive navigation bar with logo, links, mobile drawer/toggle | M1 | ORIGINAL_REQUEST §R2 |
| 8 | Breadcrumbs & Header Actions | Clear back-navigation and breadcrumb hierarchy replacing raw floating buttons | M1 | ORIGINAL_REQUEST §R2 |
| 9 | Persistent Footer | Polished, responsive footer retaining author metadata and links | M1 | ORIGINAL_REQUEST §R2 |
| 10 | Zero Em-Dash Repository Eradication | Purge existing dashes from robots.txt, evaluator.ts, and prevent anywhere in UI | M1 | ORIGINAL_REQUEST §R1 |
| 11 | Home Hero Banner | Viewport-calibrated hero (headline ≤2 lines, subtext ≤20 words, max 1 eyebrow) | M2 | ORIGINAL_REQUEST §R3 |
| 12 | Real-Time Search & Category Filters | Instant deck/sign filtering with direct deep-linking | M2 | ORIGINAL_REQUEST §R3 |
| 13 | Starred Cards Quick Access | Dedicated entry-point and count badge for virtual starred cards deck | M2 | ORIGINAL_REQUEST §R3 |
| 14 | Fingerspelling Quick-Launch | Highlighted launcher card for asl.ms fingerspelling trainer | M2 | ORIGINAL_REQUEST §R3 |
| 15 | Responsive Deck Grid | Fluid, non-overflowing card grid with tactile hover elevation | M2 | ORIGINAL_REQUEST §R3 |
| 16 | Flashcard 3D Flip Mechanics | Smooth 3D card flip (`preserve-3d`, `rotateY(180deg)`) without layout jitter | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Streaming Video Playback & Fallback | Native HTML5 video player with Google Drive iframe embed fallback | M3 | ORIGINAL_REQUEST §R3 |
| 18 | Batch Flashcard Controls | "Show Answers / Show Videos" flip-all toggle via refs | M3 | ORIGINAL_REQUEST §R3 |
| 19 | Star / Unstar Card Toggle | Instant star toggle with persistent synchronization (localStorage + API) | M3 | ORIGINAL_REQUEST §R3 |
| 20 | Infinite Scroll & Pagination | Card pagination (20 cards/page) with IntersectionObserver | M3 | ORIGINAL_REQUEST §R3 |
| 21 | Fixed Header Collision Resolution | Clean responsive header avoiding mobile collision between back and deck actions | M3 | ORIGINAL_REQUEST §R2 |
| 22 | Gamified Test Flow | Card-by-card question prompt with clean video presentation | M4 | ORIGINAL_REQUEST §R3 |
| 23 | Slash-Variant Answer Validation | Flexible case-insensitive answer matching ("thank you/you're welcome") | M4 | ORIGINAL_REQUEST §R3 |
| 24 | Test Progress Bar & Counter | Clean progress indicator without dashboard-clutter background tracks | M4 | ORIGINAL_REQUEST §R3 |
| 25 | Missing `.back-btn` Class Fix | Style `.back-btn` in TestMode.css to resolve unstyled back button | M4 | Survey Explorer 1 |
| 26 | Test Score Summary & Review | Comprehensive post-test results with correct vs. incorrect breakdown and retry | M4 | ORIGINAL_REQUEST §R3 |
| 27 | Auto-Starring Incorrect Answers | Automatic starring of missed signs for targeted reinforcement | M4 | ORIGINAL_REQUEST §R3 |
| 28 | Fingerspelling Sprite Renderer | 240px sprite sheet indexing for single letters, double letters, blank | M5 | ORIGINAL_REQUEST §R3 |
| 29 | Tempo Slider & Speed Presets | Preset buttons (slow, medium, fast, deaf) plus 100-1500ms tempo slider | M5 | ORIGINAL_REQUEST §R3 |
| 30 | Streak & Session Statistics | Real-time tracking of streak, accuracy, best streak, and word counter | M5 | ORIGINAL_REQUEST §R3 |
| 31 | Web Audio Synthesis Feedback | Sine wave for correct guesses, triangle wave for incorrect guesses | M5 | ORIGINAL_REQUEST §R3 |
| 32 | Homework Verification Sheet | Formatted verification panel with student name, date, score, and streak | M5 | ORIGINAL_REQUEST §R3 |
| 33 | AI Webcam Practice Modal | MediaPipe Tasks Vision landmark evaluation across 6 sign dimensions | M5 | ORIGINAL_REQUEST §R3 |
| 34 | Handedness Toggle | Left/right hand inversion for symmetrical landmark scoring | M5 | ORIGINAL_REQUEST §R3 |
| 35 | Practice Disclaimer Modal | First-time consent modal with persistent dismissal in localStorage | M5 | ORIGINAL_REQUEST §R3 |
| 36 | Tactile Feedback & Active Press | Subtle physical push `active:scale-[0.98]` on all interactive elements | M1-M5 | ORIGINAL_REQUEST §R4 |
| 37 | Prefers-Reduced-Motion Support | Graceful instant state changes when reduced-motion is requested | M1-M5 | ORIGINAL_REQUEST §R4 |
| 38 | Keyboard Navigation Accessibility | Full keyboard operability (Space/Arrows for flip, Enter to submit, Esc to close) | M1-M5 | ORIGINAL_REQUEST §R4 |
| 39 | WCAG AA Contrast Compliance | Minimum 4.5:1 text/interactive contrast across all surfaces and states | M1-M5 | ORIGINAL_REQUEST §R1 |
| 40 | E2E Test Suite 100% Pass | Pass all test cases across Tiers 1-4 of the E2E test suite | M6 | ORIGINAL_REQUEST §Verification |
| 41 | Adversarial Coverage Hardening | Tier 5 white-box stress testing and edge case validation | M6 | PROJECT PATTERN §Final |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Design Tokens, Shell Layout & Core Reset | Design tokens, index.css/App.css reset, navigation bar, breadcrumbs, footer, zero em-dash clean | none | COMPLETE |
| M2 | Home & Dashboard Hub Refinement | Home.tsx, Home.css, search, filters, hero banner, quick launchers, responsive deck grid | M1 | COMPLETE |
| M3 | Deck & Flashcard Interactive View | Deck.tsx/css, Flashcard.tsx/css, 3D flip, video stream/iframe fallback, flip-all, star toggle | M1 | COMPLETE |
| M4 | Test Mode & Gamified Workflow | TestMode.tsx/css, quiz flow, progress indicator, answer validation, score summary, back-btn fix | M1 | COMPLETE |
| M5 | Fingerspelling Trainer & Practice Modals | FingerspellingPractice.tsx/css, PracticeModal.tsx/css, PracticeDisclaimerModal.tsx/css | M1 | COMPLETE |
| M6 | Final Milestone: E2E Test Pass & Hardening | Phase 1: 100% E2E test suite pass (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5). | M1, M2, M3, M4, M5, E2E | COMPLETE |

## Interface Contracts
### Global Navigation ↔ Pages
- `Navigation.tsx` renders top bar with routes: `/` (Home), `/deck/all-starred` (Starred), `/fingerspelling` (Fingerspelling), `/test/all-decks` (Test All).
- Accepts optional breadcrumb props or extracts path from `useLocation()`.

### Flashcard ↔ Deck
- `Flashcard.tsx` receives: `card: Card`, `isFlipped: boolean`, `onFlip: (id: string) => void`, `isStarred: boolean`, `onToggleStar: (id: string) => void`, `onPracticeClick?: (card: Card) => void`.
- Exposes imperative flip handle or responds to `isFlipped` prop for batch flip.

### Video Utilities ↔ Flashcard & TestMode
- `getVideoSource(url: string)` returns `{ isDirectStream: boolean, streamUrl: string, iframeUrl: string }`.
- Ensures smooth aspect ratio preservation without layout shifting.

### Practice Modal ↔ App
- `PracticeModal.tsx` receives: `card: Card`, `isOpen: boolean`, `onClose: () => void`.
- Ensures complete webcam stream track termination on close (`track.stop()`).

## Code Layout
```
ASLStudyTool/client/
├── public/
│   ├── images/fs-sprite-240.webp     # Fingerspelling 240px sprite sheet
│   ├── models/                       # MediaPipe landmark model files
│   ├── wasm/                         # MediaPipe WASM binaries
│   └── robots.txt                    # Public crawler directives (dash-free)
├── src/
│   ├── components/
│   │   ├── Deck.tsx / Deck.css
│   │   ├── Flashcard.tsx / Flashcard.css
│   │   ├── Footer.tsx / Footer.css
│   │   ├── Home.tsx / Home.css
│   │   ├── Navigation.tsx / Navigation.css    # Unified application shell top nav
│   │   ├── TestMode.tsx / TestMode.css
│   │   ├── FingerspellingPractice.tsx / FingerspellingPractice.css
│   │   ├── PracticeModal.tsx / PracticeModal.css
│   │   └── PracticeDisclaimerModal.tsx / PracticeDisclaimerModal.css
│   ├── data/
│   │   └── fingerspellingWords.ts    # 5,410 Lifeprint words
│   ├── practice/                     # Vision service, normalizer, evaluator
│   ├── styles/
│   │   └── tokens.css                # Centralized warm-slate tokens and variables
│   ├── utils/                        # videoUtils.ts, etc.
│   ├── App.tsx / App.css
│   └── index.tsx / index.css
```
