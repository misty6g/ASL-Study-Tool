import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactPlayer from 'react-player';
import PracticeSession from './PracticeMode/PracticeSession';
import './Flashcard.css';

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
  const [videoSource, setVideoSource] = useState<string>('');
  const [hasFlipped, setHasFlipped] = useState(false);
  const [wasInteractedWith, setWasInteractedWith] = useState(false);
  const [starred, setStarred] = useState(isStarred);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);

  useEffect(() => {
    setStarred(isStarred);
  }, [isStarred]);

  useImperativeHandle(ref, () => ({
    flip: (state: boolean) => {
      setIsFlipped(state);
      if (!hasFlipped && state) {
        setHasFlipped(true);
        onFirstFlip();
      }
      if (isHighlighted && cardId && onCardInteraction) {
        handleInteraction();
      }
    }
  }));

  const handleInteraction = () => {
    if (!wasInteractedWith && isHighlighted && cardId && onCardInteraction) {
      setWasInteractedWith(true);
      onCardInteraction(cardId);
    }
  };

  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (cardId && onStarToggle) {
      const button = e.currentTarget as HTMLElement;
      if (button.getAttribute('data-processing') === 'true') return;
      
      button.setAttribute('data-processing', 'true');
      const newStarredState = !starred;
      setStarred(newStarredState);
      
      onStarToggle(cardId, newStarredState);
      
      setTimeout(() => {
        if (button) {
          button.setAttribute('data-processing', 'false');
        }
      }, 500);
    }
  };

  useEffect(() => {
    const transformGoogleDriveUrl = (url: string): string => {
      if (url.includes('drive.google.com')) {
        let fileId = '';
        if (url.includes('drive.google.com/file/d/')) {
          const match = url.match(/\/file\/d\/([^\/]+)/);
          if (match && match[1]) fileId = match[1];
        } else if (url.includes('drive.google.com/open?id=')) {
          const match = url.match(/open\?id=([^&]+)/);
          if (match && match[1]) fileId = match[1];
        } else if (url.includes('id=')) {
          const match = url.match(/id=([^&]+)/);
          if (match && match[1]) fileId = match[1];
        }
        
        if (fileId) {
          return `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }
      return url;
    };

    if (videoUrl.includes('drive.google.com')) {
      setVideoSource(transformGoogleDriveUrl(videoUrl));
    } else {
      setVideoSource(videoUrl);
    }
  }, [videoUrl]);

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
    setIsLoading(false);
    setError(null);
  };

  const handleVideoError = () => {
    setError('Failed to load video.');
    setIsLoading(false);
    setVideoSource('https://filesamples.com/samples/video/mp4/sample_640x360.mp4');
  };

  const handleVideoStart = () => {
    setIsLoading(false);
  };

  const handleFlip = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.video-content') || 
        (e.target as HTMLElement).closest('.star-button') ||
        (e.target as HTMLElement).closest('.practice-ai-btn')) {
      return;
    }
    
    if (!hasFlipped) {
      setHasFlipped(true);
      onFirstFlip();
    }
    
    setIsFlipped(!isFlipped);
    handleInteraction();
  };

  const isGoogleDriveEmbed = videoSource.includes('/preview');
  const shouldHighlight = isHighlighted && !wasInteractedWith;

  return (
    <>
      <div className={`flashcard-container ${shouldHighlight ? 'highlighted' : ''} ${starred ? 'starred' : ''}`}>
        <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
          <div className="flashcard-inner">
            <div className="flashcard-front">
              <div className="card-content">
                <div className="card-title">Sign</div>
                <div className="video-content">
                  {isLoading && !isGoogleDriveEmbed && (
                    <div className="video-loading">
                      <div className="loading-spinner"></div>
                      <p>Loading video...</p>
                    </div>
                  )}
                  {error && !isGoogleDriveEmbed && (
                    <div className="video-error">
                      <p>{error}</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsLoading(true);
                          setError(null);
                          const currentUrl = videoSource;
                          setVideoSource('');
                          setTimeout(() => setVideoSource(currentUrl), 100);
                        }}
                        className="retry-button"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                  {isGoogleDriveEmbed ? (
                    <iframe 
                      src={videoSource}
                      title="Google Drive Video Feed"
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
                    !error && videoSource && (
                      <ReactPlayer
                        url={videoSource}
                        width="100%"
                        height="100%"
                        controls
                        playing={false}
                        onReady={handleVideoLoad}
                        onError={handleVideoError}
                        onStart={handleVideoStart}
                        config={{
                          file: {
                            attributes: {
                              controlsList: 'nodownload',
                              disablePictureInPicture: true
                            },
                            forceVideo: true
                          }
                        }}
                      />
                    )
                  )}
                </div>
                {showInstructions && (
                  <div className="card-instruction">Click anywhere outside the video to flip</div>
                )}
              </div>
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
                  <p className="answer-text">{answer}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPracticeOpen(true);
                    }}
                    className="practice-ai-btn"
                  >
                    📸 Practice with AI
                  </button>
                </div>
                {showInstructions && (
                  <div className="card-instruction">Click to see the sign again</div>
                )}
              </div>
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
      </div>

      {isPracticeOpen && (
        <div className="practice-modal-overlay" onClick={() => setIsPracticeOpen(false)}>
          <div className="practice-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setIsPracticeOpen(false)} aria-label="Close modal">
              &times;
            </button>
            <PracticeSession signAttempted={answer} />
          </div>
        </div>
      )}
    </>
  );
});

export default Flashcard;