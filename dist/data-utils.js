// Pure data helpers: CSV parsing, calendar arithmetic, derived metrics and
// range summaries. No DOM access, so everything here is unit-testable.

export const SERIES_IDS = ['WPU08', 'WPU101', 'WPU133'];

const MONTH_START = /^\d{4}-(0[1-9]|1[0-2])-01$/;

// Parse a FRED CSV (observation_date,SERIES). Rows with FRED's "." missing
// marker, non-numeric or non-positive values, or malformed dates are dropped
// and counted. Duplicate months keep the last valid observation.
export function parseCSV(text) {
  const map = new Map();
  let dropped = 0;
  let duplicates = 0;
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, raw] = line.split(',');
    const value = Number(raw);
    if (!MONTH_START.test(date) || !raw?.trim() || !Number.isFinite(value) || value <= 0) {
      dropped++;
      continue;
    }
    const month = date.slice(0, 7);
    if (map.has(month)) duplicates++;
    map.set(month, { date: month, value });
  }
  const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows, dropped, duplicates };
}

// Identify which of the three series a FRED CSV holds from its header.
export function identifyCSV(text) {
  const header = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)[0]
    .split(',')
    .map((s) => s.trim().replace(/^"|"$/g, ''));
  const id = header[1];
  const dateHeaders = ['observation_date', 'DATE', 'date'];
  if (header.length !== 2 || !dateHeaders.includes(header[0]) || !SERIES_IDS.includes(id)) {
    throw Error('Use a FRED CSV with an observation_date and WPU08, WPU101, or WPU133 column.');
  }
  if (parseCSV(text).rows.length < 13) {
    throw Error(id + ': at least 13 valid monthly observations are required.');
  }
  return id;
}

// "2024-01" shifted by delta months, as "YYYY-MM".
export function shiftMonth(date, delta) {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

// Whole months from one "YYYY-MM" to another.
export function monthDistance(from, to) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + tm - fm;
}

// Sample standard deviation (n - 1). Null if fewer than two values or any gap.
export function sampleDeviation(values) {
  if (values.length < 2 || values.some((v) => v == null || !Number.isFinite(v))) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1));
}

// Add month-over-month, year-over-year and rolling 12-month volatility to each
// row. Lookups are by exact calendar month, so a missing month never shifts
// the comparison. Volatility is the sample SD of the trailing 12 monthly
// percent changes, in percentage points, and is null unless all 12 exist.
export function derive(rows) {
  const index = new Map(rows.map((r) => [r.date, r.value]));
  const change = new Map(
    rows.map((r) => {
      const previous = index.get(shiftMonth(r.date, -1));
      return [r.date, previous ? 100 * (r.value / previous - 1) : null];
    }),
  );
  return rows.map((r) => {
    const yearAgo = index.get(shiftMonth(r.date, -12));
    const window = Array.from({ length: 12 }, (_, i) => change.get(shiftMonth(r.date, -i)));
    return {
      ...r,
      index: r.value,
      mom: change.get(r.date),
      yoy: yearAgo ? 100 * (r.value / yearAgo - 1) : null,
      vol: window.every((v) => v != null) ? sampleDeviation(window) : null,
    };
  });
}

// Fill calendar gaps with null rows so charts show a visible break.
export function completeMonths(rows) {
  if (!rows.length) return [];
  const map = new Map(rows.map((r) => [r.date, r]));
  const result = [];
  for (let d = rows[0].date; d <= rows.at(-1).date; d = shiftMonth(d, 1)) {
    result.push(map.get(d) || { date: d, index: null, mom: null, yoy: null, vol: null });
  }
  return result;
}

// Slice a derived, gap-filled history to [from, to] and summarise it.
// Per-row metrics keep their full-history definitions (12-month lookbacks are
// computed before filtering); the summary describes the selection as a whole.
export function summarizeRange(history, from, to) {
  const months = monthDistance(from, to) + 1;
  if (months < 1) throw Error('Invalid date range');
  const rows = history.filter((r) => r.date >= from && r.date <= to);
  const valid = rows.filter((r) => r.index != null);
  const first = valid[0] ?? null;
  const last = valid.at(-1) ?? null;
  let high = null;
  let low = null;
  for (const r of valid) {
    if (!high || r.index > high.index) high = r;
    if (!low || r.index < low.index) low = r;
  }
  const changes = rows.map((r) => r.mom);
  const complete = rows.length === months && changes.every((v) => v != null);
  return {
    rows,
    months,
    first,
    last,
    high: high && { date: high.date, index: high.index },
    low: low && { date: low.date, index: low.index },
    rangeChange: first && last && first !== last ? 100 * (last.index / first.index - 1) : null,
    rangeVolatility: complete ? sampleDeviation(changes) : null,
    returnCount: changes.filter((v) => v != null).length,
  };
}
