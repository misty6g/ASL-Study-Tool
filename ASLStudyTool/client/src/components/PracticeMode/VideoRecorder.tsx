import React, { useState, useRef, useEffect } from 'react';
import './VideoRecorder.css';

interface VideoRecorderProps {
  onRecordComplete: (videoBlob: Blob) => void;
  isProcessing: boolean;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onRecordComplete, isProcessing }) => {
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [fileError, setFileError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Stop stream tracks on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [stream]);

  // Request webcam and start recording
  const startRecording = async () => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    setFileError(null);
    chunksRef.current = [];
    setCountdown(10);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false // Landmarks are biomechanical, no audio required
      });

      setStream(mediaStream);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = mediaStream;
        videoPreviewRef.current.muted = true;
        videoPreviewRef.current.play().catch(e => console.error("Video play failed:", e));
      }

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp8'
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        
        // Client-side file size validation (max 50MB)
        if (blob.size > 50 * 1024 * 1024) {
          setFileError('The recorded video exceeds the 50MB limit.');
          setRecordedBlob(null);
          setPreviewUrl(null);
        } else {
          setRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        }

        // Release camera tracks
        mediaStream.getTracks().forEach((track) => track.stop());
        setStream(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      // Start 10-second countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('Webcam access error:', err);
      setFileError('Could not access your webcam. Check permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  // Handle uploaded video files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setRecordedBlob(null);
    setPreviewUrl(null);

    const file = e.target.files?.[0];
    if (!file) return;

    // MIME type validation
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.mov') && !file.name.endsWith('.mp4')) {
      setFileError('Invalid file type. Only MP4, WebM, and MOV are supported.');
      return;
    }

    // Size check
    if (file.size > 50 * 1024 * 1024) {
      setFileError('File size is too large. Max size allowed is 50MB.');
      return;
    }

    setRecordedBlob(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const resetState = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setFileError(null);
    setIsRecording(false);
    setCountdown(10);
  };

  const handleSubmit = () => {
    if (recordedBlob) {
      onRecordComplete(recordedBlob);
    }
  };

  return (
    <div className="recorder-container" role="region" aria-label="ASL Gesture Recorder">
      <div className="recorder-tabs" role="tablist">
        <button
          className={`recorder-tab-btn ${mode === 'record' ? 'active' : ''}`}
          onClick={() => { setMode('record'); resetState(); }}
          role="tab"
          aria-selected={mode === 'record'}
          disabled={isRecording || isProcessing}
        >
          Record Webcam
        </button>
        <button
          className={`recorder-tab-btn ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => { setMode('upload'); resetState(); }}
          role="tab"
          aria-selected={mode === 'upload'}
          disabled={isRecording || isProcessing}
        >
          Upload File
        </button>
      </div>

      {fileError && (
        <div className="recorder-error" role="alert">
          {fileError}
        </div>
      )}

      <div className="recorder-viewport">
        {mode === 'record' && (
          <div className="record-panel">
            {!previewUrl && (
              <div className="video-container">
                <video
                  ref={videoPreviewRef}
                  className="live-video"
                  aria-label="Live camera preview feed"
                />
                {!isRecording && !stream && (
                  <div className="video-placeholder">
                    <p>Camera is currently off.</p>
                    <button
                      onClick={startRecording}
                      className="recorder-btn record-start"
                      disabled={isProcessing}
                    >
                      Turn On Camera & Start
                    </button>
                  </div>
                )}
                {isRecording && (
                  <div className="recording-overlay">
                    <span className="record-indicator">● RECORDING</span>
                    <span className="timer-badge">{countdown}s</span>
                  </div>
                )}
              </div>
            )}

            {previewUrl && (
              <div className="preview-container">
                <p className="preview-label">Playback Preview</p>
                <video
                  src={previewUrl}
                  controls
                  className="preview-video"
                  aria-label="Recorded gesture review"
                />
              </div>
            )}

            <div className="recorder-controls">
              {isRecording && (
                <button onClick={stopRecording} className="recorder-btn record-stop">
                  Stop Recording
                </button>
              )}
              {previewUrl && !isRecording && (
                <div className="controls-row">
                  <button
                    onClick={startRecording}
                    className="recorder-btn record-retry"
                    disabled={isProcessing}
                  >
                    Re-record
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="recorder-btn record-submit"
                    disabled={isProcessing || !recordedBlob}
                  >
                    {isProcessing ? 'Analyzing...' : 'Submit Attempt'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'upload' && (
          <div className="upload-panel">
            <div className="upload-dropzone">
              <input
                type="file"
                id="video-upload-input"
                accept="video/mp4,video/webm,video/quicktime,video/mov"
                onChange={handleFileUpload}
                disabled={isProcessing}
                aria-label="Upload video file"
              />
              <label htmlFor="video-upload-input" className="upload-label">
                <span className="upload-icon">📤</span>
                <span className="upload-text-primary">Click to select video file</span>
                <span className="upload-text-secondary">MP4, WebM, or MOV (Max 50MB)</span>
              </label>
            </div>

            {previewUrl && (
              <div className="preview-container">
                <p className="preview-label">File Selected: {recordedBlob instanceof File ? recordedBlob.name : 'Recorded Video'}</p>
                <video
                  src={previewUrl}
                  controls
                  className="preview-video"
                  aria-label="Uploaded video preview playback"
                />
                <button
                  onClick={handleSubmit}
                  className="recorder-btn record-submit upload-submit-btn"
                  disabled={isProcessing || !recordedBlob}
                >
                  {isProcessing ? 'Analyzing...' : 'Submit Video File'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
