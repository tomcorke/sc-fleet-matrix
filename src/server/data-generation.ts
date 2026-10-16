import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import {
  MatrixRawDataSchema,
  ProcessedMatrixDataSchema,
  ShipRawDataSchema,
  TopLevelResponseSchema,
} from '../data/schema.ts';

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

const fetchWithCache = async (url: string) => {
  const sanitisedUrl = url.replace(/[^a-zA-Z0-9]/g, '_');
  const cacheDir = path.join(__dirname, '../../cache/fetch-cache');
  const cacheFilePath = path.join(cacheDir, `${sanitisedUrl}`);

  fs.mkdirSync(cacheDir, { recursive: true });

  if (fs.existsSync(cacheFilePath)) {
    const fileContents = fs.readFileSync(cacheFilePath, 'utf8');

    return fileContents;
  }

  const response = await fetch(url);
  const pageContent = await response.text();

  fs.writeFileSync(cacheFilePath, pageContent);

  return pageContent;
};

const getShipPrice = async (ship: {
  id: number;
  url: string;
  name: string;
}) => {
  const pageContent = await fetchWithCache(
    `https://robertsspaceindustries.com${ship.url}`,
  );
  const parsedPage = cheerio.load(pageContent);
  const buyingOptions = parsedPage('.buying-options-content');

  if (buyingOptions.length === 0) {
    return null;
  }

  const price = buyingOptions
    .find('.price')
    .find('.final-price')
    .attr('data-value');
  const gbpPrice = Number(price) / 100;
  const formattedPrice = gbpPrice.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });

  console.log(
    `Fetched price of "${gbpPrice}" for "${ship.name} from ${ship.url}"`,
  );
  const isWarbond = buyingOptions.text().includes('Warbond');

  return { price: gbpPrice, formattedPrice, isWarbond };
};

const enhanceShipData = async (ship: z.infer<typeof ShipRawDataSchema>) => {
  const price = await getShipPrice(ship);

  return { ...ship, ...price };
};

const main = async () => {
  const data = await fetchData();

  const shipsBySize = Object.groupBy(data, (ship) => String(ship.size));

  fs.writeFileSync(
    path.join(__dirname, '../data/ships-by-size.json'),
    JSON.stringify(shipsBySize, null, 2),
  );

  const fullMappedData: z.infer<typeof ProcessedMatrixDataSchema> = [];

  for (const ship of data) {
    fullMappedData.push(await enhanceShipData(ship));
  }

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
      s.isWarbond ? 'Warbond' : '',
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
