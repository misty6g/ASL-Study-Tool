/**
 * User profile information returned by the authentication endpoints.
 */
export interface User {
  id: string;
  email: string;
}

/**
 * Biomechanical coaching feedback returned by the AI pipeline.
 */
export interface AIFeedback {
  overall_score: number;
  summary: string;
  improvements: string[];
  encouragement: string;
}

/**
 * Historical record of a sign practice session.
 */
export interface PracticeSession {
  id: string;
  sign_attempted: string;
  ai_score: number;
  ai_feedback: string;
  improvement_areas: string[];
  created_at: string;
}

/**
 * Performance metrics aggregated over practice history.
 */
export interface PracticeStats {
  total_sessions: number;
  average_score: number;
  most_practiced_sign: string;
  most_improved_sign: string;
  streak_days: number;
}
