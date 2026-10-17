import type { PriceRating } from './types';

/** Brand tokens, kept in sync with the web app's src/index.css. */
export const colors = {
  pink400: '#f472b6',
  pink500: '#ec4899',
  pink600: '#db2777',
  pink700: '#be185d',
  pink800: '#9d174d',
  ink950: '#070b19',
  ink900: '#0b1124',
  ink800: '#121a33',
  ink700: '#1c2545',
  line: 'rgba(255,255,255,0.08)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  white: '#ffffff',
};

export const radius = { sm: 10, md: 16, lg: 22, xl: 28 };

export const ratingStyle: Record<PriceRating, { label: string; color: string; tint: string; gradient: [string, string] }> = {
  STEAL: { label: 'Incredible Steal 🔥', color: colors.emerald, tint: 'rgba(16,185,129,0.12)', gradient: ['#10b981', '#0d9488'] },
  GOOD_DEAL: { label: 'Good Deal 👍', color: colors.pink400, tint: 'rgba(236,72,153,0.12)', gradient: [colors.pink600, colors.pink800] },
  FAIR: { label: 'Fair Retail Price ⚖️', color: colors.amber, tint: 'rgba(245,158,11,0.12)', gradient: ['#f59e0b', '#ea580c'] },
  OVERPRICED: { label: 'Overpriced / Wait ⏳', color: colors.rose, tint: 'rgba(244,63,94,0.12)', gradient: ['#f43f5e', '#be123c'] },
};

export function money(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
