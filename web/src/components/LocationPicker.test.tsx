import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationPicker } from './LocationPicker';
import type { ReactNode } from 'react';

vi.mock('./MapCanvas', () => ({
  default: ({ points, onPick }: { points: Array<{ lat: number; lng: number; label: string }>; onPick?: (point: { lat: number; lng: number }) => void }) => (
    <div data-testid="test-map">
      {points.map((p, idx) => (
        <span key={idx} data-testid="map-pin">{p.label}: {p.lat}, {p.lng}</span>
      ))}
      {onPick && (
        <button type="button" onClick={() => onPick({ lat: 7.2906, lng: 80.6337 })}>
          Pick Kandy Pin
        </button>
      )}
    </div>
  ),
}));

describe('LocationPicker component', () => {
  it('renders initial coordinates and identifies known preset name', () => {
    const handleChange = vi.fn();
    render(
      <LocationPicker
        label="Pickup"
        name="pickup"
        value={{ lat: 7.8742, lng: 80.6511 }}
        onChange={handleChange}
      />
    );

    const searchInput = screen.getByRole('combobox');
    expect(searchInput).toHaveValue('Dambulla Dedicated Economic Centre');
    expect(screen.getByLabelText('Pickup latitude')).toHaveValue(7.8742);
    expect(screen.getByLabelText('Pickup longitude')).toHaveValue(80.6511);
  });

  it('filters locations by name and selects via dropdown click', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <LocationPicker
        label="Delivery"
        name="delivery"
        value={{ lat: NaN, lng: NaN }}
        onChange={handleChange}
      />
    );

    const searchInput = screen.getByRole('combobox');
    await user.type(searchInput, 'Kandy');

    const option = await screen.findByRole('option', { name: /Kandy/i });
    expect(option).toBeInTheDocument();

    await user.click(option);

    expect(handleChange).toHaveBeenCalledWith({ lat: 7.2906, lng: 80.6337 });
    expect(searchInput).toHaveValue('Kandy');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation with Arrow keys and Enter', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <LocationPicker
        label="Start"
        name="start"
        value={{ lat: NaN, lng: NaN }}
        onChange={handleChange}
      />
    );

    const searchInput = screen.getByRole('combobox');
    await user.type(searchInput, 'Meegoda');

    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 6.8488, lng: 80.0577 })
    );
  });

  it('closes dropdown when Escape key is pressed', async () => {
    const user = userEvent.setup();
    render(
      <LocationPicker
        label="Destination"
        name="destination"
        value={{ lat: NaN, lng: NaN }}
        onChange={vi.fn()}
      />
    );

    const searchInput = screen.getByRole('combobox');
    await user.type(searchInput, 'Colombo');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clears query when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <LocationPicker
        label="Pickup"
        name="pickup"
        value={{ lat: 7.8742, lng: 80.6511 }}
        onChange={vi.fn()}
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear pickup search/i });
    await user.click(clearButton);

    const searchInput = screen.getByRole('combobox');
    expect(searchInput).toHaveValue('');
  });

  it('updates search bar and calls onChange when a pin is picked on the map', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <LocationPicker
        label="Pickup"
        name="pickup"
        value={{ lat: 7.8742, lng: 80.6511 }}
        onChange={handleChange}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Pick Kandy Pin' }));
    expect(handleChange).toHaveBeenCalledWith({ lat: 7.2906, lng: 80.6337 });

    const searchInput = screen.getByRole('combobox');
    expect(searchInput).toHaveValue('Kandy');
  });

  it('allows manual entry of latitude and longitude numbers', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <LocationPicker
        label="Delivery"
        name="delivery"
        value={{ lat: 7.0, lng: 80.0 }}
        onChange={handleChange}
      />
    );

    const latInput = screen.getByLabelText('Delivery latitude');
    fireEvent.change(latInput, { target: { value: '7.4863' } });

    expect(handleChange).toHaveBeenCalledWith({ lat: 7.4863, lng: 80.0 });
  });
});
