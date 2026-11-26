import { StyleSheet, Text, View } from 'react-native';
import { buyTiming, type BuyVerdict } from '../lib/buyTiming';
import { colors, radius } from '../lib/theme';
import type { ProductScanResult } from '../lib/types';

const TONE: Record<BuyVerdict, { color: string; tint: string }> = {
  BUY: { color: colors.emerald, tint: 'rgba(16,185,129,0.12)' },
  MID: { color: colors.amber, tint: 'rgba(245,158,11,0.12)' },
  WAIT: { color: colors.rose, tint: 'rgba(244,63,94,0.12)' },
  STABLE: { color: colors.textMuted, tint: 'rgba(148,163,184,0.12)' },
  EARLY: { color: colors.textMuted, tint: 'rgba(148,163,184,0.12)' },
};

/** "Buy now or wait?" from the price history SwiftScan has recorded for this product. */
export function BuyTiming({ r }: { r: ProductScanResult }) {
  const out = buyTiming({ good: r.goodPrice, checks: r.priceHistory?.checks || 0, low: r.priceHistory?.low, high: r.priceHistory?.high });
  if (!out) return null;
  const tone = TONE[out.verdict];
  return (
    <View style={[styles.box, { borderColor: tone.color, backgroundColor: tone.tint }]}>
      <Text style={[styles.headline, { color: tone.color }]}>{`Buy now or wait? ${out.headline}`}</Text>
      <Text style={styles.detail}>{out.detail}</Text>
      <Text style={styles.hint}>{"Based on SwiftScan's price estimates, which can be off. Not a prediction or a claim about the store."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 6 },
  headline: { fontSize: 15, fontWeight: '800' },
  detail: { color: colors.text, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
