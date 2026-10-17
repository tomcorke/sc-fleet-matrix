import { z } from 'zod';

import { type StoreOffers, parseStandaloneOffers } from './store-offers';

const ResultSchema = z.object({
  type: z.literal('sc-fleet:response'),
  kind: z.literal('store-offers'),
  pages: z.array(z.unknown()),
  fetchedAt: z.iso.datetime(),
});

export const fetchStoreOffers = () =>
  new Promise<StoreOffers>((resolve, reject) => {
    if (document.documentElement.dataset.scFleetHangar === undefined) {
      reject(
        new Error(
          'Store offers need the extension from extension/. Install it, then refresh.',
        ),
      );

      return;
    }

    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };

    const onMessage = ({ source, data }: MessageEvent) => {
      if (
        source !== window ||
        data?.type !== 'sc-fleet:response' ||
        data?.kind !== 'store-offers'
      ) {
        return;
      }

      finish();

      try {
        if (typeof data.error === 'string') {
          throw new Error(data.error);
        }

        const result = ResultSchema.parse(data);

        resolve({
          standalone: parseStandaloneOffers(result.pages),
          fetchedAt: result.fetchedAt,
        });
      } catch (error) {
        reject(error);
      }
    };

    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          'The store extension did not reply. Reload it, then refresh.',
        ),
      );
    }, 60_000);

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: 'sc-fleet:request', kind: 'store-offers' },
      window.location.origin,
    );
  });
