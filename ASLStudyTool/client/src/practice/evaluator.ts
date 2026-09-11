import {
  NormalizedFrame,
  SignSpecification,
  DominantHand,
  EvaluationResult,
  RuleDimension,
  DimensionResult,
  OverallRating,
} from './types';

export function getRatingDetails(
  score: number,
  adjustCount: number = 0
): {
  overallRating: OverallRating;
  ratingWord: string;
  ratingDescription: string;
} {
  // Stricter evaluation:
  // "Great" requires a score of at least 85 AND zero dimensions in 'adjust'.
  // If a core dimension requires adjustment, the rating is capped at 'good' or 'fair'.
  if (score >= 85 && adjustCount === 0) {
    return {
      overallRating: 'great',
      ratingWord: 'Great',
      ratingDescription: 'Your handshape, location, and motion closely followed the demonstration.',
    };
  }
  if (score >= 72 && adjustCount <= 1) {
    return {
      overallRating: 'good',
      ratingWord: 'Good',
      ratingDescription: 'Solid attempt! You captured the sign well with minor adjustments suggested below.',
    };
  }
  if (score >= 50 && adjustCount <= 2) {
    return {
      overallRating: 'fair',
      ratingWord: 'Getting There',
      ratingDescription: 'Partially matched the demonstration. Focus on the suggestions below and try again.',
    };
  }
  return {
    overallRating: 'needs-practice',
    ratingWord: 'Needs Practice',
    ratingDescription: 'The camera had trouble matching your movement. Watch the demonstration and give it another try.',
  };
}

const DIMENSION_LABELS: Record<RuleDimension, string> = {
  visibility: 'Camera Visibility',
  handshape: 'Handshape & Fingers',
  location: 'Signing Location',
  orientation: 'Palm Orientation',
  movement: 'Motion & Trajectory',
  coordination: 'Two-Hand Coordination',
};

/**
 * Evaluates a sequence of captured frames against a sign specification.
 */
