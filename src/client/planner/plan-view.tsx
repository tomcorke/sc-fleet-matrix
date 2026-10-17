import { useEffect, useRef } from 'react';

import type { Pledge } from '../hangar/hangar';
import type { StandaloneOffer } from '../store/store-offers';
import type { Plan } from './plan';
import STYLES from './plan-view.module.scss';

type Props = {
  plan: Plan;
  ships: { id: number; name: string }[];
  pledges: Pledge[];
  offers: StandaloneOffer[];
};

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const PlanView = ({ plan, ships, pledges, offers }: Props) => {
  const result = useRef<HTMLElement>(null);

  useEffect(() => {
    result.current?.focus();
  }, [plan]);

  const shipNames = new Map(ships.map((ship) => [ship.id, ship.name]));
  const pledgeNames = new Map(
    pledges.map((pledge) => [pledge.id, pledge.name]),
  );
  const shipName = (id: number) => shipNames.get(id) ?? `Ship ${id}`;

  return (
    <section
      ref={result}
      tabIndex={-1}
      className={STYLES.result}
      aria-labelledby="plan-title"
      aria-live="polite"
    >
      <h2 id="plan-title">Your plan</h2>
      <p>
        Melts and standalone purchases only. This plan takes no action on your
        account.
      </p>
      {plan.steps.length === 0 ? (
        <p>No steps available.</p>
      ) : (
        <ol className={STYLES.steps}>
          {plan.steps.map((step, index) => (
            <li key={index}>
              {step.kind === 'melt' ? (
                <>
                  Melt {pledgeNames.get(step.pledgeId) ?? step.pledgeId} for{' '}
                  {usd(step.credit)} in store credit.
                </>
              ) : (
                <>
                  Buy {shipName(step.shipId)} (
                  {offers.find((offer) => offer.skuId === step.skuId)?.warbond
                    ? 'warbond'
                    : 'standard edition'}
                  ): pay {usd(step.credit)} store credit and{' '}
                  {usd(step.newMoney)} new money.
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      <dl className={STYLES.totals}>
        <div>
          <dt>New money</dt>
          <dd>{usd(plan.totals.newMoney)}</dd>
        </div>
        <div>
          <dt>Credit used</dt>
          <dd>{usd(plan.totals.creditUsed)}</dd>
        </div>
        <div>
          <dt>Credit left</dt>
          <dd>{usd(plan.totals.creditLeft)}</dd>
        </div>
      </dl>
      {plan.unmet.length > 0 && (
        <>
          <h3>Unmet wants</h3>
          <ul>
            {plan.unmet.map((want, index) => (
              <li key={index}>
                {shipName(want.shipId)}: {want.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Before you act</h3>
      <ul>
        {plan.warnings.map((warning, index) => (
          <li key={index}>{warning}</li>
        ))}
      </ul>
    </section>
  );
};
