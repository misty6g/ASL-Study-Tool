import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Welcome from './Welcome';

const renderWelcome = () => {
  return render(
    <MemoryRouter>
      <Welcome />
    </MemoryRouter>
  );
};

describe('Welcome Component - Interactive Sign-on-Hover Hub', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders learner greeting and eyebrow banner', () => {
    renderWelcome();
    expect(screen.getByText(/AUTHENTICATED LEARNER HUB/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome back,/i)).toBeInTheDocument();
  });

  test('displays default learner name and allows inline editing', () => {
    renderWelcome();
    const nameBtn = screen.getByRole('button', { name: /Student name: Learner/i });
    expect(nameBtn).toBeInTheDocument();

    // Click to edit
    fireEvent.click(nameBtn);
    const input = screen.getByLabelText(/Edit learner name/i);
    expect(input).toBeInTheDocument();

    // Enter new name and save
    fireEvent.change(input, { target: { value: 'Jordan' } });
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);

    // Verify name updated in UI and localStorage
    expect(screen.getByText('Jordan')).toBeInTheDocument();
    expect(localStorage.getItem('asl_student_name')).toBe('Jordan');
  });

  test('renders interactive hand sign showcase with sprite container', () => {
    renderWelcome();
    expect(screen.getByText(/Hover-Reactive Hand Signs/i)).toBeInTheDocument();
    expect(screen.getByTestId('hand-sprite-frame')).toBeInTheDocument();
  });

  test('updates active sign when hovering over word letter tiles', () => {
    renderWelcome();
    // Default word is WELCOME, first letter is W
    expect(screen.getByText(/Letter W/i)).toBeInTheDocument();

    // Find letter E tile (index 1 in WELCOME) and hover
    const tileE = screen.getByTestId('letter-tile-E-1');
    expect(tileE).toBeInTheDocument();

    act(() => {
      fireEvent.mouseEnter(tileE);
    });

    expect(screen.getByText(/Letter E/i)).toBeInTheDocument();
  });

  test('updates active sign when hovering over alphabet ribbon chips', () => {
    renderWelcome();
    const chipK = screen.getByTestId('alphabet-chip-K');
    expect(chipK).toBeInTheDocument();

    act(() => {
      fireEvent.mouseEnter(chipK);
    });

    expect(screen.getByText(/Letter K/i)).toBeInTheDocument();
    expect(screen.getByText(/From alphabet/i)).toBeInTheDocument();
  });

  test('switches word preset and updates word tiles', () => {
    renderWelcome();
    const helloBtn = screen.getByRole('button', { name: /^HELLO$/i });
    expect(helloBtn).toBeInTheDocument();

    fireEvent.click(helloBtn);
    expect(screen.getByTestId('letter-tile-H-0')).toBeInTheDocument();
    expect(screen.getByText(/Letter H/i)).toBeInTheDocument();
  });

  test('toggles hover sound button state', () => {
    renderWelcome();
    const soundBtn = screen.getByRole('button', { name: /Enable hover sound/i });
    expect(soundBtn).toHaveTextContent(/Sound Off/i);

    fireEvent.click(soundBtn);
    expect(soundBtn).toHaveTextContent(/Sound On/i);

    fireEvent.click(soundBtn);
    expect(soundBtn).toHaveTextContent(/Sound Off/i);
  });

  test('renders quick launcher links to all core study surfaces', () => {
    renderWelcome();
    const decksLink = screen.getByRole('link', { name: /Open Vocabulary Decks/i });
    expect(decksLink).toHaveAttribute('href', '/home');

    const fsLink = screen.getByRole('link', { name: /Open Fingerspelling Drill/i });
    expect(fsLink).toHaveAttribute('href', '/fingerspelling');

    const starredLink = screen.getByRole('link', { name: /Review Starred Cards/i });
    expect(starredLink).toHaveAttribute('href', '/deck/all-starred');

    const testLink = screen.getByRole('link', { name: /Start Test Mode/i });
    expect(testLink).toHaveAttribute('href', '/test/all-decks');
  });

  test('renders zero em-dashes across rendered welcome content', () => {
    const { container } = renderWelcome();
    const allText = container.textContent || '';
    expect(allText).not.toMatch(/[\u2014\u2013]/);
  });
});
