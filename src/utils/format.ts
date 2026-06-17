export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function percent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / total) * 100));
}
