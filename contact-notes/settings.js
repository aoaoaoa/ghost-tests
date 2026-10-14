'use strict';

// Export, backup, passphrase lock.

const csvCell = (v) => {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, cols) => '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';

function notesMarkdown(notes, contacts, spaces) {
  const out = ['# Contact notes', '', `Exported ${localStamp(new Date()).replace('T', ' ')}`, ''];
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

function ledgerMarkdown(pieces, debriefs) {
  const out = ['# Ledger and debriefs', ''];
  for (const p of pieces) {
    out.push(`## ${p.title}`, '', `${p.kind}, ${p.outlet}, placed ${p.placed}${p.collaborator ? `, with ${p.collaborator}` : ''}. Theme: ${p.theme}.`, '');
    if (p.ideas.length) out.push('Ideas carried:', '', ...p.ideas.map((i) => `- ${i}`), '');
    if (p.reach) out.push(`Reach: ${p.reach.trim()}`, '');
    for (const m of MARKS) {
      const r = (p.reviews || {})[m];
      if (r) out.push(`### ${m} months`, '', `Response: ${r.response}`, '', `Uptake: ${r.uptake}`, '');
    }
    for (const d of debriefs.filter((x) => x.pieceId === p.id)) {
      out.push(`### Debrief, ${d.date}`, '', d.reactions.trim(), '', `From: ${d.fromWhom}. Collaborator returns: ${d.returned}. Written by ${d.author} for ${readerOf(d)}.`, '');
    }
  }
  return out.join('\n');
}

VIEWS.settings = async (_id, _sub, msg) => {
  const locked = await DB.hasLock();
  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <h2>Export</h2>
    <p>Everything stays on this device until you export it. Exports are plain files that open without this app.</p>
    <div class="actions">
      <button type="button" data-x="notes-md">Contact notes (Markdown)</button>
      <button type="button" data-x="notes-csv">Contact notes (CSV)</button>
      <button type="button" data-x="contacts">Contacts (CSV)</button>
      <button type="button" data-x="spaces">Spaces (CSV)</button>
      <button type="button" data-x="ideas">Ideas (CSV)</button>
      <button type="button" data-x="log">Idea log (CSV)</button>
      <button type="button" data-x="syn">Syntheses (Markdown)</button>
      <button type="button" data-x="ledger-csv">Ledger (CSV)</button>
      <button type="button" data-x="ledger-md">Ledger and debriefs (Markdown)</button>
    </div>

    <h2>Backup</h2>
    <p>A full copy, drafts included, for moving to another device.${locked ? ' The backup file is not protected by the passphrase: keep it somewhere safe.' : ''}</p>
    <div class="actions">
      <button type="button" data-x="json">Download backup</button>
      <label class="button">Restore from backup <input type="file" id="restore" accept="application/json,.json" hidden></label>
    </div>

    <h2>Passphrase lock</h2>
    ${!DB.canLock() ? '<p>This browser only allows the lock on a secure address (https, or localhost on this device).</p>'
      : locked ? `<p>The records on this device are encrypted with your passphrase.</p>
        <div class="actions"><button type="button" id="lock-now">Lock now</button><button type="button" id="unlock-off">Remove the passphrase</button></div>
        <form id="change-lock" class="narrow">
          <h3>Change the passphrase</h3>
          <label>New passphrase <input type="password" name="a" autocomplete="new-password"></label>
          <label>Again <input type="password" name="b" autocomplete="new-password"></label>
          <p class="hint">Keep this page open until it says the change is done.</p>
          <button type="submit">Change the passphrase</button>
        </form>`
      : `<p>Encrypts the records on this device. If the passphrase is forgotten, the records cannot be opened again, so download a backup first.</p>
        <form id="set-lock" class="narrow">
          <label>Passphrase <input type="password" name="a" autocomplete="new-password"></label>
          <label>Again <input type="password" name="b" autocomplete="new-password"></label>
          <button type="submit">Set the passphrase</button>
        </form>`}
    <p class="status" id="status"></p>`;

  const status = document.getElementById('status');

  main.querySelectorAll('[data-x]').forEach((b) => b.onclick = async () => {
    const data = {};
    for (const s of DB.RECORDS) data[s] = await DB.all(s);
    const { notes, contacts, spaces, ideas, entries, syntheses, pieces, debriefs } = data;
    const saved = notes.filter((n) => n.status === 'saved').sort((a, b) => a.when.localeCompare(b.when));
    const savedPieces = pieces.filter((p) => p.savedAt).sort((a, b) => a.placed.localeCompare(b.placed));
    const day = today();
    const md = 'text/markdown';
    const csv = 'text/csv';
    switch (b.dataset.x) {
      case 'notes-md': return download(`contact-notes-${day}.md`, notesMarkdown(saved, contacts, spaces), md);
      case 'notes-csv': return download(`contact-notes-${day}.csv`, toCsv(saved.map((n) => ({ ...n, who: whoOf(n), reader: readerOf(n) })),
        ['when', 'whoKind', 'who', 'ideas', 'response', 'theirWords', 'followUp', 'author', 'reader', 'savedAt', 'lastReopened', 'contactId', 'spaceId', 'id']), csv);
      case 'contacts': return download(`contacts-${day}.csv`, toCsv(contacts, ['name', 'organisation', 'role', 'strength', 'firstMet', 'lastContact', 'id']), csv);
      case 'spaces': return download(`spaces-${day}.csv`, toCsv(spaces, ['name', 'date', 'kind', 'id']), csv);
      case 'ideas': return download(`ideas-${day}.csv`, toCsv(ideas.map((i) => ({ ...i, markers: lines(i.markers) })), ['label', 'markers', 'element', 'firstIntroduced', 'status', 'id']), csv);
      case 'log': return download(`idea-log-${day}.csv`, toCsv(entries.filter((e) => e.resonance).sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ ...e, idea: (byId(ideas, e.ideaId) || {}).label })), ['date', 'idea', 'who', 'resonance', 'restatement', 'noteId', 'id']), csv);
      case 'syn': return download(`syntheses-${day}.md`, syntheses.filter((s) => s.savedAt).sort((a, b) => a.date.localeCompare(b.date)).map(synMarkdown).join('\n\n'), md);
      case 'ledger-csv': return download(`ledger-${day}.csv`, toCsv(savedPieces.map((p) => {
        const row = { ...p, reader: readerOf(p) };
        for (const m of MARKS) { const r = (p.reviews || {})[m] || {}; row[`response${m}`] = r.response; row[`uptake${m}`] = r.uptake; }
        return row;
      }), ['placed', 'kind', 'title', 'outlet', 'collaborator', 'theme', 'ideas', 'reach', ...MARKS.flatMap((m) => [`response${m}`, `uptake${m}`]), 'author', 'reader', 'id']), csv);
      case 'ledger-md': return download(`ledger-${day}.md`, ledgerMarkdown(savedPieces, debriefs.filter((d) => d.savedAt)), md);
      case 'json': return download(`contact-notes-backup-${day}.json`, JSON.stringify({ app: 'contact-notes', version: 2, ...data }, null, 2), 'application/json');
    }
  });

  document.getElementById('restore').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'contact-notes' || !Array.isArray(data.notes)) throw new Error('not a backup');
      const stores = DB.RECORDS.filter((k) => Array.isArray(data[k]));
      if (!confirm(`Add ${data.notes.length} notes and the other records in this backup? Records with the same id are replaced.`)) return;
      for (const k of stores) for (const r of data[k]) if (r && r.id) await DB.put(k, r);
      status.textContent = 'Backup restored.';
    } catch (err) {
      status.textContent = 'That file is not a backup from this app.';
    }
    e.target.value = '';
  };

  // Setting and changing are the same step: records are re-encrypted under the new key.
  for (const [formId, done] of [['set-lock', 'Passphrase set. The records are encrypted.'], ['change-lock', 'Passphrase changed.']]) {
    const form = document.getElementById(formId);
    if (!form) continue;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const { a, b } = e.target.elements;
      if (a.value.length < 8) { status.textContent = 'Use at least 8 characters.'; return; }
      if (a.value !== b.value) { status.textContent = 'The two passphrases differ.'; return; }
      status.textContent = 'Encrypting the records…';
      await DB.setLock(a.value);
      flash = done;
      route();
    };
  }
  const lockNow = document.getElementById('lock-now');
  if (lockNow) lockNow.onclick = () => { DB.forget(); route(); };
  const off = document.getElementById('unlock-off');
  if (off) off.onclick = async () => {
    if (!confirm('Remove the passphrase and store the records unencrypted?')) return;
    status.textContent = 'Decrypting the records…';
    await DB.removeLock();
    flash = 'Passphrase removed.';
    route();
  };
};
