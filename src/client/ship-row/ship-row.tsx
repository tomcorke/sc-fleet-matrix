import { hasExtension } from '../extension';
import { type Column, type Ship, formatCell } from '../ship-matrix/columns';
import { StarButton } from '../star-button/star-button';
import type { StandaloneOffer } from '../store/store-offers';
import { StoreOffersCell } from '../store/store-offers-cell';
import STYLES from './ship-row.module.scss';

type Props = {
  ship: Ship;
  columns: Column[];
  starred: boolean;
  onToggleStar: () => void;
  offers: StandaloneOffer[] | undefined;
  storeHint: string;
  ownedInsurance?: string;
};

export const ShipRow = ({
  ship,
  columns,
  starred,
  onToggleStar,
  offers,
  storeHint,
  ownedInsurance,
}: Props) => {
  const [nameColumn, ...otherColumns] = columns;

  return (
    <tr className={STYLES.row}>
      <td>
        <StarButton
          pressed={starred}
          label={`Star ${ship.name}`}
          title={`${starred ? 'Unstar' : 'Star'} ${ship.name}`}
          onClick={onToggleStar}
        />
      </td>
      <th scope="row" className={STYLES.name}>
        {formatCell(nameColumn, ship)}
      </th>
      {otherColumns.map((column) => (
        <td key={column.id} className={STYLES[column.kind]}>
          {formatCell(column, ship)}
        </td>
      ))}
      {hasExtension && (
        <td>
          <StoreOffersCell shipId={ship.id} offers={offers} hint={storeHint} />
        </td>
      )}
      {ownedInsurance !== undefined && <td>{ownedInsurance || '–'}</td>}
    </tr>
  );
};
