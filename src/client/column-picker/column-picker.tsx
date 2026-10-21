import { useRef } from 'react';

import {
  type Column,
  DEFAULT_COLUMN_IDS,
  type Ship,
  coverage,
} from '../ship-matrix/columns';
import STYLES from './column-picker.module.scss';

type Props = {
  columns: Column[];
  ships: Ship[];
  visibleIds: string[];
  onChange: (ids: string[]) => void;
};

const coverageNote = (column: Column, ships: Ship[]) => {
  const { count, total } = coverage(column, ships);

  return count === total
    ? null
    : `${count}/${total} ships (${Math.round((count / total) * 100)}%)`;
};

export const ColumnPicker = ({
  columns,
  ships,
  visibleIds,
  onChange,
}: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const groups = Object.entries(Object.groupBy(columns, (c) => c.source));

  // Keeps the data's column order rather than the order of clicks.
  const toggle = (id: string, shown: boolean) =>
    onChange(
      columns
        .map((c) => c.id)
        .filter((c) => (c === id ? shown : visibleIds.includes(c))),
    );

  return (
    <>
      <button
        type="button"
        className={STYLES.open}
        onClick={() => dialog.current?.showModal()}
      >
        Choose columns
      </button>
      <dialog
        ref={dialog}
        className={STYLES.dialog}
        aria-labelledby="column-picker-title"
      >
        <header className={STYLES.header}>
          <h2 id="column-picker-title" className={STYLES.title}>
            Columns
          </h2>
          <button
            type="button"
            className={STYLES.open}
            onClick={() => onChange(DEFAULT_COLUMN_IDS)}
          >
            Reset
          </button>
          <button
            type="button"
            className={STYLES.open}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </header>
        {groups.map(([source, group]) => (
          <fieldset key={source} className={STYLES.group}>
            <legend className={STYLES.legend}>{source}</legend>
            {group?.map((column) => {
              const note = coverageNote(column, ships);

              return (
                <label key={column.id} className={STYLES.option}>
                  <input
                    type="checkbox"
                    checked={visibleIds.includes(column.id)}
                    disabled={column.id === 'name'}
                    onChange={(event) =>
                      toggle(column.id, event.target.checked)
                    }
                  />
                  {column.label}
                  {note && <span className={STYLES.coverage}>{note}</span>}
                </label>
              );
            })}
          </fieldset>
        ))}
      </dialog>
    </>
  );
};
