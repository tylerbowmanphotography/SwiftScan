import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import type { ProductScanResult, SavedScanItem } from './types';

const HISTORY_KEY = 'swiftscan:history:v1';
const SYNCED_FOR_KEY = 'swiftscan:synced-for';
const MAX_HISTORY = 100;

type ScanType = NonNullable<SavedScanItem['scanType']>;

interface AppState {
  config: api.AppConfig | null;
  usage: api.Usage | null;
  user: api.AccountUser | null;
  history: SavedScanItem[];
  ready: boolean;
  refreshConfig: () => Promise<void>;
  setUsage: (u: api.Usage | undefined) => void;
  addScan: (result: ProductScanResult, scanType: ScanType, thumbnailUrl?: string) => SavedScanItem;
  updateItem: (id: string, patch: Partial<SavedScanItem>) => void;
  removeItem: (id: string) => void;
  clearHistory: () => void;
  getItem: (id: string) => SavedScanItem | undefined;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

const newId = () => `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function mergeByProduct(a: SavedScanItem[], b: SavedScanItem[]) {
  const byName = new Map<string, SavedScanItem>();
  for (const item of [...a, ...b]) {
    const key = item.scanResult?.productName?.toLowerCase();
    if (!key) continue;
    const cur = byName.get(key);
    if (!cur || (item.timestamp || 0) > (cur.timestamp || 0)) {
      byName.set(key, { ...item, thumbnailUrl: item.thumbnailUrl || cur?.thumbnailUrl });
    }
  }
  return [...byName.values()].sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0)).slice(0, MAX_HISTORY);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<api.AppConfig | null>(null);
  const [usage, setUsageState] = useState<api.Usage | null>(null);
  const [history, setHistory] = useState<SavedScanItem[]>([]);
  const [ready, setReady] = useState(false);
  const user = config?.user ?? null;
  const loaded = useRef(false);
  const syncedEmail = useRef<string | null>(null);

  const refreshConfig = useCallback(async () => {
    const cfg = await api.loadConfig();
    if (cfg) {
      setConfig(cfg);
      setUsageState(cfg.usage);
    }
  }, []);

  // Load local history + server config on launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (raw) setHistory(JSON.parse(raw));
      } catch {}
      loaded.current = true;
      setReady(true);
      refreshConfig();
    })();
  }, [refreshConfig]);

  // Persist locally, and to the account when signed in.
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)).catch(() => {});
    if (user && syncedEmail.current === user.email) {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => api.saveServerItems(history), 1200);
    }
  }, [history, user]);

  // When signed in, pull saved items from the account and merge them in.
  useEffect(() => {
    if (!user) {
      syncedEmail.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const server = await api.fetchServerItems();
      if (cancelled || server === null) return;
      const previous = await AsyncStorage.getItem(SYNCED_FOR_KEY);
      setHistory((local) => (previous && previous !== user.email ? mergeByProduct(server, []) : mergeByProduct(local, server)));
      syncedEmail.current = user.email;
      AsyncStorage.setItem(SYNCED_FOR_KEY, user.email).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setUsage = useCallback((u: api.Usage | undefined) => {
    if (u) setUsageState(u);
  }, []);

  const addScan = useCallback((result: ProductScanResult, scanType: ScanType, thumbnailUrl?: string) => {
    const item: SavedScanItem = {
      id: newId(),
      timestamp: Date.now(),
      scanResult: result,
      scanType,
      thumbnailUrl: thumbnailUrl || result.identification?.imageUrl,
      isBookmarked: false,
    };
    setHistory((h) => [item, ...h.filter((x) => x.scanResult.productName !== result.productName || x.isBookmarked)].slice(0, MAX_HISTORY));
    return item;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<SavedScanItem>) => {
    setHistory((h) => h.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const removeItem = useCallback((id: string) => setHistory((h) => h.filter((x) => x.id !== id)), []);
  const clearHistory = useCallback(() => setHistory((h) => h.filter((x) => x.isBookmarked)), []);
  const getItem = useCallback((id: string) => history.find((x) => x.id === id), [history]);

  const signOut = useCallback(async () => {
    await api.logout();
    syncedEmail.current = null;
    await refreshConfig();
  }, [refreshConfig]);

  const value = useMemo<AppState>(
    () => ({ config, usage, user, history, ready, refreshConfig, setUsage, addScan, updateItem, removeItem, clearHistory, getItem, signOut }),
    [config, usage, user, history, ready, refreshConfig, setUsage, addScan, updateItem, removeItem, clearHistory, getItem, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
