import fs from 'node:fs';
import path from 'node:path';

import { ProcessedDataSchema } from '../data/schema.ts';
import { normalise } from './normalise.ts';
import { fetchStorePages } from './store-prices.ts';

const DATA_DIR = path.join(import.meta.dirname, '../data');
const SOURCES_DIR = path.join(DATA_DIR, 'sources');

const MATRIX_DATA_INDEX_URL =
  'https://robertsspaceindustries.com/ship-matrix/index';

// The knowledge base keeps dated snapshots; the newest one wins.
const SNAPSHOTS_DIR =
  'E:/working/star-citizen-knowledge-base/evidence/snapshots';

const SOURCE_FILES = {
  matrix: 'rsi-ship-matrix.json',
  storePages: 'rsi-store-msrp.json',
  features: 'ship-features.json',
};

const sourcePath = (file: string) => path.join(SOURCES_DIR, file);

const writeSource = (file: string, data: unknown) =>
  fs.writeFileSync(sourcePath(file), JSON.stringify(data, null, 2));

const readSource = (file: string): unknown =>
  fs.existsSync(sourcePath(file))
    ? JSON.parse(fs.readFileSync(sourcePath(file), 'utf8'))
    : null;

const latestFeatureSnapshot = () => {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    return null;
  }

  const file = fs
    .readdirSync(SNAPSHOTS_DIR)
    .sort()
    .reverse()
    .map((dir) => path.join(SNAPSHOTS_DIR, dir, 'ship-features.json'))
    .find((candidate) => fs.existsSync(candidate));

  return file ?? null;
};

// Stores each source exactly as received; normalising happens afterwards.
const fetchSources = async () => {
  fs.mkdirSync(SOURCES_DIR, { recursive: true });

  const matrixResponse = await fetch(MATRIX_DATA_INDEX_URL);

  if (!matrixResponse.ok) {
    throw new Error(`Ship matrix failed: ${matrixResponse.status}`);
  }

  writeSource(SOURCE_FILES.matrix, await matrixResponse.json());
  writeSource(SOURCE_FILES.storePages, await fetchStorePages());

  const features = latestFeatureSnapshot();

  if (features) {
    fs.copyFileSync(features, sourcePath(SOURCE_FILES.features));
  } else {
    console.log('No ship-feature snapshot found; keeping the stored copy.');
  }
};

const main = async () => {
  if (!process.argv.includes('--offline')) {
    await fetchSources();
  }

  const data = normalise({
    matrix: readSource(SOURCE_FILES.matrix),
    storePages: (readSource(SOURCE_FILES.storePages) as unknown[] | null) ?? [],
    features: readSource(SOURCE_FILES.features),
  });

  for (const ship of data.ships.filter((s) => !('price' in s.values))) {
    console.log(`No price for "${ship.name}"`);
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'processed-data.json'),
    JSON.stringify(ProcessedDataSchema.parse(data), null, 2),
  );
};

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
