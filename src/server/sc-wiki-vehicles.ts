import { z } from 'zod';

// Community game-data API, built from the game files. Values describe each
// vehicle's stock loadout, so quantum figures are for its default drive.
const VEHICLES_URL = 'https://api.star-citizen.wiki/api/v2/vehicles';

const number = z.number().nullable().optional();

// The API sends an empty array where an object has no fields.
const record = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess(
    (value) => (Array.isArray(value) && value.length === 0 ? null : value),
    z.object(shape).nullable().optional(),
  );

const shopListing = z.object({
  price_buy: number,
  price_rent: number,
  terminal_name: z.string(),
  starmap_location: record({ name: z.string() }),
});

export const VehiclePageSchema = z.object({
  meta: z.object({ last_page: z.number() }),
  data: z.array(
    z.object({
      uuid: z.string(),
      quantum: record({
        quantum_speed: number,
        quantum_spool_time: number,
        quantum_fuel_capacity: number,
        quantum_range: number,
      }),
      health: number,
      shield: record({ hp: number, regeneration: number }),
      armor: record({
        health: number,
        damage_physical: number,
        damage_energy: number,
      }),
      weaponry: z
        .object({
          pilot_dps: number,
          pilot_sustained_dps: number,
          pilot_alpha: number,
          missiles: record({ count: number }),
          total_missile_damage: number,
        })
        .nullable()
        .optional(),
      turrets: record({
        manned: z.array(z.unknown()),
        remote: z.array(z.unknown()),
      }),
      insurance: record({
        claim_time: number,
        expedite_time: number,
        expedite_cost: number,
      }),
      // Player-reported in-game shop listings, relayed from UEX.
      uex_prices: record({
        purchase: z.array(shopListing),
        rental: z.array(shopListing),
      }),
    }),
  ),
});

export type Vehicle = z.infer<typeof VehiclePageSchema>['data'][number];

// Returns every response page as received, for storing unmodified.
export const fetchVehiclePages = async () => {
  const pages: unknown[] = [];

  for (let page = 1, last = 1; page <= last; page++) {
    const response = await fetch(`${VEHICLES_URL}?page%5Bnumber%5D=${page}`);

    if (!response.ok) {
      throw new Error(`Vehicles page ${page} failed: ${response.status}`);
    }

    const raw: unknown = await response.json();

    last = VehiclePageSchema.parse(raw).meta.last_page;
    pages.push(raw);
  }

  return pages;
};

export const vehiclesByUuid = (pages: unknown[]) =>
  new Map(
    pages
      .flatMap((page) => VehiclePageSchema.parse(page).data)
      .map((vehicle) => [vehicle.uuid, vehicle]),
  );
