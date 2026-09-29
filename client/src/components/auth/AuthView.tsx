import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface AuthViewProps {
  initialMode?: 'login' | 'register';
}

export const AuthView: React.FC<AuthViewProps> = ({ initialMode = 'login' }) => {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [role, setRole] = useState<UserRole>('MENTEE');

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setLocalError(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setLocalError('Full name is required.');
        return;
      }
      if (!username.trim() || username.length < 3) {
        setLocalError('Username must be at least 3 characters long.');
        return;
      }
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters long.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({
          email: email.trim(),
          password,
          name: name.trim(),
          username: username.trim(),
          role,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrefillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLocalError(null);
    clearError();
  };

  const displayedError = localError || error;

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        {/* Brand / Logo Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <span className="auth-logo-icon">💬</span>
          </div>
          <h1 className="auth-title">
            {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to access your contacts and messages'
              : 'Sign up to start chatting on Chat Portal'}
          </p>
        </div>

        {/* Error Alert */}
        {displayedError && (
          <div className="auth-error-alert" role="alert">
            <span className="auth-error-icon">⚠️</span>
            <span className="auth-error-text">{displayedError}</span>
          </div>
        )}

        {/* Auth Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <>
              <div className="auth-field-group">
                <label htmlFor="auth-name" className="auth-label">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="auth-field-group">
                <label htmlFor="auth-username" className="auth-label">
                  Username
                </label>
                <input
                  id="auth-username"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. janedoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </>
          )}

          <div className="auth-field-group">
            <label htmlFor="auth-email" className="auth-label">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              className="auth-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field-group">
            <div className="auth-label-row">
              <label htmlFor="auth-password" className="auth-label">
                Password
              </label>
              {mode === 'register' && (
                <span className="auth-label-hint">Min. 8 characters</span>
              )}
            </div>
            <input
              id="auth-password"
              type="password"
              className="auth-input"
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field-group">
              <label className="auth-label">Select Your Role</label>
              <div className="auth-role-selector">
                {(['MENTEE', 'MENTOR', 'ADMIN'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`auth-role-pill ${role === r ? 'active' : ''}`}
                    onClick={() => setRole(r)}
                    disabled={isSubmitting}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="auth-submit-loading">
                <span className="loading-spinner small" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Quick Demo Credentials (Login mode only) */}
        {mode === 'login' && (
          <div className="auth-demo-section">
            <span className="auth-demo-label">Quick Test Login:</span>
            <div className="auth-demo-buttons">
              <button
                type="button"
                className="auth-demo-btn"
                onClick={() => handlePrefillDemo('test_plan_user@chatportal.com', 'Password123!')}
              >
                Plan User (Mentee)
              </button>
              <button
                type="button"
                className="auth-demo-btn"
                onClick={() => handlePrefillDemo('mentor_alice@chatportal.com', 'Password123!')}
              >
                Alice (Mentor)
              </button>
            </div>
          </div>
        )}

        {/* Bottom Toggle Text (No tabs) */}
        <div className="auth-footer-text">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => switchMode('register')}
                disabled={isSubmitting}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => switchMode('login')}
                disabled={isSubmitting}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
