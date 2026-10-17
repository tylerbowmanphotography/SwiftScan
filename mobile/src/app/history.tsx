import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScanRow } from '../components/ScanRow';
import { PrimaryButton } from '../components/ui';
import { useApp } from '../lib/store';
import { colors, radius } from '../lib/theme';
import type { SavedScanItem } from '../lib/types';

type Filter = 'all' | 'saved';

export default function HistoryScreen() {
  const { history, updateItem, removeItem, clearHistory } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return history.filter(
      (i) =>
        (filter === 'all' || i.isBookmarked) &&
        (!needle || `${i.scanResult.productName} ${i.scanResult.brand} ${i.scanResult.category}`.toLowerCase().includes(needle)),
    );
  }, [history, q, filter]);

  const options = (item: SavedScanItem) => {
    const actions = [item.isBookmarked ? 'Remove bookmark' : 'Bookmark', 'Delete', 'Cancel'];
    const handle = (i: number) => {
      if (i === 0) updateItem(item.id, { isBookmarked: !item.isBookmarked });
      if (i === 1) removeItem(item.id);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: actions, destructiveButtonIndex: 1, cancelButtonIndex: 2, title: item.scanResult.productName }, handle);
    } else {
      Alert.alert(item.scanResult.productName, undefined, [
        { text: actions[0], onPress: () => handle(0) },
        { text: 'Delete', style: 'destructive', onPress: () => handle(1) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const confirmClear = () =>
    Alert.alert('Clear history?', 'Bookmarked items are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearHistory },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            history.length ? (
              <Pressable onPress={confirmClear} hitSlop={10}>
                <Text style={{ color: colors.rose, fontSize: 16, fontWeight: '600' }}>Clear</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.ink950 }}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 60 }}
        data={items}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search your scans" placeholderTextColor={colors.textFaint} style={styles.input} clearButtonMode="while-editing" />
            </View>
            <View style={styles.segment}>
              {(['all', 'saved'] as Filter[]).map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)} style={[styles.segBtn, filter === f && styles.segActive]}>
                  <Text style={[styles.segText, filter === f && { color: colors.text }]}>{f === 'all' ? 'All' : 'Bookmarked'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => <ScanRow item={item} onLongPress={() => options(item)} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 12 }}>
            <Ionicons name="time-outline" size={44} color={colors.textFaint} />
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>{history.length ? 'Nothing matches.' : 'No scans yet.'}</Text>
            {!history.length ? <PrimaryButton title="Scan an item" onPress={() => router.replace('/scan')} style={{ alignSelf: 'stretch', marginTop: 8 }} /> : null}
          </View>
        }
        ListFooterComponent={items.length ? <Text style={styles.tip}>Tip: press and hold a scan to bookmark or delete it.</Text> : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink900, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.line },
  input: { flex: 1, color: colors.text, fontSize: 16 },
  segment: { flexDirection: 'row', backgroundColor: colors.ink900, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.line },
  segBtn: { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.ink700 },
  segText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  tip: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
