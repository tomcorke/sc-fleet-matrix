import { useState } from 'react';

import { fetchOwnedShips, saveShips } from './hangar';
import STYLES from './hangar-cell.module.scss';

type Props = {
  owned: string[];
  unmatched: string[];
  onlyOwned: boolean;
  onOwnedChange: (names: string[]) => void;
  onOnlyOwnedChange: (onlyOwned: boolean) => void;
};

export const HangarCell = ({
  owned,
  unmatched,
  onlyOwned,
  onOwnedChange,
  onOnlyOwnedChange,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const names = await fetchOwnedShips();

      saveShips(names);
      onOwnedChange(names);
      onOnlyOwnedChange(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <span>
        {owned.length === 0 ? 'Not loaded' : `${owned.length} ships owned`}
      </span>
      <label className={STYLES.toggle}>
        <input
          type="checkbox"
          checked={onlyOwned}
          disabled={owned.length === 0}
          onChange={(event) => onOnlyOwnedChange(event.target.checked)}
        />
        Only ships I own
      </label>
      <button
        type="button"
        className={STYLES.load}
        onClick={load}
        disabled={loading}
      >
        {loading ? 'Loading…' : 'Load from RSI'}
      </button>
      {error && (
        <span className={STYLES.note} role="alert">
          {error}
        </span>
      )}
      {unmatched.length > 0 && (
        <span className={STYLES.note}>
          Not in the ship matrix: {unmatched.join(', ')}
        </span>
      )}
    </>
  );
};
