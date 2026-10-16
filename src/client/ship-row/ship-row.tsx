import type { ShipPriceData, ShipRawData } from '../../data/schema';

import STYLES from './ship-row.module.scss';

type Props = {
  ship: ShipRawData & ShipPriceData;
};

type ShipKey = keyof Props['ship'];

const columns: ShipKey[] = [
  'name',
  'size',
  'type',
  'focus',
  'scm_speed',
  'afterburner_speed',
  'formattedPrice',
  'isWarbond',
];

const formatters: Partial<Record<ShipKey, (value: unknown) => string>> = {
  isWarbond: (value) => (value ? 'Warbond' : ''),
};

export const ShipRow = ({ ship }: Props) => {
  return (
    <div className={STYLES.ShipRow}>
      {columns.map((key) => {
        let value = ship[key];
        if (value === null) {
          value = '-';
        }
        if (typeof value === 'object') {
          value = '{}';
        }
        if (key === 'price') {
          console.log(ship, ship.price);
        }
        return (
          <div key={key} className={STYLES.ShipRow__cell}>
            {formatters[key] ? formatters[key]?.(value) : (value as any)}
          </div>
        );
      })}
    </div>
  );
};
