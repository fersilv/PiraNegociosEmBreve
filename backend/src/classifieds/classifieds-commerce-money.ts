export type BasisPointsFeeRule = {
  rateBps: number;
  minimumFeeCents?: number | null;
  maximumFeeCents?: number | null;
};

function integer(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${field} must be a safe integer.`);
  }
  return value;
}

/**
 * Calculates a fee using integer cents and basis points only.
 * Rounding is half-up to the nearest cent and all limits are also cents.
 */
export function calculateBasisPointsFeeCents(
  amountCentsRaw: number,
  rule: BasisPointsFeeRule,
): number {
  const amountCents = integer(amountCentsRaw, 'amountCents');
  const rateBps = integer(rule.rateBps, 'rateBps');
  const minimumFeeCents = integer(rule.minimumFeeCents ?? 0, 'minimumFeeCents');
  const maximumFeeCents = rule.maximumFeeCents == null
    ? null
    : integer(rule.maximumFeeCents, 'maximumFeeCents');

  if (amountCents < 0) throw new RangeError('amountCents cannot be negative.');
  if (rateBps < 0 || rateBps > 10_000) throw new RangeError('rateBps must be between 0 and 10000.');
  if (minimumFeeCents < 0) throw new RangeError('minimumFeeCents cannot be negative.');
  if (maximumFeeCents != null && maximumFeeCents < minimumFeeCents) {
    throw new RangeError('maximumFeeCents cannot be lower than minimumFeeCents.');
  }

  const numerator = BigInt(amountCents) * BigInt(rateBps);
  const rounded = Number((numerator + 5_000n) / 10_000n);
  let feeCents = Math.max(minimumFeeCents, rounded);
  if (maximumFeeCents != null) feeCents = Math.min(maximumFeeCents, feeCents);
  return Math.max(0, Math.min(amountCents, feeCents));
}
