'use strict';

// Prototype 2: the idea log. One line per idea per contact, written by the officer.

const RESONANCE = ['rejected', 'neutral', 'interested', 'adopted'];
const ELEMENTS = ['concept', 'messaging element'];
const IDEA_STATUS = ['being tested', 'carried forward', 'set aside'];

// After a note is saved: make sure each idea exists and has a line waiting for this note.
async function syncIdeas(n) {
  const [ideas, entries] = await Promise.all([DB.all('ideas'), DB.all('entries')]);
  const keep = [];
  for (const label of n.ideas) {
    let idea = ideas.find((i) => lower(i.label) === lower(label));
    if (!idea) {
      idea = { id: newId(), label: label.trim(), markers: '', element: '', status: IDEA_STATUS[0], firstIntroduced: n.when, createdAt: new Date().toISOString() };
      ideas.push(idea);
      await DB.put('ideas', idea);
    } else if (n.when < idea.firstIntroduced) {
      idea.firstIntroduced = n.when;
      await DB.put('ideas', idea);
    }
    keep.push(idea.id);
    const e = entries.find((x) => x.noteId === n.id && x.ideaId === idea.id) || { id: newId(), noteId: n.id, ideaId: idea.id, resonance: '', restatement: '' };
    Object.assign(e, { date: n.when, contactId: n.contactId, spaceId: n.spaceId, who: whoOf(n) });
    await DB.put('entries', e);
  }
  await dropEmptyEntries(n.id, keep);
}

// Lines the officer has not written yet go with the idea; written lines stay.
async function dropEmptyEntries(noteId, keepIdeaIds) {
  const entries = await DB.all('entries');
  for (const e of entries) {
    if (e.noteId === noteId && !keepIdeaIds.includes(e.ideaId) && !e.resonance && !(e.restatement || '').trim()) await DB.del('entries', e.id);
  }
}

function entryForm(e, idea, note) {
  return `<form class="entry" data-id="${e.id}">
    <p><strong>${esc(idea ? idea.label : 'Idea removed')}</strong> with <strong>${esc(e.who)}</strong>
      <span class="meta">${esc(fmtDay(e.date))}${note ? ` · <a href="#/note/${note.id}">open note</a>` : ''}</span></p>
    ${note && note.theirWords ? `<blockquote>${esc(note.theirWords)}</blockquote>` : ''}
    <div class="choice small">${RESONANCE.map((r) => `<label><input type="radio" name="resonance" value="${r}" ${e.resonance === r ? 'checked' : ''}>${r}</label>`).join('')}</div>
    <label>How did they put it in their own words? <span class="hint">(leave empty if they did not)</span>
      <textarea name="restatement" rows="2">${esc(e.restatement)}</textarea></label>
    <button type="submit">Save line</button>
  </form>`;
}

function wireEntryForms(onSaved) {
  main.querySelectorAll('form.entry').forEach((form) => {
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const e = await DB.get('entries', form.dataset.id);
      const resonance = form.elements.resonance.value;
      if (!resonance) { alert('Choose how the idea landed before saving the line.'); return; }
      e.resonance = resonance;
      e.restatement = form.elements.restatement.value.trim();
      e.loggedAt = new Date().toISOString();
      await DB.put('entries', e);
      onSaved();
    };
  });
}

function tally(list) {
  const counts = RESONANCE.map((r) => [r, list.filter((e) => e.resonance === r).length]).filter(([, c]) => c);
  if (!list.length) return 'Not yet logged with anyone.';
  const who = new Set(list.map((e) => e.who)).size;
  return `Logged with ${who} contact${who === 1 ? '' : 's'}: ${counts.map(([r, c]) => `${c} ${r}`).join(', ')}.`;
}

