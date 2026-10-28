import './Auth.css';
import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

import { auth } from './firebase.js';
import './Auth.css';

export default function Auth() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isSignup) {
        const result = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

        await updateProfile(result.user, {
          displayName: name.trim(),
        });
      } else {
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );
      }
    } catch (err) {
      console.error('Firebase authentication error:', err.code, err.message);

      const messages = {
        'auth/email-already-in-use':
          'This email is already registered. Please login.',
        'auth/invalid-email':
          'Please enter a valid email address.',
        'auth/weak-password':
          'Password must be at least 6 characters.',
        'auth/invalid-credential':
          'Incorrect email or password.',
        'auth/user-not-found':
          'Account not found. Please sign up first.',
        'auth/wrong-password':
          'Incorrect password.',
        'auth/network-request-failed':
          'Network error. Check your internet connection.',
        'auth/operation-not-allowed':
          'Enable Email/Password in Firebase Authentication.',
        'auth/too-many-requests':
          'Too many attempts. Please try again later.',
        'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
          'Firebase API key is invalid. Check firebase.js.',
      };

      setError(
        messages[err.code] ||
        `Error: ${err.code || 'unknown'} — ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-orb orb-one"></div>
      <div className="auth-orb orb-two"></div>

      <div className="auth-card">
        <div className="auth-logo">✓</div>

        <p className="eyebrow">TASKFLOW WORKSPACE</p>

        <h1>
          {isSignup ? 'Create your account' : 'Welcome back!'}
        </h1>

        <p className="auth-subtitle">
          {isSignup
            ? 'Start organizing your day with TaskFlow.'
            : 'Sign in to continue to your TaskFlow workspace.'}
        </p>

        <div className="auth-switch">
          <button
            type="button"
            className={!isSignup ? 'selected' : ''}
            onClick={() => {
              setIsSignup(false);
              setError('');
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={isSignup ? 'selected' : ''}
            onClick={() => {
              setIsSignup(true);
              setError('');
            }}
          >
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>

            <div className="password-wrapper">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  isSignup ? 'new-password' : 'current-password'
                }
                minLength={6}
                required
              />

              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : isSignup
                ? 'Create Account →'
                : 'Login →'}
          </button>
        </form>

        <p className="auth-bottom">
          {isSignup
            ? 'Already have an account?'
            : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsSignup((value) => !value);
              setError('');
            }}
          >
            {isSignup ? 'Login' : 'Sign up'}
          </button>
        </p>

        <div className="auth-note">
          ✨ Your productivity journey starts here.
        </div>
      </div>
    </div>
  );
}