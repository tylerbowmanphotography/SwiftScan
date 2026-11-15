/**
 * Siri, Shortcuts, Spotlight and Siri AI.
 *
 * The actions themselves are Swift App Intents in mobile/app-intents (Apple discovers them at build
 * time). This file is the JavaScript side:
 *   - publishes recent scans as the "scannedItem" catalog, so Siri can resolve "AirPods Pro" and
 *     Spotlight / Siri AI can find them;
 *   - applies what Siri did while the app was closed or in the background (open the scanner, add a
 *     voice price check to "Your scans", mark a watched price, open an item);
 *   - tells iOS when the user scans or searches, so Siri learns to suggest it.
 */
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as AppIntents from 'expo-app-intents';
import { useApp } from './store';
import type { ProductScanResult, SavedScanItem } from './types';

const ITEM_KIND = 'scannedItem';
const MAX_CATALOG = 50;

const siriAvailable = () => {
  if (Platform.OS !== 'ios') return false;
  try {
    return AppIntents.isAvailable();
  } catch {
    return false;
  }
};

const money = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

function toEntity(item: SavedScanItem): AppIntents.AppIntentEntity | null {
  const r = item.scanResult;
  const title = (r?.productName || '').trim();
  if (!title) return null;
  const brand = (r.brand || '').trim();
  const shortName = brand && title.toLowerCase().startsWith(brand.toLowerCase() + ' ') ? title.slice(brand.length + 1).trim() : '';
  // Drop the size in brackets ("Cheerios (18 oz)") so people can say just "Cheerios".
  const plain = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const synonyms = [...new Set([shortName, plain !== title ? plain : ''].filter((s) => s.length >= 2))];
  const parts = [r.goodPrice > 0 ? `Fair ${money(r.goodPrice)}` : '', r.greatDealPrice > 0 ? `deal ${money(r.greatDealPrice)}` : ''].filter(Boolean);
  return {
    id: item.id,
    title,
    subtitle: parts.length ? parts.join(' · ') : undefined,
    synonyms,
    metadata: {
      brand: brand && brand !== 'Unknown brand' ? brand : '',
      msrp: String(r.msrp || 0),
      goodPrice: String(r.goodPrice || 0),
      greatDealPrice: String(r.greatDealPrice || 0),
      priceRating: r.priceRating || 'FAIR',
    },
  };
}

/** Mount once inside AppProvider, next to the navigator. Renders nothing. */
export function SiriBridge() {
  const { ready } = useApp();
  const navReady = !!useRootNavigationState()?.key;
  if (!siriAvailable() || !ready || !navReady) return null;
  return <SiriBridgeInner />;
}

function SiriBridgeInner() {
  const { history, addScan, updateItem, getItem } = useApp();
  const handled = useRef(new Set<string>());
  const latest = useRef({ addScan, updateItem, getItem });
  useEffect(() => {
    latest.current = { addScan, updateItem, getItem };
  }, [addScan, updateItem, getItem]);

  // Publish recent scans for Siri / Spotlight / Siri AI (newest first, one per product).
  useEffect(() => {
    const t = setTimeout(() => {
      const seen = new Set<string>();
      const entities: AppIntents.AppIntentEntity[] = [];
      for (const item of history) {
        const e = toEntity(item);
        const key = e?.title.toLowerCase();
        if (!e || !key || seen.has(key)) continue;
        seen.add(key);
        entities.push(e);
        if (entities.length >= MAX_CATALOG) break;
      }
      AppIntents.setEntityCatalogAsync(ITEM_KIND, entities).catch((err) => console.warn('Siri catalog update failed', err));
    }, 800);
    return () => clearTimeout(t);
  }, [history]);

  AppIntents.useAppIntents(async (pending) => {
    for (const inv of pending) {
      if (handled.current.has(inv.id)) {
        await AppIntents.removePendingInvocationAsync(inv.id).catch(() => {});
        continue;
      }
      try {
        const { addScan, updateItem, getItem } = latest.current;
        const fresh = Date.now() - (inv.createdAt || 0) < 2 * 60 * 1000;
        switch (inv.name) {
          case 'openScanner':
            // Only jump to the camera for a request made just now, not a stale one replayed later.
            if (fresh) router.push('/scan');
            break;
          case 'priceChecked': {
            const raw = inv.params.result;
            const result = typeof raw === 'string' ? (JSON.parse(raw) as ProductScanResult) : null;
            if (result?.productName) addScan(result, 'search');
            break;
          }
          case 'priceWatched': {
            const id = String(inv.params.id || '');
            const target = Number(inv.params.targetPrice);
            if (id && getItem(id) && target > 0) updateItem(id, { targetPrice: target });
            break;
          }
          case 'openItem': {
            const id = String(inv.params.id || '');
            if (fresh && id && getItem(id)) router.push({ pathname: '/result', params: { id } });
            break;
          }
          default:
            // An action from a newer app version: leave it for that version to handle.
            continue;
        }
        handled.current.add(inv.id);
        await AppIntents.removePendingInvocationAsync(inv.id);
      } catch (err) {
        // Bad data can never succeed, so drop it rather than retrying forever.
        console.warn('Siri action could not be applied', inv.name, err);
        handled.current.add(inv.id);
        await AppIntents.removePendingInvocationAsync(inv.id).catch(() => {});
      }
    }
  });

  return null;
}

/** Tell iOS the user did something Siri can repeat, so it can suggest it later. Never throws. */
export function donateToSiri(action: 'openScanner'): void;
export function donateToSiri(action: 'checkPrice', product: string): void;
export function donateToSiri(action: 'openScanner' | 'checkPrice', product?: string) {
  if (!siriAvailable()) return;
  const params = action === 'checkPrice' ? { product: (product || '').trim().slice(0, 120) } : undefined;
  if (action === 'checkPrice' && !params?.product) return;
  AppIntents.donateIntentAsync(action, params).catch(() => {});
}
