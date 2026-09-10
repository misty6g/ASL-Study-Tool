import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders application layout with footer', () => {
  render(<App />);
  const footerElement = screen.getByText(/gyanmistry/i);
  expect(footerElement).toBeInTheDocument();
});
