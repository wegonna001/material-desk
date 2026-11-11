import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { derive, shiftMonth, summarizeRange } from './dist/data-utils.js';
import {
  buildBriefContext,
  createBriefRequest,
  requestBrief,
  checkGrounding,
  HISTORY_ROWS_SENT,
} from './dist/brief-core.js';

// Thirty months rising one percent a month, selected in full.
function history() {
  return derive(Array.from({ length: 30 }, (_, i) => ({ date: shiftMonth('2024-01', i), value: 100 * 1.01 ** i })));
}
const FROM = '2024-01';
const TO = '2026-06';

const context = (overrides = {}) =>
  buildBriefContext({
    material: 'Lumber',
    series: 'WPU08',
    from: FROM,
    to: TO,
    summary: summarizeRange(history(), FROM, TO),
    budget: 250000,
    buyBy: '2026-12-01',
    notes: 'Review quote',
    ...overrides,
  });

const input = () => ({
  key: 'TEST-SESSION-KEY',
  model: 'gemini-3.5-flash-lite',
  context: context(),
  messages: [{ role: 'user', text: 'Build a brief' }],
});

test('brief context summarises the range and lists only recent months', () => {
  const c = context();
  assert.equal(c.observations, 30);
  assert.equal(c.recentHistory.length, HISTORY_ROWS_SENT);
  assert.equal(c.recentHistory.at(-1).month, TO);
  assert.equal(c.rangeSummary.low.month, FROM);
  assert.equal(c.rangeSummary.high.month, TO);
  assert.ok(c.historyNote.startsWith('Only the most recent 24 of 30'));
  assert.equal(c.source, 'https://fred.stlouisfed.org/series/WPU08');
  assert.ok(JSON.stringify(c).length < 6000, 'context stays small enough for free-tier limits');
});

test('budget scenarios are computed in code and include two data-derived moves', () => {
  const c = context();
  assert.deepEqual(
    c.budgetScenarios.slice(0, 4).map((s) => s.illustrativeBudgetUSD),
    [225000, 237500, 262500, 275000],
  );
  const labels = c.budgetScenarios.map((s) => s.label);
  assert.ok(labels.some((l) => l.includes('year-over-year')));
  assert.ok(labels.some((l) => l.includes('start-to-end')));
  const yoy = c.budgetScenarios.find((s) => s.label.includes('year-over-year'));
  assert.equal(yoy.indexChangePercent, c.latest.yoyPercent);
  assert.equal(context({ budget: null }).budgetScenarios, null);
  assert.throws(() => context({ budget: -5 }));
  assert.throws(() => context({ summary: { rows: [] } }));
});

test('Gemini request uses fixed HTTPS host and header credentials, with source context', () => {
  const r = createBriefRequest(input());
  assert.ok(r.url.startsWith('https://generativelanguage.googleapis.com/'));
  assert.ok(!r.url.includes('TEST-SESSION-KEY'));
  assert.equal(r.options.headers['x-goog-api-key'], 'TEST-SESSION-KEY');
  assert.equal(r.options.credentials, 'omit');
  const b = JSON.parse(r.options.body);
  assert.ok(b.systemInstruction.parts[0].text.includes('225000'));
  assert.ok(b.systemInstruction.parts[0].text.includes('WPU08'));
  assert.ok(!r.options.body.includes('TEST-SESSION-KEY'));
  assert.throws(() => createBriefRequest({ ...input(), model: 'https://bad.test/steal' }));
  assert.throws(() => createBriefRequest({ ...input(), key: '' }));
});

test('successful generation extracts visible text and reports truncation', async () => {
  const result = await requestBrief(input(), {
    fetchImpl: async () =>
      Response.json({
        candidates: [
          {
            finishReason: 'MAX_TOKENS',
            content: { parts: [{ thought: true, text: 'internal' }, { text: 'Supplier questions' }] },
          },
        ],
      }),
  });
  assert.deepEqual(result, { text: 'Supplier questions', truncated: true });
});

test('provider errors are actionable and never echo keys or upstream bodies', async () => {
  for (const code of [400, 401, 403, 404, 429, 500]) {
    await assert.rejects(
      requestBrief(input(), { fetchImpl: async () => new Response('TEST-SESSION-KEY', { status: code }) }),
      (e) => e.message.includes(String(code)) && !e.message.includes('TEST-SESSION-KEY'),
    );
  }
  await assert.rejects(
    requestBrief(input(), {
      fetchImpl: async () => {
        throw Error('Network');
      },
    }),
    /Charts continue to work offline/,
  );
  await assert.rejects(requestBrief(input(), { fetchImpl: async () => Response.json({ candidates: [] }) }), /no brief/);
});

