'use strict';

// Prototype 4: the cycle synthesis. The template sits beside the cycle's own notes and
// idea log lines. The app shows that material as written; it never summarises it.

const SYN_PARTS = [
  ['reading', 'What the office now reads in the discourse', 'What has shifted in how people talk about the questions the office follows.'],
  ['advanced', 'What advanced', 'Which ideas moved, with whom, and the evidence in the notes and the idea log.'],
  ['next', 'What the office will try next cycle', 'The ideas, people and spaces to work with next, and why.'],
];

function synMissing(s) {
  const m = SYN_PARTS.filter(([k]) => !(s[k] || '').trim()).map(([, label]) => `"${label}"`);
  if (!s.date) m.push('the meeting date');
  if (!readerOf(s)) m.push('a reader');
  if (!(s.author || '').trim()) m.push('the author');
  return m;
}

function synMarkdown(s) {
  return [`# Cycle ${s.cycle} synthesis`, '',
    `${s.date}. Written by ${s.author} for ${readerOf(s)}. ${s.approvedAt ? `Approved by ${s.approvedBy} on ${s.approvedAt.slice(0, 10)}.` : 'Not yet approved by the convenor.'}`, '',
    ...SYN_PARTS.flatMap(([k, label]) => [`## ${label}`, '', (s[k] || '').trim(), '']),
  ].join('\n');
}

VIEWS.synthesis = async (id, _sub, msg) => {
  if (!id) return synthesisList(msg);
  const all = await DB.all('syntheses');
  let s = id === 'new' ? null : byId(all, id);
  if (id !== 'new' && !s) return (location.hash = '#/synthesis');
  if (!s) {
    s = {
      id: newId(), cycle: Math.max(0, ...all.map((x) => Number(x.cycle) || 0)) + 1, date: today(),
      reading: '', advanced: '', next: '', author: SETTINGS.author, readerChoice: '', readerName: '',
      savedAt: null, approvedBy: '', approvedAt: null, lastReopened: null,
    };
  }
  const previous = s.savedAt ? await markReopened('syntheses', s) : null;
  return synthesisPage(s, all, previous, msg);
};

