/**
 * SwiftScan Pro through Apple In-App Purchase (StoreKit 2 via expo-iap).
 *
 * One StoreKit connection for the whole app, so purchases that finish while the app was closed
 * (Ask to Buy, interrupted payments, renewals delivered on launch) are still sent to the server.
 * The server verifies Apple's signature and unlocks Pro for the signed-in account; only then is
 * the transaction finished. If the server can't be reached, the transaction stays unfinished and
 * StoreKit delivers it again next launch (or on Restore purchases).
 */
import {
  deepLinkToSubscriptions,
  getAvailablePurchases,
  isUserCancelledError,
  restorePurchases,
  useIAP,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as api from './api';
import { useApp } from './store';

export const DEFAULT_PRO_PRODUCT_ID = 'store.swiftscan.app.pro.monthly';
export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

interface IapState {
  /** Purchases are switched on (server config) and this is an iPhone. */
  available: boolean;
  product: ProductSubscription | null;
  loadingProduct: boolean;
  busy: boolean;
  buy: () => Promise<void>;
  restore: () => Promise<void>;
  manage: () => Promise<void>;
}

const unavailable: IapState = {
  available: false,
  product: null,
  loadingProduct: false,
  busy: false,
  buy: async () => {},
  restore: async () => {},
  manage: async () => {
    Linking.openURL(APPLE_SUBSCRIPTIONS_URL).catch(() => {});
  },
};

const Ctx = createContext<IapState>(unavailable);
export const useIap = () => useContext(Ctx);

export function IapProvider({ children }: { children: React.ReactNode }) {
  const { config } = useApp();
  const enabled = Platform.OS === 'ios' && !!config?.iap?.apple?.enabled && config?.accounts?.enabled !== false;
  const productId = config?.iap?.apple?.productIds?.[0] || DEFAULT_PRO_PRODUCT_ID;
  if (!enabled) return <Ctx.Provider value={unavailable}>{children}</Ctx.Provider>;
  return <IapEngine productId={productId}>{children}</IapEngine>;
}

function IapEngine({ productId, children }: { productId: string; children: React.ReactNode }) {
  const { refreshConfig, setUsage, user } = useApp();
  const [busy, setBusy] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  // Whether the current purchase came from a tap in this session (so we can show messages).
  const interactive = useRef(false);

  // Send a purchase to the server; finish it only when the server has it (or it can never count).
  const deliver = useRef<(p: Purchase) => Promise<boolean>>(async () => false);

  const iap = useIAP({
    onPurchaseSuccess: (purchase) => {
      deliver.current(purchase).finally(() => setBusy(false));
    },
    onPurchaseError: (error) => {
      setBusy(false);
      if (isUserCancelledError(error)) return;
      if (interactive.current) Alert.alert('Purchase not completed', error?.message || 'The App Store could not complete the purchase. Please try again.');
    },
  });

  const deliverImpl = async (purchase: Purchase) => {
    if (purchase.productId !== productId) return false;
    const token = purchase.purchaseToken;
    if (!token) return false;
    if (!userRef.current) {
      // Keep it unfinished; it is verified once they sign in and tap Restore (or on next launch).
      if (interactive.current) Alert.alert('Sign in to finish', 'Sign in with your email, then tap Restore purchases to turn on Pro.');
      return false;
    }
    const r = await api.verifyApplePurchase(token);
    if (r.ok) {
      await iap.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
      if (r.usage) setUsage(r.usage);
      await refreshConfig();
      if (interactive.current) Alert.alert('Welcome to SwiftScan Pro', 'Unlimited scans are on for your account on every device you sign in on.');
      return true;
    }
    // Not retryable (expired, refunded, linked to another account): finish so it stops coming back.
    if (!r.retryable) await iap.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
    if (interactive.current) Alert.alert('Pro not turned on', r.error);
    return false;
  };
  useEffect(() => {
    deliver.current = deliverImpl;
  });

  useEffect(() => {
    if (!iap.connected) return;
    iap
      .fetchProducts({ skus: [productId], type: 'subs' })
      .catch(() => {})
      .finally(() => setLoadingProduct(false));
  }, [iap.connected, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const product = useMemo(() => iap.subscriptions.find((p) => p.id === productId) ?? null, [iap.subscriptions, productId]);

  const buy = useCallback(async () => {
    if (!userRef.current) {
      Alert.alert('Sign in first', 'Sign in with your email so Pro follows you to every device you use.');
      return;
    }
    if (!iap.connected) {
      Alert.alert('App Store unavailable', 'Could not reach the App Store. Check your connection and try again.');
      return;
    }
    interactive.current = true;
    setBusy(true);
    try {
      await iap.requestPurchase({ type: 'subs', request: { apple: { sku: productId } } });
      // The result arrives in onPurchaseSuccess / onPurchaseError.
    } catch (e) {
      setBusy(false);
      if (!isUserCancelledError(e)) Alert.alert('Purchase not completed', (e as Error)?.message || 'Please try again.');
    }
  }, [iap, productId]);

  const restore = useCallback(async () => {
    if (!userRef.current) {
      Alert.alert('Sign in first', 'Sign in with the email you use for SwiftScan, then tap Restore purchases.');
      return;
    }
    interactive.current = true;
    setBusy(true);
    try {
      await restorePurchases().catch(() => {});
      const purchases = await getAvailablePurchases();
      const pro = purchases.find((p) => p.productId === productId);
      if (!pro) {
        Alert.alert('No subscription found', 'There is no active SwiftScan Pro subscription on this Apple ID.');
        return;
      }
      await deliver.current(pro);
    } catch (e) {
      Alert.alert('Restore failed', (e as Error)?.message || 'Could not reach the App Store. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [productId]);

  const manage = useCallback(async () => {
    try {
      await deepLinkToSubscriptions({});
    } catch {
      Linking.openURL(APPLE_SUBSCRIPTIONS_URL).catch(() => {});
    }
  }, []);

  const value = useMemo<IapState>(
    // Offer Pro only once the App Store actually returns the subscription (e.g. it isn't sold
    // until Apple approves it), so nobody sees a Subscribe button that can't work.
    () => ({ available: !!product, product, loadingProduct, busy, buy, restore, manage }),
    [product, loadingProduct, busy, buy, restore, manage],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
