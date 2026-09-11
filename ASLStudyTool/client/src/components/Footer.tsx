import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Column 1: Brand & Mission */}
          <div className="footer-column footer-brand-column">
            <div className="footer-brand-header">
              <span className="footer-brand-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                >
                  <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                  <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                  <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
              </span>
              <span className="footer-brand-title">ASL Study Tool</span>
            </div>
            <p className="footer-brand-desc">
              Interactive sign language learning with real-time feedback and structured practice decks.
            </p>
          </div>

          {/* Column 2: Learning Surfaces */}
          <div className="footer-column">
            <h3 className="footer-heading">Study</h3>
            <ul className="footer-nav-list">
              <li>
                <Link to="/" className="footer-nav-link">
                  All Decks
                </Link>
              </li>
              <li>
                <Link to="/deck/all-starred" className="footer-nav-link">
                  Starred Cards
                </Link>
              </li>
              <li>
                <Link to="/fingerspelling" className="footer-nav-link">
                  Fingerspelling Trainer
                </Link>
              </li>
              <li>
                <Link to="/test/all-decks" className="footer-nav-link">
                  Test Mode
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="footer-column">
            <h3 className="footer-heading">Resources</h3>
            <ul className="footer-nav-list">
              <li>
                <a
                  href="https://www.lifeprint.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-nav-link"
                >
                  Lifeprint ASL
                </a>
              </li>
              <li>
                <a
                  href="https://asl.ms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-nav-link"
                >
                  asl.ms Fingerspelling
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Creator Credit (Strictly Preserves gyanmistry for tests) */}
          <div className="footer-column footer-contact-column">
            <h3 className="footer-heading">Connect</h3>
            <p className="footer-author-text">
              Created by <span className="author-name">gyanmistry</span>
            </p>
            <p className="footer-contact-prompt">
              For questions or feature suggestions DM{' '}
              <a
                href="https://instagram.com/gyanmistry"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-contact-link"
                aria-label="DM gyanmistry on Instagram"
              >
                @gyanmistry
              </a>{' '}
              on instagram
            </p>
          </div>
        </div>

        {/* Bottom Metadata Bar */}
        <div className="footer-bottom-bar">
          <p className="footer-copyright">
            &copy; 2026 ASL Study Tool. Open educational resource.
          </p>
          <p className="footer-a11y-badge">
            Built with accessible design standards
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;