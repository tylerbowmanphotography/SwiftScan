/**
 * "Is this sale real?" Compares the price on the tag (and the crossed-out "was" price, if any)
 * with SwiftScan's own estimates for the product. Runs on the device: no AI call, no cost.
 * Wording is deliberately about SwiftScan's estimate, never a claim about the store.
 * (A copy lives in mobile/src/lib/saleCheck.ts; keep the two identical.)
 */
export type SaleVerdict = 'GREAT' | 'GOOD' | 'FAIR' | 'HIGH' | 'INFLATED';

export interface SaleCheckInput {
  tagPrice: number;
  wasPrice?: number;
  msrp: number;
  goodPrice: number;
  greatDealPrice: number;
  /** Average of the estimated range */
  averagePrice: number;
  /** Highest of the estimated range */
  highestPrice: number;
}

export interface SaleCheckResult {
  verdict: SaleVerdict;
  headline: string;
  detail: string;
  /** Discount the tag claims, in percent (only when a "was" price was given) */
  claimedPct: number | null;
  /** Discount against SwiftScan's typical price, in percent (negative = above typical) */
  realPct: number | null;
  wasLooksInflated: boolean;
}

const pos = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
const money = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

export function checkSale(input: SaleCheckInput): SaleCheckResult | null {
  const tag = pos(input.tagPrice);
  if (!tag) return null;
  const was = pos(input.wasPrice);
  const good = pos(input.goodPrice);
  const great = pos(input.greatDealPrice);
  const typical = pos(input.averagePrice) || pos(input.msrp) || good;
  const ceiling = Math.max(pos(input.highestPrice), pos(input.msrp), typical);

  const claimedPct = was > tag ? Math.round(((was - tag) / was) * 100) : null;
  const realPct = typical ? Math.round(((typical - tag) / typical) * 100) : null;
  // The crossed-out price is well above anything SwiftScan expects this product to cost.
  const wasLooksInflated = was > tag && ceiling > 0 && was > ceiling * 1.1;

  let verdict: SaleVerdict;
  if (great && tag <= great) verdict = 'GREAT';
  else if (good && tag <= good) verdict = 'GOOD';
  else if (typical && tag <= typical * 1.05) verdict = 'FAIR';
  else verdict = 'HIGH';
  if (wasLooksInflated && (verdict === 'FAIR' || verdict === 'HIGH')) verdict = 'INFLATED';

  const inflatedNote = wasLooksInflated
    ? ` The "was" price of ${money(was)} looks high compared with what SwiftScan expects (up to about ${money(ceiling)}), so the advertised ${claimedPct}% off may overstate the saving.`
    : '';
  const vs = realPct === null ? '' : realPct >= 0 ? ` That is about ${realPct}% below SwiftScan's typical price of ${money(typical)}.` : ` That is about ${Math.abs(realPct)}% above SwiftScan's typical price of ${money(typical)}.`;

  switch (verdict) {
    case 'GREAT':
      return { verdict, headline: 'Great price', detail: `${money(tag)} is at or below SwiftScan's great-deal price of ${money(great)}.${vs}${inflatedNote}`, claimedPct, realPct, wasLooksInflated };
    case 'GOOD':
      return { verdict, headline: 'Good price', detail: `${money(tag)} is at or below SwiftScan's fair price of ${money(good)}.${vs}${inflatedNote}`, claimedPct, realPct, wasLooksInflated };
    case 'FAIR':
      return { verdict, headline: 'About normal', detail: `${money(tag)} is close to what SwiftScan expects this to cost.${vs}${good ? ` A good price would be ${money(good)} or less.` : ''}`, claimedPct, realPct, wasLooksInflated };
    case 'INFLATED':
      return { verdict, headline: 'Sale looks inflated', detail: `${money(tag)} is not a bargain by SwiftScan's estimate.${vs}${inflatedNote}${good ? ` A good price would be ${money(good)} or less.` : ''}`, claimedPct, realPct, wasLooksInflated };
    default:
      return { verdict, headline: 'Higher than usual', detail: `${money(tag)} is above what SwiftScan expects.${vs}${good ? ` A good price would be ${money(good)} or less.` : ''}`, claimedPct, realPct, wasLooksInflated };
  }
}
