import { useEffect, useState } from 'react';

import { type Pledge, loadSavedPledges } from '../hangar/hangar';
import { fetchUpgradeData } from '../store/fetch-upgrade-data';
import type { UpgradeData } from '../store/upgrade-data';
import { useStoreOffers } from '../store/use-store-offers';
import { type StoreCredit, fetchCredit } from './fetch-credit';
import { type Plan, createPlan } from './plan';
import { PlanView } from './plan-view';
import {
  type FundingMode,
  INSURANCE_MINIMUMS,
  type InsuranceMinimum,
  type PlannerState,
  loadPlannerState,
  savePlannerState,
} from './planner-state';
import STYLES from './planner.module.scss';
import {
  type PledgeGrouping,
  type PledgeListOptions,
  type PledgeSort,
  arrangePledges,
  pledgeTitle,
} from './pledge-list';

type Props = {
  ships: { id: number; name: string }[];
  onClose: () => void;
};

const FUNDING_LABELS: Record<FundingMode, string> = {
  'credit-only': 'Store credit only',
  'least-new-money': 'Least new money',
  'lowest-total': 'Lowest total cost',
};

const INSURANCE_LABELS: Record<string, string> = {
  any: 'Any insurance',
  6: '6 months or better',
  120: '120 months or better',
  lti: 'LTI',
};

const SORT_LABELS: Record<PledgeSort, string> = {
  melt: 'Melt value',
  name: 'Name',
  insurance: 'Insurance',
};

const GROUP_LABELS: Record<PledgeGrouping, string> = {
  none: 'No grouping',
  ship: 'Ship',
  type: 'Pledge type',
};

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const insuranceLabel = (pledge: Pledge) => {
  if (pledge.insurance === null) {
    return 'No insurance';
  }

  return pledge.insurance === 'lti' ? 'LTI' : `${pledge.insurance} months`;
};

const pledgeNotes = (pledge: Pledge) =>
  [
    insuranceLabel(pledge),
    !pledge.canMelt && 'Can’t melt',
    pledge.canGift && 'Giftable',
    pledge.hasAppliedUpgrades && 'Upgraded',
    pledge.containsGamePackage && 'Game package',
  ]
    .filter((note) => note !== false)
    .join(', ');

