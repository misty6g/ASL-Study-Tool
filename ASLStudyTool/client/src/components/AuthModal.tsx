import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    login,
    register,
    continueAsGuest,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(authModalMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync internal mode with authModalMode from context
  useEffect(() => {
    setMode(authModalMode);
    setError(null);
  }, [authModalMode, isAuthModalOpen]);

  // Focus on first input when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setError(null);
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isAuthModalOpen, mode]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isAuthModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const result = await login(cleanEmail, password);
        if (!result.success) {
          setError(result.error || 'Login failed. Please verify your credentials.');
        }
      } else {
        const result = await register(cleanEmail, password, displayName);
        if (!result.success) {
          setError(result.error || 'Registration failed. Please check your information.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestClick = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await continueAsGuest();
    } catch {
      setError('Could not start guest session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="auth-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAuthModal();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      data-testid="auth-modal"
    >
      <div className="auth-modal-card" ref={modalRef}>
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-brand-badge">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              aria-hidden="true"
            >
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
            <span>ASL Study Tool</span>
          </div>

          <button
            type="button"
            className="auth-modal-close-btn"
            onClick={closeAuthModal}
            aria-label="Close authentication modal"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs" role="tablist" aria-label="Authentication Options">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Title and Subtitle */}
        <div className="auth-modal-intro">
          <h2 id="auth-modal-title" className="auth-modal-title">
            {mode === 'login' ? 'Welcome Back' : 'Start Your ASL Journey'}
          </h2>
          <p className="auth-modal-subtitle">
            {mode === 'login'
              ? 'Log in to sync your starred cards, study streaks, and practice scores across devices.'
              : 'Create a free account to save your study progress and custom preferences.'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="auth-error-banner" role="alert" data-testid="auth-error">
            <span className="auth-error-icon" aria-hidden="true">⚠️</span>
            <span className="auth-error-text">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'register' && (
            <div className="auth-field-group">
              <label htmlFor="auth-display-name" className="auth-field-label">
                Display Name
              </label>
              <input
                id="auth-display-name"
                type="text"
                className="auth-input"
                placeholder="e.g. Jordan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                aria-label="Display Name"
              />
            </div>
          )}

          <div className="auth-field-group">
            <label htmlFor="auth-email" className="auth-field-label">
              Email Address
            </label>
            <input
              id="auth-email"
              ref={emailInputRef}
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              aria-label="Email Address"
            />
          </div>

          <div className="auth-field-group">
            <label htmlFor="auth-password" className="auth-field-label">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className="auth-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-label="Password"
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
            data-testid="auth-submit-button"
          >
            {isSubmitting ? (
              <span className="auth-loading-spinner" aria-hidden="true" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Free Account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span className="auth-divider-text">or</span>
          <span className="auth-divider-line" />
        </div>

        {/* Guest Fallback Action */}
        <div className="auth-guest-section">
          <button
            type="button"
            className="auth-guest-btn"
            onClick={handleGuestClick}
            disabled={isSubmitting}
          >
            Continue as Guest (Local Only)
          </button>
          <p className="auth-guest-note">
            Guest mode stores your study data in this browser only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
