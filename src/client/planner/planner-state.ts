import { z } from 'zod';

const STORAGE_KEY = 'planner';

export const INSURANCE_MINIMUMS = ['any', 6, 120, 'lti'] as const;
export const FUNDING_MODES = [
  'credit-only',
  'least-new-money',
  'lowest-total',
] as const;

const PLANNER_STATE = z.object({
  // Pledge IDs in Trade in; every other pledge is in Keep.
  tradeIn: z.array(z.string()),
  wants: z.array(
    z.object({
      key: z.string(),
      shipId: z.number().int().positive(),
      insurance: z.union(INSURANCE_MINIMUMS.map((value) => z.literal(value))),
    }),
  ),
  funding: z.enum(FUNDING_MODES),
});

export type PlannerState = z.infer<typeof PLANNER_STATE>;
export type Want = PlannerState['wants'][number];
export type InsuranceMinimum = Want['insurance'];
export type FundingMode = PlannerState['funding'];

export const EMPTY_PLANNER: PlannerState = {
  tradeIn: [],
  wants: [],
  funding: 'least-new-money',
};

export const parsePlannerState = (json: string | null): PlannerState => {
  try {
    return PLANNER_STATE.parse(JSON.parse(json ?? 'null'));
  } catch {
    return EMPTY_PLANNER;
  }
};

export const loadPlannerState = () => {
  try {
    return parsePlannerState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_PLANNER;
  }
};

export const savePlannerState = (state: PlannerState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not saved; choices reset next visit.
  }
};
