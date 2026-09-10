import {
  Landmark3D,
  Handedness,
  DominantHand,
  FingerName,
  FingerState,
  PalmDirection,
  BodyZone,
  HandFeatures,
} from './types';
import { distance3D } from './normalizer';

// MediaPipe Hand Landmark Indices
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/**
 * Evaluates individual finger curl / extension states.
 */
export function extractFingerStates(landmarks: Landmark3D[]): Record<FingerName, FingerState> {
  const wrist = landmarks[HAND_LANDMARKS.WRIST];

  // Helper for 4 main fingers
  const checkFinger = (mcpIdx: number, pipIdx: number, tipIdx: number): FingerState => {
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const tip = landmarks[tipIdx];

    const distTipToWrist = distance3D(tip, wrist);
    const distPipToWrist = distance3D(pip, wrist);
    const distMcpToWrist = distance3D(mcp, wrist);

    if (distTipToWrist > distPipToWrist * 1.08) {
      return 'extended';
    } else if (distTipToWrist < distMcpToWrist * 1.15) {
      return 'curled';
    }
    return 'half';
  };

  // Thumb: check distance between thumb tip and pinky base vs thumb IP and pinky base
  const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
  const thumbIp = landmarks[HAND_LANDMARKS.THUMB_IP];
  const thumbMcp = landmarks[HAND_LANDMARKS.THUMB_MCP];
  const pinkyMcp = landmarks[HAND_LANDMARKS.PINKY_MCP];

  const thumbSpread = distance3D(thumbTip, pinkyMcp);
  const thumbBaseSpread = distance3D(thumbMcp, pinkyMcp);
  const thumbTipWrist = distance3D(thumbTip, wrist);
  const thumbIpWrist = distance3D(thumbIp, wrist);

  let thumbState: FingerState = 'half';
  if (thumbSpread > thumbBaseSpread * 1.2 && thumbTipWrist > thumbIpWrist * 1.05) {
    thumbState = 'extended';
  } else if (thumbSpread < thumbBaseSpread * 0.95) {
    thumbState = 'curled';
  }

  return {
    thumb: thumbState,
    index: checkFinger(HAND_LANDMARKS.INDEX_MCP, HAND_LANDMARKS.INDEX_PIP, HAND_LANDMARKS.INDEX_TIP),
    middle: checkFinger(HAND_LANDMARKS.MIDDLE_MCP, HAND_LANDMARKS.MIDDLE_PIP, HAND_LANDMARKS.MIDDLE_TIP),
    ring: checkFinger(HAND_LANDMARKS.RING_MCP, HAND_LANDMARKS.RING_PIP, HAND_LANDMARKS.RING_TIP),
    pinky: checkFinger(HAND_LANDMARKS.PINKY_MCP, HAND_LANDMARKS.PINKY_PIP, HAND_LANDMARKS.PINKY_TIP),
  };
}

/**
 * Classifies basic handshape based on finger states.
 */
export function classifyHandshape(states: Record<FingerName, FingerState>): string {
  const allFourExtended =
    states.index === 'extended' &&
    states.middle === 'extended' &&
    states.ring === 'extended' &&
    states.pinky === 'extended';

  const allFourCurled =
    states.index === 'curled' &&
    states.middle === 'curled' &&
    states.ring === 'curled' &&
    states.pinky === 'curled';

  if (allFourExtended) {
    return states.thumb === 'extended' ? 'open-5' : 'flat-B';
  }
  if (allFourCurled) {
    return 'fist';
  }
  if (states.index === 'extended' && states.middle === 'curled' && states.ring === 'curled' && states.pinky === 'curled') {
    return 'index-point';
  }
  if (states.thumb === 'extended' && states.pinky === 'extended' && states.index === 'curled' && states.middle === 'curled') {
    return 'ily-or-y';
  }
  return 'custom-shape';
}

/**
 * Derives the palm plane normal vector and primary palm direction.
 */
