import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseCSV, derive, shiftMonth, completeMonths, identifyCSV, summarizeRange } from './dist/data-utils.js';
import { createView, closeView, readWorkspace } from './dist/workspace.js';
import { buildPortableCopy } from './dist/portable.js';

const SERIES = ['WPU08', 'WPU101', 'WPU133'];

// A series that rises by i percent in month i, so every derived value is known.
function rampSeries(months) {
  let value = 100;
  const rows = [{ date: '2023-01', value }];
  for (let i = 1; i < months; i++) {
    value *= 1 + i / 100;
    rows.push({ date: shiftMonth('2023-01', i), value });
  }
  return rows;
}

// ---------------------------------------------------------------- loading --

test('CSV excludes missing, invalid and zero; sorts and resolves duplicates', () => {
  const p = parseCSV(
    'date,value\n2024-02-01,110\n2024-01-01,100\n2024-02-01,120\n2024-03-01,.\n2024-13-01,40\n2024-04-01,0',
  );
  assert.deepEqual(p.rows, [
    { date: '2024-01', value: 100 },
    { date: '2024-02', value: 120 },
  ]);
  assert.equal(p.duplicates, 1);
  assert.equal(p.dropped, 3);
});

test('CSV imports reject wrong series and malformed input', () => {
  assert.throws(() => identifyCSV('date,unknown\n2024-01-01,1'));
  assert.throws(() => identifyCSV('observation_date,WPU08\n2024-01-01,1'));
  assert.equal(identifyCSV(fs.readFileSync('dist/data/WPU101.csv', 'utf8')), 'WPU101');
});

// ---------------------------------------------------------------- metrics --

test('exact calendar lags and complete rolling windows', () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({ date: shiftMonth('2023-01', i), value: 100 * 1.01 ** i }));
  const d = derive(rows);
  assert.ok(Math.abs(d[12].yoy - 100 * (1.01 ** 12 - 1)) < 1e-8);
  assert.equal(d[11].vol, null);
  assert.ok(d[12].vol < 1e-10);
  const gap = derive(rows.filter((_, i) => i !== 5));
  assert.equal(gap.find((r) => r.date === '2023-07').mom, null);
  assert.equal(gap.at(-1).vol, null);
});

test('known sample standard deviation', () => {
  // Monthly changes 1..12 have a sample SD of sqrt(13).
  assert.ok(Math.abs(derive(rampSeries(13)).at(-1).vol - Math.sqrt(13)) < 1e-8);
});

test('hand-checked lumber figures from the bundled CSV', () => {
  const history = derive(parseCSV(fs.readFileSync('dist/data/WPU08.csv', 'utf8')).rows);
  const may21 = history.find((r) => r.date === '2021-05');
  assert.ok(Math.abs(may21.mom - 100 * (358.0 / 326.1 - 1)) < 1e-9);
  assert.ok(Math.abs(may21.yoy - 100 * (358.0 / 237.7 - 1)) < 1e-9);
});

// ------------------------------------------------------------------ range --

test('short selections keep true year-over-year and 12-month volatility', () => {
  const history = derive(rampSeries(16));
  const summary = summarizeRange(history, '2024-02', '2024-04');
  assert.equal(summary.months, 3);
  for (const row of summary.rows) {
    const full = history.find((r) => r.date === row.date);
    assert.equal(row.yoy, full.yoy);
    assert.equal(row.vol, full.vol);
  }
  assert.ok(Math.abs(summary.rangeVolatility - 1) < 1e-9, 'SD of changes 14, 15, 16 is 1');
});

test('range summary reports high, low, start-to-end change and range volatility', () => {
  const history = derive([
    { date: '2024-01', value: 100 },
    { date: '2024-02', value: 110 },
    { date: '2024-03', value: 99 },
    { date: '2024-04', value: 120 },
  ]);
  const s = summarizeRange(history, '2024-01', '2024-04');
  assert.deepEqual(s.high, { date: '2024-04', index: 120 });
  assert.deepEqual(s.low, { date: '2024-03', index: 99 });
  assert.ok(Math.abs(s.rangeChange - 20) < 1e-9);
  assert.equal(s.rangeVolatility, null, 'first month has no monthly change, so the run is incomplete');
  assert.ok(summarizeRange(history, '2024-02', '2024-04').rangeVolatility > 0);
  const one = summarizeRange(history, '2024-03', '2024-03');
  assert.equal(one.months, 1);
  assert.equal(one.rangeChange, null);
});

test('missing selected months leave gaps and block range volatility', () => {
  const input = Array.from({ length: 18 }, (_, i) => ({ date: shiftMonth('2023-01', i), value: 100 + i })).filter(
    (r) => r.date !== '2024-05',
  );
  const s = summarizeRange(completeMonths(derive(input)), '2024-04', '2024-06');
  assert.equal(s.rows[1].index, null);
  assert.equal(s.rangeVolatility, null);
  assert.equal(s.last.vol, null);
});