test('cancellation propagates without disguising it as an API error', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    requestBrief(input(), {
      signal: controller.signal,
      fetchImpl: async (_, opts) => {
        assert.equal(opts.signal, controller.signal);
        throw new DOMException('cancelled', 'AbortError');
      },
    }),
    (e) => e.name === 'AbortError',
  );
});

test('grounding check flags figures absent from the data sent and ignores years and counts', () => {
  const c = context();
  const latest = c.latest.index;
  const text =
    `1. Evidence: WPU08 reached ${latest} in ${TO.slice(0, 4)}, up ${c.latest.yoyPercent}% year over year over the last 12 months. ` +
    `A budget of $250,000 would become $275,000 under a +10% move. Suppliers often quote 7.5% escalation and 3,500 tons.`;
  const result = checkGrounding(text, c);
  assert.deepEqual(result.unmatched, ['7.5%', '3,500']);
  assert.deepEqual(checkGrounding('No figures here, just the 1982=100 base.', c).unmatched, []);
});

test('brief form completes a request, flags ungrounded figures and clears its session', async () => {
  const ids = [
    'from',
    'to',
    'briefDialog',
    'briefBudget',
    'briefDate',
    'briefNotes',
    'briefQuestion',
    'briefSelection',
    'briefPreview',
    'briefCount',
    'briefNetwork',
    'buildBrief',
    'briefModel',
    'briefKey',
    'briefGenerate',
    'briefCancel',
    'briefForget',
    'briefMessages',
    'briefStatus',
    'briefDownload',
    'briefForm',
  ];
  const node = () => ({
    value: '',
    disabled: false,
    hidden: false,
    textContent: '',
    children: [],
    handlers: {},
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
    focus() {},
    showModal() {
      this.open = true;
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren() {
      this.children = [];
    },
    scrollIntoView() {},
  });
  const elements = Object.fromEntries(ids.map((id) => [id, node()]));
  elements.from.value = FROM;
  elements.to.value = TO;
  elements.briefKey.value = 'SESSION-KEY-NOT-TO-SAVE';
  elements.briefBudget.value = '250000';
  let downloaded;
  const sandbox = {
    $: (id) => elements[id],
    document: { createElement: node },
    window: { addEventListener() {} },
    navigator: { onLine: true },
    datasets: { WPU08: history() },
    material: 'WPU08',
    materials: { WPU08: 'Lumber' },
    summarizeRange,
    buildBriefContext,
    checkGrounding,
    DEFAULT_BRIEF_MODEL: 'test-model',
    validate: () => true,
    requestBrief: async (args) => {
      assert.equal(args.key, 'SESSION-KEY-NOT-TO-SAVE');
      assert.ok(args.context.recentHistory.length <= HISTORY_ROWS_SENT);
      return { text: 'Supplier questions and options. Expect 7.5% escalation.', truncated: false };
    },
    downloadFile: (name, text) => (downloaded = { name, text }),
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
  };
  vm.runInNewContext(fs.readFileSync('dist/brief-ui.js', 'utf8'), sandbox);
  elements.buildBrief.onclick();
  assert.ok(elements.briefCount.textContent.includes('30 selected months'));
  await elements.briefForm.onsubmit({ preventDefault() {} });
  assert.equal(elements.briefMessages.children.length, 2);
  const reply = elements.briefMessages.children[1];
  assert.ok(
    reply.children.some((c) => c.className === 'range-error' && c.textContent.includes('7.5%')),
    'ungrounded figure is flagged',
  );
  assert.equal(elements.briefDownload.disabled, false);
  assert.equal(elements.briefGenerate.disabled, false);
  elements.briefDownload.onclick();
  assert.ok(downloaded.text.includes('Supplier questions'));
  assert.ok(downloaded.text.includes('7.5%'));
  assert.ok(!downloaded.text.includes('SESSION-KEY'));
  elements.briefForget.onclick();
  assert.equal(elements.briefKey.value, '');
  assert.equal(elements.briefMessages.children.length, 0);
  assert.equal(elements.briefDownload.disabled, true);
});
