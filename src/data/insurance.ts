export type InsuranceTier = number | 'lti';

export const parseInsuranceTier = (title: string): InsuranceTier | null => {
  const normalized = title.trim();

  if (/^lifetime insurance$/i.test(normalized)) {
    return 'lti';
  }

  const match = /^(\d+)\s+months?\s+insurance$/i.exec(normalized);

  if (!match) {
    return null;
  }

  const months = Number(match[1]);

  return Number.isSafeInteger(months) && months > 0 ? months : null;
};

export const compareInsuranceTiers = (
  left: InsuranceTier,
  right: InsuranceTier,
) => {
  if (left === right) {
    return 0;
  }

  if (left === 'lti') {
    return 1;
  }

  if (right === 'lti') {
    return -1;
  }

  return left < right ? -1 : 1;
};
