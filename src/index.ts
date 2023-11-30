import fs from "fs-extra";
import path from "path";
import { z } from "zod";

const MATRIX_DATA_INDEX_URL =
  "https://robertsspaceindustries.com/ship-matrix/index";

const MediaArraySchema = z.array(z.unknown());

const ManufacturerSchema = z.object({
  id: z.number(),
  code: z.string(),
  description: z.string().nullable(),
  known_for: z.string().nullable(),
  name: z.string(),
  media: MediaArraySchema,
});

const ShipComponentsSchema = z.unknown();

const ShipRawDataSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),

    production_status: z.union([
      z.literal("flight-ready"),
      z.literal("in-concept"),
    ]),
    production_note: z.string().nullable(),

    size: z
      .union([
        z.literal("small"),
        z.literal("large"),
        z.literal("medium"),
        z.literal("capital"),
        z.literal("snub"),
        z.literal("vehicle"),
      ])
      .nullable(),
    type: z.union([
      z.literal("multi"),
      z.literal("exploration"),
      z.literal("transport"),
      z.literal("combat"),
      z.literal("competition"),
      z.literal("support"),
      z.literal("industrial"),
      z.literal("ground"),
    ]),
    focus: z.string(),
    url: z.string(),

    afterburner_speed: z.number().nullable(),
    beam: z.number(),
    cargocapacity: z.number().nullable(),
    chassis_id: z.number(),
    height: z.number(),
    length: z.number(),
    manufacturer_id: z.number(),
    mass: z.number().nullable(),
    max_crew: z.number().nullable(),
    min_crew: z.number().nullable(),
    scm_speed: z.number().nullable(),

    time_modified: z.string(),

    yaw_max: z.number().nullable(),
    pitch_max: z.number().nullable(),
    roll_max: z.number().nullable(),
    xaxis_acceleration: z.number().nullable(),
    yaxis_acceleration: z.number().nullable(),
    zaxis_acceleration: z.number().nullable(),

    manufacturer: ManufacturerSchema,
    media: MediaArraySchema,
    "time_modified.unfiltered": z.string(),
    compiled: ShipComponentsSchema,
  })
  .strict();

const TopLevelResponseSchema = z.object({
  success: z.literal(1),
  code: z.literal("OK"),
  msg: z.literal("OK"),
  data: z.array(z.any()),
});

const MatrixRawDataSchema = z
  .object({
    success: z.literal(1),
    code: z.literal("OK"),
    msg: z.literal("OK"),
    data: z.array(ShipRawDataSchema),
  })
  .strict();

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
