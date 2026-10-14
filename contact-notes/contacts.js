'use strict';

// Contacts: who the office talks with, and everything written about each conversation.

VIEWS.contacts = async (_id, _sub, msg) => {
  const contacts = (await DB.all('contacts')).sort((a, b) => (b.lastContact || '').localeCompare(a.lastContact || ''));
  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <h2>Contacts</h2>
    <p class="hint">Most recent contact first. A contact is added when a note names them.</p>
    <input type="search" id="q" placeholder="Filter by name or organisation" aria-label="Filter contacts">
    ${contacts.length ? `<ul class="notes" id="list">${contacts.map((c) => `<li data-text="${esc(lower(`${c.name} ${c.organisation} ${c.role}`))}"><a href="#/contact/${c.id}">
      <strong>${esc(c.name)}</strong>
      <div class="meta">${esc([c.organisation, c.role, c.strength].filter(Boolean).join(' · '))}</div>
      <div class="meta">Last contact ${esc(fmtDate(c.lastContact))}</div></a></li>`).join('')}</ul>`
      : '<p class="empty">No contacts yet.</p>'}`;
  const q = document.getElementById('q');
  q.oninput = () => main.querySelectorAll('#list li').forEach((li) => { li.hidden = !li.dataset.text.includes(lower(q.value)); });
};

VIEWS.contact = async (id, _sub, msg) => {
  const c = await DB.get('contacts', id);
  if (!c) return (location.hash = '#/contacts');
  const [notes, spaces, entries, ideas, pieces] = await Promise.all(['notes', 'spaces', 'entries', 'ideas', 'pieces'].map((s) => DB.all(s)));
  const attended = new Set(spaces.filter((s) => (s.attendees || []).includes(id)).map((s) => s.id));
  const theirNotes = notes.filter((n) => n.status === 'saved' && (n.contactId === id || attended.has(n.spaceId))).sort((a, b) => a.when.localeCompare(b.when));
  const lines_ = entries.filter((e) => e.contactId === id && e.resonance).sort((a, b) => a.date.localeCompare(b.date));
  const theirPieces = pieces.filter((p) => p.savedAt && p.collaboratorId === id);

  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <article class="read">
    <h2>${esc(c.name)}</h2>
    <p class="meta">First met ${esc(fmtDay(c.firstMet))}. Last contact ${esc(fmtDay(c.lastContact))}.</p>
    <h3>Conversations in date order</h3>
    ${theirNotes.length ? `<ul class="notes">${theirNotes.map((n) => `<li><a href="#/note/${n.id}">
      <strong>${esc(fmtDay(n.when))}</strong>${n.whoKind === 'space' ? ` at ${esc(n.spaceName)}` : ''}
      <div class="meta">${esc(n.ideas.join(', '))}</div></a></li>`).join('')}</ul>` : '<p class="empty">No saved notes.</p>'}
    <h3>Idea log</h3>
    ${lines_.length ? lines_.map((e) => `<div class="line"><p><span class="meta">${esc(fmtDay(e.date))}</span> · <a href="#/idea/${e.ideaId}">${esc((byId(ideas, e.ideaId) || {}).label || '')}</a> · ${esc(e.resonance)}</p>
      ${e.restatement ? `<blockquote>${esc(e.restatement)}</blockquote>` : ''}</div>`).join('') : '<p class="empty">No lines logged.</p>'}
    ${theirPieces.length ? `<h3>Pieces as collaborator</h3><ul class="plain">${theirPieces.map((p) => `<li><a href="#/piece/${p.id}">${esc(p.title)}</a>, ${esc(p.outlet)}</li>`).join('')}</ul>` : ''}
    </article>
    <form id="cf" novalidate>
      <h3>Details</h3>
      <div class="row">
        <label>Organisation <input type="text" name="organisation" value="${esc(c.organisation)}"></label>
        <label>Role <input type="text" name="role" value="${esc(c.role)}"></label>
      </div>
      <label>Relationship <select name="strength">${STRENGTHS.map((s) => `<option ${c.strength === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <div class="actions"><button class="primary" type="submit">Save</button><a class="button" href="#/contacts">All contacts</a></div>
    </form>`;

  document.getElementById('cf').onsubmit = async (e) => {
    e.preventDefault();
    const el = e.target.elements;
    Object.assign(c, { organisation: el.organisation.value.trim(), role: el.role.value.trim(), strength: el.strength.value });
    await DB.put('contacts', c);
    flash = 'Contact saved.';
    route();
  };
};
