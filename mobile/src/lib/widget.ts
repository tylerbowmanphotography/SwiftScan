import { Platform } from 'react-native';
import type { SavedScanItem } from './types';

const VERDICTS: Record<string, { label: string; color: string }> = {
  STEAL: { label: 'Incredible steal', color: '#10b981' },
  GOOD_DEAL: { label: 'Good deal', color: '#ec4899' },
  FAIR: { label: 'Fair price', color: '#f59e0b' },
  OVERPRICED: { label: 'Overpriced', color: '#f43f5e' },
};

/** Push the latest scan to the Home Screen widget. Safe to call anywhere; never throws. */
export function updateLastScanWidget(latest?: SavedScanItem) {
  if (Platform.OS !== 'ios') return;
  if (!latest) return;
  const r = latest.scanResult;
  const v = VERDICTS[r.priceRating] || VERDICTS.FAIR;
  const props = {
    name: r.productName,
    verdict: v.label,
    price: r.goodPrice ? `$${Math.round(r.goodPrice)}` : '',
    color: v.color,
  };
  // Loaded lazily so a missing native module (Expo Go, older build) can't break the app.
  import('../widgets/LastScanWidget')
    .then((m) => m.default.updateSnapshot(props))
    .catch(() => {
      // Widgets are optional.
    });
}
