import { calculateBasisPointsFeeCents } from './classifieds-commerce-money';

describe('calculateBasisPointsFeeCents', () => {
  it('rounds half-up to the nearest cent using integers only', () => {
    expect(calculateBasisPointsFeeCents(1_000, { rateBps: 255 })).toBe(26);
    expect(calculateBasisPointsFeeCents(1_000, { rateBps: 254 })).toBe(25);
  });

  it('honors minimum and maximum fee limits', () => {
    expect(calculateBasisPointsFeeCents(10_000, { rateBps: 100, minimumFeeCents: 150 })).toBe(150);
    expect(calculateBasisPointsFeeCents(10_000, { rateBps: 1_000, maximumFeeCents: 500 })).toBe(500);
  });

  it('never charges more than the order amount', () => {
    expect(calculateBasisPointsFeeCents(99, { rateBps: 10_000, minimumFeeCents: 500 })).toBe(99);
  });

  it('rejects fractional cents and invalid basis points', () => {
    expect(() => calculateBasisPointsFeeCents(100.5, { rateBps: 100 })).toThrow(TypeError);
    expect(() => calculateBasisPointsFeeCents(100, { rateBps: 10_001 })).toThrow(RangeError);
  });
});
