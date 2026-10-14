'use strict';

// Prototype 5: the op-ed ledger, collaborator debriefs, and the 3, 6 and 12-month reviews.

const MARKS = [3, 6, 12];
const PIECE_KINDS = ['op-ed', 'joint activity'];
const RETURNED = ['yes', 'no', 'unknown'];

async function dueReviews() {
  const pieces = (await DB.all('pieces')).filter((p) => p.savedAt && p.placed);
  const now = today();
  const due = [];
  for (const p of pieces) {
    for (const m of MARKS) {
      const dueOn = addMonths(p.placed, m);
      if (dueOn <= now && !(p.reviews || {})[m]) due.push({ piece: p, months: m, dueOn });
    }
  }
  return due.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

function markState(p, m) {
  if ((p.reviews || {})[m]) return 'written';
  return addMonths(p.placed, m) <= today() ? 'due' : `from ${fmtDate(addMonths(p.placed, m))}`;
}

// ---------- the ledger ----------

VIEWS.ledger = async (_id, _sub, msg) => {
  const pieces = (await DB.all('pieces')).filter((p) => p.savedAt).sort((a, b) => b.placed.localeCompare(a.placed));
  const due = await dueReviews();
  main.className = 'wide';
  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <h2>Ledger</h2>
    <p class="actions"><a class="button primary" href="#/piece/new">Add a piece or activity</a></p>
    ${due.length ? `<h3>Reviews due</h3><ul class="plain">${due.map((d) => `<li><a href="#/review/${d.piece.id}/${d.months}">${esc(d.piece.title)}: ${d.months}-month review</a>
      <span class="meta">due ${esc(fmtDate(d.dueOn))}</span></li>`).join('')}</ul>` : ''}
    ${pieces.length ? `<div class="scroll"><table>
      <thead><tr><th>Placed</th><th>Title</th><th>Outlet</th><th>Collaborator</th><th>Theme</th><th>Ideas carried</th>${MARKS.map((m) => `<th>${m} months</th>`).join('')}</tr></thead>
      <tbody>${pieces.map((p) => `<tr>
        <td>${esc(fmtDate(p.placed))}</td>
        <td><a href="#/piece/${p.id}">${esc(p.title)}</a>${p.kind !== 'op-ed' ? `<div class="meta">${esc(p.kind)}</div>` : ''}</td>
        <td>${esc(p.outlet)}</td><td>${esc(p.collaborator)}</td><td>${esc(p.theme)}</td><td>${esc(p.ideas.join(', '))}</td>
        ${MARKS.map((m) => { const st = markState(p, m); return `<td>${st === 'due' ? `<a href="#/review/${p.id}/${m}">due</a>` : esc(st)}</td>`; }).join('')}
      </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No pieces yet.</p>'}`;
};

// ---------- one piece ----------

VIEWS.piece = async (id, sub, msg) => {
  if (id === 'new') return pieceForm({ id: newId(), kind: 'op-ed', title: '', outlet: '', collaborator: '', placed: today(), theme: '', ideas: [], reach: '', reviews: {}, author: SETTINGS.author, readerChoice: '', readerName: '', savedAt: null });
  const p = await DB.get('pieces', id);
  if (!p) return (location.hash = '#/ledger');
  if (sub === 'edit') return pieceForm(p);

  const previous = await markReopened('pieces', p);
  const debriefs = (await DB.all('debriefs')).filter((d) => d.pieceId === p.id).sort((a, b) => a.date.localeCompare(b.date));
  main.innerHTML = `${msg ? `<p class="status">${esc(msg)}</p>` : ''}<article class="read">
    <h2>${esc(p.title)}</h2>
    <p class="meta">${esc(p.kind)} · ${esc(p.outlet)} · placed ${esc(fmtDay(p.placed))}${p.collaborator ? ` · with ${esc(p.collaborator)}` : ''}</p>
    <p class="meta">Theme: ${esc(p.theme)}</p>
    <h3>Ideas carried</h3><p>${esc(p.ideas.join('\n')) || '<span class="empty">None named.</span>'}</p>
    ${p.reach ? `<h3>Reach</h3><p>${esc(p.reach)}</p>` : ''}
    ${MARKS.map((m) => {
      const r = (p.reviews || {})[m];
      const st = markState(p, m);
      return `<h3>${m} months</h3>${r
        ? `<p class="meta">Response</p><p>${esc(r.response)}</p><p class="meta">Uptake</p><p>${esc(r.uptake)}</p>
           <p><a href="#/review/${p.id}/${m}">Edit this review</a></p>`
        : st === 'due' ? `<p><a class="button" href="#/review/${p.id}/${m}">Write the ${m}-month review</a></p>` : `<p class="empty">Due ${esc(st)}.</p>`}`;
    }).join('')}
    <h3>Debriefs</h3>
    ${debriefs.length ? `<ul class="plain">${debriefs.map((d) => `<li><a href="#/debrief/${d.id}">${esc(fmtDay(d.date))}</a> · collaborator returns: ${esc(d.returned)}</li>`).join('')}</ul>` : '<p class="empty">None yet.</p>'}
    <p class="meta" style="margin-top:20px">Written by ${esc(p.author)} for ${esc(readerOf(p))}. ${esc(reopenedLine(p, previous))}</p>
    <div class="actions">
      <a class="button primary" href="#/debrief/new/${p.id}">Write a debrief</a>
      <a class="button" href="#/piece/${p.id}/edit">Edit</a>
      <a class="button" href="#/ledger">Ledger</a>
    </div></article>`;
};

function pieceMissing(p) {
  const m = [];
  if (!p.title.trim()) m.push('a title');
  if (!p.outlet.trim()) m.push('the outlet');
  if (!p.placed) m.push('the date placed');
  if (!p.theme.trim()) m.push('the theme');
  if (!readerOf(p)) m.push('a reader');
  if (!p.author.trim()) m.push('your name');
  return m;
}

async function pieceForm(p) {
  const [contacts, ideas] = await Promise.all([DB.all('contacts'), DB.all('ideas')]);
  main.innerHTML = `<form id="f" novalidate autocomplete="off">
    <h2>${p.savedAt ? 'Edit piece' : 'Add a piece or activity'}</h2>
    <div class="choice">${PIECE_KINDS.map((k) => `<label><input type="radio" name="kind" value="${k}" ${p.kind === k ? 'checked' : ''}>${k}</label>`).join('')}</div>
    <label>Title <input type="text" name="title" value="${esc(p.title)}"></label>
    <div class="row">
      <label>Outlet or venue <input type="text" name="outlet" value="${esc(p.outlet)}"></label>
      <label>Date placed <input type="date" name="placed" value="${esc(p.placed)}"></label>
    </div>
    <label>Collaborator <input type="text" name="collaborator" list="contact-list" value="${esc(p.collaborator)}"></label>
    <datalist id="contact-list">${contacts.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>
    <label>Theme <input type="text" name="theme" value="${esc(p.theme)}"></label>
    <label>Ideas carried <span class="hint">(one per line)</span><textarea name="ideas" rows="3">${esc(p.ideas.join('\n'))}</textarea></label>
    <div class="suggest" id="suggest">${ideas.map((i) => `<button type="button" data-idea="${esc(i.label)}">+ ${esc(i.label)}</button>`).join('')}</div>
    <label>Reach <span class="hint">(where it ran and how widely it could be seen)</span><textarea name="reach" rows="2">${esc(p.reach)}</textarea></label>
    ${readerFields(p, 'Who is this ledger entry for?')}
  </form>
  <div class="savebar"><div class="inner">
    <span class="needed" id="needed"></span>
    <a class="button" href="${p.savedAt ? `#/piece/${p.id}` : '#/ledger'}">Cancel</a>
    <button type="button" class="primary" id="save">Save</button>
  </div></div>`;

  const f = document.getElementById('f');
  const read = () => {
    const el = f.elements;
    Object.assign(p, {
      kind: el.kind.value, title: el.title.value, outlet: el.outlet.value, placed: el.placed.value,
      collaborator: el.collaborator.value.trim(), theme: el.theme.value, ideas: lines(el.ideas.value), reach: el.reach.value,
      readerChoice: el.readerChoice.value, readerName: el.readerName.value, author: el.author.value,
    });
  };
  const refresh = () => {
    showReaderName(f, p);
    const m = pieceMissing(p);
    document.getElementById('needed').textContent = m.length ? `Still needed: ${m.join(', ')}.` : '';
    document.getElementById('save').disabled = m.length > 0;
  };
  f.addEventListener('input', () => { read(); refresh(); });
  f.addEventListener('change', () => { read(); refresh(); });
  document.getElementById('suggest').addEventListener('click', (e) => {
    const idea = e.target.dataset && e.target.dataset.idea;
    if (!idea || p.ideas.some((x) => lower(x) === lower(idea))) return;
    const ta = f.elements.ideas;
    ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + idea;
    read();
    refresh();
  });
  document.getElementById('save').onclick = async () => {
    read();
    if (pieceMissing(p).length) return refresh();
    const c = contacts.find((x) => lower(x.name) === lower(p.collaborator));
    p.collaboratorId = c ? c.id : null;
    if (p.readerChoice !== 'person') p.readerName = '';
    const now = new Date().toISOString();
    p.savedAt = p.savedAt || now;
    p.updatedAt = now;
    await DB.put('pieces', p);
    await setSetting('author', p.author.trim());
    flash = 'Saved.';
    location.hash = `#/piece/${p.id}`;
  };
  refresh();
}

// ---------- reviews at 3, 6 and 12 months ----------

VIEWS.review = async (id, months) => {
  const p = await DB.get('pieces', id);
  const m = Number(months);
  if (!p || !MARKS.includes(m)) return (location.hash = '#/ledger');
  const ideas = await DB.all('ideas');
  const r = (p.reviews || {})[m] || { response: '', uptake: '' };
  const carried = p.ideas.map((l) => ideas.find((i) => lower(i.label) === lower(l)) || { label: l, markers: '' });

  main.innerHTML = `<form id="f" novalidate>
    <h2>${esc(p.title)}: ${m}-month review</h2>
    <p class="meta">${esc(p.outlet)} · placed ${esc(fmtDay(p.placed))} · <a href="#/piece/${p.id}">open the piece</a></p>
    <h3>Ideas it carried</h3>
    ${carried.length ? carried.map((i) => `<p><strong>${esc(i.label)}</strong>${lines(i.markers).length ? `<br><span class="meta">Marker phrasings: ${esc(lines(i.markers).join(' · '))}</span>` : ''}</p>`).join('') : '<p class="empty">No ideas named on the piece.</p>'}
    <fieldset><legend>What response has the piece drawn since it ran?</legend>
      <p class="hint">Replies, letters, comments, invitations. Who, and what they said.</p>
      <textarea name="response" rows="5">${esc(r.response)}</textarea></fieldset>
    <fieldset><legend>Where have its ideas or phrasings been taken up?</legend>
      <p class="hint">Look for the marker phrasings above. Note where they appeared and in whose words. Write "none found" if you looked and found none.</p>
      <textarea name="uptake" rows="5">${esc(r.uptake)}</textarea></fieldset>
  </form>
  <div class="savebar"><div class="inner">
    <span class="needed" id="needed"></span>
    <a class="button" href="#/piece/${p.id}">Cancel</a>
    <button type="button" class="primary" id="save">Save review</button>
  </div></div>`;

  const f = document.getElementById('f');
  const refresh = () => {
    const ok = f.elements.response.value.trim() && f.elements.uptake.value.trim();
    document.getElementById('save').disabled = !ok;
    document.getElementById('needed').textContent = ok ? '' : 'Answer both questions to save.';
  };
  f.addEventListener('input', refresh);
  document.getElementById('save').onclick = async () => {
    p.reviews = p.reviews || {};
    p.reviews[m] = { response: f.elements.response.value.trim(), uptake: f.elements.uptake.value.trim(), writtenAt: new Date().toISOString() };
    await DB.put('pieces', p);
    flash = `${m}-month review saved.`;
    location.hash = `#/piece/${p.id}`;
  };
  refresh();
};

// ---------- debriefs ----------

function debriefMissing(d) {
  const m = [];
  if (!d.date) m.push('the date');
  if (!d.reactions.trim()) m.push('the reactions');
  if (!d.fromWhom.trim()) m.push('from whom');
  if (!d.returned) m.push('whether the collaborator returns');
  if (!readerOf(d)) m.push('a reader');
  if (!d.author.trim()) m.push('your name');
  return m;
}

VIEWS.debrief = async (id, sub) => {
  if (id === 'new') {
    const p = await DB.get('pieces', sub);
    if (!p) return (location.hash = '#/ledger');
    return debriefForm({ id: newId(), pieceId: p.id, date: today(), reactions: '', fromWhom: '', returned: '', author: SETTINGS.author, readerChoice: '', readerName: '', savedAt: null }, p);
  }
  const d = await DB.get('debriefs', id);
  if (!d) return (location.hash = '#/ledger');
  const p = (await DB.get('pieces', d.pieceId)) || { id: '', title: 'Piece removed' };
  if (sub === 'edit') return debriefForm(d, p);

  const previous = await markReopened('debriefs', d);
  main.innerHTML = `<article class="read">
    <h2>Debrief: ${esc(p.title)}</h2>
    <p class="meta">${esc(fmtDay(d.date))}</p>
    <h3>Reactions received</h3><p>${esc(d.reactions)}</p>
    <h3>From whom</h3><p>${esc(d.fromWhom)}</p>
    <h3>Does the collaborator return?</h3><p>${esc(d.returned)}</p>
    <p class="meta" style="margin-top:20px">Written by ${esc(d.author)} for ${esc(readerOf(d))}. ${esc(reopenedLine(d, previous))}</p>
    <div class="actions"><a class="button" href="#/debrief/${d.id}/edit">Edit</a>${p.id ? `<a class="button" href="#/piece/${p.id}">Back to the piece</a>` : ''}</div>
  </article>`;
};

function debriefForm(d, p) {
  main.innerHTML = `<form id="f" novalidate>
    <h2>Debrief: ${esc(p.title)}</h2>
    <label>Date <input type="date" name="date" value="${esc(d.date)}"></label>
    <fieldset><legend>What reactions were received?</legend><textarea name="reactions" rows="5">${esc(d.reactions)}</textarea></fieldset>
    <fieldset><legend>From whom?</legend><input type="text" name="fromWhom" value="${esc(d.fromWhom)}"></fieldset>
    <fieldset><legend>Will the collaborator return?</legend>
      <div class="choice">${RETURNED.map((r) => `<label><input type="radio" name="returned" value="${r}" ${d.returned === r ? 'checked' : ''}>${r}</label>`).join('')}</div></fieldset>
    ${readerFields(d, 'Who is this debrief for?')}
  </form>
  <div class="savebar"><div class="inner">
    <span class="needed" id="needed"></span>
    <a class="button" href="#/piece/${p.id}">Cancel</a>
    <button type="button" class="primary" id="save">Save debrief</button>
  </div></div>`;

  const f = document.getElementById('f');
  const read = () => {
    const el = f.elements;
    Object.assign(d, { date: el.date.value, reactions: el.reactions.value, fromWhom: el.fromWhom.value, returned: el.returned.value,
      readerChoice: el.readerChoice.value, readerName: el.readerName.value, author: el.author.value });
  };
  const refresh = () => {
    showReaderName(f, d);
    const m = debriefMissing(d);
    document.getElementById('needed').textContent = m.length ? `Still needed: ${m.join(', ')}.` : '';
    document.getElementById('save').disabled = m.length > 0;
  };
  f.addEventListener('input', () => { read(); refresh(); });
  f.addEventListener('change', () => { read(); refresh(); });
  document.getElementById('save').onclick = async () => {
    read();
    if (debriefMissing(d).length) return refresh();
    if (d.readerChoice !== 'person') d.readerName = '';
    const now = new Date().toISOString();
    d.savedAt = d.savedAt || now;
    d.updatedAt = now;
    await DB.put('debriefs', d);
    await setSetting('author', d.author.trim());
    flash = 'Debrief saved.';
    location.hash = `#/piece/${p.id}`;
  };
  refresh();
}
