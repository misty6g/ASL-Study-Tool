# ASL Study Tool: Test Infrastructure & Verification Architecture

## 1. Test Philosophy: Opaque-Box, Requirement-Driven Testing

The ASL Study Tool testing framework is engineered around **opaque-box, requirement-driven verification**. Tests interact with the application strictly from the perspective of an end user or assistive technology, asserting upon observable behaviors, DOM states, accessibility trees, and visual token contracts rather than private component internals.

### Core Testing Pillars:
1. **User-Centric Assertions**: Queries rely on accessible roles (`screen.getByRole`), labels (`getByLabelText`), placeholders (`getByPlaceholderText`), and visible text content (`getByText`), matching how students navigate the application.
2. **Deterministic Test Isolation**: Every test case sets up its own isolated DOM, mock storage, and event loop state. Neither global side effects nor test execution ordering compromise test repeatability.
3. **Spec-Driven Oracle Verification**: Expected outputs are derived directly from authoritative requirements (`ORIGINAL_REQUEST.md`, `PROJECT.md`, and `design-taste-frontend`).
4. **Adversarial & Boundary Rigor**: Input boundary stresses (empty searches, zero-card states, invalid IDs, rapid double clicks, audio timing bounds, and extreme tempo values) guarantee robust failure containment and error presentation.
5. **Anti-Slop & Accessibility Safeguards**: Continuous automated enforcement of zero em-dashes (`—`), minimum 4.5:1 WCAG AA contrast, and `prefers-reduced-motion` compliance.

---

## 2. Testing Framework & Directory Layout

The testing stack leverages **React Testing Library (RTL)** and **Jest** via `react-scripts test` (Webpack 5, Babel, and TypeScript 5.4.2).

```
ASLStudyTool/client/
├── src/
│   ├── setupTests.ts                 # Global JSDOM environment, audio, axios & route mocks
│   ├── App.test.tsx                  # Root shell render verification
│   ├── components/
│   │   └── FingerspellingPractice.test.tsx # Unit tests for word bank & fingerspelling
│   ├── practice/
│   │   └── practice.test.ts          # Normalizer, evaluator & feature extractor unit tests
│   └── __e2e__/                      # Comprehensive Opaque-Box E2E Test Suites
│       ├── testHelpers.tsx           # Test environment fixtures, router harness, a11y utils
│       ├── tier1_feature_coverage.test.tsx     # Tier 1: Feature Coverage (Features 1-39)
│       ├── tier2_boundary_cases.test.tsx       # Tier 2: Boundary, Edge & Corner Cases
│       ├── tier3_cross_feature.test.tsx        # Tier 3: Cross-Feature Interactions
│       └── tier4_application_scenarios.test.tsx # Tier 4: Real-World End-to-End User Journeys
```

---

## 3. Test Runner Invocation

Execute all test suites synchronously inside `ASLStudyTool/client`:

```bash
# Run entire test suite (unit + Tiers 1-4)
npm test -- --watchAll=false

# Run individual E2E tier
npm test -- --watchAll=false src/__e2e__/tier1_feature_coverage.test.tsx
npm test -- --watchAll=false src/__e2e__/tier2_boundary_cases.test.tsx
npm test -- --watchAll=false src/__e2e__/tier3_cross_feature.test.tsx
npm test -- --watchAll=false src/__e2e__/tier4_application_scenarios.test.tsx

# Run with verbose output
npm test -- --watchAll=false --verbose
```

---

## 4. Feature Inventory & Coverage Matrix (Features 1–39)

