import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import './Navigation.css';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface NavigationProps {
  breadcrumbs?: BreadcrumbItem[];
  showBack?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

const Navigation: React.FC<NavigationProps> = ({
  breadcrumbs: customBreadcrumbs,
  showBack: customShowBack,
  onBack: customOnBack,
  backLabel: customBackLabel,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle ESC key to close mobile menu (only attached when drawer is open)
  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Derive contextual breadcrumbs and back button from pathname
  const pathname = location.pathname;
  const isPureHome = pathname === '/';

  const computeBreadcrumbs = (): BreadcrumbItem[] => {
    if (customBreadcrumbs) {
      return customBreadcrumbs;
    }

    if (isPureHome) {
      return [];
    }

    if (pathname === '/home') {
      return [
        { label: 'Home', path: '/' },
        { label: 'Decks' },
      ];
    }

    if (pathname === '/welcome') {
      return [
        { label: 'Home', path: '/' },
        { label: 'Welcome Hub' },
      ];
    }

    if (pathname === '/deck/all-starred') {
      return [
        { label: 'Home', path: '/' },
        { label: 'Decks', path: '/home' },
        { label: 'Starred Cards' },
      ];
    }

    if (pathname.startsWith('/deck/')) {
      const deckId = pathname.replace('/deck/', '').trim();
      const formattedName = deckId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return [
        { label: 'Home', path: '/' },
        { label: 'Decks', path: '/home' },
        { label: formattedName || 'Deck' },
      ];
    }

    if (pathname === '/test/all-decks') {
      return [
        { label: 'Home', path: '/' },
        { label: 'Test Mode (All Decks)' },
      ];
    }

    if (pathname.startsWith('/test/')) {
      const deckId = pathname.replace('/test/', '').trim();
      const formattedName = deckId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return [
        { label: 'Home', path: '/' },
        { label: formattedName || 'Deck', path: `/deck/${deckId}` },
        { label: 'Test Mode' },
      ];
    }

    if (pathname === '/fingerspelling' || pathname === '/asl-ms') {
      return [
        { label: 'Home', path: '/' },
        { label: 'Fingerspelling Practice' },
      ];
    }

    return [{ label: 'Home', path: '/' }];
  };

  const breadcrumbs = computeBreadcrumbs();
  const showBack = customShowBack !== undefined ? customShowBack : !isPureHome;

  const handleBack = () => {
    if (customOnBack) {
      customOnBack();
      return;
    }

    if (pathname.startsWith('/test/') && pathname !== '/test/all-decks') {
      const deckId = pathname.replace('/test/', '').trim();
      navigate(`/deck/${deckId}`);
    } else if (pathname.startsWith('/deck/')) {
      navigate('/home');
    } else {
      navigate('/');
    }
  };

  const backLabel =
    customBackLabel ||
    (pathname.startsWith('/test/') && pathname !== '/test/all-decks'
      ? 'Back to Deck'
      : 'Back to Home');

  return (
    <header className="app-header" ref={navRef}>
      {/* Skip to Main Content Link for WCAG Accessibility */}
      <a href="#main-content" className="nav-skip-link">
        Skip to main content
      </a>

      <div className="nav-bar-container">
        {/* Brand & Contextual Navigation Section */}
        <div className="nav-left-section">
          <Link to="/" className="nav-brand" aria-label="ASL Study Tool Home">
            <span className="nav-brand-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                {/* Stylized Signing Handshape Icon */}
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
              </svg>
            </span>
            <span className="nav-brand-title">
              ASL <span className="nav-brand-accent">Study Tool</span>
            </span>
          </Link>

          {/* Contextual Back Trigger & Breadcrumbs */}
          {showBack && (
            <div className="nav-context-cluster">
              <span className="nav-context-divider" aria-hidden="true">/</span>
              <button
                type="button"
                className="nav-back-button"
                onClick={handleBack}
                aria-label={backLabel}
                title={backLabel}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="nav-back-text">{backLabel}</span>
              </button>

              {breadcrumbs.length > 0 && (
                <nav
                  className="nav-breadcrumbs"
                  aria-label="Breadcrumb hierarchy"
                  data-testid="nav-breadcrumbs"
                >
                  <ol className="breadcrumb-list">
                    {breadcrumbs.map((crumb, idx) => {
                      const isLast = idx === breadcrumbs.length - 1;
                      return (
                        <li
                          key={`${crumb.label}-${idx}`}
                          className="breadcrumb-item"
                          data-testid="breadcrumb-item"
                        >
                          {idx > 0 && (
                            <span className="breadcrumb-slash" aria-hidden="true">
                              /
                            </span>
                          )}
                          {isLast || !crumb.path ? (
                            <span
                              className="breadcrumb-current"
                              aria-current="page"
                              data-testid="breadcrumb-current"
                            >
                              {crumb.label}
                            </span>
                          ) : (
                            <Link
                              to={crumb.path}
                              className="breadcrumb-link"
                              data-testid="breadcrumb-link"
                            >
                              {crumb.label}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              )}
            </div>
          )}
        </div>

        {/* Primary Desktop Study Navigation Links */}
        <nav className="nav-desktop-links" aria-label="Primary site navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-tab-link ${isActive && isPureHome ? 'active' : ''}`
            }
          >
            <span className="nav-tab-label">Welcome</span>
          </NavLink>

          <NavLink
            to="/home"
            className={({ isActive }) =>
              `nav-tab-link ${isActive || pathname === '/home' ? 'active' : ''}`
            }
          >
            <span className="nav-tab-label">Decks</span>
          </NavLink>

          <NavLink
            to="/deck/all-starred"
            className={({ isActive }) =>
              `nav-tab-link ${isActive ? 'active' : ''}`
            }
          >
            <svg
              className="nav-tab-star-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="nav-tab-label">Starred Cards</span>
          </NavLink>

          <NavLink
            to="/fingerspelling"
            className={({ isActive }) =>
              `nav-tab-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="nav-tab-label">Fingerspelling</span>
          </NavLink>

          <NavLink
            to="/test/all-decks"
            className={({ isActive }) =>
              `nav-tab-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="nav-tab-label">Test Mode</span>
          </NavLink>
        </nav>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className={`nav-mobile-toggle-btn ${mobileMenuOpen ? 'is-open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-panel"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <span className="hamburger-line top" aria-hidden="true"></span>
          <span className="hamburger-line mid" aria-hidden="true"></span>
          <span className="hamburger-line bot" aria-hidden="true"></span>
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Panel */}
      <div
        id="mobile-nav-panel"
        className={`mobile-nav-drawer ${mobileMenuOpen ? 'drawer-open' : ''}`}
        role="dialog"
        aria-modal={mobileMenuOpen ? 'true' : undefined}
        aria-hidden={!mobileMenuOpen}
        hidden={!mobileMenuOpen}
        aria-label="Mobile Navigation Drawer"
      >
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-title">Navigation</span>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation drawer"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="mobile-drawer-links" aria-label="Mobile site links">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `mobile-nav-item ${isActive && isPureHome ? 'active' : ''}`
            }
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>Welcome Hub</span>
          </NavLink>

          <NavLink
            to="/home"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive || pathname === '/home' ? 'active' : ''}`
            }
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>Decks</span>
          </NavLink>

          <NavLink
            to="/deck/all-starred"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="mobile-item-content">
              <span>Starred Cards</span>
              <svg
                className="starred-gold-icon"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </NavLink>

          <NavLink
            to="/fingerspelling"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>Fingerspelling Trainer</span>
          </NavLink>

          <NavLink
            to="/test/all-decks"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>Test Mode</span>
          </NavLink>
        </nav>

        {showBack && (
          <div className="mobile-drawer-back-section">
            <button
              type="button"
              className="mobile-back-action"
              onClick={() => {
                setMobileMenuOpen(false);
                handleBack();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>{backLabel}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navigation;
