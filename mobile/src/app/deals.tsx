import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, SectionTitle } from '../components/ui';
import * as api from '../lib/api';
import { getAffiliateUrl } from '../lib/affiliate';
import { colors } from '../lib/theme';

/** Browse current coupons and promo codes by store (found on the web, not guaranteed). */
export default function DealsScreen() {
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<string>(api.DEAL_STORES[0]);
  const [data, setData] = useState<api.CouponSearch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api.fetchDeals(store).then((d) => {
      if (!live) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [store]);

  const pick = (s: string) => {
    if (s === store) return;
    setLoading(true);
    setData(null);
    setStore(s);
  };

  const open = (url: string) => {
    const link = getAffiliateUrl(url);
    if (link === '#') return;
    Linking.openURL(link).catch(() => WebBrowser.openBrowserAsync(link));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
      <Stack.Screen options={{ title: 'Coupons & deals' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {api.DEAL_STORES.map((s) => (
          <Pressable key={s} onPress={() => pick(s)} accessibilityRole="tab" accessibilityState={{ selected: s === store }} style={[styles.chip, s === store && styles.chipOn]}>
            <Text style={[styles.chipText, s === store && { color: '#fff' }]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card style={{ gap: 12 }}>
        <SectionTitle>{store}</SectionTitle>
        {loading ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ActivityIndicator color={colors.textMuted} />
            <Text style={styles.muted}>Searching the web…</Text>
          </View>
        ) : data?.error ? (
          <Text style={styles.muted}>{data.error}</Text>
        ) : data && data.coupons.length === 0 ? (
          <Text style={styles.muted}>{data.searched ? `No current ${store} coupons found.` : 'Deal search is unavailable right now.'}</Text>
        ) : (
          data?.coupons.map((c, i) => (
            <Pressable key={i} onPress={() => open(c.sourceUrl)} accessibilityRole="link" style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.title}>{c.title}</Text>
                {c.code ? (
                  <Text selectable style={styles.code}>
                    {c.code}
                  </Text>
                ) : null}
                <Text style={styles.muted}>{`${c.expires ? `Ends ${c.expires} · ` : ''}Found on ${c.sourceDomain}`}</Text>
              </View>
            </Pressable>
          ))
        )}
        {data?.links.map((l) => (
          <Pressable key={l.url} onPress={() => Linking.openURL(l.url)} accessibilityRole="link">
            <Text style={[styles.muted, { color: colors.pink400 }]}>{l.label}</Text>
          </Pressable>
        ))}
        <Text style={styles.fine}>Coupons are found on the web and are not guaranteed. SwiftScan does not pay cash back on these.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink950 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipOn: { backgroundColor: colors.pink600 },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  fine: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  code: { alignSelf: 'flex-start', color: colors.pink400, fontSize: 15, fontWeight: '800', letterSpacing: 1, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.pink400, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', fontFamily: 'Menlo' },
});
