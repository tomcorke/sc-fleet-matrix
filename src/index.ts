import fs from "fs-extra";
import path from "path";

import {
  MatrixRawDataSchema,
  ShipRawDataSchema,
  TopLevelResponseSchema,
} from "./schema";

const MATRIX_DATA_INDEX_URL =
  "https://robertsspaceindustries.com/ship-matrix/index";

const fetchData = async () => {
  const response = await fetch(MATRIX_DATA_INDEX_URL);
  const rawData = await response.json();

  const cacheDir = path.join(__dirname, "../cache");
  fs.mkdirp(cacheDir);
  const rawDataFilePath = path.join(cacheDir, "rawdata.json");
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
};

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
