// The hangar comes from the browser extension in `extension/`, which reads the
// RSI pledges pages with the user's sign-in. Only RSI can make those requests.
const TIMEOUT_MS = 60_000;
const STORAGE_KEY = 'owned-ships';

type HangarResult = { pages?: string[]; error?: string };

const isResult = (data: unknown): data is HangarResult =>
  typeof data === 'object' &&
  data !== null &&
  'type' in data &&
  data.type === 'sc-fleet:response' &&
  'kind' in data &&
  data.kind === 'hangar';

// Each owned ship appears once per copy, as a pledge item of kind "Ship".
export const parseOwnedShips = (pages: string[]) =>
  pages.flatMap((html) =>
    [
      ...new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelectorAll('.list-items .item'),
    ]
      .filter(
        (item) => item.querySelector('.kind')?.textContent?.trim() === 'Ship',
      )
      .map((item) => item.querySelector('.title')?.textContent?.trim() ?? ''),
  );

export const fetchOwnedShips = () =>
  new Promise<string[]>((resolve, reject) => {
    if (document.documentElement.dataset.scFleetHangar === undefined) {
      reject(new Error('Install the hangar extension from extension/ first.'));

      return;
    }

    const finish = (settle: () => void) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      settle();
    };

    const onMessage = ({ source, data }: MessageEvent) => {
      if (source !== window || !isResult(data)) {
        return;
      }

      finish(() =>
        data.pages
          ? resolve(parseOwnedShips(data.pages))
          : reject(new Error(data.error)),
      );
    };

    const timer = setTimeout(
      () =>
        finish(() => reject(new Error('The hangar extension did not reply.'))),
      TIMEOUT_MS,
    );

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: 'sc-fleet:request', kind: 'hangar' },
      window.location.origin,
    );
  });

export const loadSavedShips = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
};

export const saveShips = (names: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Not saved; the hangar loads again next visit.
  }
};
