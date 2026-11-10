import { z } from 'zod';

const STORAGE_KEY = 'starred-ships';

export const loadStarredShipIds = (): number[] => {
  try {
    return z
      .array(z.number().int().positive())
      .parse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return [];
  }
};

export const saveStarredShipIds = (ids: number[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Stars still work for this visit if browser storage is unavailable.
  }
};
