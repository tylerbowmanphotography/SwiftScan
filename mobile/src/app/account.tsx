import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, SecondaryButton } from '../components/ui';
import * as api from '../lib/api';
import { useApp } from '../lib/store';
import { colors, radius } from '../lib/theme';

export default function AccountScreen() {
  const { user, usage, config, refreshConfig, signOut } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    const r = await api.requestCode(e);
    setBusy(false);
    if (r.ok) setStep('code');
    else setError(r.error || 'Could not send the code.');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const r = await api.verifyCode(email.trim(), code.trim());
    if (r.ok) {
      await refreshConfig();
      setBusy(false);
      router.back();
    } else {
      setBusy(false);
      setError(r.error || 'Could not verify the code.');
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      `This permanently deletes ${user?.email ?? 'your account'}, your synced scans and price alerts${user?.isPro ? ', and cancels your Pro subscription' : ''}. Scans saved on this phone stay here. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const r = await api.deleteAccount();
            setBusy(false);
            if (!r.ok) return Alert.alert("Couldn't delete account", r.error);
            await refreshConfig();
            Alert.alert('Account deleted', 'Your account and its data have been removed.');
            router.back();
          },
        },
      ],
    );

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your scans stay on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  const openPage = (path: string) => WebBrowser.openBrowserAsync(api.SITE_URL + path);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ink950 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        {user ? (
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="person-circle" size={44} color={colors.pink400} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {user.email}
                </Text>
                <Text style={styles.muted}>{user.isPro ? 'SwiftScan Pro · unlimited scans' : 'Free plan'}</Text>
              </View>
            </View>
            {!user.isPro && usage?.remaining != null ? <Text style={styles.muted}>{usage.remaining} free scans left today.</Text> : null}
            <Text style={styles.muted}>Your saved scans and price alerts sync with your account on the web.</Text>
            <SecondaryButton title="Sign out" onPress={confirmSignOut} textStyle={{ color: colors.rose }} />
            <Pressable onPress={confirmDelete} disabled={busy} style={{ alignSelf: 'center', paddingVertical: 6 }} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.textFaint, fontSize: 14, textDecorationLine: 'underline' }}>{busy ? 'Deleting…' : 'Delete account'}</Text>
            </Pressable>
          </Card>
        ) : config?.accounts?.enabled === false ? (
          <Card>
            <Text style={styles.muted}>Accounts aren’t available right now.</Text>
          </Card>
        ) : (
          <Card style={{ gap: 14 }}>
            <Text style={styles.title}>{step === 'email' ? 'Sign in with email' : 'Check your email'}</Text>
            <Text style={styles.muted}>
              {step === 'email'
                ? "No password. We'll email you a 6-digit code. Signing in syncs your scans, turns on price-drop alerts, and unlocks Pro if you have it."
                : `Enter the 6-digit code we sent to ${email.trim()}.`}
            </Text>
            {step === 'email' ? (
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={sendCode}
              />
            ) : (
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, { letterSpacing: 8, fontSize: 24, textAlign: 'center' }]}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                onSubmitEditing={verify}
              />
            )}
            {error ? <Text style={{ color: colors.rose, fontSize: 14 }}>{error}</Text> : null}
            {step === 'email' ? (
              <PrimaryButton title="Email me a code" onPress={sendCode} loading={busy} disabled={!email.trim()} />
            ) : (
              <>
                <PrimaryButton title="Sign in" onPress={verify} loading={busy} disabled={code.length !== 6} />
                <Pressable
                  onPress={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                  style={{ alignSelf: 'center' }}
                  hitSlop={10}
                >
                  <Text style={{ color: colors.pink400, fontSize: 15, fontWeight: '600' }}>Use a different email</Text>
                </Pressable>
              </>
            )}
          </Card>
        )}

        <View style={styles.links}>
          <Pressable onPress={() => openPage('/privacy')} hitSlop={8}>
            <Text style={styles.link}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.muted}>·</Text>
          <Pressable onPress={() => openPage('/terms')} hitSlop={8}>
            <Text style={styles.link}>Terms</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  input: { backgroundColor: colors.ink800, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, height: 54, paddingHorizontal: 16, color: colors.text, fontSize: 17 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  link: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
});
