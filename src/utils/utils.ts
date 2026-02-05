import { I18N } from 'astrowind:config';

export const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(I18N?.language, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const getFormattedDate = (date: Date): string => (date ? formatter.format(date) : '');

export const trim = (str = '', ch?: string) => {
  if (ch === undefined) {
    return str.trim();
  }
  const pattern = new RegExp(`^[${ch}]+|[${ch}]+$`, 'g');
  return str.replace(pattern, '');
};

// Format a number with K/M/B suffix for display
export const toUiAmount = (amount: number): string | number => {
  if (!amount) return 0;

  const denominations = [
    { value: 1_000_000_000, symbol: 'B' },
    { value: 1_000_000, symbol: 'M' },
    { value: 1_000, symbol: 'K' },
  ];

  for (const denom of denominations) {
    if (amount >= denom.value) {
      const formattedNumber = (amount / denom.value).toFixed(1);
      return Number(formattedNumber) === parseInt(formattedNumber, 10)
        ? parseInt(formattedNumber, 10) + denom.symbol
        : formattedNumber + denom.symbol;
    }
  }

  return amount.toFixed(0);
};
