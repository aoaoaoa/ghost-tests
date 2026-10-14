'use strict';

const main = document.getElementById('main');
const H = 3600 * 1000;
const WINDOW_HOURS = 48;
const KINDS = ['conference', 'roundtable', 'visit', 'online'];
const STRENGTHS = ['new', 'developing', 'close'];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const LANG = navigator.language || 'en';

// ---------- small helpers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const localStamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDay = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayTime = (d) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const lower = (s) => (s || '').trim().toLowerCase();

function readerOf(n) {
  return n.readerChoice === 'person' ? (n.readerName || '').trim() : (n.readerChoice || '');
}

function whoOf(n) {
  return n.whoKind === 'space' ? n.spaceName : n.contactName;
}

function weekStart(when) {
  const d = new Date(when);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function windowText(when) {
  const deadline = new Date(when).getTime() + WINDOW_HOURS * H;
  const left = deadline - Date.now();
  if (left > 0) {
    const hours = Math.ceil(left / H);
    return { late: false, text: `Write up by ${fmtDayTime(deadline)} (${hours} hour${hours === 1 ? '' : 's'} left)` };
  }
  const over = Math.max(1, Math.floor(-left / H));
  return { late: true, text: `The 48-hour window closed ${over} hour${over === 1 ? '' : 's'} ago` };
}

function windowHtml(when) {
  if (!when) return '';
  const w = windowText(when);
  return `<p class="window${w.late ? ' late' : ''}" data-when="${esc(when)}">${esc(w.text)}</p>`;
}

setInterval(() => {
  document.querySelectorAll('[data-when]').forEach((el) => {
    const w = windowText(el.dataset.when);
    el.textContent = w.text;
    el.classList.toggle('late', w.late);
  });
}, 60 * 1000);

function blankNote() {
  return {
    id: newId(), status: 'draft', stored: false,
    when: localStamp(new Date()),
    whoKind: 'contact',
    contactName: '', organisation: '', role: '', strength: 'new', contactId: null,
    spaceName: '', spaceKind: '', spaceId: null,
    ideas: [], response: '', theirWords: '', followUp: '',
    readerChoice: '', readerName: '', author: '',
    transcriptRaw: '', transcript: '',
    createdAt: null, updatedAt: null, savedAt: null, lastReopened: null,
  };
}

function missing(n) {
  const m = [];
  if (!n.when) m.push('when');
  if (!(whoOf(n) || '').trim()) m.push(n.whoKind === 'space' ? 'the space' : 'the person');
  if (n.whoKind === 'space' && !n.spaceKind) m.push('the kind of space');
  if (!n.ideas.length) m.push('the idea tested');
  if (!n.response.trim()) m.push('their response');
  if (!n.followUp.trim()) m.push('the follow-up');
  if (!readerOf(n)) m.push('a reader');
  if (!n.author.trim()) m.push('your name');
  return m;
}

const transcriptUnedited = (n) => !!n.transcriptRaw && n.transcript === n.transcriptRaw;

async function getSetting(key) {
  const s = await DB.get('settings', key);
  return s ? s.value : '';
}
const setSetting = (key, value) => DB.put('settings', { id: key, value });

// ---------- routing ----------

let flash = '';
let flushDraft = null; // writes the open draft at once; set while a form is showing
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (document.hidden && flushDraft) flushDraft(); });
route();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function route() {
  if (flushDraft) { const f = flushDraft; flushDraft = null; await f(); }
  const [, view, id] = (location.hash || '#/notes').split('/');
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('here', a.getAttribute('href') === `#/${view}`));
  window.scrollTo(0, 0);
  if (view === 'new') return showForm(blankNote());
  if (view === 'edit') {
    const n = await DB.get('notes', id);
    return n ? showForm(n) : (location.hash = '#/notes');
  }
  if (view === 'note') return showNote(id);
  if (view === 'export') return showExport();
  const msg = flash;
  flash = '';
  return showList(msg);
}

// ---------- list ----------

