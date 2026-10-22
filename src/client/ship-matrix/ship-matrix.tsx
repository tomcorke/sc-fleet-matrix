import { useMemo, useState } from 'react';

import { ColumnFilter } from '../column-filter/column-filter';
import { ColumnPicker } from '../column-picker/column-picker';
import {
  loadVisibleColumnIds,
  saveVisibleColumnIds,
} from '../column-picker/visible-columns';
import { hasExtension } from '../extension';
import { insuranceForShip, loadSavedPledges } from '../hangar/hangar';
import { HangarCell } from '../hangar/hangar-cell';
import { ShipRow } from '../ship-row/ship-row';
import { hasAvailableWarbond } from '../store/store-offers';
import { useStoreOffers } from '../store/use-store-offers';
import {
  type Column,
  type Filters,
  type Ship,
  type Sort,
  applyView,
} from './columns';
import STYLES from './ship-matrix.module.scss';

type Props = {
  stats: Column[];
  ships: Ship[];
  onOpenPlanner: () => void;
};

const DEFAULT_SORT: Sort = { columnId: 'size', direction: 'asc' };

const ariaSort = (column: Column, sort: Sort) => {
  if (column.id !== sort.columnId) {
    return 'none';
  }

  return sort.direction === 'asc' ? 'ascending' : 'descending';
};

export const ShipMatrix = ({ stats, ships, onOpenPlanner }: Props) => {
  const [visibleIds, setVisibleIds] = useState(loadVisibleColumnIds);
  // The name column is the row header, so it always shows first.
  const columns = useMemo(
    () =>
      stats.filter(
        (stat) => stat.id === 'name' || visibleIds.includes(stat.id),
      ),
    [stats, visibleIds],
  );
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [pledges, setPledges] = useState(() =>
    hasExtension ? loadSavedPledges() : null,
  );
  const [onlyOwned, setOnlyOwned] = useState(
    pledges?.some((pledge) => pledge.ships.length > 0) ?? false,
  );
  const [onlyWarbond, setOnlyWarbond] = useState(false);
  const { store, loading, error, refresh } = useStoreOffers();

  const owned = useMemo(
    () => pledges?.flatMap((pledge) => pledge.ships) ?? [],
    [pledges],
  );
  const ownedIds = useMemo(
    () => new Set(owned.map((ship) => ship.shipId)),
    [owned],
  );
  const unmatched = owned
    .filter((ship) => ship.shipId === null)
    .map((ship) => ship.name);

  const visibleShips = useMemo(
    () =>
      applyView(
        onlyOwned ? ships.filter((ship) => ownedIds.has(ship.id)) : ships,
        columns,
        filters,
        sort,
      ).filter(
        (ship) =>
          !onlyWarbond || hasAvailableWarbond(store?.standalone ?? [], ship.id),
      ),
    [ships, onlyOwned, ownedIds, columns, filters, sort, onlyWarbond, store],
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

  const changeColumns = (ids: string[]) => {
    setVisibleIds(ids);
    saveVisibleColumnIds(ids);
  };

  const resetFilters = () => {
    setFilters({});
    setOnlyWarbond(false);
  };

  return (
    <div className={STYLES.layout}>
      <header className={STYLES.titleBlock}>
        <div className={STYLES.titleCell}>
          <h1 className={STYLES.title}>
            Fleet matrix{' '}
            <small className={STYLES.buildSha}>{__BUILD_SHA__}</small>
          </h1>
          <p className={STYLES.subtitle}>
            Every Star Citizen ship, side by side
          </p>
          {hasExtension && (
            <button
              type="button"
              className={STYLES.reset}
              onClick={onOpenPlanner}
            >
              Plan fleet changes
            </button>
          )}
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
          <ColumnPicker
            columns={stats}
            ships={ships}
            visibleIds={visibleIds}
            onChange={changeColumns}
          />
        </div>
        {hasExtension && (
          <>
            <div className={STYLES.cell}>
              <span className={STYLES.cellLabel}>Store offers</span>
              <span className={STYLES.cellNote}>
                RSI pledge store, USD before tax. Ship prices are
                standard-edition MSRP.
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
                pledges={pledges}
                ships={ships}
                unmatched={unmatched}
                onlyOwned={onlyOwned}
                onPledgesChange={setPledges}
                onOnlyOwnedChange={setOnlyOwned}
              />
            </div>
          </>
        )}
      </header>

      <div className={STYLES.scroller}>
        <table className={STYLES.table}>
          <thead>
            <tr>
              {columns.map((column) => (
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
              {hasExtension && (
                <th scope="col" className={STYLES.text}>
                  Store offers (USD)
                </th>
              )}
              {pledges !== null && (
                <th scope="col" className={STYLES.text}>
                  Owned insurance
                </th>
              )}
            </tr>
            <tr className={STYLES.filterRow}>
              {columns.map((column) => (
                <td key={column.id} className={STYLES[column.kind]}>
                  <ColumnFilter
                    column={column}
                    ships={ships}
                    filters={filters}
                    onChange={setFilter}
                  />
                </td>
              ))}
              {hasExtension && (
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
              )}
              {pledges !== null && <td />}
            </tr>
          </thead>
          <tbody>
            {visibleShips.map((ship) => (
              <ShipRow
                key={ship.id}
                ship={ship}
                columns={columns}
                offers={store?.standalone}
                storeHint={error ?? 'Loading store offers…'}
                ownedInsurance={
                  pledges === null
                    ? undefined
                    : insuranceForShip(pledges, ship.id)
                }
              />
            ))}
            {visibleShips.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1 + Number(pledges !== null)}
                  className={STYLES.empty}
                >
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
