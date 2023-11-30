import fs from "fs-extra";
import path from "path";
import { z } from "zod";

const MATRIX_DATA_INDEX_URL =
  "https://robertsspaceindustries.com/ship-matrix/index";

const main = async () => {
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
  console.log(data);

  const dataFilePath = path.join(cacheDir, "data.json");
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
