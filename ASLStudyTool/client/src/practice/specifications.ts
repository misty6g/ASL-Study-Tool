import { SignSpecification, NormalizedFrame, HandFeatures } from './types';
import { distance3D } from './normalizer';

/**
 * Helper to retrieve all dominant (or tracked) hands from captured frames.
 */
function getSigningHands(frames: NormalizedFrame[]): { frame: NormalizedFrame; hand: HandFeatures }[] {
  const result: { frame: NormalizedFrame; hand: HandFeatures }[] = [];
  for (const f of frames) {
    const dom = f.hands.find(h => h.isDominant) || f.hands[0];
    if (dom) {
      result.push({ frame: f, hand: dom });
    }
  }
  return result;
}

export const PRACTICE_SIGN_SPECIFICATIONS: Record<string, SignSpecification> = {
  hello: {
    id: 'hello',
    name: 'Hello',
    aliases: ['hello', 'hi', 'hey'],
    version: '1.0.0',
    description: 'A friendly salute-like gesture starting near the temple/forehead and moving outward.',
    requiredHands: 'one',
    instructions: 'Bring your dominant hand to your temple with fingers extended, then move it outward to the side in a smooth salute motion.',
    expectedHandshape: 'Flat hand (open palm)',
    expectedLocationZone: 'forehead',
    expectedPalmDirection: 'away',
    rules: [
      {
        id: 'hello-visibility',
        dimension: 'visibility',
        description: 'Keep your dominant hand visible throughout the sign.',
        weight: 0.4,
        feedbackOnFail: 'Keep your signing hand clearly in view of the camera from start to finish.',
        feedbackOnSuccess: 'Dominant hand remained clearly visible.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          const ratio = frames.length > 0 ? tracked.length / frames.length : 0;
          const passed = tracked.length >= 8;
          const score = passed ? Math.min(1.0, 0.75 + (tracked.length / 25) * 0.25) : Math.max(0.2, (tracked.length / 8) * 0.45);
          return {
            passed,
            score,
            observedDetail: `${tracked.length} frames tracked (${Math.round(ratio * 100)}%)`,
          };
        },
      },
      {
        id: 'hello-start-location',
        dimension: 'location',
        description: 'Start with dominant hand near the temple or forehead.',
        weight: 1.3,
        feedbackOnFail: 'Start your hand higher up, near your temple or forehead.',
        feedbackOnSuccess: 'Great starting position at temple height.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          // Temple/forehead height: wrist Y <= -0.32 or fingertips <= -0.48 or forehead zone
          const startCutoff = Math.max(3, Math.floor(tracked.length * 0.45));
          const earlyHands = tracked.slice(0, startCutoff);
          const templeEarlyHands = earlyHands.filter(
            t => t.hand.wrist.y <= -0.32 || t.hand.fingertips.index.y <= -0.48 || t.hand.bodyZone === 'forehead'
          );
          const templeHandsTotal = tracked.filter(
            t => t.hand.wrist.y <= -0.32 || t.hand.fingertips.index.y <= -0.48 || t.hand.bodyZone === 'forehead'
          );
          const minY = Math.min(...tracked.map(t => t.hand.wrist.y));
          const passed = templeHandsTotal.length >= 4 && templeEarlyHands.length >= 2;
          const score = passed ? 0.95 : Math.max(0.15, 0.55 - Math.max(0, minY - (-0.32)) * 1.8);

          return {
            passed,
            score,
            observedDetail: `Minimum wrist height Y: ${minY.toFixed(2)}`,
          };
        },
      },
      {
        id: 'hello-handshape',
        dimension: 'handshape',
        description: 'Keep fingers extended in a flat B or open hand.',
        weight: 1.2,
        feedbackOnFail: 'Extend your fingers more fully into a flat hand.',
        feedbackOnSuccess: 'Nice flat handshape with fingers extended.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const flatCount = tracked.filter(
            t => t.hand.fingerStates.index !== 'curled' && t.hand.fingerStates.middle !== 'curled' && t.hand.fingerStates.ring !== 'curled'
          ).length;
          const ratio = flatCount / tracked.length;
          const passed = ratio >= 0.65;
          const score = passed ? 0.60 + 0.40 * ratio : Math.max(0.10, ratio * 0.45);

          return {
            passed,
            score,
            observedDetail: `${Math.round(ratio * 100)}% flat handshape`,
          };
        },
      },
      {
        id: 'hello-orientation',
        dimension: 'orientation',
        description: 'Palm should face forward toward the camera.',
        weight: 0.9,
        feedbackOnFail: 'Turn your palm more forward toward the camera as you salute.',
        feedbackOnSuccess: 'Good forward palm orientation.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const awayCount = tracked.filter(
            t => t.hand.palmDirection === 'away' || t.hand.palmNormal.z < -0.1
          ).length;
          const ratio = awayCount / tracked.length;
          const passed = ratio >= 0.50;
          const score = passed ? 0.65 + 0.35 * ratio : Math.max(0.15, ratio * 0.5);

          return {
            passed,
            score,
            observedDetail: `${Math.round(ratio * 100)}% forward palm`,
          };
        },
      },
      {
        id: 'hello-movement',
        dimension: 'movement',
        description: 'Move hand outward away from temple.',
        weight: 1.4,
        feedbackOnFail: 'Move your hand outward away from your head in a distinct wave or salute.',
        feedbackOnSuccess: 'Smooth outward movement away from head.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length < 3) return { passed: false, score: 0 };

          const xs = tracked.map(t => t.hand.wrist.x);
          const rangeX = Math.max(...xs) - Math.min(...xs);
          const startX = xs.slice(0, Math.max(1, Math.floor(xs.length * 0.35))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(xs.length * 0.35));
          const endX = xs.slice(-Math.max(1, Math.floor(xs.length * 0.35))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(xs.length * 0.35));
          const displacement = Math.abs(endX - startX);

          const passed = displacement >= 0.10 || rangeX >= 0.12;
          const score = passed
            ? Math.min(1.0, 0.65 + Math.max(displacement, rangeX) * 2.2)
            : Math.max(0.10, (rangeX / 0.12) * 0.40);

          return {
            passed,
            score,
            observedDetail: `Movement range: ${rangeX.toFixed(2)}, displacement: ${displacement.toFixed(2)}`,
          };
        },
      },
    ],
  },

  thankyou: {
    id: 'thankyou',
    name: "Thank You / You're Welcome",
    aliases: [
      'thank you',
      "thank you/you're welcome",
      "you're welcome",
      'thanks',
      'thank you / you’re welcome',
    ],
    version: '1.0.0',
    description: 'Fingertips start near chin and move outward and slightly down toward the other person.',
    requiredHands: 'one',
    instructions: 'Place the fingertips of your dominant flat hand near your chin, then move your hand outward and slightly down toward the camera.',
    expectedHandshape: 'Flat hand (open palm)',
    expectedLocationZone: 'chin',
    expectedPalmDirection: 'inward',
    rules: [
      {
        id: 'ty-visibility',
        dimension: 'visibility',
        description: 'Keep dominant hand visible in frame.',
        weight: 0.4,
        feedbackOnFail: 'Keep your hand visible from your chin to the forward hold.',
        feedbackOnSuccess: 'Good hand visibility throughout.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          const ratio = frames.length > 0 ? tracked.length / frames.length : 0;
          const passed = tracked.length >= 8;
          const score = passed ? Math.min(1.0, 0.75 + (tracked.length / 25) * 0.25) : Math.max(0.2, (tracked.length / 8) * 0.45);
          return {
            passed,
            score,
            observedDetail: `${tracked.length} frames tracked (${Math.round(ratio * 100)}%)`,
          };
        },
      },
      {
        id: 'ty-start-location',
        dimension: 'location',
        description: 'Start with fingertips touching or near chin.',
        weight: 1.3,
        feedbackOnFail: 'Begin with your fingertips closer to your chin or lips.',
        feedbackOnSuccess: 'Accurate starting position at the chin.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const startCutoff = Math.max(3, Math.floor(tracked.length * 0.4));
          const earlyHands = tracked.slice(0, startCutoff);
          const earlyChinHands = earlyHands.filter(
            t => (t.hand.wrist.y >= -0.55 && t.hand.wrist.y <= -0.15) || t.hand.bodyZone === 'chin'
          );
          const chinHands = tracked.filter(
            t => (t.hand.wrist.y >= -0.55 && t.hand.wrist.y <= -0.15) || t.hand.bodyZone === 'chin'
          );
          const passed = chinHands.length >= 4 && earlyChinHands.length >= 2;
          const score = passed ? 0.95 : 0.20;
          return {
            passed,
            score,
          };
        },
      },
      {
        id: 'ty-handshape',
        dimension: 'handshape',
        description: 'Keep fingers extended and flat together.',
        weight: 1.2,
        feedbackOnFail: 'Keep your fingers extended flat together rather than bent.',
        feedbackOnSuccess: 'Proper flat handshape.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const extendedCount = tracked.filter(
            t => t.hand.fingerStates.index !== 'curled' && t.hand.fingerStates.middle !== 'curled' && t.hand.fingerStates.ring !== 'curled'
          ).length;
          const ratio = extendedCount / tracked.length;
          const passed = ratio >= 0.65;
          const score = passed ? 0.60 + 0.40 * ratio : Math.max(0.10, ratio * 0.45);
          return {
            passed,
            score,
            observedDetail: `${Math.round(ratio * 100)}% flat hand consistency`,
          };
        },
      },
      {
        id: 'ty-movement',
        dimension: 'movement',
        description: 'Move hand outward and forward from chin toward camera.',
        weight: 1.4,
        feedbackOnFail: 'Move your hand smoothly outward and forward away from your chin.',
        feedbackOnSuccess: 'Clear outward motion forward from chin.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length < 3) return { passed: false, score: 0 };

          const firstWrists = tracked.slice(0, 3).map(t => t.hand.wrist);
          const lastWrists = tracked.slice(-3).map(t => t.hand.wrist);
          const dist = distance3D(firstWrists[0], lastWrists[lastWrists.length - 1]);
          const deltaY = lastWrists[0].y - firstWrists[0].y;
          const deltaZ = (lastWrists[0].z ?? 0) - (firstWrists[0].z ?? 0);

          const moved = dist >= 0.10 || (deltaY >= 0.08 && dist >= 0.08) || deltaZ <= -0.08;
          const score = moved ? Math.min(1.0, 0.65 + dist * 2.2) : Math.max(0.10, (dist / 0.10) * 0.40);

          return {
            passed: moved,
            score,
          };
        },
      },
      {
        id: 'ty-orientation',
        dimension: 'orientation',
        description: 'Palm starts facing inward and ends angled forward/upward.',
        weight: 0.9,
        feedbackOnFail: 'Turn your palm more inward toward your face at the start.',
        feedbackOnSuccess: 'Good palm orientation shift from chin to forward.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const earlyHands = tracked.slice(0, Math.max(3, Math.floor(tracked.length * 0.4)));
          const inwardCount = earlyHands.filter(
            t => t.hand.palmDirection === 'inward' || t.hand.palmNormal.z > -0.1
          ).length;
          const ratio = inwardCount / earlyHands.length;
          const passed = ratio >= 0.45;
          const score = passed ? 0.65 + 0.35 * ratio : Math.max(0.15, ratio * 0.50);

          return {
            passed,
            score,
          };
        },
      },
    ],
  },

  good: {
    id: 'good',
    name: 'Good',
    aliases: ['good', 'well'],
    version: '1.0.0',
    description: 'Dominant flat hand starts at chin and moves down to chest level.',
    requiredHands: 'one',
    instructions: 'Place your dominant flat hand at your chin and bring it smoothly down to chest level.',
    expectedHandshape: 'Flat hand',
    expectedLocationZone: 'chin',
    expectedPalmDirection: 'inward',
    rules: [
      {
        id: 'good-visibility',
        dimension: 'visibility',
        description: 'Keep dominant hand visible.',
        weight: 0.4,
        feedbackOnFail: 'Keep your hand within the frame during the downward movement.',
        feedbackOnSuccess: 'Great hand visibility.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          const ratio = frames.length > 0 ? tracked.length / frames.length : 0;
          const passed = tracked.length >= 8;
          const score = passed ? Math.min(1.0, 0.75 + (tracked.length / 25) * 0.25) : Math.max(0.2, (tracked.length / 8) * 0.45);
          return {
            passed,
            score,
            observedDetail: `${tracked.length} frames tracked (${Math.round(ratio * 100)}%)`,
          };
        },
      },
      {
        id: 'good-start-location',
        dimension: 'location',
        description: 'Start at chin level.',
        weight: 1.3,
        feedbackOnFail: 'Start your hand closer to your chin.',
        feedbackOnSuccess: 'Accurate starting position at the chin.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const startCutoff = Math.max(3, Math.floor(tracked.length * 0.4));
          const earlyHands = tracked.slice(0, startCutoff);
          const earlyChinHands = earlyHands.filter(
            t => (t.hand.wrist.y >= -0.55 && t.hand.wrist.y <= -0.15) || t.hand.bodyZone === 'chin'
          );
          const chinHands = tracked.filter(
            t => (t.hand.wrist.y >= -0.55 && t.hand.wrist.y <= -0.15) || t.hand.bodyZone === 'chin'
          );
          const passed = chinHands.length >= 4 && earlyChinHands.length >= 2;
          const score = passed ? 0.95 : 0.20;
          return { passed, score };
        },
      },
      {
        id: 'good-movement',
        dimension: 'movement',
        description: 'Move hand downward to chest level.',
        weight: 1.4,
        feedbackOnFail: 'Move your hand clearly downward from your chin toward your chest.',
        feedbackOnSuccess: 'Clean downward motion from chin to chest.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length < 3) return { passed: false, score: 0 };

          const ys = tracked.map(t => t.hand.wrist.y);
          const rangeY = Math.max(...ys) - Math.min(...ys);
          const startY = ys.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, ys.length);
          const endY = ys.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, ys.length);
          const deltaY = endY - startY;

          const passed = deltaY >= 0.10 || rangeY >= 0.12;
          const score = passed ? Math.min(1.0, 0.65 + Math.max(deltaY, rangeY) * 2.2) : Math.max(0.10, (rangeY / 0.12) * 0.40);
          return {
            passed,
            score,
          };
        },
      },
      {
        id: 'good-handshape',
        dimension: 'handshape',
        description: 'Maintain flat open hand.',
        weight: 1.3,
        feedbackOnFail: 'Keep your fingers extended flat together.',
        feedbackOnSuccess: 'Consistent flat handshape.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const count = tracked.filter(
            t => t.hand.fingerStates.index !== 'curled' && t.hand.fingerStates.middle !== 'curled' && t.hand.fingerStates.ring !== 'curled'
          ).length;
          const ratio = count / tracked.length;
          const passed = ratio >= 0.65;
          const score = passed ? 0.60 + 0.40 * ratio : Math.max(0.10, ratio * 0.45);
          return { passed, score };
        },
      },
    ],
  },

  forgot: {
    id: 'forgot',
    name: 'Forgot',
    aliases: ['forgot', 'forget'],
    version: '1.0.0',
    description: 'Flat hand wipes across the forehead from dominant to non-dominant side.',
    requiredHands: 'one',
    instructions: 'Place your flat hand against your forehead and wipe across your forehead outward.',
    expectedHandshape: 'Flat hand curling across swipe',
    expectedLocationZone: 'forehead',
    expectedPalmDirection: 'inward',
    rules: [
      {
        id: 'forgot-location',
        dimension: 'location',
        description: 'Hand should be positioned across forehead.',
        weight: 1.4,
        feedbackOnFail: 'Position your hand higher up across your forehead.',
        feedbackOnSuccess: 'Accurate forehead positioning.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const foreheadHands = tracked.filter(
            t => t.hand.wrist.y <= -0.32 || t.hand.bodyZone === 'forehead'
          );
          const passed = foreheadHands.length >= 4;
          const score = passed ? 0.95 : 0.20;
          return { passed, score };
        },
      },
      {
        id: 'forgot-movement',
        dimension: 'movement',
        description: 'Wipe horizontally across forehead.',
        weight: 1.4,
        feedbackOnFail: 'Make a clear horizontal wiping movement across your forehead.',
        feedbackOnSuccess: 'Clear wiping motion across forehead.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length < 3) return { passed: false, score: 0 };

          const xs = tracked.map(t => t.hand.wrist.x);
          const rangeX = Math.max(...xs) - Math.min(...xs);
          const passed = rangeX >= 0.12;
          const score = passed ? Math.min(1.0, 0.65 + (rangeX - 0.12) * 2.5) : Math.max(0.10, (rangeX / 0.12) * 0.40);
          return {
            passed,
            score,
          };
        },
      },
      {
        id: 'forgot-visibility',
        dimension: 'visibility',
        description: 'Keep signing hand visible.',
        weight: 0.4,
        feedbackOnFail: 'Keep hand visible near forehead.',
        feedbackOnSuccess: 'Dominant hand remained visible.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          const ratio = frames.length > 0 ? tracked.length / frames.length : 0;
          const passed = tracked.length >= 8;
          const score = passed ? Math.min(1.0, 0.75 + (tracked.length / 25) * 0.25) : Math.max(0.2, (tracked.length / 8) * 0.45);
          return {
            passed,
            score,
            observedDetail: `${tracked.length} frames tracked (${Math.round(ratio * 100)}%)`,
          };
        },
      },
    ],
  },

  fine: {
    id: 'fine',
    name: 'Fine',
    aliases: ['fine'],
    version: '1.0.0',
    description: 'Open 5-hand with thumb touching or near center of chest.',
    requiredHands: 'one',
    instructions: 'Open your dominant hand into a 5-handshape (fingers spread) and tap or touch your thumb to the center of your chest.',
    expectedHandshape: '5-hand (fingers spread)',
    expectedLocationZone: 'chest',
    expectedPalmDirection: 'left',
    rules: [
      {
        id: 'fine-location',
        dimension: 'location',
        description: 'Hand positioned near center of chest.',
        weight: 1.4,
        feedbackOnFail: 'Hold your hand closer to the center of your chest.',
        feedbackOnSuccess: 'Accurate chest center location.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const chestHands = tracked.filter(
            t => t.hand.wrist.y >= -0.20 && t.hand.wrist.y <= 0.35 && Math.abs(t.hand.wrist.x) <= 0.35
          );
          const passed = chestHands.length >= 4;
          const score = passed ? 0.95 : 0.20;
          return { passed, score };
        },
      },
      {
        id: 'fine-handshape',
        dimension: 'handshape',
        description: '5-handshape with all fingers and thumb spread out.',
        weight: 1.4,
        feedbackOnFail: 'Spread all five fingers wide into a distinct 5-handshape.',
        feedbackOnSuccess: 'Well-spread 5-handshape.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          if (tracked.length === 0) return { passed: false, score: 0 };

          const spreadCount = tracked.filter(
            t =>
              t.hand.fingerStates.thumb !== 'curled' &&
              t.hand.fingerStates.index === 'extended' &&
              t.hand.fingerStates.middle === 'extended' &&
              t.hand.fingerStates.ring !== 'curled'
          ).length;
          const ratio = spreadCount / tracked.length;
          const passed = ratio >= 0.60;
          const score = passed ? 0.60 + 0.40 * ratio : Math.max(0.10, ratio * 0.45);
          return { passed, score };
        },
      },
      {
        id: 'fine-visibility',
        dimension: 'visibility',
        description: 'Keep signing hand visible in front of chest.',
        weight: 0.4,
        feedbackOnFail: 'Make sure your hand stays visible in front of your chest.',
        feedbackOnSuccess: 'Hand was clearly visible throughout.',
        evaluate: (frames: NormalizedFrame[]) => {
          const tracked = getSigningHands(frames);
          const ratio = frames.length > 0 ? tracked.length / frames.length : 0;
          const passed = tracked.length >= 8;
          const score = passed ? Math.min(1.0, 0.75 + (tracked.length / 25) * 0.25) : Math.max(0.2, (tracked.length / 8) * 0.45);
          return {
            passed,
            score,
            observedDetail: `${tracked.length} frames tracked (${Math.round(ratio * 100)}%)`,
          };
        },
      },
    ],
  },
};

/**
 * Normalizes an answer string to match specification keys or aliases.
 */
export function normalizeSignName(answer: string): string {
  return answer
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim();
}

/**
 * Retrieves the practice specification for a given card answer, or null if unsupported.
 */
export function getSignSpecification(cardAnswer: string | undefined): SignSpecification | null {
  if (!cardAnswer) return null;
  const cleanAnswer = normalizeSignName(cardAnswer);

  // Direct ID check
  if (PRACTICE_SIGN_SPECIFICATIONS[cleanAnswer]) {
    return PRACTICE_SIGN_SPECIFICATIONS[cleanAnswer];
  }

  // Alias lookup
  for (const spec of Object.values(PRACTICE_SIGN_SPECIFICATIONS)) {
    if (spec.aliases.some(alias => normalizeSignName(alias) === cleanAnswer)) {
      return spec;
    }
    // Substring match for combined titles like "Thank You/You're Welcome"
    if (
      cleanAnswer.includes(spec.name.toLowerCase()) ||
      spec.aliases.some(alias => cleanAnswer.includes(alias))
    ) {
      return spec;
    }
  }

  return null;
}
