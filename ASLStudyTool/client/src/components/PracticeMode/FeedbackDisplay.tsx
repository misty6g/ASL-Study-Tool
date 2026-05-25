import React, { useEffect, useState } from 'react';
import { AIFeedback } from '../../types/ai';
import './FeedbackDisplay.css';

interface FeedbackDisplayProps {
  feedback: AIFeedback;
  onReset: () => void;
}

const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedback, onReset }) => {
  const { overall_score, summary, improvements, encouragement } = feedback;
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate the score progress ring from 0 to actual score on mount
  useEffect(() => {
    const duration = 1000; // 1s animation
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing out function
      const easeOutQuad = (t: number) => t * (2 - t);
      
      setAnimatedScore(Math.floor(easeOutQuad(progress) * overall_score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [overall_score]);

  // Determine color matching grade thresholds
  const getColorClass = (score: number) => {
    if (score >= 80) return 'score-green';
    if (score >= 50) return 'score-yellow';
    return 'score-red';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 50) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  // SVG Circular path definitions
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // ~314.16
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="feedback-card" role="region" aria-label="Biomechanical Feedback Results">
      <div className="feedback-header">
        <h2 className="feedback-title">Attempt Analysis</h2>
        <p className="feedback-meta">Processed by ASL AI Coach</p>
      </div>

      <div className="feedback-score-section">
        <div 
          className="progress-ring-container"
          role="progressbar"
          aria-valuenow={overall_score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall score is ${overall_score} out of 100`}
        >
          <svg className="progress-ring" width="140" height="140" viewBox="0 0 120 120">
            {/* Background Track */}
            <circle
              className="progress-ring-track"
              cx="60"
              cy="60"
              r={radius}
              strokeWidth="8"
              fill="transparent"
            />
            {/* Animated Ring Indicator */}
            <circle
              className={`progress-ring-indicator ${getColorClass(overall_score)}`}
              cx="60"
              cy="60"
              r={radius}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ stroke: getScoreColor(overall_score) }}
            />
          </svg>
          <div className="score-label-overlay">
            <span className={`score-number ${getColorClass(overall_score)}`}>{animatedScore}</span>
            <span className="score-max">/100</span>
          </div>
        </div>
      </div>

      <div className="feedback-body">
        <div className="feedback-summary-box">
          <p className="feedback-summary-text">{summary}</p>
        </div>

        {improvements.length > 0 && (
          <div className="feedback-improvements-container">
            <h3 className="improvements-heading">Recommended Adjustments</h3>
            <ul className="improvements-list">
              {improvements.map((tip, idx) => (
                <li key={idx} className="improvement-item">
                  <span className="improvement-bullet-icon">🔧</span>
                  <span className="improvement-text">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="feedback-encouragement-box">
          <p className="encouragement-text">
            <span className="encouragement-icon">💡</span>
            {encouragement}
          </p>
        </div>
      </div>

      <div className="feedback-footer">
        <button onClick={onReset} className="feedback-reset-btn">
          Practice Again
        </button>
      </div>
    </div>
  );
};

export default FeedbackDisplay;
