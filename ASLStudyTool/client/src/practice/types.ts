export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type Handedness = 'Left' | 'Right';
export type DominantHand = 'left' | 'right';

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export type FingerState = 'extended' | 'curled' | 'half';

export type PalmDirection = 'away' | 'inward' | 'up' | 'down' | 'left' | 'right';

export type BodyZone = 'head' | 'forehead' | 'chin' | 'chest' | 'torso' | 'neutral';

export type MovementDirection = 'outward' | 'forward' | 'upward' | 'downward' | 'sideways' | 'stationary' | 'circular';

export type RuleDimension = 'visibility' | 'handshape' | 'location' | 'orientation' | 'movement' | 'coordination';

export interface HandFeatures {
  handedness: Handedness;
  isDominant: boolean;
  wrist: Landmark3D;
  fingertips: Record<FingerName, Landmark3D>;
  fingerStates: Record<FingerName, FingerState>;
  palmNormal: Landmark3D;
  palmDirection: PalmDirection;
  handshapeName: string;
  velocity: Landmark3D;
  bodyZone: BodyZone;
}

export interface NormalizedFrame {
  timestamp: number;
  poseLandmarks: Landmark3D[] | null;
  origin: Landmark3D;
  scale: number;
  hands: HandFeatures[];
  quality: {
    shouldersVisible: boolean;
    headVisible: boolean;
    handsCount: number;
    isFramedWell: boolean;
  };
}

export interface SignRule {
  id: string;
  dimension: RuleDimension;
  description: string;
  weight: number;
  feedbackOnFail: string;
  feedbackOnSuccess: string;
  evaluate: (frames: NormalizedFrame[], dominantHand: DominantHand) => {
    passed: boolean;
    score: number; // 0 to 1
    observedDetail?: string;
  };
}

export interface SignSpecification {
  id: string;
  name: string;
  aliases: string[];
  version: string;
  description: string;
  requiredHands: 'one' | 'two';
  instructions: string;
  expectedHandshape: string;
  expectedLocationZone: BodyZone;
  expectedPalmDirection: PalmDirection;
  rules: SignRule[];
}

export interface DimensionResult {
  dimension: RuleDimension;
  score: number; // 0 to 100
  status: 'strong' | 'acceptable' | 'adjust' | 'unknown';
  label: string;
  feedback: string[];
}

export type OverallRating = 'great' | 'good' | 'fair' | 'needs-practice';

export interface EvaluationResult {
  isValid: boolean;
  qualityMessage?: string;
  overallScore: number; // 0 to 100
  overallRating: OverallRating;
  ratingWord: string;
  ratingDescription: string;
  dimensionResults: Record<RuleDimension, DimensionResult>;
  prioritizedTips: string[];
  strongPoints: string[];
  dominantHandUsed: DominantHand;
  recordedFramesCount: number;
  durationMs: number;
}

export interface UserPracticePreference {
  dominantHand: DominantHand;
  overlayEnabled: boolean;
  countdownSeconds: number;
}