| Feature # | Feature Description | Milestone | Primary Target Component | Test Suite Tier |
|---|---|---|---|---|
| 1 | Warm-Slate Surface Token System | M1 | `tokens.css`, `index.css` | Tier 1 (Area 1) |
| 2 | Single Locked Accent Palette | M1 | `tokens.css` | Tier 1 (Area 1) |
| 3 | Unified Geometry & Elevation | M1 | `tokens.css` | Tier 1 (Area 1) |
| 4 | Eradication of !important Overrides | M1 | `App.css`, `Home.css` | Tier 1 (Area 1) |
| 5 | Eradication of `position: absolute` Root Lockout | M1 | `App.tsx`, `App.css` | Tier 1 (Area 1) |
| 6 | Eradication of `100vw` Layout Bugs | M1 | `index.css`, `tokens.css` | Tier 1 (Area 1) |
| 7 | Application Shell & Navigation | M1 | `Navigation.tsx` | Tier 1 (Area 1) |
| 8 | Breadcrumbs & Header Actions | M1 | `Navigation.tsx` | Tier 1 (Area 1) |
| 9 | Persistent Footer | M1 | `Footer.tsx` | Tier 1 (Area 1) |
| 10 | Zero Em-Dash Repository Eradication | M1 | All components & copy | Tier 1 (Area 1) |
| 11 | Home Hero Banner | M2 | `Home.tsx`, `Home.css` | Tier 1 (Area 2) |
| 12 | Real-Time Search & Category Filters | M2 | `Home.tsx` | Tier 1 (Area 3), Tier 2, Tier 3 |
| 13 | Starred Cards Quick Access | M2 | `Home.tsx`, `Deck.tsx` | Tier 1 (Area 4), Tier 2, Tier 3 |
| 14 | Fingerspelling Quick-Launch | M2 | `Home.tsx` | Tier 1 (Area 5), Tier 4 |
| 15 | Responsive Deck Grid | M2 | `Home.tsx`, `Home.css` | Tier 1 (Area 2) |
| 16 | Flashcard 3D Flip Mechanics | M3 | `Flashcard.tsx`, `Deck.tsx` | Tier 1 (Area 6), Tier 2, Tier 4 |
| 17 | Streaming Video Playback & Fallback | M3 | `Flashcard.tsx`, `videoUtils.ts` | Tier 1 (Area 7), Tier 4 |
| 18 | Batch Flashcard Controls | M3 | `Deck.tsx` | Tier 1 (Area 6), Tier 3, Tier 4 |
| 19 | Star / Unstar Card Toggle | M3 | `Flashcard.tsx`, `Deck.tsx` | Tier 1 (Area 4), Tier 3 |
| 20 | Infinite Scroll & Pagination | M3 | `Deck.tsx` | Tier 1 (Area 6) |
| 21 | Fixed Header Collision Resolution | M3 | `Deck.tsx`, `Navigation.tsx` | Tier 1 (Area 1) |
| 22 | Gamified Test Flow | M4 | `TestMode.tsx` | Tier 1 (Area 8), Tier 4 |
| 23 | Slash-Variant Answer Validation | M4 | `TestMode.tsx` | Tier 1 (Area 8), Tier 2 |
| 24 | Test Progress Bar & Counter | M4 | `TestMode.tsx` | Tier 1 (Area 8) |
| 25 | Missing `.back-btn` Class Fix | M4 | `TestMode.css`, `TestMode.tsx` | Tier 1 (Area 8) |
| 26 | Test Score Summary & Review | M4 | `TestMode.tsx` | Tier 1 (Area 8), Tier 4 |
| 27 | Auto-Starring Incorrect Answers | M4 | `TestMode.tsx` | Tier 1 (Area 8), Tier 3, Tier 4 |
| 28 | Fingerspelling Sprite Renderer | M5 | `FingerspellingPractice.tsx` | Tier 1 (Area 9) |
| 29 | Tempo Slider & Speed Presets | M5 | `FingerspellingPractice.tsx` | Tier 1 (Area 9), Tier 2 |
| 30 | Streak & Session Statistics | M5 | `FingerspellingPractice.tsx` | Tier 1 (Area 9), Tier 4 |
| 31 | Web Audio Synthesis Feedback | M5 | `FingerspellingPractice.tsx` | Tier 1 (Area 9) |
| 32 | Homework Verification Sheet | M5 | `FingerspellingPractice.tsx` | Tier 1 (Area 9), Tier 4 |
| 33 | AI Webcam Practice Modal | M5 | `PracticeModal.tsx` | Tier 1 (Area 10), Tier 4 |
| 34 | Handedness Toggle | M5 | `PracticeModal.tsx` | Tier 1 (Area 10), Tier 3 |
| 35 | Practice Disclaimer Modal | M5 | `PracticeDisclaimerModal.tsx` | Tier 1 (Area 10), Tier 3 |
| 36 | Tactile Feedback & Active Press | M1–M5 | `tokens.css`, buttons, cards | Tier 1 (Area 11) |
| 37 | Prefers-Reduced-Motion Support | M1–M5 | `tokens.css`, `Flashcard.css` | Tier 1 (Area 11) |
| 38 | Keyboard Navigation Accessibility | M1–M5 | `Flashcard.tsx`, `Navigation.tsx` | Tier 1 (Area 11) |
| 39 | WCAG AA Contrast Compliance | M1–M5 | All views & text elements | Tier 1 (Area 11) |

---

## 5. Tiered Test Architecture & Quality Thresholds

