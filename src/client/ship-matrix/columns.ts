import type { ShipPriceData, ShipRawData } from '../../data/schema.ts';

export type Ship = ShipRawData & ShipPriceData;

type BaseColumn = { id: string; label: string };

// Text columns filter by substring; `search` widens what the filter matches.
type TextColumn = BaseColumn & {
  kind: 'text';
  value: (ship: Ship) => string;
  search?: (ship: Ship) => string;
};

// Choice columns filter by exact value; `order` replaces alphabetical order.
type ChoiceColumn = BaseColumn & {
  kind: 'choice';
  value: (ship: Ship) => string | null;
  order?: string[];
};

// Number columns filter by an inclusive min and max.
type NumberColumn = BaseColumn & {
  kind: 'number';
  value: (ship: Ship) => number | null;
  format?: (ship: Ship) => string;
};

export type Column = TextColumn | ChoiceColumn | NumberColumn;

export type Sort = { columnId: string; direction: 'asc' | 'desc' };

// Filter inputs as typed, keyed by column ID, or `${id}:min` and `${id}:max`.
export type Filters = Record<string, string>;

const SIZE_ORDER = ['vehicle', 'snub', 'small', 'medium', 'large', 'capital'];

const STATUS_LABELS: Record<string, string> = {
  'flight-ready': 'Flight ready',
  'in-concept': 'In concept',
};

export const COLUMNS: Column[] = [
  {
    id: 'name',
    label: 'Ship',
    kind: 'text',
    value: (ship) => ship.name.trim(),
    search: (ship) => `${ship.name} ${ship.manufacturer.name}`,
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer',
    kind: 'choice',
    value: (ship) => ship.manufacturer.name,
  },
  {
    id: 'size',
    label: 'Size',
    kind: 'choice',
    value: (ship) => ship.size,
    order: SIZE_ORDER,
  },
  { id: 'role', label: 'Role', kind: 'choice', value: (ship) => ship.type },
  { id: 'focus', label: 'Focus', kind: 'text', value: (ship) => ship.focus },
  {
    id: 'status',
    label: 'Status',
    kind: 'choice',
    value: (ship) => STATUS_LABELS[ship.production_status],
  },
  {
    id: 'crew',
    label: 'Crew',
    kind: 'number',
    value: (ship) => ship.max_crew,
    format: ({ min_crew, max_crew }) =>
      min_crew === max_crew || min_crew === null
        ? String(max_crew)
        : `${min_crew}–${max_crew}`,
  },
  {
    id: 'cargo',
    label: 'Cargo (SCU)',
    kind: 'number',
    value: (ship) => ship.cargocapacity,
  },
  {
    id: 'scm',
    label: 'SCM (m/s)',
    kind: 'number',
    value: (ship) => ship.scm_speed,
  },
  {
    id: 'boost',
    label: 'Boost (m/s)',
    kind: 'number',
    value: (ship) => ship.afterburner_speed,
  },
  {
    id: 'price',
    label: 'Price (USD)',
    kind: 'number',
    value: (ship) => ship.price ?? null,
    format: (ship) => ship.formattedPrice?.replace(/\.00$/, '') ?? '',
  },
];

// RSI sends sizes and roles in lowercase.
export const choiceLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const formatCell = (column: Column, ship: Ship) => {
  const value = column.value(ship);

  if (value === null || value === undefined) {
    return '–';
  }

  if (column.kind === 'choice') {
    return choiceLabel(String(value));
  }

  return column.kind === 'number' && column.format
    ? column.format(ship)
    : String(value);
};

const rank = (column: Column, value: string | number) =>
  column.kind === 'choice' && column.order
    ? column.order.indexOf(String(value))
    : value;

export const choicesFor = (column: ChoiceColumn, ships: Ship[]) => {
  const values = new Set(ships.map(column.value).filter((v) => v !== null));

  return [...values].sort((a, b) => {
    const [rankA, rankB] = [rank(column, a), rank(column, b)];

    return typeof rankA === 'number' && typeof rankB === 'number'
      ? rankA - rankB
      : a.localeCompare(b);
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

    const value = column.value(ship);

    return (
      value !== null &&
      (min === null || value >= min) &&
      (max === null || value <= max)
    );
  }

  const filter = filters[column.id]?.trim() ?? '';

  if (filter === '') {
    return true;
  }

  if (column.kind === 'choice') {
    return column.value(ship) === filter;
  }

  const haystack = (column.search ?? column.value)(ship).toLowerCase();

  return haystack.includes(filter.toLowerCase());
};

const compare = (column: Column, a: Ship, b: Ship) => {
  const [valueA, valueB] = [column.value(a), column.value(b)];

  if (valueA === null || valueB === null) {
    return Number(valueA === null) - Number(valueB === null);
  }

  const [rankA, rankB] = [rank(column, valueA), rank(column, valueB)];

  return typeof rankA === 'number' && typeof rankB === 'number'
    ? rankA - rankB
    : String(rankA).localeCompare(String(rankB));
};

// Ships without a value sort last in both directions; name breaks ties.
export const applyView = (ships: Ship[], filters: Filters, sort: Sort) => {
  const sortColumn = COLUMNS.find((c) => c.id === sort.columnId) ?? COLUMNS[0];
  const nameColumn = COLUMNS[0];
  const direction = sort.direction === 'asc' ? 1 : -1;

  return ships
    .filter((ship) => COLUMNS.every((c) => matches(c, ship, filters)))
    .sort((a, b) => {
      const [hasA, hasB] = [sortColumn.value(a), sortColumn.value(b)].map(
        (v) => v !== null,
      );

      if (hasA !== hasB) {
        return hasA ? -1 : 1;
      }

      return direction * compare(sortColumn, a, b) || compare(nameColumn, a, b);
    });
};
