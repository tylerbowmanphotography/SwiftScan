import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientText } from '../components/GradientText';
import { ScanRow } from '../components/ScanRow';
import { useApp } from '../lib/store';
import { colors } from '../lib/theme';
import { useRunScan } from '../lib/useRunScan';

// Same content and look as the website's landing page (src/components/Landing.tsx).
const SAMPLES = [
  { name: 'Sony WH-1000XM5 Wireless Headphones', brand: 'Sony', category: 'Audio', img: require('../../assets/img/headphones.jpg') },
  { name: 'Nike Air Jordan 1 Retro High OG', brand: 'Nike', category: 'Footwear', img: require('../../assets/img/sneakers.jpg') },
  { name: "De'Longhi Dedica Deluxe Espresso Machine", brand: "De'Longhi", category: 'Kitchen', img: require('../../assets/img/espresso.jpg') },
  { name: 'Fujifilm X100V Digital Camera', brand: 'Fujifilm', category: 'Electronics', img: require('../../assets/img/camera.jpg') },
  { name: 'Apple Watch Series 9 GPS 45mm', brand: 'Apple', category: 'Wearables', img: require('../../assets/img/watch.jpg') },
  { name: 'KitchenAid Artisan Series 5-Quart Stand Mixer', brand: 'KitchenAid', category: 'Home & Kitchen', img: require('../../assets/img/mixer.jpg') },
];

const STEPS = [
  { n: '1', icon: 'scan-outline' as const, title: 'Snap it', body: 'Scan a barcode, take a photo of the item, or search by name.' },
  { n: '2', icon: 'hardware-chip-outline' as const, title: 'We look it up', body: 'Barcodes are matched against product databases first. Photos and searches use AI to estimate prices.' },
  { n: '3', icon: 'pricetag-outline' as const, title: 'You decide', body: 'See a verdict from Steal to Overpriced, the estimated price range, and links to compare stores.' },
];

const FEATURES = [
  { icon: 'speedometer-outline' as const, tint: colors.pink400, title: 'Deal verdict', body: 'A plain-English call from Steal to Overpriced, with the price to aim for.' },
  { icon: 'list-outline' as const, tint: colors.amber, title: 'Pros, cons and specs', body: 'AI-written summaries of strengths, drawbacks and key specs, plus a place to ask follow-up questions.' },
  { icon: 'storefront-outline' as const, tint: colors.emerald, title: 'Store comparison', body: 'Estimated prices and links for stores like Amazon, Best Buy, Walmart, Target and eBay.' },
  { icon: 'notifications-outline' as const, tint: '#60a5fa', title: 'Email price alerts', body: 'Save an item, set a target price, and get an email when the estimate reaches it.' },
];

const VERDICTS = ['Steal', 'Good deal', 'Fair', 'Overpriced'];

