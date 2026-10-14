'use strict';

// Shared helpers, settings, routing, lock screen and the weekly hour bar.

const main = document.getElementById('main');
const H = 3600 * 1000;
const VIEWS = {};
const READERS = ['Office', 'Convenor', 'National Assembly'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const localStamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const today = () => localStamp(new Date()).slice(0, 10);
const fmtDay = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayTime = (d) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const lower = (s) => (s || '').trim().toLowerCase();
const lines = (s) => (s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const wordCount = (...parts) => parts.join(' ').split(/\s+/).filter(Boolean).length;
const byId = (list, id) => list.find((x) => x.id === id);

function addMonths(dateStr, m) {
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00' : dateStr);
  d.setMonth(d.getMonth() + m);
  return localStamp(d).slice(0, 10);
}

// ---------- settings (stored unencrypted: no contact data here) ----------

const CYCLE_MONTHS = 3; // decided by the office
const SETTINGS = { author: '', hour: null, hours: [] };

async function loadSettings() {
  for (const k of Object.keys(SETTINGS)) {
    const s = await DB.get('settings', k);
    if (s) SETTINGS[k] = s.value;
  }
}
async function setSetting(k, value) {
  SETTINGS[k] = value;
  await DB.put('settings', { id: k, value });
}

// ---------- readers (principle 5) ----------

function readerOf(r) {
  return r.readerChoice === 'person' ? (r.readerName || '').trim() : (r.readerChoice || '');
}

function readerFields(r, prompt) {
  return `<fieldset>
    <legend>Reader</legend>
    <p class="hint">${esc(prompt)} A record without a reader cannot be saved.</p>
    <select name="readerChoice">
      <option value="">Choose a reader</option>
      ${READERS.map((x) => `<option ${r.readerChoice === x ? 'selected' : ''}>${x}</option>`).join('')}
      <option value="person" ${r.readerChoice === 'person' ? 'selected' : ''}>A named person</option>
    </select>
    <label class="reader-name">Their name <input type="text" name="readerName" value="${esc(r.readerName)}"></label>
    <label>Written by <input type="text" name="author" value="${esc(r.author)}"></label>
  </fieldset>`;
}

function showReaderName(form, r) {
  form.querySelector('.reader-name').hidden = r.readerChoice !== 'person';
}

// ---------- verification (principle 4) ----------

async function markReopened(store, rec) {
  const previous = rec.lastReopened || null;
  rec.lastReopened = new Date().toISOString();
  await DB.put(store, rec);
  return previous;
}

function reopenedLine(rec, previous) {
  return previous ? `Last reopened before this reading: ${fmtDayTime(previous)}.` : 'Not reopened since it was saved.';
}

// A record not reopened in two cycles is flagged for shortening or merging.
function staleCutoff() {
  const d = new Date();
  d.setMonth(d.getMonth() - 2 * CYCLE_MONTHS);
  return d.toISOString();
}
const isStale = (rec) => rec.savedAt && (rec.lastReopened || rec.savedAt) < staleCutoff();

// ---------- form helpers ----------

// Debounced autosave for drafts, flushed on navigation and when the page is hidden.
let flushDraft = null;
function autosaver(store) {
  let timer;
  let pending = false;
  let rec = null;
  const write = async () => {
    pending = false;
    clearTimeout(timer);
    const now = new Date().toISOString();
    rec.createdAt = rec.createdAt || now;
    rec.updatedAt = now;
    await DB.put(store, rec);
    const st = document.getElementById('status');
    if (st) st.textContent = `Draft kept on this device at ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.`;
  };
  const a = {
    touch(r) { rec = r; pending = true; clearTimeout(timer); timer = setTimeout(write, 400); },
    cancel() { pending = false; clearTimeout(timer); },
    flush() { return pending ? write() : Promise.resolve(); },
  };
  flushDraft = a.flush;
  return a;
}
document.addEventListener('visibilitychange', () => { if (document.hidden && flushDraft) flushDraft(); });

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- weekly hour (principle 6) ----------

const STAGES = [
  { label: 'Contact notes', min: 30, home: 'notes', views: ['notes', 'new', 'edit', 'note'] },
  { label: 'Idea log', min: 15, home: 'ideas', views: ['ideas', 'idea', 'note'] },
  { label: 'Reread the last synthesis', min: 15, home: 'hour', views: ['hour'] },
];
const hourStage = () => (SETTINGS.hour ? STAGES[SETTINGS.hour.stage] : null);

const Hour = {
  async start() {
    await setSetting('hour', { stage: 0, startedAt: new Date().toISOString(), endsAt: Date.now() + STAGES[0].min * 60000 });
    location.hash = '#/' + STAGES[0].home;
  },
  async next() {
    const h = SETTINGS.hour;
    if (h.stage + 1 >= STAGES.length) return Hour.end(true);
    const stage = h.stage + 1;
    await setSetting('hour', { ...h, stage, endsAt: Date.now() + STAGES[stage].min * 60000 });
    location.hash = '#/' + STAGES[stage].home;
  },
  async end(finished) {
    const h = SETTINGS.hour;
    const log = (SETTINGS.hours || []).concat([{ startedAt: h.startedAt, endedAt: new Date().toISOString(), stagesReached: h.stage + 1, finished: !!finished }]);
    await setSetting('hours', log.slice(-52));
    await setSetting('hour', null);
    flash = finished ? 'The hour is finished.' : 'The hour was ended early.';
    if (location.hash === '#/hour') route();
    else location.hash = '#/hour';
  },
};

function renderHourBar() {
  const bar = document.getElementById('hourbar');
  const nav = document.querySelector('nav');
  const st = hourStage();
  nav.hidden = !!st;
  bar.hidden = !st;
  if (!st) return;
  const left = SETTINGS.hour.endsAt - Date.now();
  const mm = Math.floor(Math.abs(left) / 60000);
  const ss = pad(Math.floor((Math.abs(left) % 60000) / 1000));
  const last = SETTINGS.hour.stage === STAGES.length - 1;
  bar.innerHTML = `<span><strong>Stage ${SETTINGS.hour.stage + 1} of 3: ${esc(st.label)}</strong>
      <span class="${left < 0 ? 'late' : ''}" id="clock">${left >= 0 ? `${mm}:${ss} left` : `Time is up (${mm}:${ss} over)`}</span></span>
    <span class="actions"><button type="button" id="hour-next">${last ? 'Finish the hour' : 'Next stage'}</button>
      <button type="button" id="hour-end">End now</button></span>`;
  document.getElementById('hour-next').onclick = () => Hour.next();
  document.getElementById('hour-end').onclick = () => { if (confirm('End the hour now?')) Hour.end(false); };
}

setInterval(() => {
  if (!SETTINGS.hour) return;
  const clock = document.getElementById('clock');
  if (!clock) return;
  const left = SETTINGS.hour.endsAt - Date.now();
  const mm = Math.floor(Math.abs(left) / 60000);
  const ss = pad(Math.floor((Math.abs(left) % 60000) / 1000));
  clock.textContent = left >= 0 ? `${mm}:${ss} left` : `Time is up (${mm}:${ss} over)`;
  clock.classList.toggle('late', left < 0);
}, 1000);

// ---------- lock screen ----------

function lockScreen() {
  document.querySelector('nav').hidden = true;
  document.getElementById('hourbar').hidden = true;
  main.innerHTML = `<form id="unlock" class="narrow">
    <h2>Locked</h2>
    <label>Passphrase <input type="password" name="pass" autocomplete="current-password" autofocus></label>
    <p class="status" id="status"></p>
    <button class="primary">Unlock</button>
  </form>`;
  document.getElementById('unlock').onsubmit = async (e) => {
    e.preventDefault();
    const st = document.getElementById('status');
    st.textContent = 'Checking…';
    if (await DB.unlock(e.target.elements.pass.value)) route();
    else st.textContent = 'That passphrase does not open these records.';
  };
}

// ---------- routing ----------

let flash = '';
let started = false;
let routing = Promise.resolve();

// Renders one at a time, so a slow page cannot land on top of a later one.
function route() {
  routing = routing.then(renderRoute, renderRoute);
  return routing;
}

async function renderRoute() {
  if (flushDraft) { const f = flushDraft; flushDraft = null; await f(); }
  if (!started) { started = true; await loadSettings(); }
  if (!DB.isOpen() && await DB.hasLock()) return lockScreen();

  const hash = location.hash;
  const parts = (hash || '#/notes').split('/');
  const view = VIEWS[parts[1]] ? parts[1] : 'notes';
  const st = hourStage();
  if (st && !st.views.includes(view)) { location.replace('#/' + st.home); return; }

  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('here', a.dataset.v === view || (a.dataset.also || '').split(' ').includes(view)));
  renderHourBar();
  window.scrollTo(0, 0);
  main.className = '';
  const msg = flash;
  flash = '';
  await VIEWS[view](parts[2], parts[3], msg);
  if (location.hash === hash) main.dataset.route = hash;
}

window.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('hashchange', route);
  route();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});
