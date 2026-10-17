import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/ui';
import * as api from '../lib/api';
import { colors, radius } from '../lib/theme';
import { useRunScan } from '../lib/useRunScan';

const POPULAR = ['Sony WH-1000XM5', 'Apple AirPods Pro 2', 'Nintendo Switch OLED', 'KitchenAid Artisan Stand Mixer', 'Dyson V15 Detect', 'Logitech MX Master 3S'];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const { run, busy } = useRunScan();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) return;
    let active = true;
    timer.current = setTimeout(async () => {
      setLoadingSuggest(true);
      const s = await api.autocomplete(q);
      if (active) setSuggestions(s.slice(0, 6));
      setLoadingSuggest(false);
    }, 350);
    return () => {
      active = false;
    };
  }, [query]);

  const submit = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q || busy) return;
    Keyboard.dismiss();
    setQuery(q);
    const digits = q.replace(/\s/g, '');
    run(/^\d{8,14}$/.test(digits) ? { barcode: digits } : { textQuery: q }, /^\d{8,14}$/.test(digits) ? 'barcode' : 'search');
  };

  const list = query.trim().length >= 2 ? suggestions : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Product name, model or barcode number"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onSubmitEditing={() => submit()}
          editable={!busy}
        />
        {loadingSuggest ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
      </View>

      <PrimaryButton title={busy ? 'Checking prices…' : 'Check price'} loading={busy} disabled={!query.trim()} onPress={() => submit()} style={{ marginTop: 14 }} />

      {list.length > 0 ? (
        <View style={styles.list}>
          {list.map((s) => (
            <Pressable key={s} onPress={() => submit(s)} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.ink800 }]} disabled={busy}>
              <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.pink400} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Text style={styles.label}>Popular checks</Text>
          <View style={styles.chips}>
            {POPULAR.map((p) => (
              <Pressable key={p} onPress={() => submit(p)} style={({ pressed }) => [styles.chip, pressed && { borderColor: colors.pink600 }]} disabled={busy}>
                <Text style={styles.chipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink950 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink900,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    height: 54,
  },
  input: { flex: 1, color: colors.text, fontSize: 17 },
  list: { marginTop: 18, backgroundColor: colors.ink900, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  suggestionText: { color: colors.text, fontSize: 16, flex: 1 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 28, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.ink900, borderWidth: 1, borderColor: colors.line },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
