import { z } from 'zod';

import {
  MatrixRawDataSchema,
  type ProcessedData,
  type ShipRawData,
  type Stat,
} from '../data/schema.ts';
import { type Vehicle, vehiclesByUuid } from './sc-wiki-vehicles.ts';
import { msrpsFromPages } from './store-prices.ts';

// Knowledge-base ship-feature snapshot. Only the fields used are checked.
const FeatureStateSchema = z.object({
  state: z.enum([
    'present',
    'explicitly-absent',
    'not-mentioned',
    'unresolved',
  ]),
});

export const ShipFeaturesSchema = z.object({
  feature_keys: z.array(z.string()),
  // Schema v2 adds a separately checked wiki observation per ship.
  wiki_feature_keys: z.array(z.string()).optional(),
  ships: z.array(
    z.object({
      matrix_id: z.number(),
      // The knowledge base's reviewed match to a game-data vehicle.
      api_status: z.string().optional(),
      api_source: z.object({ uuid: z.string() }).nullable().optional(),
      features: z.record(z.string(), FeatureStateSchema),
      wiki_features: z.record(z.string(), FeatureStateSchema).optional(),
      reported: z
        .object({
          // Medical beds arrive as counts per tier, e.g. { T3: 2 }.
          seating: z
            .record(
              z.string(),
              z
                .union([z.number(), z.record(z.string(), z.number())])
                .nullable()
                .transform((count) =>
                  count === null || typeof count === 'number'
                    ? count
                    : Object.values(count).reduce((sum, n) => sum + n, 0),
                ),
            )
            .nullable(),
          max_medical_tier: z.string().nullable(),
        })
        .partial()
        .nullable()
        .optional(),
    }),
  ),
});

export type Sources = {
  matrix: unknown;
  storePages: unknown[];
  features: unknown;
  vehiclePages: unknown[];
};

type Value = string | number | null | undefined;

type StatSource<T> = Stat & { read: (item: T) => Value };

const SIZE_ORDER = ['vehicle', 'snub', 'small', 'medium', 'large', 'capital'];

const STATUS_LABELS: Record<string, string> = {
  'flight-ready': 'Flight ready',
  'in-concept': 'In concept',
};

// RSI uses 0 where it has no measurement for these, never as a real value.
const positive = (value: number | null) =>
  value === null || value <= 0 ? null : value;

const capitalise = (value: string | null) =>
  value && value.charAt(0).toUpperCase() + value.slice(1);

const matrix = (
  id: string,
  label: string,
  kind: Stat['kind'],
  read: (ship: ShipRawData) => Value,
  extra: Partial<Stat> = {},
): StatSource<ShipRawData> => ({
  id,
  label,
  kind,
  source: 'RSI ship matrix',
  read,
  ...extra,
});

const MATRIX_STATS = [
  matrix('name', 'Ship', 'text', (s) => s.name.trim()),
  matrix('manufacturer', 'Manufacturer', 'choice', (s) => s.manufacturer.name),
  matrix('size', 'Size', 'choice', (s) => capitalise(s.size), {
    order: SIZE_ORDER.map((size) => capitalise(size) ?? size),
  }),
  matrix('role', 'Role', 'choice', (s) => capitalise(s.type)),
  matrix('focus', 'Focus', 'text', (s) => s.focus),
  matrix(
    'status',
    'Status',
    'choice',
    (s) => STATUS_LABELS[s.production_status],
  ),
  matrix('min_crew', 'Min crew', 'number', (s) => positive(s.min_crew)),
  matrix('max_crew', 'Crew', 'number', (s) => positive(s.max_crew)),
  matrix('cargo', 'Cargo (SCU)', 'number', (s) => s.cargocapacity),
  matrix('scm', 'SCM (m/s)', 'number', (s) => positive(s.scm_speed)),
  matrix('boost', 'Boost (m/s)', 'number', (s) =>
    positive(s.afterburner_speed),
  ),
  matrix('length', 'Length (m)', 'number', (s) => positive(s.length)),
  matrix('beam', 'Beam (m)', 'number', (s) => positive(s.beam)),
  matrix('height', 'Height (m)', 'number', (s) => positive(s.height)),
  matrix('mass', 'Mass (kg)', 'number', (s) => positive(s.mass)),
  matrix('pitch', 'Pitch (°/s)', 'number', (s) => positive(s.pitch_max)),
  matrix('yaw', 'Yaw (°/s)', 'number', (s) => positive(s.yaw_max)),
  matrix('roll', 'Roll (°/s)', 'number', (s) => positive(s.roll_max)),
];

const PRICE_STAT: Stat = {
  id: 'price',
  label: 'Price (USD)',
  kind: 'number',
  source: 'RSI pledge store',
  unit: 'usd',
};

const SEATING_LABELS: Record<string, string> = {
  crew_stations: 'Crew stations',
  ejection_seats: 'Ejection seats',
  escape_pods: 'Escape pods',
  jump_seats: 'Jump seats',
  beds: 'Beds (incl. medical)',
  medical_beds: 'Medical beds',
};

const FEATURE_SOURCE = 'Ship features (knowledge base)';