export default function Home() {
  const insets = useSafeAreaInsets();
  const { history, usage, user, config } = useApp();
  const { run, busy } = useRunScan();
  const recent = history.slice(0, 3);

  const usageText = usage
    ? usage.isPro
      ? 'Unlimited scans'
      : usage.remaining !== null && usage.limit !== null
        ? `${usage.remaining} of ${usage.limit} free scans left today`
        : null
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink950 }}>
      {/* Header: logo + round icon buttons, like the website */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.brand}>
          <LinearGradient colors={[colors.pink600, colors.pink800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
            <Ionicons name="barcode-outline" size={20} color="#fff" />
          </LinearGradient>
          <Text style={styles.brandText}>
            Swift<Text style={{ color: colors.pink400 }}>Scan</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {config?.accounts?.enabled !== false ? (
            <HeaderButton icon={user ? 'person' : 'person-outline'} label="Account" onPress={() => router.push('/account')} active={!!user} />
          ) : null}
          <HeaderButton icon="search-outline" label="Search" onPress={() => router.push('/search')} />
          <HeaderButton icon="time-outline" label="History" onPress={() => router.push('/history')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110, gap: 16 }}>
        {usageText ? (
          <View style={styles.usagePill}>
            <View style={styles.dot} />
            <Text style={styles.usageText}>{usageText}</Text>
          </View>
        ) : null}

        {/* Hero card */}
        <View style={styles.hero}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(219,39,119,0.32)', 'rgba(7,11,25,0)', 'rgba(7,11,25,0)', 'rgba(16,185,129,0.12)']}
            locations={[0, 0.45, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={13} color="#f9a8d4" />
            <Text style={styles.badgeText}>AI PRICE CHECK FOR YOUR PHONE</Text>
          </View>
          <Text style={styles.h1}>Snap it.</Text>
          <GradientText style={styles.h1}>Know what it’s worth.</GradientText>
          <Text style={styles.lead}>
            Point your camera at a barcode, label or item. SwiftScan gives you an AI-estimated price range, a plain-English deal verdict, and links to compare stores.
          </Text>

          <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <LinearGradient colors={['#ec4899', colors.pink600, colors.pink700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
              <Ionicons name="camera-outline" size={22} color="#fff" />
              <Text style={styles.primaryText}>Scan an item</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => router.push('/search')} accessibilityRole="button" style={({ pressed }) => [styles.ghostBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
            <Ionicons name="search" size={20} color="#f9a8d4" />
            <Text style={styles.ghostText}>Search by name</Text>
          </Pressable>

          <View style={styles.checks}>
            {['Free to start', 'Barcode database lookups'].map((t) => (
              <View key={t} style={styles.check}>
                <Ionicons name="checkmark" size={15} color={colors.emerald} />
                <Text style={styles.checkText}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Photo with scan overlay and example verdict */}
          <View style={styles.photo}>
            <Image source={require('../../assets/img/hero-market.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(7,11,25,0.1)', 'transparent', 'rgba(7,11,25,0.75)']} style={StyleSheet.absoluteFill} />
            <View style={[styles.corner, { top: 22, left: 40, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 }]} />
            <View style={[styles.corner, { top: 22, right: 40, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 }]} />
            <View style={styles.scanLine} />
            <View style={styles.verdictCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="speedometer-outline" size={14} color="#fff" />
                  <Text style={styles.verdictTitle}>Deal verdict</Text>
                </View>
                <Text style={styles.example}>EXAMPLE</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                {VERDICTS.map((v, i) => (
                  <View key={v} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <View style={[styles.meter, { backgroundColor: i === 1 ? colors.pink500 : 'rgba(255,255,255,0.15)' }]} />
                    <Text style={[styles.meterText, i === 1 && { color: '#fff' }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <Text style={styles.credit}>Photo: Biris Bianca / Unsplash</Text>
        </View>

        {recent.length > 0 ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <SectionHeading eyebrow="Your scans" title="Recent price checks" action={{ label: 'See all', onPress: () => router.push('/history') }} />
            {recent.map((item) => (
              <ScanRow key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        {/* How it works */}
        <SectionHeading eyebrow="How it works" title="Three steps to a smarter buy" />
        {STEPS.map((s) => (
          <View key={s.n} style={styles.card}>
            <Text style={styles.bigNumber}>{s.n}</Text>
            <View style={styles.iconTile}>
              <Ionicons name={s.icon} size={22} color={colors.pink400} />
            </View>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}

        {/* Samples */}
        <SectionHeading eyebrow="See it in action" title="Try a sample product" hint="Tap any item to see how a SwiftScan price check looks." />
        <View style={styles.grid}>
          {SAMPLES.map((p) => (
            <Pressable
              key={p.name}
              disabled={busy}
              onPress={() => run({ textQuery: p.name }, 'preset', { replace: false })}
              style={({ pressed }) => [styles.sample, pressed && { borderColor: colors.pink600 }]}
              accessibilityRole="button"
              accessibilityLabel={`Check the price of ${p.name}`}
            >
              <View style={styles.sampleImgWrap}>
                <Image source={p.img} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.catPill}>
                  <Text style={styles.catText}>{p.category}</Text>
                </View>
              </View>
              <Text style={styles.sampleBrand}>{p.brand.toUpperCase()}</Text>
              <Text style={styles.sampleName} numberOfLines={2}>
                {p.name}
              </Text>
              <View style={styles.sampleFoot}>
                <Text style={styles.sampleLink}>{busy ? 'Checking…' : 'Check the price'}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.pink400} />
              </View>
            </Pressable>
          ))}
        </View>

        {/* What you get */}
        <SectionHeading eyebrow="What you get" title="Quick answers, right at the shelf" />
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.card}>
            <View style={[styles.iconTile, { backgroundColor: f.tint + '22' }]}>
              <Ionicons name={f.icon} size={22} color={f.tint} />
            </View>
            <Text style={styles.cardTitle}>{f.title}</Text>
            <Text style={styles.cardBody}>{f.body}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>
            Swift<Text style={{ color: colors.pink400 }}>Scan</Text>
          </Text>
          <Text style={styles.footerText}>Snap it. Know what it’s worth.</Text>
        </View>
      </ScrollView>

      {/* Sticky scan button, like the website's mobile bar */}
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <LinearGradient colors={['#ec4899', colors.pink600, colors.pink700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text style={styles.primaryText}>Scan an item</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function HeaderButton({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [styles.headerBtn, pressed && { backgroundColor: colors.ink700 }]}>
      <Ionicons name={icon} size={19} color={active ? colors.pink400 : colors.text} />
    </Pressable>
  );
}

function SectionHeading({ eyebrow, title, hint, action }: { eyebrow: string; title: string; hint?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ marginTop: 18, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10}>
            <Text style={{ color: colors.pink400, fontWeight: '700', fontSize: 14 }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.h2}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.ink950,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: colors.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  headerBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink900, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  usagePill: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingHorizontal: 16, height: 46, borderRadius: 14, backgroundColor: colors.ink900, borderWidth: 1, borderColor: colors.line },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.emerald },
  usageText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hero: { borderRadius: 32, padding: 22, overflow: 'hidden', backgroundColor: colors.ink950, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 22 },
  badgeText: { color: '#fbcfe8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  h1: { color: '#fff', fontSize: 40, lineHeight: 42, fontWeight: '900', letterSpacing: -1.2 },
  lead: { color: '#cbd5e1', fontSize: 16, lineHeight: 25, marginTop: 20, marginBottom: 22 },
  primaryBtn: { height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ghostBtn: { height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  ghostText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 18 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  photo: { marginTop: 22, aspectRatio: 4 / 3, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: '#fff' },
  scanLine: { position: 'absolute', left: 30, right: 30, top: '42%', height: 2, borderRadius: 1, backgroundColor: '#f9a8d4', opacity: 0.85 },
  verdictCard: { position: 'absolute', left: 12, right: 12, bottom: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(11,17,36,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  verdictTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  example: { color: '#cbd5e1', fontSize: 10, fontWeight: '800', letterSpacing: 1, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  meter: { height: 6, borderRadius: 3, alignSelf: 'stretch' },
  meterText: { color: '#cbd5e1', fontSize: 10.5, fontWeight: '700' },
  credit: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  eyebrow: { color: '#f9a8d4', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  h2: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8 },
  hint: { color: colors.textMuted, fontSize: 15 },
  card: { backgroundColor: colors.ink900, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 20, overflow: 'hidden' },
  bigNumber: { position: 'absolute', right: 14, top: -6, fontSize: 96, fontWeight: '900', color: 'rgba(255,255,255,0.05)' },
  iconTile: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(236,72,153,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  cardTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  cardBody: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  sample: { width: '48.5%', backgroundColor: colors.ink900, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 8, paddingBottom: 12 },
  sampleImgWrap: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.ink800 },
  catPill: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(7,11,25,0.75)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  catText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sampleBrand: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginHorizontal: 6 },
  sampleName: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 19, marginTop: 3, marginHorizontal: 6, minHeight: 38 },
  sampleFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, marginHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sampleLink: { color: colors.pink400, fontSize: 13, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 24, gap: 4 },
  footerBrand: { color: '#fff', fontSize: 18, fontWeight: '900' },
  footerText: { color: colors.textMuted, fontSize: 13 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: 'rgba(7,11,25,0.92)' },
});
