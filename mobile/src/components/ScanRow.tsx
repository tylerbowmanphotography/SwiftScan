import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, money, radius, ratingStyle } from '../lib/theme';
import type { SavedScanItem } from '../lib/types';

function timeAgo(ts: number) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ScanRow({ item, onLongPress }: { item: SavedScanItem; onLongPress?: () => void }) {
  const r = item.scanResult;
  const rs = ratingStyle[r.priceRating] ?? ratingStyle.FAIR;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/result', params: { id: item.id } })}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={`${r.productName}, ${rs.label}`}
    >
      <View style={styles.thumb}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Ionicons name={item.scanType === 'barcode' ? 'barcode-outline' : 'pricetag-outline'} size={22} color={colors.pink400} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name} numberOfLines={1}>
          {r.productName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[r.brand, timeAgo(item.timestamp)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.price}>{money(r.goodPrice)}</Text>
        <View style={[styles.dot, { backgroundColor: rs.color }]} />
      </View>
      {item.isBookmarked ? <Ionicons name="bookmark" size={14} color={colors.pink400} style={{ marginLeft: 6 }} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.ink900,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.ink800,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  price: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