async function showList(flash) {
  const notes = await DB.all('notes');
  const drafts = notes.filter((n) => n.status === 'draft').sort((a, b) => a.when.localeCompare(b.when));
  const saved = notes.filter((n) => n.status === 'saved').sort((a, b) => b.when.localeCompare(a.when));

  const weeks = new Map();
  for (const n of saved) {
    const k = weekStart(n.when).getTime();
    if (!weeks.has(k)) weeks.set(k, []);
    weeks.get(k).push(n);
  }

  const item = (n, href, extra) => `<li><a href="${href}">
      <strong>${esc(whoOf(n) || 'No name yet')}</strong>
      <div class="meta">${esc(fmtDayTime(n.when))}${n.ideas.length ? ' · ' + esc(n.ideas.join(', ')) : ''}</div>
      ${extra || ''}</a></li>`;

  main.innerHTML = `
    ${flash ? `<p class="status">${esc(flash)}</p>` : ''}
    <h2>Drafts</h2>
    ${drafts.length
      ? `<ul class="notes">${drafts.map((n) => item(n, `#/edit/${n.id}`, windowHtml(n.when))).join('')}</ul>`
      : '<p class="empty">No drafts.</p>'}
    <h2>Notes by week</h2>
    ${weeks.size
      ? [...weeks].map(([k, ns]) => `<h3>Week of ${esc(fmtDay(k))}</h3>
          <ul class="notes">${ns.map((n) => item(n, `#/note/${n.id}`, `<div class="meta">For ${esc(readerOf(n))}</div>`)).join('')}</ul>`).join('')
      : '<p class="empty">No saved notes yet.</p>'}
    <p class="actions"><a class="button" href="#/new">New note</a></p>`;
}

// ---------- read one note ----------

