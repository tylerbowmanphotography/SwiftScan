/**
 * "Buy now or wait": where SwiftScan's current fair-price estimate sits inside the range it has
 * recorded for the product. Runs on the device. Wording is about SwiftScan's own estimates, and it
 * says so plainly when there is not enough history yet.
 * (A copy lives in mobile/src/lib/buyTiming.ts; keep the two identical.)
 */
export type BuyVerdict = 'EARLY' | 'STABLE' | 'BUY' | 'MID' | 'WAIT';

export interface BuyTimingInput {
  /** Current fair-price estimate */
  good: number;
  checks: number;
  low?: number;
  high?: number;
}

export interface BuyTimingResult {
  verdict: BuyVerdict;
  headline: string;
  detail: string;
}

export const MIN_CHECKS = 4;
const money = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

export function buyTiming(input: BuyTimingInput): BuyTimingResult | null {
  const good = Number.isFinite(input.good) && input.good > 0 ? input.good : 0;
  if (!good) return null;
  const checks = Number.isFinite(input.checks) ? Math.max(0, Math.floor(input.checks)) : 0;
  const low = input.low && input.low > 0 ? input.low : 0;
  const high = input.high && input.high > 0 ? input.high : 0;
  if (checks < MIN_CHECKS || !low || !high || high < low) {
    return {
      verdict: 'EARLY',
      headline: 'Too early to say',
      detail: `SwiftScan has checked this ${checks} time${checks === 1 ? '' : 's'} so far. It needs at least ${MIN_CHECKS} checks over time before it can say whether now is a good moment.`,
    };
  }
  const range = high - low;
  if (range < good * 0.03) {
    return { verdict: 'STABLE', headline: 'Price has barely moved', detail: `Across ${checks} checks, SwiftScan's fair-price estimate stayed between ${money(low)} and ${money(high)}, so waiting is unlikely to change much.` };
  }
  const pos = (good - low) / range;
  if (pos <= 0.2) {
    return { verdict: 'BUY', headline: 'Near its low end', detail: `The current estimate of ${money(good)} is near the bottom of the ${money(low)} to ${money(high)} range SwiftScan has seen across ${checks} checks.` };
  }
  if (pos >= 0.8) {
    return { verdict: 'WAIT', headline: 'Near its high end', detail: `The current estimate of ${money(good)} is near the top of the ${money(low)} to ${money(high)} range SwiftScan has seen across ${checks} checks. It may be worth waiting or watching the price.` };
  }
  return { verdict: 'MID', headline: 'Middle of its range', detail: `The current estimate of ${money(good)} is in the middle of the ${money(low)} to ${money(high)} range SwiftScan has seen across ${checks} checks.` };
}
