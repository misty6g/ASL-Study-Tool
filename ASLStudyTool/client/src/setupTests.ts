// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';

// Mock IntersectionObserver for JSDOM
class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
(window as any).IntersectionObserver = MockIntersectionObserver;

// Global mocks for Jest with ESM packages under react-scripts
jest.mock(
  'axios',
  () => ({
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    create: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ data: [] })),
      post: jest.fn(() => Promise.resolve({ data: {} })),
    })),
  }),
  { virtual: true }
);

jest.mock(
  'react-router-dom',
  () => {
    const React = require('react');
    return {
      BrowserRouter: ({ children }: any) => React.createElement('div', null, children),
      Routes: ({ children }: any) => React.createElement('div', null, children),
      Route: ({ element }: any) => React.createElement('div', null, element),
      useParams: () => ({ deckId: '1' }),
      useNavigate: () => jest.fn(),
      useLocation: () => ({ state: null }),
      Link: ({ children }: any) => React.createElement('a', null, children),
    };
  },
  { virtual: true }
);
