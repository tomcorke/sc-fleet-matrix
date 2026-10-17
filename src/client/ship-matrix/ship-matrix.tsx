import { useMemo, useState } from 'react';

import { ColumnFilter } from '../column-filter/column-filter';
import { loadSavedShips } from '../hangar/hangar';
import { HangarCell } from '../hangar/hangar-cell';
import { ShipRow } from '../ship-row/ship-row';
import { hasAvailableWarbond } from '../store/store-offers';
import { useStoreOffers } from '../store/use-store-offers';
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

// Hangar names match ship-matrix names, give or take case and spacing.
const nameKey = (name: string) => name.trim().toLowerCase();

const ariaSort = (column: Column, sort: Sort) => {
  if (column.id !== sort.columnId) {
    return 'none';
  }

  return sort.direction === 'asc' ? 'ascending' : 'descending';
};

export const ShipMatrix = ({ ships }: Props) => {
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [owned, setOwned] = useState(loadSavedShips);
  const [onlyOwned, setOnlyOwned] = useState(owned.length > 0);
  const [onlyWarbond, setOnlyWarbond] = useState(false);
  const { store, loading, error, refresh } = useStoreOffers();

  const ownedKeys = useMemo(() => new Set(owned.map(nameKey)), [owned]);

  const unmatched = useMemo(() => {
    const shipKeys = new Set(ships.map((ship) => nameKey(ship.name)));

    return owned.filter((name) => !shipKeys.has(nameKey(name)));
  }, [ships, owned]);

  const visibleShips = useMemo(
    () =>
      applyView(
        onlyOwned
          ? ships.filter((ship) => ownedKeys.has(nameKey(ship.name)))
          : ships,
        filters,
        sort,
      ).filter(
        (ship) =>
          !onlyWarbond || hasAvailableWarbond(store?.standalone ?? [], ship.id),
      ),
    [ships, onlyOwned, ownedKeys, filters, sort, onlyWarbond, store],
  );

  const isFiltered =
    onlyWarbond || Object.values(filters).some((v) => v.trim() !== '');

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

  const resetFilters = () => {
    setFilters({});
    setOnlyWarbond(false);
  };

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
          <span className={STYLES.cellLabel}>Store offers</span>
          <span className={STYLES.cellNote}>
            RSI pledge store, USD before tax. Ship prices are standard-edition
            MSRP.
          </span>
          {store && (
            <span aria-live="polite">
              Fetched{' '}
              <time dateTime={store.fetchedAt}>
                {new Date(store.fetchedAt).toLocaleString()}
              </time>
            </span>
          )}
          <button
            type="button"
            className={STYLES.reset}
            onClick={refresh}
            disabled={loading}
          >
            {loading ? 'Loading offers…' : 'Refresh offers'}
          </button>
          {error && (
            <span className={STYLES.cellNote} role="alert">
              {error}
            </span>
          )}
        </div>
        <div className={STYLES.cell}>
          <span className={STYLES.cellLabel}>Your hangar</span>
          <HangarCell
            owned={owned}
            unmatched={unmatched}
            onlyOwned={onlyOwned}
            onOwnedChange={setOwned}
            onOnlyOwnedChange={setOnlyOwned}
          />
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
              <th scope="col" className={STYLES.text}>
                Store offers (USD)
              </th>
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
              <td>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyWarbond}
                    disabled={!store}
                    onChange={(event) => setOnlyWarbond(event.target.checked)}
                  />{' '}
                  Warbond on sale
                </label>
              </td>
            </tr>
          </thead>
          <tbody>
            {visibleShips.map((ship) => (
              <ShipRow
                key={ship.id}
                ship={ship}
                offers={store?.standalone}
                storeHint={error ?? 'Loading store offers…'}
              />
            ))}
            {visibleShips.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className={STYLES.empty}>
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