test('headline figures for the latest month are identical across 1Y/5Y/10Y on real data', () => {
  for (const id of SERIES) {
    const history = completeMonths(derive(parseCSV(fs.readFileSync('dist/data/' + id + '.csv', 'utf8')).rows));
    const end = history.at(-1).date;
    const ranges = [1, 5, 10].map((y) => summarizeRange(history, shiftMonth(end, -12 * y + 1), end));
    assert.deepEqual(
      ranges.map((r) => r.months),
      [12, 60, 120],
    );
    for (const key of ['index', 'mom', 'yoy', 'vol']) {
      assert.equal(new Set(ranges.map((r) => r.last[key])).size, 1, id + ' latest ' + key);
    }
    assert.equal(new Set(ranges.map((r) => r.rangeChange.toFixed(6))).size, 3);
  }
});

// -------------------------------------------------------------- workspace --

test('views clone zoom independently and close selects nearest neighbour', () => {
  const a = createView('a', '2020-01', '2024-12', { zoom: { index: { start: 15, end: 80 } } });
  const b = createView('b', a.from, a.to, a);
  b.zoom.index.start = 40;
  assert.equal(a.zoom.index.start, 15);
  const group = closeView({ tabs: [a, b], active: 'b' }, 'b', () => createView('c', a.from, a.to));
  assert.equal(group.active, 'a');
  const last = closeView(group, 'a', () => createView('c', a.from, a.to));
  assert.equal(last.tabs.length, 1);
  assert.equal(last.active, 'c');
});

test('closing a background view preserves active view', () => {
  const tabs = ['a', 'b', 'c'].map((id) => createView(id, '2020-01', '2024-12'));
  const g = closeView({ tabs, active: 'c' }, 'a', () => null);
  assert.equal(g.active, 'c');
  assert.equal(g.tabs.length, 2);
});

test('saved workspace validates ranges, duplicate IDs and zoom', () => {
  const groups = Object.fromEntries(
    SERIES.map((id) => [
      id,
      { active: 'a', tabs: [createView('a', '2020-01', '2024-12', { zoom: { index: { start: 20, end: 90 } } })] },
    ]),
  );
  const raw = () => JSON.stringify({ version: 1, groups });
  assert.equal(readWorkspace(raw()).WPU08.tabs[0].zoom.index.start, 20);
  groups.WPU08.tabs[0].to = '2019-12';
  assert.equal(readWorkspace(raw()), null);
  groups.WPU08.tabs[0].to = '2024-12';
  groups.WPU08.tabs.push(groups.WPU08.tabs[0]);
  assert.equal(readWorkspace(raw()), null);
  assert.equal(readWorkspace('invalid'), null);
});

// -------------------------------------------------------------- packaging --

test('portable copy embeds only data and labels, escaped for inline script', () => {
  const html = buildPortableCopy({
    template: '<html><head><!--styles--></head><body><!--scripts--></body></html>',
    styleHtml: '<style>s</style>',
    vendorHtml: '<script id="vendor-script">v</script>',
    templateDataHtml: '<script id="template-data" type="application/json">"t"</script>',
    runtimeHtml: '<script id="runtime-script">r</script>',
    csv: { WPU08: 'observation_date,WPU08\n2024-01-01,1' },
    labels: { WPU08: 'Imported <safe>' },
  });
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 4);
  const data = JSON.parse(scripts.find((s) => s[1].includes('embedded-data'))[2]);
  assert.equal(data.labels.WPU08, 'Imported <safe>');
  assert.ok(!html.includes('<safe>'), 'angle brackets are escaped inside the JSON script');
});

test('built HTML is self-contained: no network, server, modules or external assets', () => {
  const html = fs.readFileSync('portable/Material Desk.html', 'utf8');
  assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html));
  assert.ok(!/<link\b[^>]*\brel="stylesheet"/i.test(html));
  assert.ok(!/@import\s+url/i.test(html));
  assert.ok(!/type="module"/.test(html));
  assert.ok(!/fetch\(/.test(fs.readFileSync('dist/app.js', 'utf8')), 'charts never call the network');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 4);
  for (const s of scripts) if (!s[1].includes('application/json')) new vm.Script(s[2]);
  const data = JSON.parse(scripts.find((s) => s[1].includes('embedded-data'))[2]);
  for (const id of SERIES) assert.equal(identifyCSV(data.csv[id]), id);
  assert.equal(fs.readFileSync('dist/index.html', 'utf8'), html);
  assert.ok(!html.includes('SESSION'), 'no session material is ever written at build time');
});
