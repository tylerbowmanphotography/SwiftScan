import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, PrimaryButton, SecondaryButton } from '../components/ui';
import { SITE_URL } from '../lib/api';
import { useIap } from '../lib/iap';
import { useApp } from '../lib/store';
import { colors } from '../lib/theme';

const APPLE_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const PERKS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  { icon: 'infinite', title: 'Unlimited scans', body: 'No daily limit on barcode, photo and name searches.' },
  { icon: 'notifications', title: 'More price alerts', body: 'Watch up to 25 items and get an email when the price drops.' },
  { icon: 'phone-portrait', title: 'On every device', body: 'Pro follows your account to the website and any phone you sign in on.' },
];

export default function ProScreen() {
  const insets = useSafeAreaInsets();
  const { user, usage } = useApp();
  const { available, product, loadingProduct, busy, buy, restore, manage } = useIap();
  const isPro = !!(user?.isPro || usage?.isPro);
  const price = product?.displayPrice;

  const open = (url: string) => WebBrowser.openBrowserAsync(url);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ink950 }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30, gap: 18 }}>
      <LinearGradient colors={[colors.pink600, colors.pink800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="sparkles" size={26} color="#fff" />
        <Text style={styles.heroTitle}>SwiftScan Pro</Text>
        <Text style={styles.heroBody}>Check every price you want, as often as you want.</Text>
      </LinearGradient>

      <Card style={{ gap: 16 }}>
        {PERKS.map((p) => (
          <View key={p.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Ionicons name={p.icon} size={22} color={colors.pink400} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.perkTitle}>{p.title}</Text>
              <Text style={styles.muted}>{p.body}</Text>
            </View>
          </View>
        ))}
      </Card>

      {isPro ? (
        <Card style={{ gap: 12 }}>
          <Text style={styles.perkTitle}>You have SwiftScan Pro 🎉</Text>
          <Text style={styles.muted}>If you subscribed on iPhone, you can change or cancel it in your Apple ID subscriptions.</Text>
          <SecondaryButton title="Manage subscription" onPress={manage} icon={<Ionicons name="settings-outline" size={18} color={colors.textMuted} />} />
        </Card>
      ) : !available ? (
        <Card>
          <Text style={styles.muted}>{"Pro isn't available to buy in the app right now."}</Text>
        </Card>
      ) : !user ? (
        <View style={{ gap: 10 }}>
          <PrimaryButton title="Sign in to subscribe" onPress={() => router.push('/account')} icon={<Ionicons name="mail-outline" size={18} color="#fff" />} />
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            Pro belongs to your SwiftScan account, so it works on the website and every device you sign in on. Sign-in is a one-time email code, no password.
          </Text>
          <SecondaryButton title="Restore purchases" onPress={restore} disabled={busy} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {loadingProduct && !product ? (
            <ActivityIndicator color={colors.pink400} style={{ paddingVertical: 18 }} />
          ) : (
            <PrimaryButton
              title={price ? `Subscribe · ${price}/month` : 'Subscribe'}
              onPress={buy}
              loading={busy}
              disabled={!product}
            />
          )}
          {!loadingProduct && !product ? (
            <Text style={[styles.muted, { textAlign: 'center' }]}>{"Couldn't load the subscription from the App Store. Check your connection and try again later."}</Text>
          ) : null}
          <SecondaryButton title="Restore purchases" onPress={restore} disabled={busy} />
        </View>
      )}

      {!isPro && available ? (
        <Text style={styles.fine}>
          {`SwiftScan Pro is a monthly auto-renewing subscription${price ? ` for ${price} per month` : ''}. Payment is charged to your Apple ID when you confirm. It renews automatically unless you cancel at least 24 hours before the end of the current period, and your account is charged for renewal within 24 hours before the period ends. Manage or cancel anytime in your Apple ID subscription settings. Free users keep 5 scans a day.`}
        </Text>
      ) : null}

      <View style={styles.links}>
        <Pressable onPress={() => open(APPLE_EULA)} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Terms of Use (EULA)</Text>
        </Pressable>
        <Text style={styles.fine}>·</Text>
        <Pressable onPress={() => open(SITE_URL + '/terms')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Terms</Text>
        </Pressable>
        <Text style={styles.fine}>·</Text>
        <Pressable onPress={() => open(SITE_URL + '/privacy')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 22, gap: 8 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  heroBody: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 22 },
  perkTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  fine: { color: colors.textFaint, fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  link: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
