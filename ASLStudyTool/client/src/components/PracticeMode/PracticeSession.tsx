import React, { useState, useEffect, useRef } from 'react';
import VideoRecorder from './VideoRecorder';
import FeedbackDisplay from './FeedbackDisplay';
import { AIFeedback } from '../../types/ai';
import { apiClient } from '../../api/client';
import './PracticeSession.css';

interface PracticeSessionProps {
  signAttempted: string;
}

const PracticeSession: React.FC<PracticeSessionProps> = ({ signAttempted }) => {
  const [step, setStep] = useState<'record' | 'loading' | 'feedback' | 'error'>('record');
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup abort signals on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleVideoComplete = async (videoBlob: Blob) => {
    setStep('loading');
    setError(null);

    // Create abort controller for request cancellation
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append('video', videoBlob, 'gesture_attempt.webm');
    formData.append('sign_attempted', signAttempted);

    try {
      const response = await apiClient.post<AIFeedback>('/api/practice/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: abortControllerRef.current?.signal,
        timeout: 60000, // 60-second timeout
      });

      if (response.data) {
        setFeedback(response.data);
        setStep('feedback');
      }
    } catch (err: any) {
      if (err.name === 'CanceledError') {
        console.log('Request canceled successfully.');
        return;
      }
      
      console.error('AI pipeline analysis failed:', err);
      const errMsg = err.response?.data?.error || 'AI Pipeline connection timeout. The service might be temporarily offline.';
      setError(errMsg);
      setStep('error');
    }
  };

  const handleReset = () => {
    setFeedback(null);
    setError(null);
    setStep('record');
  };

  return (
    <div className="practice-session-wrapper">
      <div className="practice-session-header">
        <h2 className="practice-sign-title">
          Sign Word: <span className="highlight-word">"{signAttempted}"</span>
        </h2>
        <p className="practice-instructions">
          Record a 1-10 second video signing the word above, or upload a video file for biomechanical analysis.
        </p>
      </div>

      {step === 'record' && (
        <VideoRecorder onRecordComplete={handleVideoComplete} isProcessing={false} />
      )}

      {step === 'loading' && (
        <div className="skeleton-loader-card" role="alert" aria-busy="true" aria-label="Analyzing sign gestures">
          <div className="skeleton-header">
            <div className="skeleton-title pulsing"></div>
            <div className="skeleton-subtitle pulsing"></div>
          </div>
          <div className="skeleton-ring-section">
            <div className="skeleton-ring pulsing"></div>
          </div>
          <div className="skeleton-body">
            <div className="skeleton-box pulsing"></div>
            <div className="skeleton-heading pulsing"></div>
            <div className="skeleton-item pulsing"></div>
            <div className="skeleton-item pulsing"></div>
            <div className="skeleton-item pulsing"></div>
            <div className="skeleton-box-small pulsing"></div>
          </div>
        </div>
      )}

      {step === 'feedback' && feedback && (
        <FeedbackDisplay feedback={feedback} onReset={handleReset} />
      )}

      {step === 'error' && (
        <div className="practice-error-card" role="alert">
          <div className="error-icon">⚠️</div>
          <h3>Analysis Failed</h3>
          <p className="error-message-text">{error}</p>
          <div className="error-controls">
            <button onClick={handleReset} className="error-retry-btn">
              Try Recording Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeSession;
