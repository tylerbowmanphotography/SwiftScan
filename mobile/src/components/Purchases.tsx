import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addPurchase, daysLeft, parsePurchases, recheckBy, removePurchase, WINDOWS, type Purchase } from '../lib/purchases';
import { colors, radius } from '../lib/theme';
import type { ProductScanResult } from '../lib/types';
import { Card, SecondaryButton, SectionTitle } from './ui';

const STORE_KEY = 'ss_purchases';
const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);
const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** "I bought this": log the price paid and a re-check window; the list shows how many days are left. */
export function Purchases({ r }: { r: ProductScanResult }) {
  const [list, setList] = useState<Purchase[]>([]);
  const [price, setPrice] = useState('');
  const [windowDays, setWindowDays] = useState<number>(30);
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => setList(parsePurchases(raw)))
      .catch(() => {});
  }, []);
  const save = (next: Purchase[]) => {
    setList(next);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {});
  };
  const paid = toNumber(price);
  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle>Bought it? Re-check later</SectionTitle>
      <Text style={styles.hint}>{"Some stores adjust the price if it drops soon after you buy. Policies vary, so check the store's before you count on it."}</Text>
      <View style={{ gap: 4 }}>
        <Text style={styles.label}>Price you paid</Text>
        <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="$0.00" placeholderTextColor={colors.textMuted} style={styles.input} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {WINDOWS.map((d) => (
          <Pressable key={d} onPress={() => setWindowDays(d)} style={[styles.chip, windowDays === d && styles.chipOn]} accessibilityRole="button">
            <Text style={[styles.chipText, windowDays === d && { color: '#fff' }]}>{`${d} days`}</Text>
          </Pressable>
        ))}
      </View>
      <SecondaryButton
        title="Log this purchase"
        disabled={!(paid > 0)}
        onPress={() => {
          save(addPurchase(list, { name: r.productName, price: paid, boughtAt: Date.now(), windowDays }));
          setPrice('');
        }}
      />
      {list.map((p) => {
        const left = daysLeft(p);
        return (
          <View key={p.name} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{`${p.name} (${fmt(p.price)})`}</Text>
              <Text style={[styles.hint, left >= 0 && left <= 3 && { color: colors.rose, fontWeight: '700' }]}>
                {left < 0 ? 'Window closed' : `Re-check by ${new Date(recheckBy(p)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} (${left} day${left === 1 ? '' : 's'} left)`}
              </Text>
            </View>
            <Pressable onPress={() => save(removePurchase(list, p.name))} hitSlop={8} accessibilityLabel={`Remove ${p.name}`}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  input: { color: colors.text, fontSize: 17, fontWeight: '700', backgroundColor: colors.ink800, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  chip: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.textMuted, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.pink600, borderColor: colors.pink600 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
