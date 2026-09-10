import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './PracticeDisclaimerModal.css';

interface PracticeDisclaimerModalProps {
  isOpen: boolean;
  signName?: string;
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}

export const PracticeDisclaimerModal: React.FC<PracticeDisclaimerModalProps> = ({
  isOpen,
  signName,
  onConfirm,
  onCancel,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="disclaimer-modal-backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="disclaimer-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="disclaimer-header">
          <div className="disclaimer-icon-circle">⚠️</div>
          <div className="disclaimer-header-text">
            <h2 id="disclaimer-title">Practice Mode Notice</h2>
            <p className="disclaimer-subtitle">
              Important information before practicing {signName ? `"${signName}"` : 'with camera'}
            </p>
          </div>
          <button
            type="button"
            className="disclaimer-close-btn"
            onClick={onCancel}
            aria-label="Close disclaimer"
          >
            &times;
          </button>
        </div>

        <div className="disclaimer-body">
          <div className="disclaimer-callout">
            <strong>Not an official evaluation of right or wrong</strong>
            <p>
              This practice tool is an informal study aid. It does <em>not</em> determine whether
              your signing is officially "correct" or "fluent."
            </p>
          </div>

          <div className="disclaimer-points">
            <div className="disclaimer-point">
              <span className="point-icon">🤖</span>
              <div>
                <strong>Basic Computer Algorithms</strong>
                <p>
                  Feedback is generated purely by automated computer vision heuristics (tracking joint coordinates and hand geometry). It cannot capture the full expressiveness, pacing, or dialect variations of natural sign language.
                </p>
              </div>
            </div>

            <div className="disclaimer-point">
              <span className="point-icon">👥</span>
              <div>
                <strong>Not Professional or Fluent Signers</strong>
                <p>
                  This feedback does <em>not</em> come from certified ASL instructors, Deaf community members, or fluent signers. For true learning, cultural context, and accurate language acquisition, always consult qualified Deaf teachers and community resources.
                </p>
              </div>
            </div>

            <div className="disclaimer-point">
              <span className="point-icon">🔒</span>
              <div>
                <strong>Strictly On-Device Privacy</strong>
                <p>
                  All camera processing runs locally in your browser using WebAssembly. No webcam video is ever recorded, transmitted, or stored on any server.
                </p>
              </div>
            </div>
          </div>

          <label className="disclaimer-checkbox-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don't show this disclaimer again</span>
          </label>
        </div>

        <div className="disclaimer-footer">
          <button type="button" className="btn-disclaimer-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-disclaimer-confirm"
            onClick={() => onConfirm(dontShowAgain)}
          >
            I Understand & Continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PracticeDisclaimerModal;