### Tier 1: Feature Coverage Suite (`tier1_feature_coverage.test.tsx`)
- **Focus**: Opaque-box functional verification across all primary feature areas (>= 5 tests per major feature area).
- **Major Areas Covered**:
  1. Surface Tokens & Shell Navigation (Features 1–10)
  2. Home Deck Hub & Responsive Grid (Features 11, 15)
  3. Real-Time Search & Filtering (Feature 12)
  4. Starred Cards Access & Persistence (Features 13, 19)
  5. Fingerspelling Quick-Launcher (Feature 14)
  6. Flashcard 3D Flips, Pagination & Batch Operations (Features 16, 18, 20)
  7. Video Playback & Fallback Resolution (Feature 17)
  8. Gamified Test Mode, Slash Validation & Auto-Starring (Features 22, 23, 24, 25, 26, 27)
  9. Fingerspelling Practice, Audio Feedback & Homework Verification (Features 28, 29, 30, 31, 32)
  10. AI Webcam Practice, Handedness & Disclaimer Modals (Features 33, 34, 35)
  11. Tactile Feedback, Reduced Motion, Keyboard A11y & WCAG AA Contrast (Features 36, 37, 38, 39)
- **Minimum Target**: >= 55 tests.

### Tier 2: Boundary & Corner Cases Suite (`tier2_boundary_cases.test.tsx`)
- **Focus**: Extreme conditions, boundary thresholds, missing resources, and adversarial input combinations.
- **Specific Scenarios**:
  - Empty search inputs, whitespace-only queries, and strings yielding zero results.
  - Non-existent deck routes (`/deck/invalid-id`, `/test/unknown-deck`).
  - Empty starred state (0 starred cards, missing localStorage).
  - Rapid flip toggling (re-entrance and race avoidance).
  - Tempo slider exact boundaries (100ms minimum, 1500ms maximum) and preset transitions.
  - Extreme input lengths, special characters, and accents in quiz submission.
  - Slash variant edge cases (multiple slashes, leading/trailing whitespace, casing).
  - Extreme fingerspelling word lengths (1 letter vs 15+ letters).
- **Minimum Target**: >= 25 tests.

### Tier 3: Cross-Feature Interactions Suite (`tier3_cross_feature.test.tsx`)
- **Focus**: State handoffs and pairwise feature workflows across disparate components.
- **Specific Scenarios**:
  - Search on Home -> Navigate to Deck -> Star a card -> Verify Starred deck count updates.
  - Navigate between Deck view and Test Mode, preserving deck ID and returning cleanly.
  - Test mode auto-starring missed signs -> Return to Home -> Starred deck displays newly starred cards.
  - Switching dominant hand in Practice Modal -> Running vision evaluation -> Verifying inverted landmark coordinate handling.
  - Custom word bank entered in Fingerspelling -> Switching speed presets -> Verifying custom word queue persists.
  - Batch "Flip All" operation -> Flipping individual card -> Verifying independent flip state.
  - Disclaimer modal "Don't show again" check -> Dismissal persisted in localStorage across page reloads.
- **Minimum Target**: >= 15 tests.

### Tier 4: Real-World Application Scenarios Suite (`tier4_application_scenarios.test.tsx`)
- **Focus**: Comprehensive, multi-step end-to-end user journeys mirroring authentic study sessions.
- **Specific Scenarios**:
  1. **Full Study Session Journey**: Home hero -> Browse decks -> Select deck -> Inspect 3D card -> Star card -> Return to Home.
  2. **Batch Study & Flip-All Journey**: Deck view -> Batch reveal all answers -> Batch reset to videos -> Individual card inspection.
  3. **Complete Test Quiz & Score Review**: Launch Test Mode -> Answer series of questions with correct & incorrect inputs -> Reach quiz completion -> Verify score calculation and auto-starred review list.
  4. **Fingerspelling Mastery Progression**: Open asl.ms trainer -> Adjust speed preset -> Correctly guess consecutive words -> Advance streak counter -> Open verification sheet.
  5. **AI Webcam Practice & Feedback Journey**: Open Flashcard -> Trigger Practice -> Accept disclaimer modal -> Render webcam canvas -> Toggle handedness -> Stop session and verify stream track cleanup.
- **Minimum Target**: >= 10 tests.

---

## 6. Environmental Simulation & Mock Harness

JSDOM does not natively provide hardware APIs (Web Audio, MediaStream, ResizeObserver, or WebGL). The test infrastructure configures high-fidelity synthetic mocks in `setupTests.ts` and `testHelpers.tsx`:
- **Web Audio Context**: Fully mockable AudioContext generating synthetic oscillators and gain nodes for frequency ramp verification.
- **Webcam MediaStream**: Synthetic `navigator.mediaDevices.getUserMedia` returning valid video tracks with track stop tracking.
- **MediaPipe Tasks Vision**: Spy-instrumented vision service processing normalized frames without external network or WASM overhead.
- **IntersectionObserver & ResizeObserver**: Full observer lifecycle mocks with imperative `triggerIntersection` dispatchers.
- **React Router Navigation**: Route-aware mocked router supporting deep-linking, `useParams`, `useLocation`, and standard HTML `<a>` link event propagation.
