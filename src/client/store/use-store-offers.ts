import { useEffect, useState } from 'react';

import { fetchStoreOffers } from './fetch-store-offers';
import type { StoreOffers } from './store-offers';

export const useStoreOffers = () => {
  const [store, setStore] = useState<StoreOffers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let active = true;

    fetchStoreOffers()
      .then((result) => {
        if (active) {
          setStore(result);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshCount]);

  const refresh = () => {
    setLoading(true);
    setError(null);
    setRefreshCount((count) => count + 1);
  };

  return { store, loading, error, refresh };
};
