import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as api from './api';
import { useApp } from './store';
import type { SavedScanItem } from './types';

type ScanType = NonNullable<SavedScanItem['scanType']>;

/**
 * Runs a scan and routes to the result. Shared by the camera and search screens.
 * Returns the outcome so a screen can resume scanning after a miss.
 */
export function useRunScan() {
  const { addScan, setUsage, config } = useApp();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (input: api.ScanInput, scanType: ScanType, opts: { thumbnailUrl?: string; replace?: boolean; quietNotFound?: boolean } = {}) => {
      setBusy(true);
      try {
        const out = await api.scan(input);
        setUsage(out.usage);
        if (out.kind === 'found') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          const item = addScan(out.data, scanType, opts.thumbnailUrl);
          const go = opts.replace === false ? router.push : router.replace;
          go({ pathname: '/result', params: { id: item.id } });
        } else if (out.kind === 'notFound') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          // The camera shows its own banner for this, so it can keep the viewfinder ready for a photo.
          if (opts.quietNotFound) return out;
          Alert.alert(
            'Barcode not in our databases yet',
            "Take a photo of the front of the item, or search by name. We'll remember this barcode, so next time it scans instantly.",
            [
              { text: 'Search by name', onPress: () => router.replace({ pathname: '/search', params: { q: '', link: out.barcode } }) },
              { text: 'Take a photo', style: 'cancel' },
            ],
          );
        } else if (out.kind === 'limit') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          const canSignIn = !!config?.accounts?.enabled && !config?.user;
          Alert.alert(
            "You've used today's free scans",
            out.message + (canSignIn ? '\n\nAlready have SwiftScan Pro? Sign in with the same email to keep scanning.' : ''),
            canSignIn ? [{ text: 'Not now', style: 'cancel' }, { text: 'Sign in', onPress: () => router.push('/account') }] : [{ text: 'OK' }],
          );
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          Alert.alert(out.code === 'BARCODE_MISREAD' ? 'Barcode misread' : 'Scan failed', out.message);
        }
        return out;
      } finally {
        setBusy(false);
      }
    },
    [addScan, setUsage, config],
  );

  return { run, busy };
}