// `not-mentioned` counts as absent within the checked sources, per the
// knowledge base's policy; `unresolved` means nobody could check.
const FEATURE_VALUES: Record<string, string | null> = {
  present: 'Yes',
  'explicitly-absent': 'No',
  'not-mentioned': 'No',
  unresolved: null,
};

// Sources combine by the strongest state, per the knowledge base's policy:
// explicit evidence beats an omission, and any check beats none.
const STATE_STRENGTH = [
  'present',
  'explicitly-absent',
  'not-mentioned',
  'unresolved',
] as const;

const combinedState = (
  states: (z.infer<typeof FeatureStateSchema> | undefined)[],
) =>
  STATE_STRENGTH.find((state) => states.some((s) => s?.state === state)) ??
  'unresolved';

const GAME_SOURCE = 'Game data, stock loadout (star-citizen.wiki)';

const rounded = (value: number | null | undefined, places: number) =>
  value == null || value <= 0 ? null : Number(value.toFixed(places));

const GAME_STATS: StatSource<Vehicle>[] = [
  {
    id: 'quantum_speed',
    label: 'Quantum speed (km/s)',
    read: (v: Vehicle) => rounded((v.quantum?.quantum_speed ?? 0) / 1000, 0),
  },
  {
    id: 'quantum_spool',
    label: 'Quantum spool (s)',
    read: (v: Vehicle) => rounded(v.quantum?.quantum_spool_time, 1),
  },
  {
    id: 'quantum_fuel',
    label: 'Quantum fuel (SCU)',
    read: (v: Vehicle) => rounded(v.quantum?.quantum_fuel_capacity, 2),
  },
  {
    id: 'quantum_range',
    label: 'Quantum range (Gm)',
    read: (v: Vehicle) => rounded((v.quantum?.quantum_range ?? 0) / 1e9, 1),
  },
].map((stat) => ({ ...stat, kind: 'number' as const, source: GAME_SOURCE }));

const featureLabel = (key: string) =>
  capitalise(key.replaceAll('_', ' ')) ?? key;

export const normalise = ({
  matrix,
  storePages,
  features,
  vehiclePages,
}: Sources) => {
  const ships = MatrixRawDataSchema.parse(matrix).data;
  const msrps = msrpsFromPages(storePages);
  const featureData =
    features === null ? null : ShipFeaturesSchema.parse(features);
  const featureShips = new Map(
    featureData?.ships.map((ship) => [ship.matrix_id, ship]) ?? [],
  );

  // Several game vehicles can share a matrix ID, so only reviewed matches
  // count; ambiguous and unmatched ships get no game data.
  const vehicles = vehiclesByUuid(vehiclePages);
  const vehicleFor = (id: number) => {
    const ship = featureShips.get(id);
    const uuid =
      ship?.api_status === 'matched' ? ship.api_source?.uuid : undefined;

    return uuid === undefined ? undefined : vehicles.get(uuid);
  };

  const featureStats: StatSource<number>[] = featureData
    ? [
        ...[
          ...new Set([
            ...featureData.feature_keys,
            ...(featureData.wiki_feature_keys ?? []),
          ]),
        ].map((key) => ({
          id: `feature:${key}`,
          label: featureLabel(key),
          kind: 'choice' as const,
          source: FEATURE_SOURCE,
          order: ['Yes', 'No'],
          read: (id: number) => {
            const ship = featureShips.get(id);

            return FEATURE_VALUES[
              combinedState([ship?.features[key], ship?.wiki_features?.[key]])
            ];
          },
        })),
        ...Object.entries(SEATING_LABELS).map(([key, label]) => ({
          id: `seating:${key}`,
          label,
          kind: 'number' as const,
          source: FEATURE_SOURCE,
          read: (id: number) => featureShips.get(id)?.reported?.seating?.[key],
        })),
        {
          id: 'max_medical_tier',
          // Tier 1 is the most capable.
          label: 'Medical tier',
          kind: 'choice' as const,
          order: ['T1', 'T2', 'T3'],
          source: FEATURE_SOURCE,
          read: (id: number) =>
            featureShips.get(id)?.reported?.max_medical_tier,
        },
      ]
    : [];

  const values = (entries: [string, Value][]) =>
    Object.fromEntries(
      entries.filter(
        (entry): entry is [string, string | number] => entry[1] != null,
      ),
    );

  const data: ProcessedData = {
    // `read` is stripped when the output is parsed with ProcessedDataSchema.
    stats: [...MATRIX_STATS, PRICE_STAT, ...GAME_STATS, ...featureStats],
    ships: ships.map((ship) => ({
      id: ship.id,
      name: ship.name.trim(),
      values: values([
        ...MATRIX_STATS.map((stat): [string, Value] => [
          stat.id,
          stat.read(ship),
        ]),
        [PRICE_STAT.id, msrps.get(ship.id)],
        ...GAME_STATS.map((stat): [string, Value] => {
          const vehicle = vehicleFor(ship.id);

          return [stat.id, vehicle && stat.read(vehicle)];
        }),
        ...featureStats.map((stat): [string, Value] => [
          stat.id,
          stat.read(ship.id),
        ]),
      ]),
    })),
  };

  // Stats no ship has data for aren't worth offering as columns.
  data.stats = data.stats.filter((stat) =>
    data.ships.some((ship) => stat.id in ship.values),
  );

  return data;
};
