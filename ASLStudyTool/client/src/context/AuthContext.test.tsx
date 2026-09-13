import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';

// Helper component to exercise useAuth hook
const TestAuthConsumer: React.FC = () => {
  const {
    user,
    token,
    isAuthenticated,
    login,
    register,
    logout,
    continueAsGuest,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal
  } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-id">{user?.id || 'none'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <div data-testid="user-name">{user?.displayName || 'none'}</div>
      <div data-testid="token-status">{token ? 'has-token' : 'no-token'}</div>
      <div data-testid="modal-state">{isAuthModalOpen ? 'modal-open' : 'modal-closed'}</div>

      <button
        onClick={() => register('newuser@example.com', 'pass1234', 'New Learner')}
        data-testid="btn-register"
      >
        Register
      </button>

      <button
        onClick={() => login('alice@example.com', 'secret123')}
        data-testid="btn-login"
      >
        Login
      </button>

      <button onClick={() => continueAsGuest()} data-testid="btn-guest">
        Guest
      </button>

      <button onClick={() => logout()} data-testid="btn-logout">
        Logout
      </button>

      <button onClick={() => openAuthModal('login')} data-testid="btn-open-modal">
        Open Modal
      </button>

      <button onClick={() => closeAuthModal()} data-testid="btn-close-modal">
        Close Modal
      </button>
    </div>
  );
};

describe('AuthContext and Multi-User State', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('initializes as unauthenticated when no stored session exists', async () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });
    expect(screen.getByTestId('user-id')).toHaveTextContent('none');
    expect(screen.getByTestId('token-status')).toHaveTextContent('no-token');
  });

  test('successfully registers a new user and stores auth token', async () => {
    const mockPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        token: 'mock-jwt-token-123',
        user: {
          id: 'user_new_1',
          email: 'newuser@example.com',
          displayName: 'New Learner'
        }
      }
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-register'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('user-id')).toHaveTextContent('user_new_1');
    expect(screen.getByTestId('user-email')).toHaveTextContent('newuser@example.com');
    expect(screen.getByTestId('user-name')).toHaveTextContent('New Learner');
    expect(localStorage.getItem('asl_auth_token')).toBe('mock-jwt-token-123');
    mockPost.mockRestore();
  });

  test('successfully logs in an existing user', async () => {
    const mockPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        token: 'alice-jwt-token',
        user: {
          id: 'user_alice_42',
          email: 'alice@example.com',
          displayName: 'Alice Cooper'
        }
      }
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('user-name')).toHaveTextContent('Alice Cooper');
    expect(localStorage.getItem('asl_auth_token')).toBe('alice-jwt-token');
    mockPost.mockRestore();
  });

  test('supports guest mode without marking user as full account', async () => {
    const mockPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        token: 'guest-temp-token',
        user: {
          id: 'guest_999',
          email: 'guest_999@guest.local',
          displayName: 'Guest Learner',
          isGuest: true
        }
      }
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-guest'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('guest_999');
    });

    // Guest users should not have full authenticated privileges
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Guest Learner');
    mockPost.mockRestore();
  });

  test('logout clears user state, tokens, and storage', async () => {
    localStorage.setItem('asl_auth_token', 'persisted-jwt');
    localStorage.setItem(
      'asl_user_info',
      JSON.stringify({ id: 'user_test', email: 'test@example.com', displayName: 'Test' })
    );

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-logout'));
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('none');
    expect(localStorage.getItem('asl_auth_token')).toBeNull();
    expect(localStorage.getItem('asl_user_info')).toBeNull();
  });

  test('controls modal open and close states', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('modal-state')).toHaveTextContent('modal-closed');

    fireEvent.click(screen.getByTestId('btn-open-modal'));
    expect(screen.getByTestId('modal-state')).toHaveTextContent('modal-open');

    fireEvent.click(screen.getByTestId('btn-close-modal'));
    expect(screen.getByTestId('modal-state')).toHaveTextContent('modal-closed');
  });
});
