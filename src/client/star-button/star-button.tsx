import STYLES from './star-button.module.scss';

type Props = {
  pressed: boolean;
  label: string;
  title: string;
  onClick: () => void;
};

export const StarButton = ({ pressed, label, title, onClick }: Props) => (
  <button
    type="button"
    className={STYLES.button}
    aria-label={label}
    aria-pressed={pressed}
    title={title}
    onClick={onClick}
  >
    <span aria-hidden="true">{pressed ? '★' : '☆'}</span>
  </button>
);
