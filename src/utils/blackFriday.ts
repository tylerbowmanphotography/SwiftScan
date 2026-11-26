/** Black Friday is the day after US Thanksgiving (4th Thursday of November); Cyber Monday is 3 days later. */
export function blackFridayDate(year: number): Date {
  const first = new Date(year, 10, 1).getDay(); // weekday of Nov 1 (0 = Sunday)
  const thanksgiving = 1 + ((4 - first + 7) % 7) + 21;
  return new Date(year, 10, thanksgiving + 1);
}

/** True from the Monday of Black Friday week until the day after Cyber Monday. */
export function isBlackFridayWeek(now: Date = new Date()): boolean {
  const bf = blackFridayDate(now.getFullYear());
  const start = new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() - 4);
  const end = new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() + 4);
  return now >= start && now < end;
}

/** Cyber Monday: the Monday after Black Friday. */
export function cyberMondayLabel(year: number = new Date().getFullYear()): string {
  const bf = blackFridayDate(year);
  return new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() + 3).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Apple offer code for SwiftScan Pro Monthly: $2.49 for the first month. Created in App Store Connect; expires Dec 1, 2026. */
export const BF_PROMO = {
  code: 'BLACKFRIDAY50',
  year: 2026,
  url: 'https://apps.apple.com/redeem?ctx=offercodes&id=6823987573&code=BLACKFRIDAY50',
  price: '$2.49',
} as const;

/** True from Nov 25 through the end of Dec 1 (the offer code's last day). */
export function isPromoActive(now: Date = new Date()): boolean {
  return now >= new Date(BF_PROMO.year, 10, 25) && now < new Date(BF_PROMO.year, 11, 2);
}
