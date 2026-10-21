import { z } from 'zod';

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

// RSI mixes an older role vocabulary into its current one.
const ROLE_ALIASES: Record<string, string> = {
  multi: 'multi-role',
  transport: 'transporter',
};

export const ShipRawDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),

  production_status: z.union([
    z.literal('flight-ready'),
    z.literal('in-concept'),
  ]),
  production_note: z.string().nullable(),

  size: z
    .string()
    .toLowerCase()
    .pipe(z.enum(['snub', 'small', 'medium', 'large', 'capital', 'vehicle']))
    .nullable(),
  type: z
    .string()
    .toLowerCase()
    .transform((role) => ROLE_ALIASES[role] ?? role),
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
  'time_modified.unfiltered': z.string(),
  compiled: ShipComponentsSchema,
});

export type ShipRawData = z.infer<typeof ShipRawDataSchema>;

export const TopLevelResponseSchema = z.object({
  success: z.literal(1),
  code: z.literal('OK'),
  msg: z.literal('OK'),
  data: z.array(z.any()),
});

export const MatrixRawDataSchema = z
  .object({
    success: z.literal(1),
    code: z.literal('OK'),
    msg: z.literal('OK'),
    data: z.array(ShipRawDataSchema),
  })
  .strict();

// Normalised output: every source becomes stat values keyed by stat ID. A
// missing key means the sources have no data for that ship.
export const StatSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['text', 'choice', 'number']),
  source: z.string(),
  // Number formatting: 'usd' renders whole dollars as currency.
  unit: z.enum(['usd']).optional(),
  // Choice order, replacing alphabetical order.
  order: z.array(z.string()).optional(),
});

export const ShipSchema = z.object({
  id: z.number(),
  name: z.string(),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const ProcessedDataSchema = z.object({
  stats: z.array(StatSchema),
  ships: z.array(ShipSchema),
});

export type Stat = z.infer<typeof StatSchema>;
export type Ship = z.infer<typeof ShipSchema>;
export type ProcessedData = z.infer<typeof ProcessedDataSchema>;
