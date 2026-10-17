import type { StandaloneOffer } from './store-offers';
import STYLES from './store-offers-cell.module.scss';

type Props = {
  shipId: number;
  offers: StandaloneOffer[] | undefined;
  hint: string;
};

const insuranceLabel = (insurance: StandaloneOffer['insurance']) => {
  if (insurance === null) {
    return 'Insurance unknown';
  }

  return insurance === 'lti' ? 'LTI' : `${insurance} months`;
};

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const StoreOffersCell = ({ shipId, offers, hint }: Props) => {
  if (!offers) {
    return <span className={STYLES.note}>{hint}</span>;
  }

  const matching = offers.filter((offer) => offer.shipId === shipId);

  if (matching.length === 0) {
    return <span className={STYLES.note}>Not on sale</span>;
  }

  return (
    <ul className={STYLES.offers}>
      {matching.map((offer) => (
        <li key={offer.skuId}>
          <span className={offer.warbond ? STYLES.warbond : undefined}>
            {offer.warbond ? 'Warbond' : 'Standard'}{' '}
            {usd.format(offer.price / 100)}
          </span>
          {' — '}
          {insuranceLabel(offer.insurance)}
          {offer.warbond && (
            <span className={STYLES.note}> (new money only)</span>
          )}
          {!offer.available && <strong> — Unavailable</strong>}
        </li>
      ))}
    </ul>
  );
};
