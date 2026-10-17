import type { Pledge } from '../hangar/hangar';
import type { StandaloneOffer } from '../store/store-offers';
import type { Plan, PlanStep } from './plan';
import STYLES from './plan-view.module.scss';
import { pledgeTitle } from './pledge-list';

type Props = {
  plan: Plan;
  ships: { id: number; name: string }[];
  pledges: Pledge[];
  offers: StandaloneOffer[];
};

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const insuranceLabel = (
  insurance: StandaloneOffer['insurance'] | undefined,
) => {
  if (insurance === null || insurance === undefined) {
    return 'Insurance unknown';
  }

  return insurance === 'lti' ? 'LTI' : `${insurance} months insurance`;
};

export const PlanView = ({ plan, ships, pledges, offers }: Props) => {
  const shipNames = new Map(ships.map((ship) => [ship.id, ship.name]));
  const pledgeDescriptions = new Map(
    pledges.map((pledge) => {
      const contents = pledge.hasAppliedUpgrades
        ? ''
        : `: ${pledge.ships.map((ship) => ship.name).join(', ') || 'No ships'}`;

      return [
        pledge.id,
        `${pledgeTitle(pledge)}${contents} (${insuranceLabel(pledge.insurance)})`,
      ];
    }),
  );
  const offersBySku = new Map(offers.map((offer) => [offer.skuId, offer]));
  const shipName = (id: number) => shipNames.get(id) ?? `Ship ${id}`;
  const pledgeInsurance = new Map(
    pledges.map((pledge) => [pledge.id, pledge.insurance]),
  );
  const pledgeLabels = new Map(
    pledges.map((pledge) => [pledge.id, `pledge ${pledge.id}`]),
  );

  for (const step of plan.steps) {
    if (step.kind === 'buy-standalone' && step.pledgeId) {
      pledgeInsurance.set(
        step.pledgeId,
        offersBySku.get(step.skuId)?.insurance ?? null,
      );
      pledgeLabels.set(step.pledgeId, step.pledgeId);
    }
  }

  const renderStep = (step: PlanStep) => {
    if (step.kind === 'melt') {
      return (
        <>
          Melt {pledgeDescriptions.get(step.pledgeId) ?? step.pledgeId} for{' '}
          {usd(step.credit)} in store credit.
        </>
      );
    }

    if (step.kind === 'buy-standalone') {
      const offer = offersBySku.get(step.skuId);

      return (
        <>
          Buy {shipName(step.shipId)} (
          {offer?.warbond ? 'warbond' : 'standard edition'},{' '}
          {insuranceLabel(offer?.insurance)})
          {step.pledgeId && ` as ${step.pledgeId}`}: pay {usd(step.credit)}{' '}
          store credit and {usd(step.newMoney)} new money.
          {step.note && <p>{step.note}</p>}
        </>
      );
    }

    const insurance = insuranceLabel(pledgeInsurance.get(step.pledgeId));
    const pledgeLabel =
      pledgeLabels.get(step.pledgeId) ?? `pledge ${step.pledgeId}`;
    const edition = step.warbond ? 'warbond' : 'standard';

    if (step.kind === 'buy-upgrade') {
      return (
        <>
          Buy a {edition} upgrade from {shipName(step.fromShipId)} ({insurance})
          to {shipName(step.toShipId)} for {pledgeLabel} (keeps {insurance}):
          pay {usd(step.credit)} store credit and {usd(step.newMoney)} new
          money.
        </>
      );
    }

    return (
      <>
        Upgrade {shipName(step.fromShipId)} ({insurance}) to{' '}
        {shipName(step.toShipId)} with the {edition} upgrade on {pledgeLabel}.
        Keep {insurance}.
      </>
    );
  };

  return (
    <section
      className={STYLES.result}
      aria-labelledby="plan-title"
      aria-live="polite"
    >
      <h2 id="plan-title">Your plan</h2>
      <p>
        Melts, standalone purchases and upgrade chains. This plan takes no
        action on your account.
      </p>
      {plan.steps.length === 0 ? (
        <p>No steps available.</p>
      ) : (
        <ol className={STYLES.steps}>
          {plan.steps.map((step, index) => (
            <li key={index}>{renderStep(step)}</li>
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
