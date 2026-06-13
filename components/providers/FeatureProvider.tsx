'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getFeatures, type FeatureMap } from '@/services/api';
import {
  DEFAULT_FEATURES,
  FEATURES_CACHE_KEY,
  type FeatureKey,
} from '@/lib/features';

interface FeatureContextValue {
  features: FeatureMap;
  /** True unless an admin has switched this feature off. Fail-open. */
  enabled: (key: FeatureKey) => boolean;
  refresh: () => Promise<void>;
}

const FeatureContext = createContext<FeatureContextValue | null>(null);

function readCache(): FeatureMap {
  if (typeof window === 'undefined') return DEFAULT_FEATURES;
  try {
    const raw = localStorage.getItem(FEATURES_CACHE_KEY);
    if (raw) return { ...DEFAULT_FEATURES, ...(JSON.parse(raw) as FeatureMap) };
  } catch {
    /* ignore */
  }
  return DEFAULT_FEATURES;
}

function writeCache(map: FeatureMap) {
  try {
    localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  // Seed from the cached map so gating is correct on first paint, then refresh
  // from the server. Fail-open everywhere: a fetch error keeps everything on.
  const [features, setFeatures] = useState<FeatureMap>(readCache);

  const refresh = useCallback(async () => {
    try {
      const map = await getFeatures();
      const merged = { ...DEFAULT_FEATURES, ...map };
      setFeatures(merged);
      writeCache(merged);
    } catch {
      /* keep the last-known (cached) map */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enabled = useCallback(
    (key: FeatureKey) => features[key] !== false,
    [features]
  );

  return (
    <FeatureContext.Provider value={{ features, enabled, refresh }}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures(): FeatureContextValue {
  const ctx = useContext(FeatureContext);
  // Fail-open if used outside the provider (shouldn't happen) — never block UI.
  if (!ctx) {
    return {
      features: DEFAULT_FEATURES,
      enabled: () => true,
      refresh: async () => {},
    };
  }
  return ctx;
}
