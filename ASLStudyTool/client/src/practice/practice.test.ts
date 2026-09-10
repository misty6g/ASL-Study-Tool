import {
  getSignSpecification,
  PRACTICE_SIGN_SPECIFICATIONS,
  normalizeSignName,
} from './specifications';
import {
  calculateNormalizationBasis,
  normalizeCoordinate,
  distance3D,
} from './normalizer';
import {
  classifyHandshape,
  determineBodyZone,
  extractPalmNormal,
} from './featureExtractor';
import { evaluateAttempt } from './evaluator';
import { NormalizedFrame, Landmark3D } from './types';

describe('ASL Practice Feedback Module', () => {
  describe('Sign Specifications', () => {
    test('retrieves practice specifications by direct name or alias', () => {
      const helloSpec = getSignSpecification('Hello');
      expect(helloSpec).not.toBeNull();
      expect(helloSpec?.id).toBe('hello');

      const thankYouSpec = getSignSpecification("Thank You/You're Welcome");
      expect(thankYouSpec).not.toBeNull();
      expect(thankYouSpec?.id).toBe('thankyou');

      const goodSpec = getSignSpecification('Good');
      expect(goodSpec).not.toBeNull();
      expect(goodSpec?.id).toBe('good');
    });

    test('returns null for signs without practice specifications', () => {
      expect(getSignSpecification('Elephant')).toBeNull();
      expect(getSignSpecification('')).toBeNull();
      expect(getSignSpecification(undefined)).toBeNull();
    });

    test('all configured specifications contain required rules and metadata', () => {
      for (const spec of Object.values(PRACTICE_SIGN_SPECIFICATIONS)) {
        expect(spec.id).toBeTruthy();
        expect(spec.name).toBeTruthy();
        expect(spec.version).toBe('1.0.0');
        expect(spec.rules.length).toBeGreaterThan(0);
        expect(spec.instructions).toBeTruthy();
        expect(spec.expectedHandshape).toBeTruthy();
        expect(spec.expectedLocationZone).toBeTruthy();
      }
    });

    test('normalizes sign strings with curly quotes and whitespace', () => {
      expect(normalizeSignName("Thank You / You’re Welcome")).toBe("thank you / you're welcome");
      expect(normalizeSignName("  HELLO  ")).toBe("hello");
    });
  });

  describe('Landmark Normalization & Mirroring', () => {
    test('calculates midpoint origin between left and right shoulders', () => {
      const dummyPose: Landmark3D[] = Array(20).fill({ x: 0, y: 0, z: 0 });
      dummyPose[11] = { x: 0.4, y: 0.5, z: 0, visibility: 0.9 }; // left shoulder
      dummyPose[12] = { x: 0.6, y: 0.5, z: 0, visibility: 0.9 }; // right shoulder
      dummyPose[0] = { x: 0.5, y: 0.3, z: 0, visibility: 0.9 };  // nose

      const basis = calculateNormalizationBasis(dummyPose);
      expect(basis.origin.x).toBeCloseTo(0.5);
      expect(basis.origin.y).toBeCloseTo(0.5);
      expect(basis.scale).toBeCloseTo(0.2);
      expect(basis.shouldersVisible).toBe(true);
    });

    test('normalizes coordinates relative to origin and scale', () => {
      const origin: Landmark3D = { x: 0.5, y: 0.5, z: 0 };
      const scale = 0.2;
      const pt: Landmark3D = { x: 0.7, y: 0.3, z: 0 };

      const rightHandedNorm = normalizeCoordinate(pt, origin, scale, 'right');
      expect(rightHandedNorm.x).toBeCloseTo(1.0);
      expect(rightHandedNorm.y).toBeCloseTo(-1.0);

      // Left-handed mirroring inverts the horizontal X axis
      const leftHandedNorm = normalizeCoordinate(pt, origin, scale, 'left');
      expect(leftHandedNorm.x).toBeCloseTo(-1.0);
      expect(leftHandedNorm.y).toBeCloseTo(-1.0);
    });

    test('calculates 3D euclidean distance', () => {
      const p1: Landmark3D = { x: 0, y: 0, z: 0 };
      const p2: Landmark3D = { x: 3, y: 4, z: 0 };
      expect(distance3D(p1, p2)).toBeCloseTo(5.0);
    });
  });

  describe('Feature Extraction', () => {
    test('classifies handshapes correctly', () => {
      expect(
        classifyHandshape({
          thumb: 'half',
          index: 'extended',
          middle: 'extended',
          ring: 'extended',
          pinky: 'extended',
        })
      ).toBe('flat-B');

      expect(
        classifyHandshape({
          thumb: 'curled',
          index: 'curled',
          middle: 'curled',
          ring: 'curled',
          pinky: 'curled',
        })
      ).toBe('fist');

      expect(
        classifyHandshape({
          thumb: 'curled',
          index: 'extended',
          middle: 'curled',
          ring: 'curled',
          pinky: 'curled',
        })
      ).toBe('index-point');
    });

    test('maps normalized heights to body zones', () => {
      expect(determineBodyZone({ x: 0, y: -0.7, z: 0 })).toBe('forehead');
      expect(determineBodyZone({ x: 0, y: -0.3, z: 0 })).toBe('chin');
      expect(determineBodyZone({ x: 0, y: 0.1, z: 0 })).toBe('chest');
      expect(determineBodyZone({ x: 0, y: 0.6, z: 0 })).toBe('torso');
    });

    test('derives palm normal vector', () => {
      const dummyLandmarks: Landmark3D[] = Array(21).fill({ x: 0, y: 0, z: 0 });
      dummyLandmarks[0] = { x: 0, y: 0, z: 0 };    // wrist
      dummyLandmarks[5] = { x: 0, y: -1, z: 0 };   // index MCP
      dummyLandmarks[17] = { x: 1, y: -1, z: 0 };  // pinky MCP

      const { normal, direction } = extractPalmNormal(dummyLandmarks, 'Right');
      expect(normal).toBeDefined();
      expect(direction).toBeDefined();
    });
  });

  describe('Evaluation Engine & Scoring', () => {
    const helloSpec = PRACTICE_SIGN_SPECIFICATIONS.hello;

    test('returns invalid result when insufficient frames are captured', () => {
      const result = evaluateAttempt([], helloSpec, 'right');
      expect(result.isValid).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.qualityMessage).toContain('Not enough frames');
    });

    test('returns invalid result when dominant hand is missing from frame', () => {
      const emptyFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: i * 100,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 0, isFramedWell: false },
      }));

      const result = evaluateAttempt(emptyFrames, helloSpec, 'right');
      expect(result.isValid).toBe(false);
      expect(result.qualityMessage).toContain('not sufficiently visible');
    });

    test('evaluates valid frames and produces prioritized feedback', () => {
      // Mock 10 frames of a hello attempt
      const mockFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: i * 200,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [
          {
            handedness: 'Right',
            isDominant: true,
            wrist: { x: 0.2 + i * 0.02, y: -0.45, z: 0 }, // temple level, moving outward
            fingertips: {
              thumb: { x: 0.2, y: -0.5, z: 0 },
              index: { x: 0.22, y: -0.65, z: 0 },
              middle: { x: 0.24, y: -0.65, z: 0 },
              ring: { x: 0.26, y: -0.65, z: 0 },
              pinky: { x: 0.28, y: -0.65, z: 0 },
            },
            fingerStates: {
              thumb: 'half',
              index: 'extended',
              middle: 'extended',
              ring: 'extended',
              pinky: 'extended',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'flat-B',
            velocity: { x: 0.02, y: 0, z: 0 },
            bodyZone: 'forehead',
          },
        ],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
      }));

      const result = evaluateAttempt(mockFrames, helloSpec, 'right');
      expect(result.isValid).toBe(true);
      expect(result.overallScore).toBeGreaterThan(60);
      expect(result.dimensionResults.location.status).toBe('strong');
      expect(result.dimensionResults.handshape.status).toBe('strong');
      expect(result.strongPoints.length).toBeGreaterThan(0);
      expect(result.prioritizedTips).toBeDefined();
    });

    test('auto-recovers when MediaPipe reports inverted handedness (selfie camera)', () => {
      // MediaPipe often reports 'Left' for user right hand on front cameras
      const invertedFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: i * 200,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [
          {
            handedness: 'Left',
            isDominant: false, // Originally false because of handedness mismatch
            wrist: { x: 0.2 + i * 0.02, y: -0.45, z: 0 },
            fingertips: {
              thumb: { x: 0.2, y: -0.5, z: 0 },
              index: { x: 0.22, y: -0.65, z: 0 },
              middle: { x: 0.24, y: -0.65, z: 0 },
              ring: { x: 0.26, y: -0.65, z: 0 },
              pinky: { x: 0.28, y: -0.65, z: 0 },
            },
            fingerStates: {
              thumb: 'half',
              index: 'extended',
              middle: 'extended',
              ring: 'extended',
              pinky: 'extended',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'flat-B',
            velocity: { x: 0.02, y: 0, z: 0 },
            bodyZone: 'forehead',
          },
        ],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
      }));

      const result = evaluateAttempt(invertedFrames, helloSpec, 'right');
      expect(result.isValid).toBe(true);
      expect(result.overallRating).not.toBe('needs-practice');
      expect(['great', 'good', 'fair']).toContain(result.overallRating);
    });

    test('realistic attempt with leading and trailing idle frames evaluates to a strong rating', () => {
      // 5 idle frames before + 10 signing frames + 5 idle frames after
      const leadingIdle: NormalizedFrame[] = Array(5).fill(null).map((_, i) => ({
        timestamp: i * 100,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 0, isFramedWell: false },
      }));

      const activeFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: (5 + i) * 100,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [
          {
            handedness: 'Right',
            isDominant: true,
            wrist: { x: 0.15 + i * 0.02, y: -0.4, z: 0 },
            fingertips: {
              thumb: { x: 0.15, y: -0.45, z: 0 },
              index: { x: 0.18, y: -0.6, z: 0 },
              middle: { x: 0.2, y: -0.6, z: 0 },
              ring: { x: 0.22, y: -0.6, z: 0 },
              pinky: { x: 0.24, y: -0.6, z: 0 },
            },
            fingerStates: {
              thumb: 'half',
              index: 'extended',
              middle: 'extended',
              ring: 'extended',
              pinky: 'extended',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'flat-B',
            velocity: { x: 0.02, y: 0, z: 0 },
            bodyZone: 'forehead',
          },
        ],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
      }));

      const trailingIdle: NormalizedFrame[] = Array(5).fill(null).map((_, i) => ({
        timestamp: (15 + i) * 100,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 0, isFramedWell: false },
      }));

      const combinedFrames = [...leadingIdle, ...activeFrames, ...trailingIdle];
      const result = evaluateAttempt(combinedFrames, helloSpec, 'right');

      expect(result.isValid).toBe(true);
      expect(result.overallRating).toBe('great');
      expect(result.ratingWord).toBe('Great');
    });

    test('hand held completely still fails movement and does not get Great', () => {
      // 10 frames with hand at temple, but x does not move (zero movement)
      const stillFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: i * 200,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [
          {
            handedness: 'Right',
            isDominant: true,
            wrist: { x: 0.2, y: -0.45, z: 0 }, // motionless
            fingertips: {
              thumb: { x: 0.2, y: -0.5, z: 0 },
              index: { x: 0.2, y: -0.65, z: 0 },
              middle: { x: 0.2, y: -0.65, z: 0 },
              ring: { x: 0.2, y: -0.65, z: 0 },
              pinky: { x: 0.2, y: -0.65, z: 0 },
            },
            fingerStates: {
              thumb: 'half',
              index: 'extended',
              middle: 'extended',
              ring: 'extended',
              pinky: 'extended',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'flat-B',
            velocity: { x: 0, y: 0, z: 0 },
            bodyZone: 'forehead',
          },
        ],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
      }));

      const result = evaluateAttempt(stillFrames, helloSpec, 'right');
      expect(result.isValid).toBe(true);
      expect(result.overallRating).not.toBe('great');
      expect(result.dimensionResults.movement.status).toBe('adjust');
      expect(result.prioritizedTips.some(t => t.toLowerCase().includes('wave') || t.toLowerCase().includes('move'))).toBe(true);
    });

    test('fist handshape fails handshape rule for hello and does not get Great', () => {
      // Hand moving at temple, but all fingers curled into a fist
      const fistFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: i * 200,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [
          {
            handedness: 'Right',
            isDominant: true,
            wrist: { x: 0.15 + i * 0.02, y: -0.45, z: 0 }, // moving outward
            fingertips: {
              thumb: { x: 0.15, y: -0.4, z: 0 },
              index: { x: 0.15, y: -0.4, z: 0 },
              middle: { x: 0.15, y: -0.4, z: 0 },
              ring: { x: 0.15, y: -0.4, z: 0 },
              pinky: { x: 0.15, y: -0.4, z: 0 },
            },
            fingerStates: {
              thumb: 'curled',
              index: 'curled',
              middle: 'curled',
              ring: 'curled',
              pinky: 'curled',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'fist',
            velocity: { x: 0.02, y: 0, z: 0 },
            bodyZone: 'forehead',
          },
        ],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
      }));

      const result = evaluateAttempt(fistFrames, helloSpec, 'right');
      expect(result.isValid).toBe(true);
      expect(result.overallRating).not.toBe('great');
      expect(result.dimensionResults.handshape.status).toBe('adjust');
      expect(result.prioritizedTips.some(t => t.toLowerCase().includes('flat') || t.toLowerCase().includes('finger'))).toBe(true);
    });

    test('hand at chest level fails location rule for hello and drops rating', () => {
      // Moving at chest level instead of temple
      const chestFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: i * 200,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [
          {
            handedness: 'Right',
            isDominant: true,
            wrist: { x: 0.15 + i * 0.02, y: 0.2, z: 0 }, // at chest level (positive Y)
            fingertips: {
              thumb: { x: 0.15, y: 0.1, z: 0 },
              index: { x: 0.15, y: 0.0, z: 0 },
              middle: { x: 0.15, y: 0.0, z: 0 },
              ring: { x: 0.15, y: 0.0, z: 0 },
              pinky: { x: 0.15, y: 0.0, z: 0 },
            },
            fingerStates: {
              thumb: 'half',
              index: 'extended',
              middle: 'extended',
              ring: 'extended',
              pinky: 'extended',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'flat-B',
            velocity: { x: 0.02, y: 0, z: 0 },
            bodyZone: 'chest',
          },
        ],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
      }));

      const result = evaluateAttempt(chestFrames, helloSpec, 'right');
      expect(result.isValid).toBe(true);
      expect(result.overallRating).not.toBe('great');
      expect(result.dimensionResults.location.status).toBe('adjust');
    });

    test('micro or lazy hand movement below 0.10 fails strict movement rule and does not get Great', () => {
      // Hand at temple, but wrist only drifts by 0.04 (natural minor hand wobble)
      const microMotionFrames: NormalizedFrame[] = Array(10).fill(null).map((_, i) => ({
        timestamp: i * 200,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: [
          {
            handedness: 'Right',
            isDominant: true,
            wrist: { x: 0.20 + i * 0.004, y: -0.45, z: 0 }, // total shift 0.036 < 0.10
            fingertips: {
              thumb: { x: 0.2, y: -0.5, z: 0 },
              index: { x: 0.2, y: -0.65, z: 0 },
              middle: { x: 0.2, y: -0.65, z: 0 },
              ring: { x: 0.2, y: -0.65, z: 0 },
              pinky: { x: 0.2, y: -0.65, z: 0 },
            },
            fingerStates: {
              thumb: 'half',
              index: 'extended',
              middle: 'extended',
              ring: 'extended',
              pinky: 'extended',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'flat-B',
            velocity: { x: 0.004, y: 0, z: 0 },
            bodyZone: 'forehead',
          },
        ],
        quality: { shouldersVisible: true, headVisible: true, handsCount: 1, isFramedWell: true },
      }));

      const result = evaluateAttempt(microMotionFrames, helloSpec, 'right');
      expect(result.isValid).toBe(true);
      expect(result.overallRating).not.toBe('great');
      expect(result.dimensionResults.movement.status).toBe('adjust');
    });

    test('insufficient dominant hand presence (less than 5 frames or ratio < 0.20) is rejected as invalid', () => {
      // 20 frames total, but hand only visible in 3 frames (ratio = 0.15 < 0.20)
      const sparseFrames: NormalizedFrame[] = Array(20).fill(null).map((_, i) => ({
        timestamp: i * 100,
        poseLandmarks: null,
        origin: { x: 0.5, y: 0.5, z: 0 },
        scale: 0.3,
        hands: i < 3 ? [
          {
            handedness: 'Right',
            isDominant: true,
            wrist: { x: 0.2, y: -0.45, z: 0 },
            fingertips: {
              thumb: { x: 0.2, y: -0.5, z: 0 },
              index: { x: 0.2, y: -0.65, z: 0 },
              middle: { x: 0.2, y: -0.65, z: 0 },
              ring: { x: 0.2, y: -0.65, z: 0 },
              pinky: { x: 0.2, y: -0.65, z: 0 },
            },
            fingerStates: {
              thumb: 'half',
              index: 'extended',
              middle: 'extended',
              ring: 'extended',
              pinky: 'extended',
            },
            palmNormal: { x: 0, y: 0, z: -1 },
            palmDirection: 'away',
            handshapeName: 'flat-B',
            velocity: { x: 0, y: 0, z: 0 },
            bodyZone: 'forehead',
          },
        ] : [],
        quality: { shouldersVisible: true, headVisible: true, handsCount: i < 3 ? 1 : 0, isFramedWell: i < 3 },
      }));

      const result = evaluateAttempt(sparseFrames, helloSpec, 'right');
      expect(result.isValid).toBe(false);
      expect(result.overallRating).toBe('needs-practice');
      expect(result.qualityMessage).toContain('sufficiently visible');
    });

    test('visibility has significantly lower weight than handshape, motion, and location across all specifications', () => {
      for (const spec of Object.values(PRACTICE_SIGN_SPECIFICATIONS)) {
        const visRule = spec.rules.find(r => r.dimension === 'visibility');
        const coreRules = spec.rules.filter(r => ['handshape', 'movement', 'location'].includes(r.dimension));

        if (visRule) {
          expect(visRule.weight).toBeLessThanOrEqual(0.5);
          for (const core of coreRules) {
            expect(core.weight).toBeGreaterThanOrEqual(1.2);
            expect(visRule.weight).toBeLessThan(core.weight);
          }
        }
      }
    });
  });
});
