import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import {
  MatrixRawDataSchema,
  ProcessedMatrixDataSchema,
  ShipRawDataSchema,
  TopLevelResponseSchema,
} from '../data/schema.ts';
import { fetchShipMsrps } from './store-prices.ts';

const __dirname = import.meta.dirname;

const MATRIX_DATA_INDEX_URL =
  'https://robertsspaceindustries.com/ship-matrix/index';

export const fetchData = async () => {
  const response = await fetch(MATRIX_DATA_INDEX_URL);
  const rawData = await response.json();

  const cacheDir = path.join(__dirname, '../data');

  fs.mkdirSync(cacheDir, { recursive: true });
  const rawDataFilePath = path.join(cacheDir, 'rawdata.json');

  fs.writeFileSync(rawDataFilePath, JSON.stringify(rawData, null, 2));

  const roughParsedData = TopLevelResponseSchema.parse(rawData);
  const roughData = roughParsedData.data;

  for (const item of roughData) {
    ShipRawDataSchema.parse(item);
  }

  const parsedData = MatrixRawDataSchema.parse(rawData);
  const data = parsedData.data;

  return data;
};

const main = async () => {
  const data = await fetchData();

  const shipsBySize = Object.groupBy(data, (ship) => String(ship.size));

  fs.writeFileSync(
    path.join(__dirname, '../data/ships-by-size.json'),
    JSON.stringify(shipsBySize, null, 2),
  );

  const msrps = await fetchShipMsrps();

  const fullMappedData: z.infer<typeof ProcessedMatrixDataSchema> = data.map(
    (ship) => {
      const price = msrps.get(ship.id);

      if (price == null) {
        console.log(`No price for "${ship.name}"`);

        return ship;
      }

      const formattedPrice = price.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });

      return { ...ship, price, formattedPrice };
    },
  );

  fs.writeFileSync(
    path.join(__dirname, '../data/processed-data.json'),
    JSON.stringify(ProcessedMatrixDataSchema.parse(fullMappedData), null, 2),
  );

  const mappedData = fullMappedData.map((s) => {
    return [
      s.name,
      s.manufacturer.name,
      s.type,
      s.focus,
      s.size,
      s.cargocapacity,
      s.scm_speed,
      s.price,
    ];
  });

  fs.writeFileSync(
    path.join(__dirname, '../data/ships.csv'),
    mappedData
      .map((row) => row.map((item) => `"${item}"`).join(','))
      .join('\n'),
  );
};

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