VIEWS.ideas = async (_id, _sub, msg) => {
  const [ideas, entries, notes] = await Promise.all([DB.all('ideas'), DB.all('entries'), DB.all('notes')]);
  const pending = entries.filter((e) => !e.resonance).sort((a, b) => a.date.localeCompare(b.date));
  ideas.sort((a, b) => a.label.localeCompare(b.label));

  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <h2>To log</h2>
    <p class="hint">One line for each idea tested in a saved note. Say how it landed, and how they restated it.</p>
    ${pending.length ? pending.map((e) => entryForm(e, byId(ideas, e.ideaId), byId(notes, e.noteId))).join('') : '<p class="empty">Nothing waiting.</p>'}
    <h2>Ideas</h2>
    ${ideas.length ? `<ul class="notes">${ideas.map((i) => {
      const logged = entries.filter((e) => e.ideaId === i.id && e.resonance);
      return `<li><a href="#/idea/${i.id}"><strong>${esc(i.label)}</strong>
        <div class="meta">${esc([i.element, i.status].filter(Boolean).join(' · '))}</div>
        <div class="meta">${esc(tally(logged))}</div></a></li>`;
    }).join('')}</ul>` : '<p class="empty">No ideas yet. They appear when a note names one, or add one here.</p>'}
    <form id="add-idea" class="row" style="margin-top:12px">
      <input type="text" name="label" aria-label="New idea">
      <button type="submit">Add idea</button>
    </form>`;

  wireEntryForms(() => { flash = 'Line saved.'; route(); });
  document.getElementById('add-idea').onsubmit = async (ev) => {
    ev.preventDefault();
    const label = ev.target.elements.label.value.trim();
    if (!label) return;
    if (ideas.some((i) => lower(i.label) === lower(label))) { alert('That idea is already in the list.'); return; }
    const idea = { id: newId(), label, markers: '', element: '', status: IDEA_STATUS[0], firstIntroduced: localStamp(new Date()), createdAt: new Date().toISOString() };
    await DB.put('ideas', idea);
    location.hash = `#/idea/${idea.id}`;
  };
};

// The per-idea page is for reading: every contact's response and restatement in date order.
VIEWS.idea = async (id, _sub, msg) => {
  const idea = await DB.get('ideas', id);
  if (!idea) return (location.hash = '#/ideas');
  const previous = await markReopened('ideas', idea);
  const [entries, notes] = await Promise.all([DB.all('entries'), DB.all('notes')]);
  const mine = entries.filter((e) => e.ideaId === id).sort((a, b) => a.date.localeCompare(b.date));
  const logged = mine.filter((e) => e.resonance);
  const waiting = mine.filter((e) => !e.resonance);

  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <article class="read">
    <h2>${esc(idea.label)}</h2>
    <p class="meta">First introduced ${esc(fmtDay(idea.firstIntroduced))}. ${esc(tally(logged))} ${esc(reopenedLine(idea, previous))}</p>
    <h3>Responses in date order</h3>
    ${logged.length ? logged.map((e) => {
      const note = byId(notes, e.noteId);
      return `<div class="line">
        <p><span class="meta">${esc(fmtDay(e.date))}</span> · <strong>${esc(e.who)}</strong> · ${esc(e.resonance)}
          ${note ? ` · <a href="#/note/${note.id}">note</a>` : ''}</p>
        ${e.restatement ? `<blockquote>${esc(e.restatement)}</blockquote>` : ''}
        ${note && note.theirWords && note.theirWords !== e.restatement ? `<p class="meta">Their words in the note: “${esc(note.theirWords)}”</p>` : ''}
      </div>`;
    }).join('') : '<p class="empty">No lines logged yet.</p>'}
    ${waiting.length ? `<h3>Waiting to be logged</h3>${waiting.map((e) => entryForm(e, idea, byId(notes, e.noteId))).join('')}` : ''}
    </article>

    <form id="idea-form" novalidate>
      <h3>About this idea</h3>
      <label>Label <input type="text" name="label" value="${esc(idea.label)}"></label>
      <label>Marker phrasings <span class="hint">(one per line: the words that show the idea has travelled)</span>
        <textarea name="markers" rows="3">${esc(idea.markers)}</textarea></label>
      <div class="row">
        <label>Kind <select name="element"><option value="">Choose</option>${ELEMENTS.map((x) => `<option ${idea.element === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label>Status <select name="status">${IDEA_STATUS.map((x) => `<option ${idea.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      </div>
      <div class="actions"><button class="primary" type="submit">Save</button><a class="button" href="#/ideas">Back to ideas</a></div>
    </form>`;

  wireEntryForms(() => { flash = 'Line saved.'; route(); });
  document.getElementById('idea-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const el = ev.target.elements;
    const label = el.label.value.trim();
    if (!label) return alert('An idea needs a label.');
    const all = await DB.all('ideas');
    if (all.some((i) => i.id !== id && lower(i.label) === lower(label))) return alert('Another idea already has that label.');
    if (label !== idea.label) {
      // Notes and pieces name ideas by label, so a rename follows through to them.
      for (const store of ['notes', 'pieces']) {
        for (const r of await DB.all(store)) {
          if (r.ideas && r.ideas.some((x) => lower(x) === lower(idea.label))) {
            r.ideas = r.ideas.map((x) => (lower(x) === lower(idea.label) ? label : x));
            await DB.put(store, r);
          }
        }
      }
    }
    Object.assign(idea, { label, markers: el.markers.value, element: el.element.value, status: el.status.value });
    await DB.put('ideas', idea);
    flash = 'Idea saved.';
    route();
  };
};
