import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validations
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Authentication failed. Please check your credentials.';
      setError(serverError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-background">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
      </div>
      
      <div className="auth-card" role="main" aria-labelledby="auth-title">
        <div className="auth-header">
          <h1 id="auth-title" className="auth-title">ASL Study Tool</h1>
          <p className="auth-subtitle">AI-Powered Hand Gesture Analysis & Feedback</p>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(null); }}
            role="tab"
            aria-selected={isLogin}
          >
            Login
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(null); }}
            role="tab"
            aria-selected={!isLogin}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error-banner" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div className="input-group">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder=" "
              autoComplete="email"
            />
            <label htmlFor="email">Email Address</label>
          </div>

          <div className="input-group">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder=" "
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <label htmlFor="password">Password</label>
          </div>

          {!isLogin && (
            <div className="input-group">
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder=" "
                autoComplete="new-password"
              />
              <label htmlFor="confirm-password">Confirm Password</label>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <span className="spinner-loading">Processing...</span>
            ) : isLogin ? (
              'Login'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="auth-toggle-link"
            >
              {isLogin ? 'Register here' : 'Login here'}
            </button>
          </p>
          <div className="demo-credentials-helper">
            <p><strong>Demo Access:</strong> email: <code>demo@example.com</code> / password: <code>demo123</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
