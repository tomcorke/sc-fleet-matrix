import { z } from 'zod';

const RESULT = z.object({
  type: z.literal('sc-fleet:response'),
  kind: z.literal('credit'),
  amount: z.number().int().nonnegative().optional(),
  fetchedAt: z.iso.datetime().optional(),
  error: z.string().optional(),
});

export type StoreCredit = { amount: number; fetchedAt: string };

// Resolves to the store credit balance in USD cents and its fetch time.
export const fetchCredit = () =>
  new Promise<StoreCredit>((resolve, reject) => {
    if (document.documentElement.dataset.scFleetHangar === undefined) {
      reject(
        new Error(
          'Store credit needs the extension from extension/. Install it, then refresh.',
        ),
      );

      return;
    }

    const finish = (settle: () => void) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      settle();
    };

    const onMessage = ({ source, data }: MessageEvent) => {
      const result = RESULT.safeParse(data);

      if (source !== window || !result.success) {
        return;
      }

      const { amount, fetchedAt, error } = result.data;

      finish(() =>
        amount === undefined || fetchedAt === undefined
          ? reject(new Error(error ?? 'Invalid store credit response.'))
          : resolve({ amount, fetchedAt }),
      );
    };

    const timer = setTimeout(
      () =>
        finish(() =>
          reject(
            new Error('The extension did not reply. Reload it, then refresh.'),
          ),
        ),
      60_000,
    );

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: 'sc-fleet:request', kind: 'credit' },
      window.location.origin,
    );
  });
