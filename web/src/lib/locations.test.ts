import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findMatchingPresets, findNearestPreset, searchNominatim } from './locations';

describe('locations helper', () => {
  it('returns default top presets when query is empty', () => {
    const list = findMatchingPresets('');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].category).toBe('economic_centre');
  });

  it('matches Dambulla preset by query', () => {
    const list = findMatchingPresets('Dambulla');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].name).toContain('Dambulla');
    expect(list[0].lat).toBeCloseTo(7.8742, 3);
  });

  it('finds nearest preset for coordinates matching Kandy', () => {
    const match = findNearestPreset({ lat: 7.2906, lng: 80.6337 });
    expect(match).not.toBeNull();
    expect(match?.name).toBe('Kandy');
  });

  it('finds nearest preset for Dambulla sample coordinates', () => {
    const match = findNearestPreset({ lat: 7.8742, lng: 80.6511 });
    expect(match).not.toBeNull();
    expect(match?.name).toContain('Dambulla');
  });

  it('returns null for coordinates far away from any preset', () => {
    const match = findNearestPreset({ lat: 0, lng: 0 });
    expect(match).toBeNull();
  });

  it('searches Nominatim and handles successful API response', async () => {
    const mockResults = [
      {
        place_id: 12345,
        display_name: 'Main Street, Kegalle, Sabaragamuwa Province, Sri Lanka',
        name: 'Main Street',
        lat: '7.251340',
        lon: '80.346410',
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    }));

    const results = await searchNominatim('Kegalle');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Main Street');
    expect(results[0].lat).toBe(7.25134);
    expect(results[0].source).toBe('nominatim');
  });

  it('handles Nominatim network failure gracefully without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const results = await searchNominatim('Kandy');
    expect(results).toEqual([]);
  });
});
