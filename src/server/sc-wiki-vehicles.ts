import { z } from 'zod';

// Community game-data API, built from the game files. Values describe each
// vehicle's stock loadout, so quantum figures are for its default drive.
const VEHICLES_URL = 'https://api.star-citizen.wiki/api/v2/vehicles';

const number = z.number().nullable().optional();

export const VehiclePageSchema = z.object({
  meta: z.object({ last_page: z.number() }),
  data: z.array(
    z.object({
      uuid: z.string(),
      quantum: z
        .object({
          quantum_speed: number,
          quantum_spool_time: number,
          quantum_fuel_capacity: number,
          quantum_range: number,
        })
        .nullable()
        .optional(),
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
