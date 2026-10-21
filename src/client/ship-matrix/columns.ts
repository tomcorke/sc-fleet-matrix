import type { Ship, Stat } from '../../data/schema.ts';

export type { Ship };

// A column shows one normalised stat.
export type Column = Stat;

export type Sort = { columnId: string; direction: 'asc' | 'desc' };

// Filter inputs as typed, keyed by column ID, or `${id}:min` and `${id}:max`.
export type Filters = Record<string, string>;

export const DEFAULT_COLUMN_IDS = [
  'name',
  'manufacturer',
  'size',
  'role',
  'focus',
  'status',
  'max_crew',
  'cargo',
  'scm',
  'boost',
  'price',
];

export const valueOf = (column: Column, ship: Ship) =>
  ship.values[column.id] ?? null;

// Ship names also match on manufacturer.
const searchText = (column: Column, ship: Ship) =>
  column.id === 'name'
    ? `${ship.name} ${ship.values.manufacturer ?? ''}`
    : String(valueOf(column, ship) ?? '');

export const coverage = (column: Column, ships: Ship[]) => {
  const count = ships.filter((ship) => column.id in ship.values).length;

  return { count, total: ships.length };
};

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const formatCell = (column: Column, ship: Ship) => {
  const value = valueOf(column, ship);

  if (value === null) {
    return '–';
  }

  return column.unit === 'usd' && typeof value === 'number'
    ? usd.format(value)
    : String(value);
};

const rank = (column: Column, value: string | number) =>
  column.order ? column.order.indexOf(String(value)) : value;

export const choicesFor = (column: Column, ships: Ship[]) => {
  const values = new Set(
    ships.map((ship) => valueOf(column, ship)).filter((v) => v !== null),
  );

  return [...values].sort((a, b) => {
    const [rankA, rankB] = [rank(column, a), rank(column, b)];

    return typeof rankA === 'number' && typeof rankB === 'number'
      ? rankA - rankB
      : String(a).localeCompare(String(b));
  });
};

const parseBound = (input: string | undefined) =>
  input === undefined || input.trim() === '' ? null : Number(input);

const matches = (column: Column, ship: Ship, filters: Filters) => {
  if (column.kind === 'number') {
    const min = parseBound(filters[`${column.id}:min`]);
    const max = parseBound(filters[`${column.id}:max`]);

    if (min === null && max === null) {
      return true;
    }

    const value = valueOf(column, ship);

    return (
      typeof value === 'number' &&
      (min === null || value >= min) &&
      (max === null || value <= max)
    );
  }

  const filter = filters[column.id]?.trim() ?? '';

  if (filter === '') {
    return true;
  }

  if (column.kind === 'choice') {
    return String(valueOf(column, ship)) === filter;
  }

  const haystack = searchText(column, ship).toLowerCase();

  return haystack.includes(filter.toLowerCase());
};

const compare = (column: Column, a: Ship, b: Ship) => {
  const [valueA, valueB] = [valueOf(column, a), valueOf(column, b)];

  if (valueA === null || valueB === null) {
    return Number(valueA === null) - Number(valueB === null);
  }

  const [rankA, rankB] = [rank(column, valueA), rank(column, valueB)];

  return typeof rankA === 'number' && typeof rankB === 'number'
    ? rankA - rankB
    : String(rankA).localeCompare(String(rankB));
};

// Ships without a value sort last in both directions; name breaks ties.
// Only the given columns filter, so hiding a column drops its filter.
export const applyView = (
  ships: Ship[],
  columns: Column[],
  filters: Filters,
  sort: Sort,
) => {
  const sortColumn = columns.find((c) => c.id === sort.columnId) ?? columns[0];
  const direction = sort.direction === 'asc' ? 1 : -1;
  const byName = (a: Ship, b: Ship) => a.name.localeCompare(b.name);

  return ships
    .filter((ship) => columns.every((c) => matches(c, ship, filters)))
    .sort((a, b) => {
      const [hasA, hasB] = [a, b].map(
        (ship) => valueOf(sortColumn, ship) !== null,
      );

      if (hasA !== hasB) {
        return hasA ? -1 : 1;
      }

      return direction * compare(sortColumn, a, b) || byName(a, b);
    });
};
