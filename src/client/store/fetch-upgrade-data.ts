import { z } from 'zod';

import { type UpgradeData, parseUpgradeData } from './upgrade-data.ts';

const ResultSchema = z.object({
  type: z.literal('sc-fleet:response'),
  kind: z.literal('upgrade-data'),
  response: z.unknown(),
  fetchedAt: z.iso.datetime(),
});

export const fetchUpgradeData = () =>
  new Promise<UpgradeData>((resolve, reject) => {
    if (document.documentElement.dataset.scFleetHangar === undefined) {
      reject(
        new Error(
          'Upgrade data needs the extension from extension/. Install it, then refresh.',
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
        data?.kind !== 'upgrade-data'
      ) {
        return;
      }

      finish();

      try {
        if (typeof data.error === 'string') {
          throw new Error(data.error);
        }

        const result = ResultSchema.parse(data);

        resolve(parseUpgradeData(result.response, result.fetchedAt));
      } catch (error) {
        reject(error);
      }
    };

    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          'The upgrade extension did not reply. Reload it, then refresh.',
        ),
      );
    }, 60_000);

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: 'sc-fleet:request', kind: 'upgrade-data' },
      window.location.origin,
    );
  });
