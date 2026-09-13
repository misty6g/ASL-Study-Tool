import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  SignSpecification,
  DominantHand,
  NormalizedFrame,
  EvaluationResult,
  RuleDimension,
} from '../practice/types';
import { visionService } from '../practice/visionService';
import { evaluateAttempt } from '../practice/evaluator';
import { resolveVideoSources } from '../utils/videoUtils';
import PracticeDisclaimerModal from './PracticeDisclaimerModal';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './PracticeModal.css';

interface PracticeModalProps {
  spec: SignSpecification;
  videoUrl: string;
  onClose: () => void;
}

type CaptureState = 'init' | 'ready' | 'countdown' | 'recording' | 'evaluating' | 'results' | 'error';

const LOCAL_STORAGE_DOMINANT_HAND = 'asl_practice_dominant_hand';

export const PracticeModal: React.FC<PracticeModalProps> = ({ spec, videoUrl, onClose }) => {
  const { user } = useAuth();
  const [dominantHand, setDominantHand] = useState<DominantHand>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_DOMINANT_HAND);
    return saved === 'left' ? 'left' : 'right';
  });
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [captureState, setCaptureState] = useState<CaptureState>('init');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isFramedWell, setIsFramedWell] = useState<boolean>(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const capturedFramesRef = useRef<NormalizedFrame[]>([]);
  const isCapturingRef = useRef<boolean>(false);
  const dominantHandRef = useRef<DominantHand>(dominantHand);
  const showOverlayRef = useRef<boolean>(showOverlay);

  // Keep refs in sync with state for animation frame loop
  useEffect(() => {
    dominantHandRef.current = dominantHand;
    localStorage.setItem(LOCAL_STORAGE_DOMINANT_HAND, dominantHand);
    try {
      const targetUserId = user?.id || 'demo-user-id';
      axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/users/${targetUserId}/preferences`, {
        dominantHand
      }).catch(() => {});
    } catch {}
  }, [dominantHand, user?.id]);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  // Clean stop of webcam stream
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.kind);
      });
      streamRef.current = null;
    }
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, stopCamera]);

  // Frame processing loop
  const processLiveFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState >= 2 && canvas) {
      const now = performance.now();
      const result = visionService.processFrame(video, now, dominantHandRef.current);

      if (result) {
        setIsFramedWell(result.frame.quality.isFramedWell);

        // Record if active
        if (isCapturingRef.current) {
          capturedFramesRef.current.push(result.frame);
        }

        // Draw overlay if enabled
        if (showOverlayRef.current) {
          visionService.drawLandmarks(
            canvas,
            result.rawPoseLandmarks,
            result.rawHandLandmarks,
            dominantHandRef.current
          );
        } else {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(processLiveFrame);
  }, []);

  // Initialize camera and vision service
  useEffect(() => {
    let isCancelled = false;

    const setupCameraAndVision = async () => {
      try {
        setCaptureState('init');
        setErrorMessage(null);

        // 1. Initialize vision service
        await visionService.initialize();

        if (isCancelled) return;

        // 2. Request webcam stream
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Your browser does not support webcam access.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (isCancelled) return;
            videoRef.current?.play().catch(e => console.warn('Video play error:', e));
            setCaptureState('ready');
            animationFrameRef.current = requestAnimationFrame(processLiveFrame);
          };
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Camera or vision init failed:', err);
          setErrorMessage(
            err.name === 'NotAllowedError'
              ? 'Camera access was denied. Please allow camera permissions in your browser to practice.'
              : err.message || 'Unable to access webcam.'
          );
          setCaptureState('error');
        }
      }
    };

    setupCameraAndVision();

    return () => {
      isCancelled = true;
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      stopCamera();
    };
  }, [processLiveFrame, stopCamera]);

  // Finish capture and evaluate
  const finishRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    isCapturingRef.current = false;
    setCaptureState('evaluating');

    const frames = [...capturedFramesRef.current];
    const evaluation = evaluateAttempt(frames, spec, dominantHandRef.current);
    console.log('Practice Attempt Evaluation:', {
      sign: spec.id,
      dominantHand: dominantHandRef.current,
      framesCount: frames.length,
      rating: evaluation.overallRating,
      word: evaluation.ratingWord,
      score: evaluation.overallScore,
      details: evaluation,
    });

    setEvaluationResult(evaluation);
    setCaptureState('results');

    try {
      const targetUserId = user?.id || 'demo-user-id';
      axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/practice/attempts`, {
        userId: targetUserId,
        signId: spec.id,
        overallScore: Math.round(evaluation.overallScore),
        dominantHand: dominantHandRef.current,
        durationMs: 3500,
        dimensionResults: evaluation.dimensionResults || {}
      }).catch(() => {});
    } catch {
      // Ignore attempt persistence error
    }
  }, [spec, user?.id]);

  // Start recording workflow: countdown -> recording (3.5s) -> evaluate
  const startPracticeCapture = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);

    setCaptureState('countdown');
    setCountdown(3);
    capturedFramesRef.current = [];
    isCapturingRef.current = false;

    let count = 3;
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;

        // Start actual capture
        setCaptureState('recording');
        isCapturingRef.current = true;

        const duration = 3500; // 3.5 seconds capture window
        recordingTimerRef.current = setTimeout(() => {
          finishRecording();
        }, duration);
      }
    }, 1000);
  };

  const handleRetry = () => {
    setEvaluationResult(null);
    capturedFramesRef.current = [];
    isCapturingRef.current = false;
    setCaptureState('ready');
  };

  const handleModalClose = () => {
    stopCamera();
    onClose();
  };

  const videoSources = resolveVideoSources(videoUrl);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const refVideoRef = useRef<HTMLVideoElement | null>(null);

  return ReactDOM.createPortal(
    <div className="practice-modal-backdrop" onClick={handleModalClose} role="dialog" aria-modal="true">
      <div className="practice-modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="practice-modal-header">
          <div className="practice-title-group">
            <h2>
              Practice: {spec.name}
              <span className="practice-sign-badge">On-Device Feedback</span>
            </h2>
          </div>

          <div className="practice-header-controls">
            <div className="handedness-selector">
              <span>Dominant:</span>
              <button
                type="button"
                className={`hand-btn ${dominantHand === 'right' ? 'active' : ''}`}
                onClick={() => setDominantHand('right')}
                title="Evaluate with Right Hand as dominant"
              >
                Right
              </button>
              <button
                type="button"
                className={`hand-btn ${dominantHand === 'left' ? 'active' : ''}`}
                onClick={() => setDominantHand('left')}
                title="Evaluate with Left Hand as dominant (mirrors criteria)"
              >
                Left
              </button>
            </div>

            <button
              type="button"
              className="practice-disclaimer-badge-btn"
              onClick={() => setShowDisclaimerModal(true)}
              title="Practice Mode Algorithm Disclaimer"
            >
              ⚠️ Algorithm Notice
            </button>

            <button
              type="button"
              className="modal-close-btn"
              onClick={handleModalClose}
              aria-label="Close practice mode"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="practice-modal-body">
          {/* Stage Grid: Reference + Camera */}
          <div className="practice-stage-grid">
            {/* Reference Panel */}
            <div className="practice-panel">
              <h3 className="panel-heading">Reference Demonstration</h3>
              <div className="reference-video-wrapper">
                {useIframeFallback ? (
                  <iframe
                    src={videoSources.previewUrl}
                    width="100%"
                    height="100%"
                    allow="autoplay"
                    allowFullScreen
                    style={{ border: 'none' }}
                    title={`Reference video for ${spec.name}`}
                  />
                ) : (
                  <video
                    ref={refVideoRef}
                    key={videoSources.streamUrl}
                    src={videoSources.streamUrl}
                    controls
                    loop
                    playsInline
                    muted
                    autoPlay
                    onLoadedMetadata={(e) => {
                      e.currentTarget.muted = true;
                      e.currentTarget.volume = 0;
                    }}
                    onPlay={(e) => {
                      e.currentTarget.muted = true;
                      e.currentTarget.volume = 0;
                    }}
                    onError={() => {
                      if (videoSources.isDrive) {
                        setUseIframeFallback(true);
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              <div className="reference-instructions">
                <strong>How to sign:</strong> {spec.instructions}
              </div>

              <div className="reference-tags">
                <span className="ref-tag">Handshape: {spec.expectedHandshape}</span>
                <span className="ref-tag">Location: {spec.expectedLocationZone}</span>
                <span className="ref-tag">Palm: {spec.expectedPalmDirection}</span>
              </div>
            </div>

            {/* Camera Panel */}
            <div className="practice-panel">
              <div className="panel-heading">
                <span>Your Webcam Preview</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowOverlay(!showOverlay)}
                  title="Toggle landmark skeleton overlay"
                >
                  {showOverlay ? 'Hide Skeleton' : 'Show Skeleton'}
                </button>
              </div>

              <div
                className={`camera-viewport ${
                  isFramedWell ? 'framed-ok' : ''
                } ${captureState === 'recording' ? 'recording-now' : ''}`}
              >
                <video
                  ref={videoRef}
                  className="webcam-video"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas
                  ref={canvasRef}
                  className="webcam-canvas"
                  width={640}
                  height={480}
                />

                {/* Countdown overlay */}
                {captureState === 'countdown' && (
                  <div className="countdown-overlay">
                    <div className="countdown-number">{countdown}</div>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Get ready to sign!</span>
                  </div>
                )}

                {/* Recording indicator */}
                {captureState === 'recording' && (
                  <div className="recording-indicator">
                    <span>●</span> Capturing Sign...
                  </div>
                )}

                {/* Camera Overlay Status Banner */}
                {captureState === 'ready' && (
                  <div className="camera-overlay-banner">
                    <div>
                      <span className={`framing-dot ${isFramedWell ? 'ok' : ''}`} />
                      {isFramedWell
                        ? 'Framing ready! Hands and torso detected.'
                        : 'Center your shoulders, face, and hands in view.'}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {captureState === 'error' && (
                  <div className="countdown-overlay" style={{ background: 'rgba(20, 10, 10, 0.9)' }}>
                    <p style={{ color: '#f87171', textAlign: 'center', padding: '0 20px', margin: 0 }}>
                      {errorMessage || 'Unable to access camera.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Controls Bar */}
              <div className="camera-controls-bar">
                {captureState === 'ready' && (
                  <button
                    type="button"
                    className="btn-primary-capture"
                    onClick={startPracticeCapture}
                  >
                    <span>⏺</span> Start Practice Capture
                  </button>
                )}

                {captureState === 'recording' && (
                  <button
                    type="button"
                    className="btn-stop-capture"
                    onClick={finishRecording}
                  >
                    Done Signing
                  </button>
                )}

                {captureState === 'evaluating' && (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    Comparing attempt to reference criteria...
                  </div>
                )}

                {captureState === 'results' && (
                  <button
                    type="button"
                    className="btn-primary-capture"
                    onClick={handleRetry}
                  >
                    ↺ Try Again
                  </button>
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleModalClose}
                >
                  Done Practicing
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          {captureState === 'results' && evaluationResult && (
            <div className="practice-results-section">
              <div className="results-header-summary">
                <div className="rating-summary-box">
                  <div className={`rating-pill-badge rating-${evaluationResult.overallRating}`}>
                    <span className="rating-badge-icon">
                      {evaluationResult.overallRating === 'great' ? '⭐' :
                       evaluationResult.overallRating === 'good' ? '👍' :
                       evaluationResult.overallRating === 'fair' ? '🔄' : '🎯'}
                    </span>
                    <span className="rating-badge-word">{evaluationResult.ratingWord}</span>
                  </div>
                  <div className="rating-meta">
                    <h3>
                      Attempt Rating:{' '}
                      <span className={`rating-accent rating-${evaluationResult.overallRating}`}>
                        {evaluationResult.ratingWord}
                      </span>
                    </h3>
                    <p>{evaluationResult.ratingDescription}</p>
                  </div>
                </div>

                <div className="practice-results-actions">
                  <button type="button" className="btn-primary-capture" onClick={handleRetry}>
                    ↺ Practice Again
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleModalClose}>
                    Return to Cards
                  </button>
                </div>
              </div>

              {/* Algorithm Disclaimer Banner */}
              <div className="algorithmic-disclaimer-pill">
                ⚠️ <strong>Educational Note:</strong> This rating is estimated by basic computer vision algorithms, not professional or fluent ASL signers. This is an informal study aid, not an official test of right or wrong.
              </div>

              {/* Prioritized Coaching Feedback */}
              <div className="coaching-cards-grid">
                <div className="coaching-card adjust">
                  <h4>💡 Try Adjusting:</h4>
                  <ul>
                    {evaluationResult.prioritizedTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>

                {evaluationResult.strongPoints.length > 0 && (
                  <div className="coaching-card strong">
                    <h4>✓ Strong Aspects:</h4>
                    <ul>
                      {evaluationResult.strongPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Component Dimension Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
                  Component Breakdown
                </h4>
                <table className="dimension-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Observed Status</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(evaluationResult.dimensionResults) as RuleDimension[])
                      .filter(dim => evaluationResult.dimensionResults[dim].feedback.length > 0)
                      .map(dim => {
                        const item = evaluationResult.dimensionResults[dim];
                        return (
                          <tr key={dim}>
                            <td>
                              <strong>{item.label}</strong>
                            </td>
                            <td>
                              <span className={`status-tag ${item.status}`}>
                                {item.status === 'strong'
                                  ? 'Strong'
                                  : item.status === 'acceptable'
                                  ? 'Acceptable'
                                  : item.status === 'adjust'
                                  ? 'Needs Adjustment'
                                  : 'Not Assessed'}
                              </span>
                            </td>
                            <td>{item.feedback.join(' ')}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <p className="privacy-notice">
            🔒 Privacy: Camera video and landmark features are processed strictly in your browser.
            No raw webcam video is recorded, transmitted, or stored on any server.
          </p>
        </div>

        {showDisclaimerModal && (
          <PracticeDisclaimerModal
            isOpen={showDisclaimerModal}
            signName={spec.name}
            onConfirm={() => setShowDisclaimerModal(false)}
            onCancel={() => setShowDisclaimerModal(false)}
          />
        )}
      </div>
    </div>,
    document.body
  );
};

export default PracticeModal;