async function showNote(id) {
  const n = await DB.get('notes', id);
  if (!n) return (location.hash = '#/notes');
  if (n.status === 'draft') return (location.hash = `#/edit/${id}`);
  const previous = n.lastReopened;
  n.lastReopened = new Date().toISOString();
  await DB.put('notes', n);

  const contact = n.contactId ? await DB.get('contacts', n.contactId) : null;
  const space = n.spaceId ? await DB.get('spaces', n.spaceId) : null;
  const sub = contact
    ? [contact.organisation, contact.role, contact.strength].filter(Boolean).join(' · ')
    : space ? space.kind : '';

  main.innerHTML = `<article class="read">
    <h2>${esc(whoOf(n))}</h2>
    <p class="meta">${esc(sub)}</p>
    <p class="meta">${esc(fmtDayTime(n.when))}</p>
    <h3>Idea tested</h3><p>${esc(n.ideas.join('\n'))}</p>
    <h3>How they responded</h3><p>${esc(n.response)}</p>
    ${n.theirWords ? `<h3>Their words</h3><blockquote>${esc(n.theirWords)}</blockquote>` : ''}
    <h3>Follow-up agreed</h3><p>${esc(n.followUp)}</p>
    ${n.transcript ? `<details><summary>Transcript, as edited</summary><p>${esc(n.transcript)}</p></details>` : ''}
    <p class="meta" style="margin-top:20px">Written by ${esc(n.author)} for ${esc(readerOf(n))}.<br>
      Saved ${esc(fmtDayTime(n.savedAt))}.
      ${previous ? `Last reopened before today's reading: ${esc(fmtDayTime(previous))}.` : 'Not reopened since it was saved.'}</p>
    <div class="actions">
      <a class="button" href="#/edit/${n.id}">Edit</a>
      <a class="button" href="#/notes">Back to notes</a>
      <button type="button" id="del">Delete</button>
    </div></article>`;

  document.getElementById('del').onclick = async () => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await DB.del('notes', n.id);
    location.hash = '#/notes';
  };
}

// ---------- the form ----------

async function showForm(n) {
  const [contacts, allNotes] = await Promise.all([DB.all('contacts'), DB.all('notes')]);
  if (!n.author) n.author = await getSetting('author');
  const isSaved = n.status === 'saved';

  main.innerHTML = `
  <form id="f" novalidate autocomplete="off">
    <h2>${isSaved ? 'Edit note' : 'New contact note'}</h2>
    <div id="win">${isSaved ? '' : windowHtml(n.when)}</div>
    <label>When was the conversation?
      <input type="datetime-local" name="when" value="${esc(n.when)}">
    </label>

    <fieldset>
      <legend>1. Who, or where?</legend>
      <div class="choice">
        <label><input type="radio" name="whoKind" value="contact" ${n.whoKind === 'contact' ? 'checked' : ''}>A person</label>
        <label><input type="radio" name="whoKind" value="space" ${n.whoKind === 'space' ? 'checked' : ''}>A space</label>
      </div>
      <div id="who-contact">
        <label>Name
          <input type="text" name="contactName" list="contact-list" value="${esc(n.contactName)}">
        </label>
        <datalist id="contact-list">${contacts.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <p class="hint" id="known"></p>
        <div class="row">
          <label>Organisation <input type="text" name="organisation" value="${esc(n.organisation)}"></label>
          <label>Role <input type="text" name="role" value="${esc(n.role)}"></label>
        </div>
        <label>Relationship
          <select name="strength">${STRENGTHS.map((s) => `<option ${n.strength === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </label>
      </div>
      <div id="who-space">
        <label>Name of the space <input type="text" name="spaceName" value="${esc(n.spaceName)}"></label>
        <label>Kind
          <select name="spaceKind"><option value="">Choose</option>${KINDS.map((k) => `<option ${n.spaceKind === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>2. What idea did you test?</legend>
      <p class="hint">One idea per line, as a short label you will recognise later.</p>
      <textarea name="ideas" rows="2">${esc(n.ideas.join('\n'))}</textarea>
      <div class="suggest" id="suggest"></div>
    </fieldset>

    <fieldset>
      <legend>3. How did they respond?</legend>
      <p class="hint">What they said and did, as it happened.</p>
      <textarea name="response" rows="4">${esc(n.response)}</textarea>
      <label>Their words <span class="hint">(optional: a phrase exactly as they said it)</span>
        <input type="text" name="theirWords" value="${esc(n.theirWords)}">
      </label>
    </fieldset>

    <fieldset>
      <legend>4. What follow-up did you agree?</legend>
      <p class="hint">Who does what, by when. Write "none" if nothing was agreed.</p>
      <textarea name="followUp" rows="2">${esc(n.followUp)}</textarea>
    </fieldset>

    <fieldset>
      <legend>Reader</legend>
      <p class="hint">Who is this note written for? A note without a reader cannot be saved.</p>
      <select name="readerChoice">
        <option value="">Choose a reader</option>
        <option ${n.readerChoice === 'Office' ? 'selected' : ''}>Office</option>
        <option ${n.readerChoice === 'Convenor' ? 'selected' : ''}>Convenor</option>
        <option value="person" ${n.readerChoice === 'person' ? 'selected' : ''}>A named person</option>
      </select>
      <label id="reader-name">Their name <input type="text" name="readerName" value="${esc(n.readerName)}"></label>
      <label>Written by <input type="text" name="author" value="${esc(n.author)}"></label>
    </fieldset>

    <details ${n.transcript || n.transcriptRaw ? 'open' : ''}>
      <summary>Transcript (optional)</summary>
      <p class="hint">Raw material, dictated or pasted. Move what matters into the prompts above in your own words.
        The note cannot be saved until you have edited this text.</p>
      <div id="dictation"></div>
      <textarea name="transcript" rows="5">${esc(n.transcript)}</textarea>
    </details>

    <p class="status" id="status"></p>
  </form>
  <div class="savebar"><div class="inner">
    <span class="needed" id="needed"></span>
    ${isSaved ? `<a class="button" href="#/note/${n.id}">Cancel</a>` : '<button type="button" id="discard">Discard</button>'}
    <button type="button" class="primary" id="save">${isSaved ? 'Save changes' : 'Save note'}</button>
  </div></div>`;

  const f = document.getElementById('f');
  const knownIdeas = [...new Set(allNotes.filter((x) => x.status === 'saved').flatMap((x) => x.ideas))].sort((a, b) => a.localeCompare(b));
  let timer;

  function read() {
    const v = (k) => f.elements[k].value;
    n.when = v('when');
    n.whoKind = f.elements.whoKind.value || 'contact';
    n.contactName = v('contactName');
    n.organisation = v('organisation');
    n.role = v('role');
    n.strength = v('strength');
    n.spaceName = v('spaceName');
    n.spaceKind = v('spaceKind');
    n.ideas = v('ideas').split('\n').map((s) => s.trim()).filter(Boolean);
    n.response = v('response');
    n.theirWords = v('theirWords');
    n.followUp = v('followUp');
    n.readerChoice = v('readerChoice');
    n.readerName = v('readerName');
    n.author = v('author');
    n.transcript = v('transcript');
  }

  function refresh() {
    document.getElementById('who-contact').hidden = n.whoKind !== 'contact';
    document.getElementById('who-space').hidden = n.whoKind !== 'space';
    document.getElementById('reader-name').hidden = n.readerChoice !== 'person';
    if (!isSaved) document.getElementById('win').innerHTML = windowHtml(n.when);

    const known = contacts.find((c) => lower(c.name) === lower(n.contactName));
    document.getElementById('known').textContent = known
      ? `Known contact. First met ${fmtDay(known.firstMet)}, last contact ${fmtDay(known.lastContact)}.`
      : n.contactName.trim() ? 'New contact. Saving the note adds them.' : '';

    const unused = knownIdeas.filter((i) => !n.ideas.some((x) => lower(x) === lower(i)));
    const html = unused.map((i) => `<button type="button" data-idea="${esc(i)}">+ ${esc(i)}</button>`).join('');
    const box = document.getElementById('suggest');
    if (box.innerHTML !== html) box.innerHTML = html; // rebuilding mid-tap would swallow the tap

    const m = missing(n);
    const blocked = transcriptUnedited(n);
    document.getElementById('needed').textContent = blocked
      ? 'Edit the transcript before saving.'
      : m.length ? `Still needed: ${m.join(', ')}.` : '';
    document.getElementById('save').disabled = blocked || m.length > 0;
  }

  function changed() {
    read();
    refresh();
    if (isSaved) return;
    clearTimeout(timer);
    pending = true;
    timer = setTimeout(storeDraft, 400);
  }
  flushDraft = () => { clearTimeout(timer); return pending ? storeDraft() : Promise.resolve(); };

  let pending = false;
  async function storeDraft() {
    pending = false;
    const now = new Date().toISOString();
    if (!n.createdAt) n.createdAt = now;
    n.updatedAt = now;
    n.stored = true;
    await DB.put('notes', n);
    document.getElementById('status').textContent = `Draft kept on this device at ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.`;
  }

  f.addEventListener('input', changed);
  f.addEventListener('change', changed);

  f.elements.contactName.addEventListener('input', () => {
    const known = contacts.find((c) => lower(c.name) === lower(f.elements.contactName.value));
    if (!known) return;
    if (!f.elements.organisation.value) f.elements.organisation.value = known.organisation || '';
    if (!f.elements.role.value) f.elements.role.value = known.role || '';
    f.elements.strength.value = known.strength || 'new';
  });

  document.getElementById('suggest').addEventListener('click', (e) => {
    const idea = e.target.dataset && e.target.dataset.idea;
    if (!idea) return;
    const ta = f.elements.ideas;
    ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + idea;
    changed();
  });

  // A pasted transcript counts as captured text: it must be edited before saving.
  f.elements.transcript.addEventListener('paste', () => {
    const wasUnedited = !n.transcript || n.transcript === n.transcriptRaw;
    setTimeout(() => {
      if (wasUnedited) n.transcriptRaw = f.elements.transcript.value;
      changed();
    });
  });

  const discard = document.getElementById('discard');
  if (discard) discard.onclick = async () => {
    if ((n.stored || n.response || n.contactName) && !confirm('Discard this draft?')) return;
    clearTimeout(timer);
    pending = false;
    await DB.del('notes', n.id);
    location.hash = '#/notes';
  };

  document.getElementById('save').onclick = async () => {
    read();
    if (transcriptUnedited(n) || missing(n).length) return refresh();
    clearTimeout(timer);
    pending = false;
    await saveNote(n);
    await setSetting('author', n.author.trim());
    flash = 'Note saved.';
    location.hash = '#/notes';
  };

  // Probe for dictation only when asked: some browsers fail inside the speech API.
  const details = f.querySelector('details');
  const probe = () => { if (details.open && !details.dataset.probed) { details.dataset.probed = '1'; setupDictation(n, f, changed); } };
  details.addEventListener('toggle', probe);
  probe();
  refresh();
}

async function saveNote(n) {
  const now = new Date().toISOString();
  if (n.whoKind === 'contact') {
    const contacts = await DB.all('contacts');
    let c = contacts.find((x) => lower(x.name) === lower(n.contactName));
    if (!c) c = { id: newId(), name: n.contactName.trim(), firstMet: n.when, lastContact: n.when };
    c.organisation = n.organisation.trim();
    c.role = n.role.trim();
    c.strength = n.strength;
    if (n.when < c.firstMet) c.firstMet = n.when;
    if (n.when > c.lastContact) c.lastContact = n.when;
    await DB.put('contacts', c);
    n.contactId = c.id;
    n.spaceId = null;
    n.contactName = c.name;
  } else {
    const day = n.when.slice(0, 10);
    const spaces = await DB.all('spaces');
    let s = spaces.find((x) => lower(x.name) === lower(n.spaceName) && x.date === day);
    if (!s) s = { id: newId(), name: n.spaceName.trim(), date: day, attendees: [] };
    s.kind = n.spaceKind;
    await DB.put('spaces', s);
    n.spaceId = s.id;
    n.contactId = null;
    n.spaceName = s.name;
  }
  if (n.readerChoice !== 'person') n.readerName = '';
  n.status = 'saved';
  n.stored = true;
  n.createdAt = n.createdAt || now;
  n.updatedAt = now;
  n.savedAt = n.savedAt || now;
  await DB.put('notes', n);
}

// ---------- dictation, on this device only ----------

// Browser speech recognition normally sends audio to a remote service. That would
// break the rule that nothing about a social actor leaves the office's storage,
// so dictation is offered only when the browser can recognise speech on the device.
async function setupDictation(n, f, changed) {
  const box = document.getElementById('dictation');
  let state = 'unavailable';
  if (SR && typeof SR.available === 'function') {
    try { state = await SR.available({ langs: [LANG], processLocally: true }); } catch (e) { state = 'unavailable'; }
  }

  if (state === 'unavailable') {
    box.innerHTML = '<p class="hint">Dictation is off on this browser: it would send the audio to an outside service. You can paste a transcript instead.</p>';
    return;
  }
  if (state === 'downloadable' || state === 'downloading') {
    box.innerHTML = '<button type="button" id="prep">Prepare dictation on this device</button>';
    document.getElementById('prep').onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Preparing…';
      try { await SR.install({ langs: [LANG], processLocally: true }); } catch (err) { /* reported below */ }
      setupDictation(n, f, changed);
    };
    return;
  }

  box.innerHTML = '<button type="button" id="mic">Start dictation</button>';
  const btn = document.getElementById('mic');
  let rec = null;
  btn.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = LANG;
    rec.continuous = true;
    rec.interimResults = false;
    rec.processLocally = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const text = e.results[i][0].transcript.trim();
        if (!text) continue;
        const ta = f.elements.transcript;
        const join = (s) => (s ? s.replace(/\s+$/, '') + ' ' : '') + text;
        n.transcriptRaw = join(n.transcriptRaw);
        ta.value = join(ta.value);
        changed();
      }
    };
    rec.onend = () => { rec = null; btn.textContent = 'Start dictation'; };
    rec.onerror = () => { rec = null; btn.textContent = 'Start dictation'; };
    rec.start();
    btn.textContent = 'Stop dictation';
  };
}

// ---------- export ----------

const csvCell = (v) => {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, cols) => '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function notesMarkdown(notes, contacts, spaces) {
  const byId = (list, id) => list.find((x) => x.id === id);
  const out = ['# Contact notes', '', `Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, ''];
  for (const n of notes) {
    const c = byId(contacts, n.contactId);
    const s = byId(spaces, n.spaceId);
    const sub = c ? [c.organisation, c.role].filter(Boolean).join(', ') : s ? s.kind : '';
    out.push(`## ${n.when.replace('T', ' ')} · ${whoOf(n)}${sub ? ` (${sub})` : ''}`, '');
    out.push(`Written by ${n.author} for ${readerOf(n)}. Saved ${n.savedAt}. Last reopened ${n.lastReopened || 'never'}.`, '');
    out.push('### Idea tested', '', ...n.ideas.map((i) => `- ${i}`), '');
    out.push('### How they responded', '', n.response.trim(), '');
    if (n.theirWords) out.push('### Their words', '', `> ${n.theirWords.trim()}`, '');
    out.push('### Follow-up agreed', '', n.followUp.trim(), '');
    if (n.transcript) out.push('### Transcript, as edited', '', n.transcript.trim(), '');
  }
  return out.join('\n');
}

async function showExport() {
  main.innerHTML = `
    <h2>Export</h2>
    <p>Everything stays on this device until you export it. Exports are plain files that open without this app.</p>
    <div class="actions">
      <button type="button" data-x="md">Notes as Markdown</button>
      <button type="button" data-x="notes">Notes as CSV</button>
      <button type="button" data-x="contacts">Contacts as CSV</button>
      <button type="button" data-x="spaces">Spaces as CSV</button>
    </div>
    <h2>Backup</h2>
    <p>A full copy, drafts included, for moving to another device.</p>
    <div class="actions">
      <button type="button" data-x="json">Download backup</button>
      <label class="button">Restore from backup <input type="file" id="restore" accept="application/json,.json" hidden></label>
    </div>
    <p class="status" id="status"></p>`;

  main.querySelectorAll('[data-x]').forEach((b) => b.onclick = async () => {
    const [notes, contacts, spaces] = await Promise.all(['notes', 'contacts', 'spaces'].map((s) => DB.all(s)));
    const saved = notes.filter((n) => n.status === 'saved').sort((a, b) => a.when.localeCompare(b.when));
    const day = localStamp(new Date()).slice(0, 10);
    const x = b.dataset.x;
    if (x === 'md') download(`contact-notes-${day}.md`, notesMarkdown(saved, contacts, spaces), 'text/markdown');
    if (x === 'notes') download(`contact-notes-${day}.csv`, toCsv(saved.map((n) => ({ ...n, who: whoOf(n), reader: readerOf(n) })),
      ['when', 'whoKind', 'who', 'ideas', 'response', 'theirWords', 'followUp', 'author', 'reader', 'savedAt', 'lastReopened', 'contactId', 'spaceId', 'id']), 'text/csv');
    if (x === 'contacts') download(`contacts-${day}.csv`, toCsv(contacts,
      ['name', 'organisation', 'role', 'strength', 'firstMet', 'lastContact', 'id']), 'text/csv');
    if (x === 'spaces') download(`spaces-${day}.csv`, toCsv(spaces, ['name', 'date', 'kind', 'id']), 'text/csv');
    if (x === 'json') download(`contact-notes-backup-${day}.json`, JSON.stringify({ app: 'contact-notes', version: 1, notes, contacts, spaces }, null, 2), 'application/json');
  });

  document.getElementById('restore').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById('status');
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'contact-notes' || !['notes', 'contacts', 'spaces'].every((k) => Array.isArray(data[k]))) throw new Error('not a backup');
      if (!confirm(`Add ${data.notes.length} notes and ${data.contacts.length} contacts from this backup? Records with the same id are replaced.`)) return;
      for (const k of ['notes', 'contacts', 'spaces']) for (const r of data[k]) if (r && r.id) await DB.put(k, r);
      status.textContent = 'Backup restored.';
    } catch (err) {
      status.textContent = 'That file is not a backup from this app.';
    }
    e.target.value = '';
  };
}
