import { useState } from 'react';

import { type Pledge, fetchPledges, savePledges } from './hangar';
import STYLES from './hangar-cell.module.scss';

type Props = {
  pledges: Pledge[] | null;
  ships: { id: number; name: string }[];
  unmatched: string[];
  onlyOwned: boolean;
  onPledgesChange: (pledges: Pledge[]) => void;
  onOnlyOwnedChange: (onlyOwned: boolean) => void;
};

export const HangarCell = ({
  pledges,
  ships,
  unmatched,
  onlyOwned,
  onPledgesChange,
  onOnlyOwnedChange,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownedCount =
    pledges?.reduce((count, pledge) => count + pledge.ships.length, 0) ?? 0;

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await fetchPledges(ships);

      savePledges(loaded);
      onPledgesChange(loaded);
      onOnlyOwnedChange(loaded.some((pledge) => pledge.ships.length > 0));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <span>
        {pledges === null ? 'Not loaded' : `${ownedCount} ships owned`}
      </span>
      <label className={STYLES.toggle}>
        <input
          type="checkbox"
          checked={onlyOwned}
          disabled={ownedCount === 0}
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
