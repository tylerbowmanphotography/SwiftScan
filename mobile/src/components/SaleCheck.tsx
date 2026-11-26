import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { checkSale, type SaleVerdict } from '../lib/saleCheck';
import { parseEntries, recordEntry, summarize, type SaleEntry } from '../lib/savings';
import { colors, radius } from '../lib/theme';
import type { ProductScanResult } from '../lib/types';
import { Card, SectionTitle } from './ui';

const STORE_KEY = 'ss_sale_checks';
const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const TONE: Record<SaleVerdict, { color: string; tint: string }> = {
  GREAT: { color: colors.emerald, tint: 'rgba(16,185,129,0.12)' },
  GOOD: { color: colors.emerald, tint: 'rgba(16,185,129,0.12)' },
  FAIR: { color: colors.amber, tint: 'rgba(245,158,11,0.12)' },
  HIGH: { color: colors.rose, tint: 'rgba(244,63,94,0.12)' },
  INFLATED: { color: colors.rose, tint: 'rgba(244,63,94,0.12)' },
};

/** "Is this sale real?": type the tag price (and the crossed-out price) to compare with SwiftScan's estimate. */
export function SaleCheck({ r }: { r: ProductScanResult }) {
  const [tag, setTag] = useState('');
  const [was, setWas] = useState('');
  const outcome = useMemo(
    () =>
      checkSale({
        tagPrice: toNumber(tag),
        wasPrice: toNumber(was),
        msrp: r.msrp,
        goodPrice: r.goodPrice,
        greatDealPrice: r.greatDealPrice,
        averagePrice: r.historicalPriceRange?.averagePrice || 0,
        highestPrice: r.historicalPriceRange?.highestPrice || 0,
      }),
    [tag, was, r],
  );
  const tone = outcome ? TONE[outcome.verdict] : null;

  const [entries, setEntries] = useState<SaleEntry[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => setEntries(parseEntries(raw)))
      .catch(() => {});
  }, []);
  const typical = r.historicalPriceRange?.averagePrice || r.msrp || r.goodPrice || 0;
  const tagValue = toNumber(tag);
  // Remember the tag price once the shopper stops typing.
  useEffect(() => {
    if (!outcome || !(tagValue > 0)) return;
    const id = setTimeout(() => {
      setEntries((prev) => {
        const next = recordEntry(prev, { name: r.productName, tag: tagValue, typical, t: Date.now() });
        AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }, 1500);
    return () => clearTimeout(id);
  }, [tagValue, typical, r.productName, outcome]);
  const tally = useMemo(() => summarize(entries), [entries]);
  const good = outcome && (outcome.verdict === 'GREAT' || outcome.verdict === 'GOOD');

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Is this sale real?</SectionTitle>
      <Text style={styles.hint}>{"Type the price on the tag to compare it with SwiftScan's estimate."}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.label}>Price on the tag</Text>
          <TextInput value={tag} onChangeText={setTag} keyboardType="decimal-pad" placeholder="$0.00" placeholderTextColor={colors.textFaint} style={styles.input} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.label}>{'"Was" price (optional)'}</Text>
          <TextInput value={was} onChangeText={setWas} keyboardType="decimal-pad" placeholder="$0.00" placeholderTextColor={colors.textFaint} style={styles.input} />
        </View>
      </View>
      {outcome && tone ? (
        <View style={[styles.result, { backgroundColor: tone.tint, borderColor: tone.color }]} accessibilityRole="summary">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={good ? 'checkmark-circle' : 'warning'} size={18} color={tone.color} />
            <Text style={[styles.headline, { color: tone.color }]}>{outcome.headline}</Text>
          </View>
          <Text style={styles.detail}>{outcome.detail}</Text>
          <Text style={styles.hint}>{"Based on SwiftScan's price estimates, which can be off. Not a claim about the store."}</Text>
        </View>
      ) : null}
      {tally.items > 0 ? (
        <Text style={styles.hint}>
          {`Your tally: ${tally.items} price${tally.items === 1 ? '' : 's'} checked${
            tally.below > 0 ? `, ${tally.below} below SwiftScan's typical price (${fmt(tally.spotted)} in total)` : ''
          }. Prices spotted, not money saved.`}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  input: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    backgroundColor: colors.ink800,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  result: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 6 },
  headline: { fontSize: 16, fontWeight: '800' },
  detail: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
