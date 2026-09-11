// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';

// Mock IntersectionObserver for JSDOM
class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
(window as any).IntersectionObserver = MockIntersectionObserver;

// Mock global fetch for components using fetch (e.g. TestMode)
const mockCardsData = [
  {
    id: 'c1',
    answer: 'Hello',
    video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/view',
    deck_id: '1',
  },
  {
    id: 'c2',
    answer: 'Thank You',
    video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qc/view',
    deck_id: '1',
  },
];

(global as any).fetch = jest.fn((url: string = '') => {
  const urlStr = String(url || '');
  if (urlStr.includes('/api/cards') || urlStr.includes('cards')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockCardsData),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
  });
});
(window as any).fetch = (global as any).fetch;

jest.mock('axios', () => {
  const mockDecksData = [
    { id: '1', title: 'ASL Alphabet', user_id: 'demo-user-id' },
    { id: '2', title: 'Numbers 1-20', user_id: 'demo-user-id' },
    { id: '3', title: 'Greetings and Phrases', user_id: 'demo-user-id' },
  ];

  const mockCardsList = [
    {
      id: 'c1',
      answer: 'Hello',
      video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb/view',
      deck_id: '1',
    },
    {
      id: 'c2',
      answer: 'Thank You',
      video_url: 'https://drive.google.com/file/d/18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qc/view',
      deck_id: '1',
    },
  ];

  const defaultAxiosGet = (url = '') => {
    const urlStr = String(url || '');
    if (urlStr.includes('/starred-cards') || urlStr.includes('starred')) {
      return Promise.resolve({ data: { cards: [] } });
    }
    if (urlStr.includes('/api/users') || urlStr.includes('users')) {
      return Promise.resolve({
        data: [{ id: 'demo-user-id', email: 'demo@example.com' }],
      });
    }
    if (urlStr.includes('/api/decks') || urlStr.includes('decks')) {
      return Promise.resolve({
        data: mockDecksData,
      });
    }
    if (urlStr.includes('/api/cards') || urlStr.includes('cards')) {
      return Promise.resolve({
        data: mockCardsList,
      });
    }
    return Promise.resolve({ data: [] });
  };

  const postFn = () => Promise.resolve({ data: {} });
  const deleteFn = () => Promise.resolve({ data: {} });

  const client = {
    get: defaultAxiosGet,
    post: postFn,
    delete: deleteFn,
    create: () => client,
  };

  return {
    __esModule: true,
    default: client,
    get: defaultAxiosGet,
    post: postFn,
    delete: deleteFn,
    create: () => client,
  };
});

jest.mock(
  'react-router-dom',
  () => {
    const React = require('react');

    const matchPath = (pattern: string, pathname: string) => {
      if (!pattern) return null;
      if (pattern === pathname) return {};
      const keys: string[] = [];
      const regexPattern = pattern.replace(/:([a-zA-Z0-9_]+)/g, (_: any, key: string) => {
        keys.push(key);
        return '([^/]+)';
      });
      const regex = new RegExp(`^${regexPattern}$`);
      const match = pathname.match(regex);
      if (!match) return null;
      const params: Record<string, string> = {};
      keys.forEach((key, index) => {
        params[key] = match[index + 1];
      });
      return params;
    };

    const getPath = () => {
      if (typeof global !== 'undefined' && (global as any).window && (global as any).window.location) {
        return (global as any).window.location.pathname || '/';
      }
      return '/';
    };

    return {
      BrowserRouter: ({ children }: any) => React.createElement('div', { 'data-testid': 'browser-router' }, children),
      MemoryRouter: ({ initialEntries = ['/'], children }: any) => {
        if (initialEntries && initialEntries.length > 0) {
          if (typeof global !== 'undefined' && (global as any).window && (global as any).window.history) {
            (global as any).window.history.pushState({}, '', initialEntries[0]);
          }
        }
        return React.createElement('div', { 'data-testid': 'memory-router' }, children);
      },
      Routes: ({ children }: any) => {
        const pathname = getPath();
        const childArray = React.Children.toArray(children);
        for (const child of childArray) {
          if (React.isValidElement(child)) {
            const { path, element } = child.props as any;
            const params = matchPath(path, pathname);
            if (params !== null) {
              return element;
            }
          }
        }
        return null;
      },
      Route: ({ element }: any) => element,
      useParams: () => {
        const pathname = getPath();
        const deckMatch = pathname.match(/\/deck\/([^/]+)/);
        if (deckMatch) return { deckId: deckMatch[1] };
        const testMatch = pathname.match(/\/test\/([^/]+)/);
        if (testMatch) return { deckId: testMatch[1] };
        return { deckId: '1' };
      },
      useNavigate: () => (to: string | number) => {
        if (typeof to === 'string') {
          if (typeof global !== 'undefined' && (global as any).window && (global as any).window.history) {
            (global as any).window.history.pushState({}, '', to);
          }
        }
      },
      useLocation: () => {
        const pathname = getPath();
        return {
          pathname,
          search: (typeof global !== 'undefined' && (global as any).window && (global as any).window.location.search) || '',
          hash: (typeof global !== 'undefined' && (global as any).window && (global as any).window.location.hash) || '',
          state: null,
        };
      },
      Link: ({ to, children, className, onClick, ...rest }: any) =>
        React.createElement(
          'a',
          {
            href: to,
            className,
            onClick: (e: any) => {
              if (onClick) onClick(e);
              if (!e.defaultPrevented) {
                if (typeof global !== 'undefined' && (global as any).window && (global as any).window.history) {
                  (global as any).window.history.pushState({}, '', to);
                }
              }
            },
            ...rest,
          },
          children
        ),
      NavLink: ({ to, children, className, onClick, end, ...rest }: any) => {
        const pathname = getPath();
        const isActive = end ? pathname === to : pathname.startsWith(to);
        const computedClass = typeof className === 'function' ? className({ isActive }) : className;
        return React.createElement(
          'a',
          {
            href: to,
            className: computedClass,
            'aria-current': isActive ? 'page' : undefined,
            onClick: (e: any) => {
              if (onClick) onClick(e);
              if (!e.defaultPrevented) {
                if (typeof global !== 'undefined' && (global as any).window && (global as any).window.history) {
                  (global as any).window.history.pushState({}, '', to);
                }
              }
            },
            ...rest,
          },
          children
        );
      },
    };
  },
  { virtual: true }
);
