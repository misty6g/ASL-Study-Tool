import { Landmark3D, DominantHand } from './types';

// MediaPipe Pose Landmark Indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;

export interface NormalizationBasis {
  origin: Landmark3D;
  scale: number;
  shouldersVisible: boolean;
  headVisible: boolean;
}

/**
 * Calculates Euclidean distance between two 3D landmarks.
 */
export function distance3D(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Derives the body coordinate origin (shoulder midpoint) and scale (shoulder distance).
 */
export function calculateNormalizationBasis(poseLandmarks: Landmark3D[] | null): NormalizationBasis {
  if (!poseLandmarks || poseLandmarks.length <= POSE_LANDMARKS.RIGHT_SHOULDER) {
    return {
      origin: { x: 0.5, y: 0.5, z: 0 },
      scale: 0.3,
      shouldersVisible: false,
      headVisible: false,
    };
  }

  const leftShoulder = poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const nose = poseLandmarks[POSE_LANDMARKS.NOSE];

  const shouldersVisible =
    (leftShoulder?.visibility === undefined || leftShoulder.visibility > 0.4) &&
    (rightShoulder?.visibility === undefined || rightShoulder.visibility > 0.4);

  const headVisible = nose?.visibility === undefined || nose.visibility > 0.4;

  const origin: Landmark3D = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: ((leftShoulder.z ?? 0) + (rightShoulder.z ?? 0)) / 2,
  };

  const rawDist = distance3D(leftShoulder, rightShoulder);
  // Guard against division by zero or unrealistic scale
  const scale = rawDist > 0.05 ? rawDist : 0.3;

  return { origin, scale, shouldersVisible, headVisible };
}

/**
 * Normalizes landmark coordinate relative to origin and scale.
 * If dominantHand is 'left', mirrors the horizontal X coordinate so rules
 * designed for right-handed signers seamlessly apply to left-handed signers.
 */
export function normalizeCoordinate(
  point: Landmark3D,
  origin: Landmark3D,
  scale: number,
  dominantHand: DominantHand = 'right'
): Landmark3D {
  let normX = (point.x - origin.x) / scale;
  const normY = (point.y - origin.y) / scale;
  const normZ = ((point.z ?? 0) - (origin.z ?? 0)) / scale;

  // Mirror X axis if signer is left-handed
  if (dominantHand === 'left') {
    normX = -normX;
  }

  return {
    x: normX,
    y: normY,
    z: normZ,
    visibility: point.visibility,
  };
}

/**
 * Normalizes an array of landmarks.
 */
export function normalizeLandmarkList(
  landmarks: Landmark3D[],
  origin: Landmark3D,
  scale: number,
  dominantHand: DominantHand = 'right'
): Landmark3D[] {
  return landmarks.map(pt => normalizeCoordinate(pt, origin, scale, dominantHand));
}
