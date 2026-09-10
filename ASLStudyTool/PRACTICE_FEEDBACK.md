# ASL Practice Feedback Feature Documentation

## Overview

The **Practice Feedback** feature allows ASL learners to practice supported isolated signs through their desktop or laptop webcam, compare observable physical aspects of their attempt against a curated reference specification, and receive concise, constructive visual coaching.

Processing runs **locally and privately in the browser** using Google MediaPipe Tasks Vision.

---

## Key Features

1. **Eligible Flashcard Practice Entry**:
   - Flashcards with an active practice specification display a dedicated **📷 Practice** button on both front and back faces.
   - Flashcards without an active specification remain unaffected.
2. **Dominant Hand Preference & Mirroring**:
   - Supports Left-handed and Right-handed signers.
   - Selecting **Left-handed** mirrors body-relative coordinates horizontally ($x = -x$) and swaps dominant/non-dominant roles, allowing left-handed signers to be evaluated with equal accuracy.
   - Preference is saved across sessions in `localStorage` and synchronized via API.
3. **Framing Guidance & Camera Safety**:
   - Real-time indicator confirms upper torso and hands are visible before signing.
   - MediaStream tracks stop immediately upon closing the modal or leaving the practice session.
4. **Explainable, Rules-Driven Evaluation**:
   - Compares observable geometry: handshape, body-relative location, palm orientation, and motion trajectory.
   - Summarized as similarity to configured reference criteria (not an authoritative measure of ASL fluency).
   - Generates top 1–2 actionable coaching suggestions ("Try adjusting...") and highlights strong areas ("Strong: ...").

---

## How to Add Practice Support to a Flashcard

To enable practice feedback for a sign:

1. Open `client/src/practice/specifications.ts`.
2. Add a new `SignSpecification` to `PRACTICE_SIGN_SPECIFICATIONS`:

```typescript
export const PRACTICE_SIGN_SPECIFICATIONS: Record<string, SignSpecification> = {
  // ... existing signs ...
  mysign: {
    id: 'mysign',
    name: 'My Sign',
    aliases: ['my sign', 'mysign'],
    version: '1.0.0',
    description: 'Short description of the sign.',
    requiredHands: 'one', // 'one' | 'two'
    instructions: 'Step-by-step instructions for the learner.',
    expectedHandshape: 'Flat hand (open palm)',
    expectedLocationZone: 'chin', // 'forehead' | 'chin' | 'chest' | 'torso' | 'neutral'
    expectedPalmDirection: 'inward', // 'away' | 'inward' | 'up' | 'down' | 'left' | 'right'
    rules: [
      {
        id: 'mysign-location',
        dimension: 'location',
        description: 'Verify start location at chin.',
        weight: 1.2,
        feedbackOnFail: 'Start your hand closer to your chin.',
        feedbackOnSuccess: 'Great starting position at chin level.',
        evaluate: (frames: NormalizedFrame[]) => {
          // Rule evaluation logic...
          return { passed: true, score: 1.0 };
        },
      },
    ],
  },
};
```

3. Ensure the flashcard's answer in the database matches either the `id`, `name`, or any entry in `aliases`. The system automatically detects eligible cards.

---

## Sign Specification Schema

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (e.g., `'hello'`, `'thankyou'`). |
| `name` | `string` | Human-readable sign label. |
| `aliases` | `string[]` | Alternative names/spellings for matching flashcard answers. |
| `version` | `string` | Specification version (semantic versioning). |
| `description` | `string` | Educational summary of the sign. |
| `requiredHands` | `'one' \| 'two'` | Required number of active hands. |
| `instructions` | `string` | Guidance on how to perform the sign in front of the camera. |
| `expectedHandshape` | `string` | Expected broad handshape template description. |
| `expectedLocationZone` | `BodyZone` | `'forehead'`, `'chin'`, `'chest'`, `'torso'`, or `'neutral'`. |
| `expectedPalmDirection`| `PalmDirection`| `'away'`, `'inward'`, `'up'`, `'down'`, `'left'`, or `'right'`. |
| `rules` | `SignRule[]` | Individual measurable rules evaluated by the engine. |

### Rule Structure

```typescript
interface SignRule {
  id: string;
  dimension: 'visibility' | 'handshape' | 'location' | 'orientation' | 'movement' | 'coordination';
  description: string;
  weight: number;
  feedbackOnFail: string;
  feedbackOnSuccess: string;
  evaluate: (frames: NormalizedFrame[], dominantHand: DominantHand) => {
    passed: boolean;
    score: number; // 0.0 to 1.0
    observedDetail?: string;
  };
}
```

---

## Observable Feature Categories

1. **Camera Visibility**: Verifies the signer's upper body and dominant hand remain in the frame.
2. **Handshape**: Evaluates finger extension/curl states (thumb, index, middle, ring, pinky) and classifies broad shapes (`flat-B`, `open-5`, `fist`, `index-point`, etc.).
3. **Body-Relative Location**: Uses the midpoint between shoulders as `(0, 0, 0)` origin and shoulder width as scale unit, categorizing coordinates into anatomical zones.
4. **Palm Orientation**: Computes palm plane normal via cross product of index MCP, pinky MCP, and wrist vectors.
5. **Movement Trajectory & Displacement**: Evaluates start-to-end vector, direction, velocity, and displacement distance.
6. **Two-Hand Coordination**: Evaluates symmetry and relative distance for two-handed signs.

---

## Privacy & Security

- **Strictly On-Device**: MediaPipe model inference executes inside the user's browser via WebAssembly.
- **No Raw Video Storage**: Webcam video streams are never saved to disk, transmitted over the network, or uploaded to any server.
- **Explicit Access**: Camera permission is only requested when the user clicks **Start Practice**.
- **Immediate Teardown**: Camera tracks are halted immediately when the user closes the modal or navigates away.

---

## Limitations

- **Isolated Signs Only**: Designed for single isolated signs with 1–2 phases; not designed for continuous signing or conversational ASL.
- **Facial Grammar / Non-Manual Markers**: Does not evaluate facial grammar, mouthing, or eyebrow movement.
- **Lighting & Camera Quality**: Requires sufficient lighting and visibility of the upper torso and hands.
