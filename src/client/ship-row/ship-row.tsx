import { COLUMNS, type Ship, formatCell } from '../ship-matrix/columns';
import STYLES from './ship-row.module.scss';

type Props = {
  ship: Ship;
};

export const ShipRow = ({ ship }: Props) => {
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
    </tr>
  );
};
