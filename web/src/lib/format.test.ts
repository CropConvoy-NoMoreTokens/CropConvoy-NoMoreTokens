import { describe, test, expect } from 'vitest';
import { money, rupeesToMinor, colomboToUtc, localDateInput } from './format';
describe('money and Sri Lanka date conversions', () => {
  test('converts decimal strings without losing a minor unit', () => { expect(rupeesToMinor('220.35')).toBe(22035); expect(rupeesToMinor('0.01')).toBe(1); expect(rupeesToMinor('16000')).toBe(1600000); });
  test('rejects excess precision, negative values and unsafe money', () => { for (const value of ['1.001', '-2', '', 'Infinity', '999999999999999999']) expect(Number.isNaN(rupeesToMinor(value))).toBe(true); });
  test('renders the fixture proceeds in LKR', () => { expect(money(1665000)).toContain('16,650'); expect(money(22035)).toContain('220.35'); });
  test('converts Colombo local time to UTC independently of host timezone', () => { expect(colomboToUtc('2026-10-25T08:00')).toBe('2026-10-25T02:30:00.000Z'); expect(localDateInput('2026-10-25T02:30:00Z')).toBe('2026-10-25T08:00'); });
  test('handles midnight crossing and rejects invalid dates', () => { expect(colomboToUtc('2026-10-25T00:15')).toBe('2026-10-24T18:45:00.000Z'); expect(colomboToUtc('2026-02-30T12:00')).toBe(''); expect(colomboToUtc('')).toBe(''); });
});
