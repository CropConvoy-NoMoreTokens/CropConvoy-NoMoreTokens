import { describe, it, expect } from 'vitest';
import { findMatchingPresets, findNearestPreset } from './locations';

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

});
