import { z } from 'zod';

import { DEFAULT_COLUMN_IDS } from '../ship-matrix/columns';

const STORAGE_KEY = 'visible-columns';

export const loadVisibleColumnIds = () => {
  try {
    return z
      .array(z.string())
      .parse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_COLUMN_IDS;
  }
};

export const saveVisibleColumnIds = (ids: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Not saved; the default columns show next visit.
  }
};
