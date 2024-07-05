import React from 'react';
import { render, screen } from '@testing-library/react';
import LiarsDice from '@/components/LiarsDice';

jest.mock('socket.io-client', () => {
  const mSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
  return {
    io: jest.fn(() => mSocket),
  };
});

describe('LiarsDice', () => {
  it('renders without crashing', () => {
    render(<LiarsDice />);
    expect(screen.getByText("Liar's Dice")).toBeInTheDocument();
  });
});