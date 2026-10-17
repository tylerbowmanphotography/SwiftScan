import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScanRow } from '../components/ScanRow';
import { Card, PrimaryButton, SecondaryButton } from '../components/ui';
import { useApp } from '../lib/store';
import { colors, radius } from '../lib/theme';

const STEPS = [
  { icon: 'scan-outline' as const, title: 'Scan', body: 'Point at a barcode, or snap the product itself.' },
  { icon: 'sparkles-outline' as const, title: 'Price check', body: 'Get an estimated fair price and a deal verdict.' },
  { icon: 'storefront-outline' as const, title: 'Compare', body: 'Jump to stores to compare before you buy.' },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const { history, usage, user, config } = useApp();
  const recent = history.slice(0, 4);

  const usageText = usage
    ? usage.isPro
      ? 'Pro · unlimited scans'
      : usage.remaining !== null
        ? `${usage.remaining} free scan${usage.remaining === 1 ? '' : 's'} left today`
        : null
    : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ink950 }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <LinearGradient colors={[colors.pink600, colors.pink800]} style={styles.logo}>
            <Ionicons name="barcode-outline" size={18} color="#fff" />
          </LinearGradient>
          <Text style={styles.brandText}>SwiftScan</Text>
        </View>
        {config?.accounts?.enabled ? (
          <Pressable onPress={() => router.push('/account')} hitSlop={12} accessibilityLabel="Account" style={styles.iconBtn}>
            <Ionicons name={user ? 'person-circle' : 'person-circle-outline'} size={28} color={user ? colors.pink400 : colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.hero}>
        <Text style={styles.h1}>
          Snap it.{'\n'}
          <Text style={{ color: colors.pink400 }}>Know what it’s worth.</Text>
        </Text>
        <Text style={styles.sub}>Scan a barcode or photograph any item for an AI price estimate, a deal verdict, and stores to compare.</Text>

        <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel="Start scanning" style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <LinearGradient colors={[colors.pink600, colors.pink800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scanCta}>
            <View style={styles.scanIcon}>
              <Ionicons name="scan" size={34} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanTitle}>Scan an item</Text>
              <Text style={styles.scanSub}>Barcode, label or product photo</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </Pressable>

        <SecondaryButton
          title="Search by name"
          onPress={() => router.push('/search')}
          icon={<Ionicons name="search" size={18} color={colors.textMuted} />}
          style={{ marginTop: 12 }}
        />
        {usageText ? <Text style={styles.usage}>{usageText}</Text> : null}
      </View>

      <View style={styles.section}>
        {recent.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Recent scans</Text>
              <Pressable onPress={() => router.push('/history')} hitSlop={10}>
                <Text style={styles.link}>See all</Text>
              </Pressable>
            </View>
            <View style={{ gap: 10 }}>
              {recent.map((item) => (
                <ScanRow key={item.id} item={item} />
              ))}
            </View>
          </>
        ) : (
          <Card style={{ gap: 16 }}>
            <Text style={styles.sectionTitle}>How it works</Text>
            {STEPS.map((s) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Ionicons name={s.icon} size={20} color={colors.pink400} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepBody}>{s.body}</Text>
                </View>
              </View>
            ))}
            <PrimaryButton title="Try your first scan" onPress={() => router.push('/scan')} />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 48 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 20, paddingTop: 20 },
  h1: { color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -0.8 },
  sub: { color: colors.textMuted, fontSize: 16, lineHeight: 23, marginTop: 12, marginBottom: 24 },
  scanCta: { borderRadius: radius.xl, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  scanIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  scanSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  usage: { color: colors.textFaint, fontSize: 13, textAlign: 'center', marginTop: 12 },
  section: { paddingHorizontal: 20, marginTop: 32 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  link: { color: colors.pink400, fontSize: 15, fontWeight: '600' },
  step: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  stepIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(236,72,153,0.12)', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  stepBody: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
});