export function extractPalmNormal(
  landmarks: Landmark3D[],
  handedness: Handedness
): { normal: Landmark3D; direction: PalmDirection } {
  const wrist = landmarks[HAND_LANDMARKS.WRIST];
  const indexMcp = landmarks[HAND_LANDMARKS.INDEX_MCP];
  const pinkyMcp = landmarks[HAND_LANDMARKS.PINKY_MCP];

  // Vectors spanning the palm
  const v1 = {
    x: indexMcp.x - wrist.x,
    y: indexMcp.y - wrist.y,
    z: (indexMcp.z ?? 0) - (wrist.z ?? 0),
  };

  const v2 = {
    x: pinkyMcp.x - wrist.x,
    y: pinkyMcp.y - wrist.y,
    z: (pinkyMcp.z ?? 0) - (wrist.z ?? 0),
  };

  // Cross product
  let cx = v1.y * v2.z - v1.z * v2.y;
  let cy = v1.z * v2.x - v1.x * v2.z;
  let cz = v1.x * v2.y - v1.y * v2.x;

  // Handedness flip for palm normal vector consistency (pointing out of palm face)
  if (handedness === 'Right') {
    cx = -cx;
    cy = -cy;
    cz = -cz;
  }

  const length = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  const normal: Landmark3D = {
    x: cx / length,
    y: cy / length,
    z: cz / length,
  };

  // Determine dominant orientation
  let direction: PalmDirection = 'away';
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);

  if (absZ >= absX && absZ >= absY) {
    direction = normal.z < 0 ? 'away' : 'inward';
  } else if (absY >= absX && absY >= absZ) {
    direction = normal.y < 0 ? 'up' : 'down';
  } else {
    direction = normal.x < 0 ? 'left' : 'right';
  }

  return { normal, direction };
}

/**
 * Maps normalized coordinates to a named body zone.
 */
export function determineBodyZone(point: Landmark3D): BodyZone {
  // Negative Y is upward (above shoulders), positive Y is downward (torso)
  if (point.y < -0.55) {
    return 'forehead';
  }
  if (point.y < -0.15) {
    return 'chin';
  }
  if (point.y < 0.35) {
    return 'chest';
  }
  if (point.y < 0.8) {
    return 'torso';
  }
  return 'neutral';
}

/**
 * Extracts complete hand features from normalized landmarks.
 */
export function extractHandFeatures(
  normalizedLandmarks: Landmark3D[],
  detectedHandedness: Handedness,
  userDominantHand: DominantHand,
  previousWrist?: Landmark3D
): HandFeatures {
  const wrist = normalizedLandmarks[HAND_LANDMARKS.WRIST];
  const fingerStates = extractFingerStates(normalizedLandmarks);
  const handshapeName = classifyHandshape(fingerStates);
  const { normal: palmNormal, direction: palmDirection } = extractPalmNormal(
    normalizedLandmarks,
    detectedHandedness
  );
  const bodyZone = determineBodyZone(wrist);

  const velocity: Landmark3D = previousWrist
    ? {
        x: wrist.x - previousWrist.x,
        y: wrist.y - previousWrist.y,
        z: (wrist.z ?? 0) - (previousWrist.z ?? 0),
      }
    : { x: 0, y: 0, z: 0 };

  const isDominant =
    userDominantHand === 'left'
      ? detectedHandedness === 'Left'
      : detectedHandedness === 'Right';

  const fingertips: Record<FingerName, Landmark3D> = {
    thumb: normalizedLandmarks[HAND_LANDMARKS.THUMB_TIP],
    index: normalizedLandmarks[HAND_LANDMARKS.INDEX_TIP],
    middle: normalizedLandmarks[HAND_LANDMARKS.MIDDLE_TIP],
    ring: normalizedLandmarks[HAND_LANDMARKS.RING_TIP],
    pinky: normalizedLandmarks[HAND_LANDMARKS.PINKY_TIP],
  };

  return {
    handedness: detectedHandedness,
    isDominant,
    wrist,
    fingertips,
    fingerStates,
    palmNormal,
    palmDirection,
    handshapeName,
    velocity,
    bodyZone,
  };
}
