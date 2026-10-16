import { useMemo, useState } from 'react';

import { ColumnFilter } from '../column-filter/column-filter';
import { ShipRow } from '../ship-row/ship-row';
import {
  COLUMNS,
  type Column,
  type Filters,
  type Ship,
  type Sort,
  applyView,
} from './columns';
import STYLES from './ship-matrix.module.scss';

type Props = {
  ships: Ship[];
};

const DEFAULT_SORT: Sort = { columnId: 'size', direction: 'asc' };

const ariaSort = (column: Column, sort: Sort) => {
  if (column.id !== sort.columnId) {
    return 'none';
  }

  return sort.direction === 'asc' ? 'ascending' : 'descending';
};

export const ShipMatrix = ({ ships }: Props) => {
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState(DEFAULT_SORT);

  const visibleShips = useMemo(
    () => applyView(ships, filters, sort),
    [ships, filters, sort],
  );

  const isFiltered = Object.values(filters).some((v) => v.trim() !== '');

  const setFilter = (key: string, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const toggleSort = (columnId: string) =>
    setSort((current) => ({
      columnId,
      direction:
        current.columnId === columnId && current.direction === 'asc'
          ? 'desc'
          : 'asc',
    }));

  const resetFilters = () => setFilters({});

  return (
    <div className={STYLES.layout}>
      <header className={STYLES.titleBlock}>
        <div className={STYLES.titleCell}>
          <h1 className={STYLES.title}>Fleet matrix</h1>
          <p className={STYLES.subtitle}>
            Every Star Citizen ship, side by side
          </p>
        </div>
        <div className={STYLES.cell}>
          <span className={STYLES.cellLabel}>Ships shown</span>
          <span className={STYLES.count} aria-live="polite">
            {visibleShips.length} of {ships.length}
          </span>
          <button
            type="button"
            className={STYLES.reset}
            onClick={resetFilters}
            disabled={!isFiltered}
          >
            Clear filters
          </button>
        </div>
        <div className={STYLES.cell}>
          <span className={STYLES.cellLabel}>Source</span>
          <span>RSI ship matrix and pledge store</span>
          <span className={STYLES.cellNote}>
            Prices are standard-edition MSRP
          </span>
        </div>
      </header>

      <div className={STYLES.scroller}>
        <table className={STYLES.table}>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={ariaSort(column, sort)}
                  className={STYLES[column.kind]}
                >
                  <button
                    type="button"
                    className={STYLES.sortButton}
                    onClick={() => toggleSort(column.id)}
                  >
                    {column.label}
                    <span className={STYLES.sortMark} aria-hidden="true">
                      {sort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
            <tr className={STYLES.filterRow}>
              {COLUMNS.map((column) => (
                <td key={column.id} className={STYLES[column.kind]}>
                  <ColumnFilter
                    column={column}
                    ships={ships}
                    filters={filters}
                    onChange={setFilter}
                  />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleShips.map((ship) => (
              <ShipRow key={ship.id} ship={ship} />
            ))}
            {visibleShips.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className={STYLES.empty}>
                  No ships match these filters.{' '}
                  <button
                    type="button"
                    className={STYLES.reset}
                    onClick={resetFilters}
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
