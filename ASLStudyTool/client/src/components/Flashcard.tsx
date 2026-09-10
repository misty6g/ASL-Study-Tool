import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import './Flashcard.css';
import { getSignSpecification } from '../practice/specifications';
import PracticeModal from './PracticeModal';
import PracticeDisclaimerModal from './PracticeDisclaimerModal';
import { resolveVideoSources } from '../utils/videoUtils';

interface FlashcardProps {
  videoUrl: string;
  answer: string;
  showInstructions: boolean;
  onFirstFlip: () => void;
  isHighlighted?: boolean;
  onCardInteraction?: (cardId: string) => void;
  cardId?: string;
  isStarred?: boolean;
  onStarToggle?: (cardId: string, isStarred: boolean) => void;
}

export interface FlashcardHandle {
  flip: (state: boolean) => void;
}

const Flashcard = forwardRef<FlashcardHandle, FlashcardProps>(
  ({ videoUrl, answer, showInstructions, onFirstFlip, isHighlighted = false, onCardInteraction, cardId, isStarred = false, onStarToggle }, ref) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFlipped, setHasFlipped] = useState(false);
  const [wasInteractedWith, setWasInteractedWith] = useState(false);
  const [starred, setStarred] = useState(isStarred);
  const practiceSpec = getSignSpecification(answer);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);

  const handlePracticeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    let isDismissed = false;
    try {
      isDismissed = localStorage.getItem('asl_dismissed_practice_disclaimer') === 'true';
    } catch (err) {
      isDismissed = false;
    }

    if (isDismissed) {
      setIsPracticeOpen(true);
    } else {
      setIsDisclaimerOpen(true);
    }
  };

  const handleConfirmDisclaimer = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('asl_dismissed_practice_disclaimer', 'true');
      } catch (err) {
        // ignore localStorage errors
      }
    }
    setIsDisclaimerOpen(false);
    setIsPracticeOpen(true);
  };

  const handleCancelDisclaimer = () => {
    setIsDisclaimerOpen(false);
  };

  const videoSources = resolveVideoSources(videoUrl);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Update internal starred state when prop changes
  useEffect(() => {
    setStarred(isStarred);
  }, [isStarred]);

  useEffect(() => {
    setIsLoading(true);
    setIsVideoLoaded(false);
    setError(null);
    setUseIframeFallback(false);
    if (videoElementRef.current) {
      videoElementRef.current.muted = true;
      videoElementRef.current.volume = 0;
    }
  }, [videoUrl]);

  // Expose flip method to parent components
  useImperativeHandle(ref, () => ({
    flip: (state: boolean) => {
      setIsFlipped(state);
      if (!hasFlipped && state) {
        setHasFlipped(true);
        onFirstFlip();
      }
      // Also count programmatic flips as interaction
      if (isHighlighted && cardId && onCardInteraction) {
        handleInteraction();
      }
    }
  }));

  // Handle any interaction with the card
  const handleInteraction = () => {
    if (!wasInteractedWith && isHighlighted && cardId && onCardInteraction) {
      setWasInteractedWith(true);
      onCardInteraction(cardId);
    }
  };

  // Handle starring a card
  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card from flipping
    e.preventDefault(); // Prevent any default behavior
    
    // Only proceed if we have a valid card ID and toggle handler
    if (cardId && onStarToggle) {
      // Get the button element
      const button = e.currentTarget as HTMLElement;
      
      // Check if this button is already being processed (has the data attribute)
      if (button.getAttribute('data-processing') === 'true') {
        console.log('Star toggle already in progress, ignoring click');
        return;
      }
      
      // Mark button as being processed to prevent double clicks
      button.setAttribute('data-processing', 'true');
      
      // First update UI immediately for responsiveness
      const newStarredState = !starred;
      setStarred(newStarredState);
      
      // Then call parent handler (which handles API call)
      onStarToggle(cardId, newStarredState);
      
      // Prevent further clicks for a short period
      setTimeout(() => {
        if (button) {
          button.setAttribute('data-processing', 'false');
        }
      }, 500); // Longer timeout to ensure API call completes
    }
  };

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
    setIsLoading(false);
    setError(null);
  };

  const handleVideoError = (e: any) => {
    console.error('Video error:', e);
    setError('Failed to load video. Please check your internet connection and try again.');
    setIsLoading(false);
  };

  const handleFlip = (e: React.MouseEvent) => {
    // Don't flip if clicking on the video container or star button
    if ((e.target as HTMLElement).closest('.video-content') || 
        (e.target as HTMLElement).closest('.star-button')) {
      return;
    }
    
    // If this is the first time any card is being flipped, call the parent function
    if (!hasFlipped) {
      setHasFlipped(true);
      onFirstFlip();
    }
    
    setIsFlipped(!isFlipped);

    // Notify parent about the interaction
    handleInteraction();
  };

  // Determine if the card should appear highlighted
  const shouldHighlight = isHighlighted && !wasInteractedWith;

  return (
    <div className={`flashcard-container ${shouldHighlight ? 'highlighted' : ''} ${starred ? 'starred' : ''}`}>
      <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
        <div className="flashcard-inner">
          <div className="flashcard-front">
            <div className="card-content">
              <div className="card-title">Sign</div>
              <div className="video-content">
                {isLoading && (
                  <div className="video-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading video...</p>
                  </div>
                )}
                {error && !useIframeFallback && (
                  <div className="video-error">
                    <p>{error}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLoading(true);
                        setError(null);
                        setUseIframeFallback(false);
                      }}
                      className="retry-button"
                    >
                      Try Again
                    </button>
                  </div>
                )}
                {useIframeFallback ? (
                  <iframe 
                    title={`ASL sign video demonstration for ${answer}`}
                    src={videoSources.previewUrl}
                    width="100%" 
                    height="100%" 
                    allow="autoplay" 
                    allowFullScreen
                    style={{ border: 'none' }}
                    onLoad={() => {
                      setIsLoading(false);
                      setIsVideoLoaded(true);
                    }}
                  ></iframe>
                ) : (
                  <video
                    ref={videoElementRef}
                    key={videoSources.streamUrl}
                    src={videoSources.streamUrl}
                    controls
                    muted
                    loop
                    playsInline
                    autoPlay
                    onLoadedData={handleVideoLoad}
                    onLoadedMetadata={(e) => {
                      e.currentTarget.muted = true;
                      e.currentTarget.volume = 0;
                    }}
                    onPlay={(e) => {
                      e.currentTarget.muted = true;
                      e.currentTarget.volume = 0;
                    }}
                    onError={(e) => {
                      console.warn('Direct stream error, using iframe fallback:', e);
                      if (videoSources.isDrive) {
                        setUseIframeFallback(true);
                      } else {
                        handleVideoError(e);
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                )}
              </div>
              {showInstructions && (
                <div className="card-instruction">Click anywhere outside the video to flip</div>
              )}
            </div>
            {/* Front practice button */}
            {practiceSpec && (
              <button
                type="button"
                className="practice-button"
                onClick={handlePracticeClick}
                title={`Practice signing "${practiceSpec.name}" with webcam feedback`}
              >
                📷 Practice
              </button>
            )}
            {/* Front star button */}
            <button
              className={`star-button ${starred ? 'starred' : ''}`}
              onClick={handleStar}
              title={starred ? 'Unstar this card' : 'Star this card'}
            >
              {starred ? '★' : '☆'}
            </button>
          </div>
          <div className="flashcard-back">
            <div className="card-content">
              <div className="card-title">Answer</div>
              <div className="answer-content">
                <p>{answer}</p>
              </div>
              {showInstructions && (
                <div className="card-instruction">Click to see the sign again</div>
              )}
            </div>
            {/* Back practice button */}
            {practiceSpec && (
              <button
                type="button"
                className="practice-button"
                onClick={handlePracticeClick}
                title={`Practice signing "${practiceSpec.name}" with webcam feedback`}
              >
                📷 Practice
              </button>
            )}
            {/* Back star button */}
            <button
              className={`star-button ${starred ? 'starred' : ''}`}
              onClick={handleStar}
              title={starred ? 'Unstar this card' : 'Star this card'}
            >
              {starred ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>

      {/* Practice Disclaimer Pop-Up */}
      {isDisclaimerOpen && practiceSpec && (
        <PracticeDisclaimerModal
          isOpen={isDisclaimerOpen}
          signName={practiceSpec.name}
          onConfirm={handleConfirmDisclaimer}
          onCancel={handleCancelDisclaimer}
        />
      )}

      {/* Practice Feedback Modal */}
      {isPracticeOpen && practiceSpec && (
        <PracticeModal
          spec={practiceSpec}
          videoUrl={videoSources.streamUrl || videoUrl}
          onClose={() => setIsPracticeOpen(false)}
        />
      )}
    </div>
  );
});

export default Flashcard;