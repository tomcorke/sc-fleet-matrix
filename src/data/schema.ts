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

const ShipPriceDataSchema = z.object({
  price: z.number().optional(),
  formattedPrice: z.string().optional(),
});

export type ShipRawData = z.infer<typeof ShipRawDataSchema>;
export type ShipPriceData = z.infer<typeof ShipPriceDataSchema>;

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

export const ProcessedMatrixDataSchema = z.array(
  ShipRawDataSchema.merge(ShipPriceDataSchema),
);
