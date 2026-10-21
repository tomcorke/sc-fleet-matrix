import { useMemo } from 'react';

import {
  type Column,
  type Filters,
  type Ship,
  choicesFor,
} from '../ship-matrix/columns';
import STYLES from './column-filter.module.scss';

type Props = {
  column: Column;
  ships: Ship[];
  filters: Filters;
  onChange: (key: string, value: string) => void;
};

export const ColumnFilter = ({ column, ships, filters, onChange }: Props) => {
  const choices = useMemo(
    () => (column.kind === 'choice' ? choicesFor(column, ships) : []),
    [column, ships],
  );

  const classFor = (key: string) =>
    (filters[key] ?? '') === '' ? STYLES.input : STYLES.activeInput;

  if (column.kind === 'number') {
    const minKey = `${column.id}:min`;
    const maxKey = `${column.id}:max`;

    return (
      <div className={STYLES.range}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          className={classFor(minKey)}
          placeholder="Min"
          aria-label={`${column.label} minimum`}
          value={filters[minKey] ?? ''}
          onChange={(event) => onChange(minKey, event.target.value)}
        />
        <input
          type="number"
          inputMode="decimal"
          min={0}
          className={classFor(maxKey)}
          placeholder="Max"
          aria-label={`${column.label} maximum`}
          value={filters[maxKey] ?? ''}
          onChange={(event) => onChange(maxKey, event.target.value)}
        />
      </div>
    );
  }

  const value = filters[column.id] ?? '';
  const className = classFor(column.id);

  if (column.kind === 'choice') {
    return (
      <select
        className={className}
        aria-label={`Filter by ${column.label.toLowerCase()}`}
        value={value}
        onChange={(event) => onChange(column.id, event.target.value)}
      >
        <option value="">All</option>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="search"
      className={className}
      placeholder="Search"
      aria-label={`Filter by ${column.label.toLowerCase()}`}
      value={value}
      onChange={(event) => onChange(column.id, event.target.value)}
    />
  );
};
