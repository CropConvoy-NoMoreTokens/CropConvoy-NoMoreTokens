import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import MapCanvas from './MapCanvas';
const map = vi.hoisted(() => ({ fitBounds: vi.fn(), setView: vi.fn(), getZoom: () => 10 }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ eventHandlers }: { eventHandlers: { tileerror(): void } }) => <button onClick={eventHandlers.tileerror}>Simulate tile failure</button>,
  CircleMarker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Polyline: ({ positions }: { positions: unknown }) => <output data-testid="returned-route">{JSON.stringify(positions)}</output>,
  useMap: () => map, useMapEvents: () => map,
}));
test('tile failure keeps selected pins visible without inventing a route', async () => {
  const user = userEvent.setup(); render(<MapCanvas points={[{ lat: 7.87, lng: 80.65, label: 'Pickup' }]} />);
  expect(screen.queryByTestId('returned-route')).not.toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Simulate tile failure' }));
  expect(screen.getByText(/Map tiles are unavailable/)).toBeInTheDocument(); expect(screen.getByText('Pickup')).toBeInTheDocument();
});
test('returned GeoJSON maps longitude/latitude into Leaflet latitude/longitude', () => {
  render(<MapCanvas points={[{ lat: 7.87, lng: 80.65, label: 'Pickup' }]} geometry={{ type: 'LineString', coordinates: [[80.65, 7.87], [80.63, 7.29]] }} />);
  expect(screen.getByTestId('returned-route')).toHaveTextContent('[[7.87,80.65],[7.29,80.63]]');
});
