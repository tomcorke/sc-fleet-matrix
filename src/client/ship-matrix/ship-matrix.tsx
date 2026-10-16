import type { ShipPriceData, ShipRawData } from '../../data/schema';

import { ShipRow } from '../ship-row/ship-row';
import STYLES from './ship-matrix.module.scss';

type Props = {
  data: Array<ShipRawData & ShipPriceData>;
};

const bySize = (a: { size?: string | null }, b: { size?: string | null }) => {
  if (a.size && b.size) {
    return a.size < b.size ? -1 : 1;
  }
  if (a.size) {
    return -1;
  }
  return 1;
};

export const ShipMatrix = ({ data }: Props) => {
  return (
    <div className={STYLES.ShipMatrix}>
      {data.sort(bySize).map((ship) => (
        <ShipRow key={ship.id} ship={ship} />
      ))}
    </div>
  );
};
