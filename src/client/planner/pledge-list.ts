import { compareInsuranceTiers } from '../../data/insurance.ts';

import type { Pledge } from '../hangar/hangar.ts';

export type PledgeSort = 'melt' | 'name' | 'insurance';
export type PledgeGrouping = 'none' | 'ship' | 'type';
export type PledgeListOptions = {
  hideWorthless: boolean;
  sort: PledgeSort;
  group: PledgeGrouping;
};

// An upgraded pledge keeps its original title, so the ships it holds now come
// first: "Standalone Ships - MTC" upgraded to an Asgard reads as the Asgard.
export const pledgeTitle = (pledge: Pledge) =>
  pledge.hasAppliedUpgrades && pledge.ships.length > 0
    ? pledge.ships.map((ship) => ship.name).join(', ')
    : pledge.name;

// RSI titles read "<type> - <contents>", such as "Standalone Ships - Aurora".
const pledgeType = (pledge: Pledge) =>
  pledge.name.split(' - ')[0]?.trim() || pledge.name;

const groupKey = (pledge: Pledge, group: PledgeGrouping) => {
  if (group === 'ship') {
    return pledge.ships[0]?.name ?? 'No ships';
  }

  return group === 'type' ? pledgeType(pledge) : '';
};

const compare = (sort: PledgeSort) => (left: Pledge, right: Pledge) => {
  if (sort === 'melt') {
    return right.meltValue - left.meltValue;
  }

  if (sort === 'insurance') {
    if (left.insurance === null || right.insurance === null) {
      return Number(left.insurance === null) - Number(right.insurance === null);
    }

    return compareInsuranceTiers(right.insurance, left.insurance);
  }

  return pledgeTitle(left).localeCompare(pledgeTitle(right));
};

export const arrangePledges = (
  pledges: Pledge[],
  { hideWorthless, sort, group }: PledgeListOptions,
) => {
  const groups = new Map<string, Pledge[]>();
  const shown = pledges
    .filter((pledge) => !hideWorthless || pledge.meltValue > 0)
    .toSorted(
      (left, right) =>
        compare(sort)(left, right) ||
        pledgeTitle(left).localeCompare(pledgeTitle(right)),
    );

  for (const pledge of shown) {
    const key = groupKey(pledge, group);

    groups.set(key, [...(groups.get(key) ?? []), pledge]);
  }

  return [...groups].toSorted(([left], [right]) => left.localeCompare(right));
};
