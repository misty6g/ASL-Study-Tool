import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from './AuthModal';
import { AuthProvider } from '../context/AuthContext';
import * as AuthContextModule from '../context/AuthContext';

describe('AuthModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('does not render modal when closed', () => {
    render(
      <AuthProvider>
        <AuthModal />
      </AuthProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('renders dialog with sign in tab active by default when open', () => {
    const mockAuth: AuthContextModule.AuthContextType = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn().mockResolvedValue({ success: true }),
      register: jest.fn().mockResolvedValue({ success: true }),
      logout: jest.fn(),
      continueAsGuest: jest.fn(),
      isAuthModalOpen: true,
      authModalMode: 'login',
      openAuthModal: jest.fn(),
      closeAuthModal: jest.fn()
    };

    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockAuth);

    render(<AuthModal />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sign in/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  test('switches tabs between Sign In and Create Account', () => {
    const mockAuth: AuthContextModule.AuthContextType = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn().mockResolvedValue({ success: true }),
      register: jest.fn().mockResolvedValue({ success: true }),
      logout: jest.fn(),
      continueAsGuest: jest.fn(),
      isAuthModalOpen: true,
      authModalMode: 'login',
      openAuthModal: jest.fn(),
      closeAuthModal: jest.fn()
    };

    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockAuth);

    render(<AuthModal />);

    const registerTab = screen.getByRole('tab', { name: /create account/i });
    fireEvent.click(registerTab);

    expect(registerTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create free account/i })).toBeInTheDocument();
  });

  test('validates minimum password length upon submission', async () => {
    const mockAuth: AuthContextModule.AuthContextType = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn().mockResolvedValue({ success: true }),
      register: jest.fn().mockResolvedValue({ success: true }),
      logout: jest.fn(),
      continueAsGuest: jest.fn(),
      isAuthModalOpen: true,
      authModalMode: 'login',
      openAuthModal: jest.fn(),
      closeAuthModal: jest.fn()
    };

    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockAuth);

    render(<AuthModal />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /^sign in$/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 6 characters/i);
    });

    expect(mockAuth.login).not.toHaveBeenCalled();
  });

  test('triggers close on escape key press', () => {
    const closeAuthModal = jest.fn();
    const mockAuth: AuthContextModule.AuthContextType = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      continueAsGuest: jest.fn(),
      isAuthModalOpen: true,
      authModalMode: 'login',
      openAuthModal: jest.fn(),
      closeAuthModal
    };

    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockAuth);

    render(<AuthModal />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closeAuthModal).toHaveBeenCalledTimes(1);
  });

  test('calls continueAsGuest when guest button is pressed', async () => {
    const continueAsGuest = jest.fn().mockResolvedValue(undefined);
    const mockAuth: AuthContextModule.AuthContextType = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      continueAsGuest,
      isAuthModalOpen: true,
      authModalMode: 'login',
      openAuthModal: jest.fn(),
      closeAuthModal: jest.fn()
    };

    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockAuth);

    render(<AuthModal />);

    const guestBtn = screen.getByRole('button', { name: /continue as guest/i });
    await waitFor(async () => {
      fireEvent.click(guestBtn);
    });

    expect(continueAsGuest).toHaveBeenCalledTimes(1);
  });
});
