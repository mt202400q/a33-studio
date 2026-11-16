/**
 * a33.club balances and charges are in yuan: top-ups are paid in CNY and credited 1:1 by default,
 * and the a33.club web console shows every amount with ¥.
 */
export function cnyFormatter(locale: string, fractionDigits = 2): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })
}

/** Small per-request costs need more than two decimals to be meaningful. */
export function formatCost(locale: string, value: number): string {
  return cnyFormatter(locale, Math.abs(value) >= 1 || value === 0 ? 2 : 4).format(value)
}
