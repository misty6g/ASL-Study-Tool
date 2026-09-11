# Original User Request

## 2026-09-10T20:11:15Z

Use a full team of agents to perform a comprehensive frontend redesign and modernization of the ASL (American Sign Language) Study Tool. Transform the existing bare-bones interface into a warm, engaging, and interactive educational platform with tactile micro-animations, friendly rounded geometry, and robust responsive layouts adhering to the local anti-slop design skill.

Working directory: /Users/gyanmistry/SoftdevI/ASL-Study-Tool/ASLStudyTool/client
Integrity mode: development

## Requirements

### R1. Cohesive Visual Design & Foundation
Establish a unified, warm, and engaging design system throughout the entire client application:
- Implement a harmonious surface and token palette (rich warm-slate surfaces, high-contrast readable typography, and a single locked accent system for study progress and interactive states).
- Establish consistent geometry and elevation (unified rounded card radii, soft layered borders, and tactile elevation shadows).
- Adhere strictly to the anti-slop guidelines in `.agents/skills/design-taste-frontend` (zero em-dashes `—` anywhere in copy, no AI-slop neon glows or generic templates, proper WCAG AA contrast for text and interactive controls).

### R2. Layout & Architectural Overhaul
Eliminate brittle styling hacks and establish clean responsive mechanics:
- Completely eradicate `!important` viewport overrides, `position: absolute` screen lockouts, and `width: 100vw` declarations that currently cause horizontal overflow, clipping, and mobile layout breakage.
- Introduce a clean application shell with consistent top navigation, clear breadcrumbs / back navigation, and a refined persistent footer.
- Ensure fluid responsive behavior across all viewports (mobile < 768px, tablet, and desktop) with zero horizontal page scroll.

### R3. Core Learning Surfaces & Feature Refinement
Redesign all primary study views while keeping 100% of existing functionality intact:
- **Home / Dashboard**: Engaging deck selection hub featuring hero introduction, streamlined real-time search with instant category filters, quick-launch for asl.ms fingerspelling, and dedicated access to Starred cards.
- **Deck & Flashcard View**: Interactive flashcard interface with smooth 3D flip mechanics, seamless video streaming playback, clear instruction cues, flip-all controls, star toggles, and direct trigger for AI webcam practice.
- **Test Mode**: Gamified testing workflow with video presentation, clear answer inputs, instant validation, progress indicator, and an engaging post-test score summary with review of correct vs. incorrect signs.
- **Fingerspelling Practice (asl.ms)**: Redesigned interactive trainer featuring animated handshape image display, tempo/speed slider with presets, streak badges, session stats, and customizable word lists.
- **Practice Modal & Disclaimer**: Clean, focused modal interfaces for MediaPipe webcam feedback, handedness toggles, and live sign similarity scoring.

### R4. Tactile Micro-Interactions & Accessibility
Bring the application to life with purposeful motion and inclusive design:
- Tactile button press feedback (`active:scale-[0.98]` / subtle press depth), smooth card flip transitions, and celebration animations on test milestones or streak gains.
- Complete support for `prefers-reduced-motion` (graceful instant transitions without animation loops).
- Full keyboard navigability (spacebar/arrows for card flips, enter for submission, escape for modals).

## Verification Resources

- **Build Target**: `npm run build` inside `ASLStudyTool/client` must compile with 0 errors.
- **Test Target**: Existing unit tests (`npm test -- --watchAll=false`) must pass.
- **Design Skill Rubric**: Verification against `.agents/skills/design-taste-frontend/SKILL.md` (Pre-Flight Check checklist).

## Acceptance Criteria

### Build & Architectural Health
- [ ] `npm run build` succeeds cleanly in `ASLStudyTool/client` without build errors.
- [ ] All `!important` layout overrides on `.App`, `html`, `body`, `#root`, and `.home-container` in `App.css`, `index.css`, and `Home.css` are eliminated and replaced with standard responsive layout containers.
- [ ] Zero horizontal overflow occurs at mobile (375px), tablet (768px), and desktop (1280px+).

### Design Standards & Quality
- [ ] ZERO em-dashes (`—`) appear anywhere in copy, headings, buttons, instructions, or modals.
- [ ] Consistent visual language applied across all 5 core surfaces: Home, Deck, Test Mode, Fingerspelling, and Modals.
- [ ] All buttons, inputs, and interactive text meet WCAG AA contrast standards (minimum 4.5:1 ratio).
- [ ] `prefers-reduced-motion` media queries or settings are respected for all flip and state animations.

### Functional Completeness
- [ ] Home search returns matching decks and signs, with functional deep-linking.
- [ ] Flashcard flip, star/unstar, and "Show Answers / Show Videos" batch operations function reliably.
- [ ] Video playback loads direct stream or fallback smoothly without breaking card dimensions.
- [ ] Test mode correctly tallies correct/incorrect answers and presents the summary results.
- [ ] Fingerspelling practice generates correct handshape images, respects speed settings, and accurately evaluates guesses.
- [ ] AI practice modal and disclaimer open, operate webcam feed, and close properly.
