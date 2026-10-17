import { COLUMNS, type Ship, formatCell } from '../ship-matrix/columns';
import type { StandaloneOffer } from '../store/store-offers';
import { StoreOffersCell } from '../store/store-offers-cell';
import STYLES from './ship-row.module.scss';

type Props = {
  ship: Ship;
  offers: StandaloneOffer[] | undefined;
  storeHint: string;
};

export const ShipRow = ({ ship, offers, storeHint }: Props) => {
  const [nameColumn, ...otherColumns] = COLUMNS;

  return (
    <tr className={STYLES.row}>
      <th scope="row" className={STYLES.name}>
        {formatCell(nameColumn, ship)}
      </th>
      {otherColumns.map((column) => (
        <td key={column.id} className={STYLES[column.kind]}>
          {formatCell(column, ship)}
        </td>
      ))}
      <td>
        <StoreOffersCell shipId={ship.id} offers={offers} hint={storeHint} />
      </td>
    </tr>
  );
};
