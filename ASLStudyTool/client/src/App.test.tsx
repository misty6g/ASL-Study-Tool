import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders application layout with footer', () => {
  render(<App />);
  const footerElements = screen.getAllByText(/gyanmistry/i);
  expect(footerElements.length).toBeGreaterThanOrEqual(1);
  expect(footerElements[0]).toBeInTheDocument();
});
