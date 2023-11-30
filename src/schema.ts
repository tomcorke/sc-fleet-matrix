import { z } from "zod";

export const MediaArraySchema = z.array(z.unknown());

export const ManufacturerSchema = z.object({
  id: z.number(),
  code: z.string(),
  description: z.string().nullable(),
  known_for: z.string().nullable(),
  name: z.string(),
  media: MediaArraySchema,
});

export const ShipComponentsSchema = z.unknown();

export const ShipRawDataSchema = z
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

export const TopLevelResponseSchema = z.object({
  success: z.literal(1),
  code: z.literal("OK"),
  msg: z.literal("OK"),
  data: z.array(z.any()),
});

export const MatrixRawDataSchema = z
  .object({
    success: z.literal(1),
    code: z.literal("OK"),
    msg: z.literal("OK"),
    data: z.array(ShipRawDataSchema),
  })
  .strict();
