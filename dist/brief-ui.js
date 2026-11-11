// Purchasing-brief dialog. Runs after the offline dashboard is ready and uses
// its globals ($, datasets, material, materials, validate, downloadFile) plus
// the brief-core and data-utils functions, all joined by build.mjs.

let briefAbort = null;
let briefEpoch = 0;
let briefHistory = [];
let briefHistoryContext = '';
let lastBrief = '';
const briefDialog = $('briefDialog');

function briefContext() {
  const summary = summarizeRange(datasets[material], $('from').value, $('to').value);
  return buildBriefContext({
    material: materials[material],
    series: material,
    from: $('from').value,
    to: $('to').value,
    summary,
    budget: $('briefBudget').value.trim() ? Number($('briefBudget').value) : null,
    buyBy: $('briefDate').value,
    notes: $('briefNotes').value.trim(),
  });
}

function showBriefContext() {
  const ready = !!datasets[material] && $('from').value && $('to').value;
  $('briefSelection').textContent = ready
    ? materials[material] + ' · ' + $('from').value + ' → ' + $('to').value
    : 'Load a valid chart range first.';
  try {
    const c = briefContext();
    $('briefPreview').textContent = JSON.stringify(c, null, 2);
    $('briefCount').textContent =
      `${c.observations} selected months are summarised; the latest ${c.recentHistory.length} are listed in full. ` +
      'Your project details and conversation are sent with them.';
  } catch (error) {
    $('briefPreview').textContent = error.message;
    $('briefCount').textContent = error.message;
  }
  $('briefNetwork').textContent =
    navigator.onLine === false
      ? 'Offline · charts work; connect to generate a brief.'
      : 'Online AI · Gemini API key required';
}

function openBrief() {
  showBriefContext();
  briefDialog.showModal();
  ($('briefKey').value ? $('briefQuestion') : $('briefKey')).focus();
}

$('buildBrief').onclick = openBrief;
for (const id of ['briefBudget', 'briefDate', 'briefNotes']) $(id).oninput = showBriefContext;
window.addEventListener('materialdesk:context', () => {
  if (briefDialog.open) showBriefContext();
});
window.addEventListener('online', showBriefContext);
window.addEventListener('offline', showBriefContext);

function setBriefBusy(busy) {
  $('briefGenerate').disabled = busy;
  for (const id of ['briefModel', 'briefKey', 'briefBudget', 'briefDate', 'briefNotes', 'briefQuestion'])
    $(id).disabled = busy;
  $('briefCancel').hidden = !busy;
}

briefDialog.addEventListener('close', () => briefAbort?.abort());
$('briefCancel').onclick = () => briefAbort?.abort();

function clearBriefSession(message) {
  briefEpoch++;
  briefAbort?.abort();
  $('briefKey').value = '';
  briefHistory = [];
  briefHistoryContext = '';
  lastBrief = '';
  $('briefMessages').replaceChildren();
  $('briefDownload').disabled = true;
  if (message) $('briefStatus').textContent = message;
}

$('briefForget').onclick = () => {
  clearBriefSession('Key and brief cleared.');
  $('briefKey').focus();
};

function appendBriefMessage(label, text) {
  const section = document.createElement('section');
  section.className = 'brief-message';
  const title = document.createElement('h3');
  title.textContent = label;
  const body = document.createElement('div');
  body.className = 'brief-text';
  body.textContent = text;
  section.append(title, body);
  $('briefMessages').append(section);
  return section;
}

// Figures in the reply that are not in the data sent are listed under the
// brief so the reader checks them before relying on them.
function appendGroundingWarning(section, unmatched) {
  if (!unmatched.length) return;
  const warning = document.createElement('p');
  warning.className = 'range-error';
  warning.textContent =
    'Check before relying on these figures; they do not appear in the data sent: ' + unmatched.join(', ');
  section.append(warning);
}

$('briefDownload').onclick = () => {
  if (lastBrief) downloadFile('Material Desk purchasing brief.txt', lastBrief, 'text/plain');
};

$('briefForm').onsubmit = async (event) => {
  event.preventDefault();
  if (briefAbort) return;
  const status = $('briefStatus');
  status.textContent = '';
  if (!validate()) {
    status.textContent = 'Correct the chart date range before generating a brief.';
    return;
  }
  if (!$('briefKey').value.trim()) {
    status.textContent = 'Enter your Gemini API key. The charts do not require a key.';
    $('briefKey').focus();
    return;
  }
  if (navigator.onLine === false) {
    status.textContent = 'You are offline. Connect to generate a brief; all charts remain available.';
    return;
  }
  let context;
  try {
    context = briefContext();
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  const question =
    $('briefQuestion').value.trim() ||
    'Build a purchasing brief for this material and project. Ask for missing constraints before recommending a purchase schedule.';
  const signature = JSON.stringify(context);
  const prior = briefHistoryContext === signature ? briefHistory : [];
  const messages = [...prior, { role: 'user', text: question }].slice(-7);
  const epoch = briefEpoch;
  const abort = new AbortController();
  briefAbort = abort;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, 90000);
  setBriefBusy(true);
  status.textContent = 'Sending the previewed context directly to Gemini…';
  try {
    const result = await requestBrief(
      { key: $('briefKey').value, model: $('briefModel').value.trim(), context, messages },
      { signal: abort.signal },
    );
    if (epoch !== briefEpoch) return;
    const contextLabel = context.material + ' · ' + context.selectedRange.from + ' → ' + context.selectedRange.to;
    appendBriefMessage('Your request · ' + contextLabel, question);
    const reply = appendBriefMessage('Gemini brief · ' + contextLabel, result.text);
    const grounding = checkGrounding(result.text, context);
    appendGroundingWarning(reply, grounding.unmatched);
    briefHistory = [...messages, { role: 'model', text: result.text }].slice(-6);
    briefHistoryContext = signature;
    lastBrief =
      'MATERIAL DESK / PURCHASING BRIEF\n' +
      contextLabel +
      '\nSource: ' +
      context.source +
      '\nGenerated: ' +
      new Date().toISOString() +
      '\nModel: ' +
      $('briefModel').value.trim() +
      '\n\n' +
      result.text +
      (grounding.unmatched.length ? '\n\nFigures not found in the data sent: ' + grounding.unmatched.join(', ') : '') +
      '\n\nHistorical context, not a forecast. Review illustrative contract wording with a qualified professional.';
    $('briefDownload').disabled = false;
    $('briefQuestion').value = '';
    status.textContent = result.truncated
      ? 'The model reached its output limit. Ask a follow-up to continue.'
      : 'Brief ready. Review its sources and assumptions. Project or chart changes start a fresh AI context.';
    reply.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (error) {
    if (epoch !== briefEpoch) return;
    status.textContent =
      error.name === 'AbortError'
        ? timedOut
          ? 'Request timed out. Please retry.'
          : 'Request cancelled.'
        : error.message;
  } finally {
    clearTimeout(timer);
    if (briefAbort === abort) briefAbort = null;
    setBriefBusy(false);
  }
};

window.addEventListener('pagehide', () => clearBriefSession(''));

$('buildBrief').disabled = !datasets[material];
$('briefModel').value = DEFAULT_BRIEF_MODEL;
