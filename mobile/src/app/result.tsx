import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Pill, PrimaryButton, SecondaryButton, SectionTitle } from '../components/ui';
import { getAffiliateConfig, getAffiliateUrl, hasAffiliateIds, isAmazonLink } from '../lib/affiliate';
import * as api from '../lib/api';
import { useApp } from '../lib/store';
import { colors, money, radius, ratingStyle } from '../lib/theme';
import type { ProductScanResult } from '../lib/types';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getItem, updateItem, config, user } = useApp();
  const insets = useSafeAreaInsets();
  const item = id ? getItem(id) : undefined;

  if (!item) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>This scan is no longer saved.</Text>
        <SecondaryButton title="Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const r = item.scanResult;
  const rs = ratingStyle[r.priceRating] ?? ratingStyle.FAIR;
  const ident = r.identification;
  const identText =
    ident?.verified && ident.method === 'database'
      ? 'Identified from barcode database'
      : ident?.source === 'SwiftScan users'
        ? 'Matched from an earlier SwiftScan scan of this barcode (unverified)'
        : ident?.source === 'Web search'
        ? 'Matched from the barcode by web search (unverified)'
        : ident?.method === 'photo'
        ? 'Identified by AI from your photo (unverified)'
        : ident?.method === 'search' || ident?.method === 'correction'
          ? 'Product from your search'
          : 'Identification not verified';

  const share = () => {
    Share.share({
      message: `${r.productName}: ${rs.label.replace(/[^\w\s/]/g, '').trim()}. Good price around ${money(r.goodPrice)}, great deal at ${money(r.greatDealPrice)}. Checked with SwiftScan ${api.SITE_URL}`,
    }).catch(() => {});
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Pressable onPress={() => updateItem(item.id, { isBookmarked: !item.isBookmarked })} hitSlop={10} accessibilityLabel={item.isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
                <Ionicons name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={item.isBookmarked ? colors.pink400 : colors.text} />
              </Pressable>
              <Pressable onPress={share} hitSlop={10} accessibilityLabel="Share">
                <Ionicons name="share-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }}>
        {/* Product header */}
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="pricetag-outline" size={28} color={colors.pink400} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{r.productName}</Text>
            <Text style={styles.meta}>{[r.brand, r.category].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        <View style={styles.identRow}>
          <Ionicons name={ident?.verified ? 'checkmark-circle' : 'information-circle-outline'} size={16} color={ident?.verified ? colors.emerald : colors.textMuted} />
          <Text style={styles.identText}>{identText}</Text>
        </View>

        {/* Verdict + price targets */}
        <LinearGradient colors={rs.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.verdict}>
          <Text style={styles.verdictLabel}>{rs.label}</Text>
          {r.priceAdvice ? <Text style={styles.verdictAdvice}>{r.priceAdvice}</Text> : null}
          <View style={styles.priceRow}>
            <PriceStat label="Good price" value={r.goodPrice} big />
            <PriceStat label="Great deal" value={r.greatDealPrice} />
            <PriceStat label="MSRP" value={r.msrp} />
          </View>
        </LinearGradient>
        {r.pricesAreEstimates !== false ? (
          <Text style={styles.disclaimer}>Prices are AI estimates, not live quotes. Check the store before you buy.</Text>
        ) : null}

        {r.verdict || r.summary ? (
          <Card style={{ gap: 10 }}>
            <SectionTitle>Our take</SectionTitle>
            {r.verdict ? <Text style={styles.body}>{r.verdict}</Text> : null}
            {r.summary && r.summary !== r.verdict ? <Text style={[styles.body, { color: colors.textMuted }]}>{r.summary}</Text> : null}
          </Card>
        ) : null}

        <PriceComparison r={r} />
        <Coupons r={r} />
        <PriceHistory r={r} />
        <ProsCons r={r} />

        {r.keySpecs?.length ? (
          <Card>
            <SectionTitle>Key specs</SectionTitle>
            {r.keySpecs.map((s, i) => (
              <View key={i} style={[styles.specRow, i > 0 && styles.divider]}>
                <Text style={styles.specLabel}>{s.label}</Text>
                <Text style={styles.specValue}>{s.value}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {config?.accounts?.enabled ? <PriceAlert r={r} signedIn={!!user} /> : null}
        <AskQuestion r={r} />
        <LocalStores r={r} />

        <SecondaryButton
          title="Wrong product? Search instead"
          onPress={() => router.push({ pathname: '/search', params: { q: r.productName } })}
          icon={<Ionicons name="refresh" size={18} color={colors.textMuted} />}
        />
        <PrimaryButton title="Scan another item" onPress={() => router.push('/scan')} icon={<Ionicons name="scan" size={20} color="#fff" />} />
      </ScrollView>
    </>
  );
}

function PriceStat({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <View style={{ flex: big ? 1.3 : 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, big && { fontSize: 28 }]} numberOfLines={1} adjustsFontSizeToFit>
        {money(value)}
      </Text>
    </View>
  );
}

function PriceComparison({ r }: { r: ProductScanResult }) {
  const rows = r.priceComparison || [];
  if (!rows.length) return null;
  const best = Math.min(...rows.map((p) => p.price).filter((n) => Number.isFinite(n)));
  const open = async (url?: string, retailer?: string) => {
    const link = getAffiliateUrl(url, retailer, r.productName);
    if (link === '#') return;
    // Store links open in their app (e.g. Amazon) when installed, otherwise in the browser.
    Linking.openURL(link).catch(() => WebBrowser.openBrowserAsync(link));
  };
  return (
    <Card>
      <SectionTitle>Compare stores</SectionTitle>
      {rows.map((p, i) => (
        <Pressable key={i} onPress={() => open(p.url, p.retailer)} style={({ pressed }) => [styles.storeRow, i > 0 && styles.divider, pressed && { opacity: 0.6 }]} accessibilityRole="link">
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.storeName}>{p.retailer}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {p.price === best ? <Pill text="Lowest" color={colors.emerald} bg="rgba(16,185,129,0.12)" /> : null}
              {p.dealTag ? <Pill text={p.dealTag} /> : null}
              {!p.inStock ? <Pill text="Out of stock" color={colors.textMuted} bg={colors.ink800} /> : null}
            </View>
          </View>
          <Text style={styles.storePrice}>{money(p.price)}</Text>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
      {hasAffiliateIds() ? (
        <Text style={[styles.disclaimer, { marginTop: 12, textAlign: 'left' }]}>
          {getAffiliateConfig().amazonTag && rows.some((p) => isAmazonLink(p.url)) ? 'As an Amazon Associate I earn from qualifying purchases. ' : ''}
          Links may be affiliate links; we may earn a commission at no extra cost to you.
        </Text>
      ) : null}
    </Card>
  );
}

function PriceHistory({ r }: { r: ProductScanResult }) {
  const h = r.historicalPriceRange;
  if (!h || !(h.highestPrice > h.lowestEver)) return null;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - h.lowestEver) / (h.highestPrice - h.lowestEver)) * 100))}%` as const;
  return (
    <Card>
      <SectionTitle>Typical price range</SectionTitle>
      <View style={{ height: 20, justifyContent: 'center' }}>
        <View style={styles.track}>
          <LinearGradient colors={[colors.emerald, colors.amber, colors.rose]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </View>
        <View style={[styles.marker, { left: pos(r.goodPrice) }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <View>
          <Text style={styles.statLabelDark}>Lowest</Text>
          <Text style={styles.rangeValue}>{money(h.lowestEver)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.statLabelDark}>Average</Text>
          <Text style={styles.rangeValue}>{money(h.averagePrice)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.statLabelDark}>Highest</Text>
          <Text style={styles.rangeValue}>{money(h.highestPrice)}</Text>
        </View>
      </View>
      <Text style={[styles.disclaimer, { textAlign: 'left', marginTop: 10 }]}>The white marker is the good price to aim for.</Text>
    </Card>
  );
}

function ProsCons({ r }: { r: ProductScanResult }) {
  if (!r.pros?.length && !r.cons?.length) return null;
  return (
    <Card style={{ gap: 14 }}>
      {r.pros?.length ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.subhead, { color: colors.emerald }]}>Pros</Text>
          {r.pros.map((p, i) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="add-circle" size={18} color={colors.emerald} />
              <Text style={styles.bulletText}>{p}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {r.cons?.length ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.subhead, { color: colors.rose }]}>Cons</Text>
          {r.cons.map((c, i) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="remove-circle" size={18} color={colors.rose} />
              <Text style={styles.bulletText}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function PriceAlert({ r, signedIn }: { r: ProductScanResult; signedIn: boolean }) {
  const [target, setTarget] = useState(r.greatDealPrice ? String(Math.round(r.greatDealPrice)) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const n = Number(target.replace(/[^0-9.]/g, ''));
    if (!(n > 0)) return Alert.alert('Enter a target price', 'Type the price you want to be told about.');
    setSaving(true);
    const res = await api.setPriceAlert(r.productName, r.brand, n);
    setSaving(false);
    if (res.ok) setSaved(true);
    else if (res.signInRequired) router.push('/account');
    else Alert.alert("Couldn't save alert", res.error);
  };

  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle>Price drop alert</SectionTitle>
      {saved ? (
        <View style={styles.bullet}>
          <Ionicons name="notifications" size={18} color={colors.pink400} />
          <Text style={styles.bulletText}>We’ll email you when it looks like it hits {money(Number(target))}.</Text>
        </View>
      ) : signedIn ? (
        <>
          <Text style={[styles.body, { color: colors.textMuted }]}>Get an email when this drops to your price.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={styles.priceInput}>
              <Text style={{ color: colors.textMuted, fontSize: 17 }}>$</Text>
              <TextInput value={target} onChangeText={setTarget} keyboardType="decimal-pad" style={{ flex: 1, color: colors.text, fontSize: 17 }} placeholder="0" placeholderTextColor={colors.textFaint} />
            </View>
            <PrimaryButton title="Set alert" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.body, { color: colors.textMuted }]}>Sign in with your email to get alerted when this drops in price.</Text>
          <SecondaryButton title="Sign in" onPress={() => router.push('/account')} icon={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />} />
        </>
      )}
    </Card>
  );
}

const SUGGESTED_QUESTIONS = ["What's included in the box?", 'Does it have a warranty?', 'How does it compare to competitors?'];

function AskQuestion({ r }: { r: ProductScanResult }) {
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<{ q: string; a?: string; err?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setQ('');
    setBusy(true);
    setThread((t) => [...t, { q: question }]);
    const res = await api.askQuestion(r, question);
    setThread((t) => t.map((m, i) => (i === t.length - 1 ? { ...m, a: res.answer, err: res.error } : m)));
    setBusy(false);
  };

  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle>Ask about this product</SectionTitle>
      {thread.map((m, i) => (
        <View key={i} style={{ gap: 8 }}>
          <View style={styles.qBubble}>
            <Text style={styles.qText}>{m.q}</Text>
          </View>
          {m.a ? (
            <Text style={styles.body}>{m.a}</Text>
          ) : m.err ? (
            <Text style={[styles.body, { color: colors.rose }]}>{m.err}</Text>
          ) : (
            <ActivityIndicator color={colors.pink400} style={{ alignSelf: 'flex-start' }} />
          )}
        </View>
      ))}
      {thread.length === 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTED_QUESTIONS.map((s) => (
            <Pressable key={s} onPress={() => ask(s)} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.askRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Type a question"
          placeholderTextColor={colors.textFaint}
          style={{ flex: 1, color: colors.text, fontSize: 16 }}
          returnKeyType="send"
          onSubmitEditing={() => ask()}
          editable={!busy}
        />
        <Pressable onPress={() => ask()} disabled={!q.trim() || busy} hitSlop={8} accessibilityLabel="Send question">
          <Ionicons name="arrow-up-circle" size={30} color={q.trim() && !busy ? colors.pink500 : colors.textFaint} />
        </Pressable>
      </View>
    </Card>
  );
}

function LocalStores({ r }: { r: ProductScanResult }) {
  const [stores, setStores] = useState<api.LocalStore[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.localStores(r.productName);
    setStores(res.stores);
    setLoading(false);
    if (res.error) Alert.alert('Stores', res.error);
  };

  const openMap = (s: api.LocalStore) => {
    const q = encodeURIComponent(`${s.name} ${s.address || ''}`.trim());
    Linking.openURL(`https://maps.apple.com/?q=${q}`).catch(() => Linking.openURL(`https://www.google.com/maps/search/${q}`));
  };

  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle>Buy it in person</SectionTitle>
      {stores === null ? (
        <SecondaryButton title={loading ? 'Finding stores…' : 'Find stores that carry it'} onPress={load} disabled={loading} icon={<Ionicons name="location-outline" size={18} color={colors.textMuted} />} />
      ) : stores.length === 0 ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>No stores found.</Text>
      ) : (
        stores.map((s, i) => (
          <Pressable key={i} onPress={() => openMap(s)} style={({ pressed }) => [styles.storeRow, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.storeName}>{s.name}</Text>
              {s.reason ? <Text style={styles.meta}>{s.reason}</Text> : null}
            </View>
            <Ionicons name="map-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ))
      )}
    </Card>
  );
}

function Coupons({ r }: { r: ProductScanResult }) {
  const [result, setResult] = useState<api.CouponSearch | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.findCoupons(r);
    setLoading(false);
    if (res.error) {
      Alert.alert('Coupons', res.error);
      return;
    }
    setResult(res);
  };

  const open = (url: string, track = true) => {
    const link = track ? getAffiliateUrl(url) : url;
    if (link === '#') return;
    Linking.openURL(link).catch(() => WebBrowser.openBrowserAsync(link));
  };

  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle>Coupons & deals</SectionTitle>
      {result === null ? (
        <SecondaryButton
          title={loading ? 'Searching the web…' : 'Find coupons'}
          onPress={load}
          disabled={loading}
          icon={loading ? <ActivityIndicator color={colors.textMuted} /> : <Ionicons name="pricetags-outline" size={18} color={colors.textMuted} />}
        />
      ) : (
        <>
          {result.coupons.length === 0 ? (
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {result.searched ? 'No current coupons found for this item. Try a search below.' : 'Coupon search is unavailable right now. Try a search below.'}
            </Text>
          ) : (
            result.coupons.map((c, i) => (
              <Pressable
                key={i}
                onPress={() => open(c.sourceUrl)}
                style={({ pressed }) => [styles.storeRow, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}
                accessibilityRole="link"
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.subhead, { color: colors.pink400, fontSize: 12 }]}>{c.store}</Text>
                  <Text style={styles.storeName}>{c.title}</Text>
                  {c.code ? (
                    <Text selectable style={styles.code} accessibilityHint="Long-press to copy the code">
                      {c.code}
                    </Text>
                  ) : null}
                  <Text style={styles.meta}>{`${c.expires ? `Ends ${c.expires} · ` : ''}Found on ${c.sourceDomain}`}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
          {result.links.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {result.links.map((l) => (
                <Pressable key={l.url} onPress={() => open(l.url, false)} style={styles.chip} accessibilityRole="link">
                  <Text style={styles.chipText}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={[styles.disclaimer, { textAlign: 'left' }]}>
            {`Coupons are found on the web and aren't guaranteed. Check the terms at the store.${result.coupons.some((c) => c.code) ? ' Long-press a code to copy it.' : ''}${hasAffiliateIds() ? ' Some links may earn us a commission.' : ''}`}
          </Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  code: { alignSelf: 'flex-start', color: colors.pink400, fontSize: 15, fontWeight: '800', letterSpacing: 1, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.pink400, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', fontFamily: 'Menlo' },
  screen: { flex: 1, backgroundColor: colors.ink950 },
  thumb: { width: 76, height: 76, borderRadius: 18, backgroundColor: colors.ink800 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 3 },
  identRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  identText: { color: colors.textMuted, fontSize: 13 },
  verdict: { borderRadius: radius.xl, padding: 20, gap: 8 },
  verdictLabel: { color: '#fff', fontSize: 24, fontWeight: '800' },
  verdictAdvice: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 21 },
  priceRow: { flexDirection: 'row', gap: 12, marginTop: 10, alignItems: 'flex-end' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statLabelDark: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  disclaimer: { color: colors.textFaint, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10 },
  specLabel: { color: colors.textMuted, fontSize: 14, flexShrink: 0 },
  specValue: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  storeName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  storePrice: { color: colors.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  marker: { position: 'absolute', width: 6, height: 20, marginLeft: -3, borderRadius: 3, backgroundColor: '#fff', top: 0, borderWidth: 1, borderColor: colors.ink950 },
  rangeValue: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  subhead: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletText: { color: colors.text, fontSize: 15, lineHeight: 21, flex: 1 },
  priceInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.ink800, borderRadius: radius.md, paddingHorizontal: 14, height: 56, borderWidth: 1, borderColor: colors.line },
  qBubble: { alignSelf: 'flex-end', backgroundColor: colors.pink700, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '85%' },
  qText: { color: '#fff', fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.ink800, borderWidth: 1, borderColor: colors.line },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink800, borderRadius: radius.md, paddingLeft: 14, paddingRight: 8, height: 50, borderWidth: 1, borderColor: colors.line },
});
