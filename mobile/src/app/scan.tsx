import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { prepareForScan } from '../lib/image';
import { colors } from '../lib/theme';
import { useRunScan } from '../lib/useRunScan';

const PRODUCT_BARCODES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128'] as const;

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const locked = useRef(false);
  const [torch, setTorch] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const { run, busy } = useRunScan();

  const unlockSoon = () =>
    setTimeout(() => {
      locked.current = false;
      setPreview(null);
    }, 1500);

  const onBarcode = async (res: BarcodeScanningResult) => {
    const code = res.data?.replace(/\D/g, '');
    if (locked.current || !code || code.length < 8 || code.length > 14) return;
    locked.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStatus(`Looking up ${code}…`);
    const out = await run({ barcode: code }, 'barcode');
    if (out.kind !== 'found') unlockSoon();
  };

  const scanPhoto = async (uri: string, width?: number) => {
    locked.current = true;
    setPreview(uri);
    setStatus('Identifying your item…');
    try {
      const img = await prepareForScan(uri, width);
      const out = await run({ imageBase64: img.base64, mimeType: img.mimeType }, 'camera', { thumbnailUrl: img.uri });
      if (out.kind !== 'found') unlockSoon();
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not use that photo.');
      unlockSoon();
    }
  };

  const takePhoto = async () => {
    if (locked.current || !camera.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (pic?.uri) await scanPhoto(pic.uri, pic.width);
    } catch {
      Alert.alert('Camera error', 'Could not take the photo. Try again.');
    }
  };

  const pickPhoto = async () => {
    if (locked.current) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) await scanPhoto(res.assets[0].uri, res.assets[0].width);
  };

  if (!permission) return <View style={styles.fill} />;

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center, { padding: 28, paddingTop: insets.top + 28 }]}>
        <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + 8 }]} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Ionicons name="camera-outline" size={56} color={colors.pink400} />
        <Text style={styles.permTitle}>Allow camera access</Text>
        <Text style={styles.permBody}>SwiftScan needs the camera to read barcodes and photograph products. Photos are only used for the price check.</Text>
        <PrimaryButton
          title={permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          style={{ alignSelf: 'stretch', marginTop: 24 }}
        />
        <Pressable onPress={pickPhoto} style={{ marginTop: 18 }} hitSlop={10}>
          <Text style={{ color: colors.pink400, fontSize: 16, fontWeight: '600' }}>Choose a photo instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODES] }}
        onBarcodeScanned={busy || preview ? undefined : onBarcode}
      />
      {preview ? <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}

      {/* Viewfinder */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={styles.frame}>
          <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }]} />
          <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }]} />
          <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }]} />
          <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 }]} />
        </View>
        <Text style={styles.hint}>{busy ? '' : 'Aim at a barcode, or tap the shutter to snap the item'}</Text>
      </View>

      {/* Top controls */}
      <View style={[styles.topRow, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.roundBtn} hitSlop={8} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setTorch((t) => !t)} style={styles.roundBtn} hitSlop={8} accessibilityLabel={torch ? 'Turn off flashlight' : 'Turn on flashlight'}>
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color={torch ? colors.amber : '#fff'} />
        </Pressable>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={pickPhoto} style={styles.roundBtnLg} disabled={busy} accessibilityLabel="Choose from photos">
          <Ionicons name="images-outline" size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={takePhoto} disabled={busy} accessibilityLabel="Take photo and scan" style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}>
          <View style={styles.shutterInner} />
        </Pressable>
        <Pressable onPress={() => router.replace('/search')} style={styles.roundBtnLg} disabled={busy} accessibilityLabel="Search by name">
          <Ionicons name="search" size={24} color="#fff" />
        </Pressable>
      </View>

      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.busy]}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={colors.pink400} />
            <Text style={styles.busyTitle}>{status || 'Checking prices…'}</Text>
            <Text style={styles.busySub}>Estimating fair price and deals. This can take a few seconds.</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const FRAME = 270;
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME * 0.72 },
  corner: { position: 'absolute', width: 42, height: 42, borderColor: colors.pink500 },
  hint: { color: '#fff', marginTop: 24, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  roundBtnLg: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  bottomRow: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.pink600 },
  close: { position: 'absolute', left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  permTitle: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 16 },
  permBody: { color: colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 10 },
  busy: { backgroundColor: 'rgba(7,11,25,0.72)' },
  busyCard: { backgroundColor: colors.ink900, borderRadius: 24, padding: 26, alignItems: 'center', marginHorizontal: 40, borderWidth: 1, borderColor: colors.line },
  busyTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  busySub: { color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
});