export function evaluateAttempt(
  frames: NormalizedFrame[],
  spec: SignSpecification,
  dominantHand: DominantHand = 'right'
): EvaluationResult {
  const durationMs =
    frames.length > 1
      ? frames[frames.length - 1].timestamp - frames[0].timestamp
      : 0;

  // 1. Minimum capture validity check
  if (frames.length < 5) {
    return createInvalidResult(
      'Not enough frames were captured. Please hold your sign for 1-2 seconds and try again.',
      dominantHand,
      frames.length,
      durationMs
    );
  }

  // 2. Check framing & visibility quality
  // Auto-tag dominant hand if frames detected any hands
  for (const f of frames) {
    if (f.hands.length > 0 && !f.hands.some(h => h.isDominant)) {
      f.hands[0].isDominant = true;
    }
  }

  const framesWithDominantHand = frames.filter(f =>
    f.hands.some(h => h.isDominant)
  );
  const dominantHandRatio = frames.length > 0 ? framesWithDominantHand.length / frames.length : 0;

  // Pass validity if at least 5 frames had a hand, AND ratio >= 0.20
  if (framesWithDominantHand.length < 5 || dominantHandRatio < 0.20) {
    return createInvalidResult(
      'Your signing hand was not sufficiently visible in frame. Please ensure your upper body and hands stay inside camera view.',
      dominantHand,
      frames.length,
      durationMs
    );
  }

  // 3. Evaluate individual rules
  const dimensionResultsMap: Record<RuleDimension, DimensionResult> = {
    visibility: { dimension: 'visibility', score: 100, status: 'strong', label: DIMENSION_LABELS.visibility, feedback: [] },
    handshape: { dimension: 'handshape', score: 100, status: 'unknown', label: DIMENSION_LABELS.handshape, feedback: [] },
    location: { dimension: 'location', score: 100, status: 'unknown', label: DIMENSION_LABELS.location, feedback: [] },
    orientation: { dimension: 'orientation', score: 100, status: 'unknown', label: DIMENSION_LABELS.orientation, feedback: [] },
    movement: { dimension: 'movement', score: 100, status: 'unknown', label: DIMENSION_LABELS.movement, feedback: [] },
    coordination: { dimension: 'coordination', score: 100, status: 'unknown', label: DIMENSION_LABELS.coordination, feedback: [] },
  };

  const prioritizedTips: string[] = [];
  const strongPoints: string[] = [];

  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Track per-dimension scores
  const dimWeights: Partial<Record<RuleDimension, number>> = {};
  const dimWeightedScores: Partial<Record<RuleDimension, number>> = {};

  for (const rule of spec.rules) {
    const outcome = rule.evaluate(frames, dominantHand);
    const ruleScore = Math.max(0, Math.min(1, outcome.score));

    // Accumulate total
    totalWeightedScore += ruleScore * rule.weight;
    totalWeight += rule.weight;

    // Accumulate dimension
    dimWeights[rule.dimension] = (dimWeights[rule.dimension] || 0) + rule.weight;
    dimWeightedScores[rule.dimension] =
      (dimWeightedScores[rule.dimension] || 0) + ruleScore * rule.weight;

    if (outcome.passed) {
      strongPoints.push(rule.feedbackOnSuccess);
      dimensionResultsMap[rule.dimension].feedback.push(rule.feedbackOnSuccess);
    } else {
      prioritizedTips.push(rule.feedbackOnFail);
      dimensionResultsMap[rule.dimension].feedback.push(rule.feedbackOnFail);
    }
  }

  // Core dimensions that directly reflect sign performance (handshape, location, movement)
  const CORE_DIMENSIONS: RuleDimension[] = ['handshape', 'location', 'movement'];

  // Compute aggregated scores for active dimensions
  let coreAdjustCount = 0;
  for (const dim of Object.keys(dimWeights) as RuleDimension[]) {
    const w = dimWeights[dim] || 1;
    const ws = dimWeightedScores[dim] || 0;
    const pct = Math.round((ws / w) * 100);

    dimensionResultsMap[dim].score = pct;
    if (pct >= 82) {
      dimensionResultsMap[dim].status = 'strong';
    } else if (pct >= 62) {
      dimensionResultsMap[dim].status = 'acceptable';
    } else {
      dimensionResultsMap[dim].status = 'adjust';
      if (CORE_DIMENSIONS.includes(dim)) {
        coreAdjustCount++;
      }
    }
  }

  const overallScore =
    totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) : 0;
  const ratingDetails = getRatingDetails(overallScore, coreAdjustCount);

  // Limit prioritized tips to 1 or 2 most useful suggestions
  const uniqueTips = Array.from(new Set(prioritizedTips)).slice(0, 2);
  const uniqueStrong = Array.from(new Set(strongPoints)).slice(0, 2);

  return {
    isValid: true,
    overallScore,
    overallRating: ratingDetails.overallRating,
    ratingWord: ratingDetails.ratingWord,
    ratingDescription: ratingDetails.ratingDescription,
    dimensionResults: dimensionResultsMap,
    prioritizedTips: uniqueTips.length > 0 ? uniqueTips : ['Looking good! Your signing closely matched the reference.'],
    strongPoints: uniqueStrong,
    dominantHandUsed: dominantHand,
    recordedFramesCount: frames.length,
    durationMs,
  };
}

function createInvalidResult(
  message: string,
  dominantHand: DominantHand,
  framesCount: number,
  durationMs: number
): EvaluationResult {
  const emptyDim = (dim: RuleDimension): DimensionResult => ({
    dimension: dim,
    score: 0,
    status: 'unknown',
    label: DIMENSION_LABELS[dim],
    feedback: [],
  });

  return {
    isValid: false,
    qualityMessage: message,
    overallScore: 0,
    overallRating: 'needs-practice',
    ratingWord: 'Needs Practice',
    ratingDescription: 'Incomplete or unclear capture. Please try again.',
    dimensionResults: {
      visibility: emptyDim('visibility'),
      handshape: emptyDim('handshape'),
      location: emptyDim('location'),
      orientation: emptyDim('orientation'),
      movement: emptyDim('movement'),
      coordination: emptyDim('coordination'),
    },
    prioritizedTips: [message],
    strongPoints: [],
    dominantHandUsed: dominantHand,
    recordedFramesCount: framesCount,
    durationMs,
  };
}
