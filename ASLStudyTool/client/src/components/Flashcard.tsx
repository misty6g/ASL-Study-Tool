import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import './Flashcard.css';

// Import ReactPlayer directly to prevent lazy loading issues
import ReactPlayer from 'react-player';

interface FlashcardProps {
  videoUrl: string;
  answer: string;
  showInstructions: boolean;
  onFirstFlip: () => void;
  isHighlighted?: boolean;
  onCardInteraction?: (cardId: string) => void;
  cardId?: string;
}

export interface FlashcardHandle {
  flip: (state: boolean) => void;
}

const Flashcard = forwardRef<FlashcardHandle, FlashcardProps>(
  ({ videoUrl, answer, showInstructions, onFirstFlip, isHighlighted = false, onCardInteraction, cardId }, ref) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoSource, setVideoSource] = useState<string>('');
  const [hasFlipped, setHasFlipped] = useState(false);
  const [wasInteractedWith, setWasInteractedWith] = useState(false);

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

  useEffect(() => {
    // Transform Google Drive URL to direct video URL
    const transformGoogleDriveUrl = (url: string): string => {
      // Check if it's a Google Drive URL
      if (url.includes('drive.google.com')) {
        // Extract file ID from URL
        let fileId = '';
        
        // Handle different Google Drive URL formats
        if (url.includes('drive.google.com/file/d/')) {
          // Format: https://drive.google.com/file/d/{fileId}/view
          const match = url.match(/\/file\/d\/([^\/]+)/);
          if (match && match[1]) {
            fileId = match[1];
          }
        } else if (url.includes('drive.google.com/open?id=')) {
          // Format: https://drive.google.com/open?id={fileId}
          const match = url.match(/open\?id=([^&]+)/);
          if (match && match[1]) {
            fileId = match[1];
          }
        } else if (url.includes('id=')) {
          // Format: https://drive.google.com/uc?id={fileId}
          const match = url.match(/id=([^&]+)/);
          if (match && match[1]) {
            fileId = match[1];
          }
        }
        
        if (fileId) {
          console.log('Extracted Google Drive file ID:', fileId);
          // Use embed format which works better than direct download
          return `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }
      
      // If not a Google Drive URL or couldn't extract ID, return original
      return url;
    };

    // Set video source with transformation if needed
    if (videoUrl.includes('drive.google.com')) {
      const transformedUrl = transformGoogleDriveUrl(videoUrl);
      console.log('Transformed Google Drive URL:', transformedUrl);
      setVideoSource(transformedUrl);
    } else {
      setVideoSource(videoUrl);
    }
    
    console.log('Video URL:', videoUrl);
  }, [videoUrl]);

  const handleVideoLoad = () => {
    console.log('Video loaded successfully:', videoSource);
    setIsVideoLoaded(true);
    setIsLoading(false);
    setError(null);
  };

  const handleVideoError = (e: any) => {
    console.error('Video error:', e);
    console.error('Failed URL:', videoSource);
    setError('Failed to load video. Please check your internet connection and try again.');
    setIsLoading(false);
    
    // Use a reliable fallback video if the main one fails
    setVideoSource('https://filesamples.com/samples/video/mp4/sample_640x360.mp4');
  };

  const handleVideoStart = () => {
    console.log('Video started playing');
    setIsLoading(false);
  };

  const handleFlip = (e: React.MouseEvent) => {
    // Don't flip if clicking on the video container
    if ((e.target as HTMLElement).closest('.video-content')) {
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

  // Special handling for Google Drive embedded videos
  const isGoogleDriveEmbed = videoSource.includes('/preview');

  // Determine if the card should appear highlighted
  const shouldHighlight = isHighlighted && !wasInteractedWith;

  return (
    <div className={`flashcard-container ${shouldHighlight ? 'highlighted' : ''}`}>
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
                        // Try reloading the video
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
                {/* For Google Drive embedded videos, use iframe directly */}
                {isGoogleDriveEmbed ? (
                  <iframe 
                    src={videoSource}
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
                  // For regular videos, use ReactPlayer
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
          </div>
        </div>
      </div>
    </div>
  );
});

export default Flashcard;