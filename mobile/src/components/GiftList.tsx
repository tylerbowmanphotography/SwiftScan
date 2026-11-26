import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addGift, emptyList, parseGiftList, removeGift, setBudget, totals, type GiftList as List } from '../lib/giftList';
import { colors, radius } from '../lib/theme';
import type { ProductScanResult } from '../lib/types';
import { Card, SecondaryButton, SectionTitle } from './ui';

const STORE_KEY = 'ss_gift_list';
const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);
const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Holiday gift list: add this product at the price you plan to pay and keep a running total against a budget. */
export function GiftList({ r }: { r: ProductScanResult }) {
  const [list, setList] = useState<List>(emptyList());
  const [price, setPrice] = useState('');
  const [budget, setBudgetText] = useState('');
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        const l = parseGiftList(raw);
        setList(l);
        if (l.budget) setBudgetText(String(l.budget));
      })
      .catch(() => {});
  }, []);
  const save = (next: List) => {
    setList(next);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {});
  };
  const planned = toNumber(price) || r.goodPrice || r.msrp || 0;
  const t = totals(list);
  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle>Holiday gift list</SectionTitle>
      <Text style={styles.hint}>Add this item at the price you plan to pay and keep a running total.</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.label}>{"Price you'll pay"}</Text>
          <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder={planned ? fmt(planned) : '$0.00'} placeholderTextColor={colors.textMuted} style={styles.input} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.label}>Gift budget (optional)</Text>
          <TextInput
            value={budget}
            onChangeText={(v) => {
              setBudgetText(v);
              save(setBudget(list, toNumber(v)));
            }}
            keyboardType="decimal-pad"
            placeholder="$0.00"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
      </View>
      <SecondaryButton title="Add to gift list" onPress={() => save(addGift(list, { name: r.productName, price: planned, t: Date.now() }))} disabled={!(planned > 0)} />
      {t.count > 0 ? (
        <View style={{ gap: 6 }}>
          {list.items.map((g) => (
            <View key={g.name} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
              <Text style={styles.price}>{fmt(g.price)}</Text>
              <Pressable onPress={() => save(removeGift(list, g.name))} hitSlop={8} accessibilityLabel={`Remove ${g.name}`}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <Text style={[styles.total, t.over && { color: colors.rose }]}>
            {`Total ${fmt(t.total)} for ${t.count} gift${t.count === 1 ? '' : 's'}`}
            {t.left !== null ? (t.over ? `, ${fmt(Math.abs(t.left))} over budget` : `, ${fmt(t.left)} left`) : ''}
          </Text>
          <Text style={styles.hint}>{"Prices are your own or SwiftScan's estimates, not store prices."}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  input: { color: colors.text, fontSize: 17, fontWeight: '700', backgroundColor: colors.ink800, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 14 },
  price: { color: colors.text, fontSize: 14, fontWeight: '700' },
  total: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
