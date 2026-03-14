/** Shared helpers for mock API data generation */

export const now = new Date('2025-12-31T12:00:00Z');

export function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export function genDates2025(intervalDays = 7): string[] {
  const result: string[] = [];
  const start = new Date('2025-01-01T00:00:00Z');
  const end = new Date('2025-12-31T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + intervalDays)) {
    result.push(toISODate(d));
  }
  return result;
}

export function sortByDateDesc<T>(arr: T[], getDate: (x: T) => string | Date): T[] {
  return arr.sort((a, b) => new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime());
}

export function parseQsParams(url: string): Record<string, string> {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return {};
  const query = url.substring(qIndex + 1);
  const out: Record<string, string> = {};
  query.split('&').filter(Boolean).forEach((p) => {
    const [k, v] = p.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return out;
}

export type MockHelpers = {
  now: Date;
  getRandomItem: <T>(arr: T[]) => T;
  toISODate: (d: Date) => string;
  genDates2025: (intervalDays?: number) => string[];
  sortByDateDesc: <T>(arr: T[], getDate: (x: T) => string | Date) => T[];
  parseQsParams: (url: string) => Record<string, string>;
};