const usePlannerData = () => {
  const [credit, setCredit] = useState<StoreCredit | null>(null);
  const [upgrades, setUpgrades] = useState<UpgradeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([fetchCredit(), fetchUpgradeData()])
      .then(([amount, data]) => {
        if (active) {
          setCredit(amount);
          setUpgrades(data);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { credit, upgrades, error };
};

export const Planner = ({ ships, onClose }: Props) => {
  const [pledges] = useState(loadSavedPledges);
  const [plan, setPlan] = useState(loadPlannerState);
  const [search, setSearch] = useState('');
  const { credit, upgrades, error } = usePlannerData();
  const {
    store,
    loading: offersLoading,
    error: offersError,
  } = useStoreOffers();
  const [result, setResult] = useState<Plan | null>(null);
  const [listOptions, setListOptions] = useState<PledgeListOptions>({
    hideWorthless: true,
    sort: 'melt',
    group: 'none',
  });

  const update = (change: (current: PlannerState) => PlannerState) => {
    setResult(null);
    setPlan((current) => {
      const next = change(current);

      savePlannerState(next);

      return next;
    });
  };

  const runPlan = () => {
    if (
      pledges === null ||
      credit === null ||
      store === null ||
      upgrades === null
    ) {
      return;
    }

    setResult(
      createPlan({
        pledges,
        tradeIn: plan.tradeIn,
        want: plan.wants.map((want) => ({
          shipId: want.shipId,
          minInsurance: want.insurance,
        })),
        offers: store,
        upgrades,
        credit: credit.amount,
        creditFetchedAt: credit.fetchedAt,
        funding: plan.funding,
      }),
    );
  };

  const shipNames = new Map(ships.map((ship) => [ship.id, ship.name]));
  const tradeIn = new Set(plan.tradeIn);
  const match = ships.find(
    (ship) => ship.name.toLowerCase() === search.trim().toLowerCase(),
  );

  const move = (pledge: Pledge) =>
    update((current) => ({
      ...current,
      tradeIn: current.tradeIn.includes(pledge.id)
        ? current.tradeIn.filter((id) => id !== pledge.id)
        : [...current.tradeIn, pledge.id],
    }));

  const addWant = () => {
    if (!match) {
      return;
    }

    update((current) => ({
      ...current,
      wants: [
        ...current.wants,
        { key: crypto.randomUUID(), shipId: match.id, insurance: 'any' },
      ],
    }));
    setSearch('');
  };

  const setWantInsurance = (key: string, insurance: InsuranceMinimum) =>
    update((current) => ({
      ...current,
      wants: current.wants.map((want) =>
        want.key === key ? { ...want, insurance } : want,
      ),
    }));

  const removeWant = (key: string) =>
    update((current) => ({
      ...current,
      wants: current.wants.filter((want) => want.key !== key),
    }));

  const renderGroup = (id: string, title: string, inTradeIn: boolean) => {
    const members =
      pledges?.filter((pledge) => tradeIn.has(pledge.id) === inTradeIn) ?? [];
    const melt = members.reduce((sum, pledge) => sum + pledge.meltValue, 0);
    const arranged = arrangePledges(members, listOptions);
    const shown = arranged.reduce((sum, [, group]) => sum + group.length, 0);
    let body;

    if (pledges === null) {
      body = (
        <p className={STYLES.empty}>
          Load your hangar from the matrix first, then come back to sort your
          pledges.
        </p>
      );
    } else if (members.length === 0) {
      body = (
        <p className={STYLES.empty}>
          {inTradeIn
            ? 'Move pledges here that you’d melt or upgrade.'
            : 'Every pledge is marked for trade-in.'}
        </p>
      );
    } else {
      body = (
        <div className={STYLES.scroll}>
          {arranged.map(([key, group]) => (
            <div key={key}>
              {key && <h3 className={STYLES.subgroup}>{key}</h3>}
              <ul className={STYLES.list}>
                {group.map((pledge) => (
                  <li key={pledge.id} className={STYLES.row}>
                    <div className={STYLES.rowMain}>
                      <span className={STYLES.name}>{pledgeTitle(pledge)}</span>
                      <span className={STYLES.detail}>
                        {pledge.hasAppliedUpgrades && pledge.ships.length > 0
                          ? `Upgraded from ${pledge.name}`
                          : pledge.ships.map((ship) => ship.name).join(', ') ||
                            'No ships'}
                      </span>
                      <span className={STYLES.detail}>
                        {pledgeNotes(pledge)}
                      </span>
                    </div>
                    <span className={STYLES.melt}>{usd(pledge.meltValue)}</span>
                    <button
                      type="button"
                      className={STYLES.link}
                      onClick={() => move(pledge)}
                    >
                      {inTradeIn ? 'Keep' : 'Trade in'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {shown < members.length && (
            <p className={STYLES.hidden}>
              {members.length - shown} pledges worth $0 hidden.
            </p>
          )}
        </div>
      );
    }

    return (
      <section
        className={inTradeIn ? STYLES.tradeIn : STYLES.group}
        aria-labelledby={id}
      >
        <header className={STYLES.groupHeader}>
          <h2 id={id} className={STYLES.groupTitle}>
            {title}
          </h2>
          <span className={STYLES.groupMeta}>
            {members.length} pledges, {usd(melt)} melt
          </span>
        </header>
        {body}
      </section>
    );
  };

  return (
    <div className={STYLES.layout}>
      <header className={STYLES.titleBlock}>
        <div className={STYLES.titleCell}>
          <h1 className={STYLES.title}>Fleet planner</h1>
          <button type="button" className={STYLES.link} onClick={onClose}>
            Back to the matrix
          </button>
        </div>
        <div className={STYLES.cell}>
          <span className={STYLES.cellLabel}>Store credit</span>
          {credit !== null && (
            <span className={STYLES.count}>{usd(credit.amount)}</span>
          )}
          {credit === null && !error && <span>Loading…</span>}
          {error && (
            <span className={STYLES.note} role="alert">
              {error}
            </span>
          )}
        </div>
        <fieldset className={STYLES.cell}>
          <legend className={STYLES.cellLabel}>Pay with</legend>
          {Object.entries(FUNDING_LABELS).map(([mode, label]) => (
            <label key={mode} className={STYLES.option}>
              <input
                type="radio"
                name="funding"
                checked={plan.funding === mode}
                onChange={() =>
                  update((current) => ({
                    ...current,
                    funding: mode as FundingMode,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className={STYLES.cell}>
          <button
            type="button"
            className={STYLES.plan}
            onClick={runPlan}
            disabled={
              pledges === null ||
              credit === null ||
              store === null ||
              upgrades === null ||
              plan.wants.length === 0
            }
          >
            Plan
          </button>
          <span className={STYLES.note}>
            Melts, standalone purchases and upgrade chains.
          </span>
          {offersLoading && (
            <span className={STYLES.note}>Loading offers…</span>
          )}
          {offersError && (
            <span className={STYLES.note} role="alert">
              {offersError}
            </span>
          )}
        </div>
      </header>
      <main className={STYLES.workspace}>
        <div className={STYLES.hangar}>
          <div className={STYLES.toolbar}>
            <label className={STYLES.option}>
              <input
                type="checkbox"
                checked={listOptions.hideWorthless}
                onChange={(event) =>
                  setListOptions({
                    ...listOptions,
                    hideWorthless: event.target.checked,
                  })
                }
              />
              Hide $0 melt value
            </label>
            <label className={STYLES.option}>
              Sort by
              <select
                value={listOptions.sort}
                onChange={(event) =>
                  setListOptions({
                    ...listOptions,
                    sort: event.target.value as PledgeSort,
                  })
                }
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={STYLES.option}>
              Group by
              <select
                value={listOptions.group}
                onChange={(event) =>
                  setListOptions({
                    ...listOptions,
                    group: event.target.value as PledgeGrouping,
                  })
                }
              >
                {Object.entries(GROUP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {renderGroup('group-trade-in', 'Trade in', true)}
          {renderGroup('group-keep', 'Keep', false)}
        </div>
        <div className={STYLES.planColumn}>
          <section className={STYLES.group} aria-labelledby="group-want">
            <header className={STYLES.groupHeader}>
              <h2 id="group-want" className={STYLES.groupTitle}>
                Want
              </h2>
              <span className={STYLES.groupMeta}>
                {plan.wants.length} ships
              </span>
            </header>
            <form
              className={STYLES.search}
              onSubmit={(event) => {
                event.preventDefault();
                addWant();
              }}
            >
              <input
                type="search"
                list="planner-ships"
                aria-label="Ship to add"
                placeholder="Search ships"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <datalist id="planner-ships">
                {ships.map((ship) => (
                  <option key={ship.id} value={ship.name} />
                ))}
              </datalist>
              <button type="submit" className={STYLES.link} disabled={!match}>
                Add
              </button>
            </form>
            {plan.wants.length === 0 ? (
              <p className={STYLES.empty}>Add the ships you want to own.</p>
            ) : (
              <ul className={STYLES.list}>
                {plan.wants.map((want) => (
                  <li key={want.key} className={STYLES.row}>
                    <span className={STYLES.name}>
                      {shipNames.get(want.shipId) ?? `Ship ${want.shipId}`}
                    </span>
                    <select
                      aria-label="Minimum insurance"
                      value={want.insurance}
                      onChange={(event) =>
                        setWantInsurance(
                          want.key,
                          INSURANCE_MINIMUMS.find(
                            (value) => String(value) === event.target.value,
                          ) ?? 'any',
                        )
                      }
                    >
                      {INSURANCE_MINIMUMS.map((value) => (
                        <option key={value} value={value}>
                          {INSURANCE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={STYLES.link}
                      onClick={() => removeWant(want.key)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {result && store && (
            <PlanView
              plan={result}
              ships={ships}
              pledges={pledges ?? []}
              offers={store.standalone}
            />
          )}
        </div>
      </main>
    </div>
  );
};