async function synthesisList(msg) {
  const all = (await DB.all('syntheses')).sort((a, b) => b.date.localeCompare(a.date));
  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <h2>Cycle syntheses</h2>
    <p class="hint">One page at each reflection meeting, every ${SETTINGS.cycleMonths} months. Read by the National Assembly.</p>
    <p class="actions"><a class="button primary" href="#/synthesis/new">Start the next synthesis</a></p>
    ${all.length ? `<ul class="notes">${all.map((s) => `<li><a href="#/synthesis/${s.id}">
      <strong>Cycle ${esc(s.cycle)}</strong>
      <div class="meta">${esc(fmtDay(s.date))} · ${!s.savedAt ? 'draft' : s.approvedAt ? `approved by ${esc(s.approvedBy)}` : 'saved, awaiting approval'}${readerOf(s) ? ` · for ${esc(readerOf(s))}` : ''}</div></a></li>`).join('')}</ul>`
      : '<p class="empty">No syntheses yet.</p>'}`;
}

async function synthesisPage(s, all, previous, msg) {
  const [notes, entries, ideas, debriefs, pieces] = await Promise.all(['notes', 'entries', 'ideas', 'debriefs', 'pieces'].map((x) => DB.all(x)));
  const before = all.filter((x) => x.id !== s.id && x.savedAt && x.date < s.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const from = before ? before.date : '';
  const to = s.date + 'T23:59';
  const inCycle = (when) => when && when >= from && when <= to;
  const cycleNotes = notes.filter((n) => n.status === 'saved' && inCycle(n.when)).sort((a, b) => a.when.localeCompare(b.when));
  const cycleEntries = entries.filter((e) => e.resonance && inCycle(e.date)).sort((a, b) => a.date.localeCompare(b.date));
  const cycleDebriefs = debriefs.filter((d) => d.savedAt && inCycle(d.date));
  const stale = [
    ...notes.filter((n) => n.status === 'saved' && isStale(n)).map((n) => ({ href: `#/note/${n.id}`, label: `Note: ${whoOf(n)}, ${fmtDate(n.when)}` })),
    ...debriefs.filter(isStale).map((d) => ({ href: `#/debrief/${d.id}`, label: `Debrief: ${(byId(pieces, d.pieceId) || {}).title || 'piece removed'}, ${fmtDate(d.date)}` })),
    ...all.filter((x) => x.id !== s.id && isStale(x)).map((x) => ({ href: `#/synthesis/${x.id}`, label: `Synthesis: cycle ${x.cycle}` })),
  ];
  const locked = !!s.approvedAt;
  const ideaLabel = (e) => (byId(ideas, e.ideaId) || {}).label || '';

  main.className = 'wide';
  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <div class="split">
    <section>
      <form id="f" novalidate>
        <h2>Cycle ${esc(s.cycle)} synthesis</h2>
        <p class="meta">${s.savedAt ? `Saved ${esc(fmtDayTime(s.savedAt))}. ${esc(reopenedLine(s, previous))}` : 'Draft.'}
          Material ${from ? `since ${esc(fmtDate(from))}` : 'from the start of the records'}.</p>
        <div class="row">
          <label>Cycle <input type="text" name="cycle" inputmode="numeric" value="${esc(s.cycle)}" ${locked ? 'readonly' : ''}></label>
          <label>Meeting date <input type="date" name="date" value="${esc(s.date)}" ${locked ? 'readonly' : ''}></label>
        </div>
        ${SYN_PARTS.map(([k, label, hint]) => `<fieldset><legend>${esc(label)}</legend><p class="hint">${esc(hint)}</p>
          <textarea name="${k}" rows="7" ${locked ? 'readonly' : ''}>${esc(s[k])}</textarea></fieldset>`).join('')}
        <p class="hint" id="count"></p>
        ${readerFields(s, 'Who reads this synthesis?')}
        <p class="status" id="status"></p>
        <div class="actions">
          ${locked ? '' : `<button type="button" class="primary" id="save">Save</button>`}
          <span class="needed" id="needed"></span>
        </div>
      </form>
      <fieldset>
        <legend>Convenor approval</legend>
        ${locked
          ? `<p>Approved by ${esc(s.approvedBy)} on ${esc(fmtDay(s.approvedAt))}. The text is fixed until approval is withdrawn.</p>
             <button type="button" id="withdraw">Withdraw approval</button>`
          : `<p class="hint">Once saved, the convenor approves the synthesis for its reader.</p>
             <div class="row"><input type="text" id="approver" aria-label="Convenor's name"><button type="button" id="approve" ${s.savedAt ? '' : 'disabled'}>Approve</button></div>`}
      </fieldset>
      <div class="actions">
        <button type="button" id="md" ${s.savedAt ? '' : 'disabled'}>Download as Markdown</button>
        <button type="button" onclick="window.print()">Print</button>
        <a class="button" href="#/synthesis">All syntheses</a>
      </div>
    </section>

    <aside class="material">
      ${stale.length ? `<h3>Not reopened in two cycles</h3>
        <p class="hint">Shorten or merge these, or reopen them if they are still in use.</p>
        <ul class="plain">${stale.map((x) => `<li><a href="${x.href}">${esc(x.label)}</a></li>`).join('')}</ul>` : ''}
      <h3>This cycle's own records</h3>
      <div class="row filters">
        <input type="search" id="q" placeholder="Filter by any word" aria-label="Filter">
        <select id="fi"><option value="">All ideas</option>${ideas.map((i) => `<option value="${i.id}">${esc(i.label)}</option>`).join('')}</select>
        <select id="fk"><option value="">Notes and idea log</option><option value="note">Notes only</option><option value="entry">Idea log only</option><option value="debrief">Debriefs only</option></select>
      </div>
      <p class="hint" id="shown"></p>
      <div id="items">
        ${cycleNotes.map((n) => `<div class="item" data-kind="note" data-ideas="${esc(n.ideas.map((l) => (ideas.find((i) => lower(i.label) === lower(l)) || {}).id).join(' '))}">
          <p class="meta">Note · ${esc(fmtDay(n.when))} · <a href="#/note/${n.id}">${esc(whoOf(n))}</a> · ${esc(n.ideas.join(', '))}</p>
          <p>${esc(n.response)}</p>
          ${n.theirWords ? `<blockquote>${esc(n.theirWords)}</blockquote>` : ''}
          <p class="meta">Follow-up: ${esc(n.followUp)}</p></div>`).join('')}
        ${cycleEntries.map((e) => `<div class="item" data-kind="entry" data-ideas="${e.ideaId}">
          <p class="meta">Idea log · ${esc(fmtDay(e.date))} · ${esc(ideaLabel(e))} · ${esc(e.who)} · ${esc(e.resonance)}</p>
          ${e.restatement ? `<blockquote>${esc(e.restatement)}</blockquote>` : ''}</div>`).join('')}
        ${cycleDebriefs.map((d) => `<div class="item" data-kind="debrief" data-ideas="">
          <p class="meta">Debrief · ${esc(fmtDay(d.date))} · <a href="#/debrief/${d.id}">${esc((byId(pieces, d.pieceId) || {}).title || '')}</a></p>
          <p>${esc(d.reactions)}</p><p class="meta">From: ${esc(d.fromWhom)} · collaborator returns: ${esc(d.returned)}</p></div>`).join('')}
      </div>
    </aside>
    </div>`;

  const f = document.getElementById('f');
  const saver = autosaver('syntheses');

  function read() {
    const el = f.elements;
    s.cycle = el.cycle.value.trim();
    s.date = el.date.value;
    for (const [k] of SYN_PARTS) s[k] = el[k].value;
    s.readerChoice = el.readerChoice.value;
    s.readerName = el.readerName.value;
    s.author = el.author.value;
  }
  function refresh() {
    showReaderName(f, s);
    const words = wordCount(...SYN_PARTS.map(([k]) => s[k]));
    document.getElementById('count').textContent = `${words} words. One page is about 500.`;
    const m = synMissing(s);
    const btn = document.getElementById('save');
    if (btn) btn.disabled = m.length > 0;
    document.getElementById('needed').textContent = m.length ? `Still needed: ${m.join(', ')}.` : '';
  }
  function filter() {
    const q = lower(document.getElementById('q').value);
    const fi = document.getElementById('fi').value;
    const fk = document.getElementById('fk').value;
    let shown = 0;
    document.querySelectorAll('#items .item').forEach((el) => {
      const ok = (!q || el.textContent.toLowerCase().includes(q))
        && (!fi || el.dataset.ideas.split(' ').includes(fi))
        && (fk ? el.dataset.kind === fk : el.dataset.kind !== 'debrief');
      el.hidden = !ok;
      if (ok) shown++;
    });
    document.getElementById('shown').textContent = `${shown} record${shown === 1 ? '' : 's'} shown.`;
  }

  f.addEventListener('input', () => {
    read();
    refresh();
    if (!s.savedAt && !locked) {
      saver.touch(s);
      if (location.hash.endsWith('/new')) history.replaceState(null, '', `#/synthesis/${s.id}`);
    }
  });
  f.addEventListener('change', () => { read(); refresh(); });
  ['q', 'fi', 'fk'].forEach((x) => document.getElementById(x).addEventListener('input', filter));

  const save = document.getElementById('save');
  if (save) save.onclick = async () => {
    read();
    if (synMissing(s).length) return refresh();
    saver.cancel();
    const now = new Date().toISOString();
    s.savedAt = s.savedAt || now;
    s.updatedAt = now;
    if (s.readerChoice !== 'person') s.readerName = '';
    await DB.put('syntheses', s);
    await setSetting('author', s.author.trim());
    flash = 'Synthesis saved.';
    if (location.hash === `#/synthesis/${s.id}`) route();
    else location.hash = `#/synthesis/${s.id}`;
  };

  const approve = document.getElementById('approve');
  if (approve) approve.onclick = async () => {
    const name = document.getElementById('approver').value.trim();
    if (!name) return alert("Write the convenor's name to approve.");
    read();
    if (synMissing(s).length) return alert('Save a complete synthesis before approving it.');
    Object.assign(s, { approvedBy: name, approvedAt: new Date().toISOString() });
    await DB.put('syntheses', s);
    flash = 'Approved.';
    route();
  };
  const withdraw = document.getElementById('withdraw');
  if (withdraw) withdraw.onclick = async () => {
    if (!confirm('Withdraw approval so the text can be changed?')) return;
    Object.assign(s, { approvedBy: '', approvedAt: null });
    await DB.put('syntheses', s);
    route();
  };
  document.getElementById('md').onclick = () => download(`cycle-${s.cycle}-synthesis.md`, synMarkdown(s), 'text/markdown');

  refresh();
  filter();
}
