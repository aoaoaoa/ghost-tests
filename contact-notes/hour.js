'use strict';

// Prototype 3: the weekly hour. Stages one and two reuse the notes and idea log pages;
// the bar in core.js keeps the timer and hides everything else.

async function lastSynthesis() {
  const all = (await DB.all('syntheses')).filter((s) => s.savedAt).sort((a, b) => b.date.localeCompare(a.date));
  return all.find((s) => s.approvedAt) || all[0] || null;
}

function synthesisArticle(s) {
  return `<article class="read synthesis">
    <h2>Cycle ${esc(s.cycle)} synthesis</h2>
    <p class="meta">${esc(fmtDay(s.date))} · written by ${esc(s.author)} for ${esc(readerOf(s))}
      · ${s.approvedAt ? `approved by ${esc(s.approvedBy)} on ${esc(fmtDate(s.approvedAt))}` : 'not yet approved by the convenor'}</p>
    <h3>What the office now reads in the discourse</h3><p>${esc(s.reading)}</p>
    <h3>What advanced</h3><p>${esc(s.advanced)}</p>
    <h3>What the office will try next cycle</h3><p>${esc(s.next)}</p>
  </article>`;
}

VIEWS.hour = async (_id, _sub, msg) => {
  if (SETTINGS.hour) {
    const s = await lastSynthesis();
    if (s) await markReopened('syntheses', s);
    main.innerHTML = s ? synthesisArticle(s) : '<p class="empty">There is no cycle synthesis yet. Use the time to reread last week\'s notes once the hour ends.</p>';
    return;
  }
  const past = (SETTINGS.hours || []).slice().reverse().slice(0, 8);
  main.innerHTML = `
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <h2>The weekly hour</h2>
    <ol class="stages">${STAGES.map((st) => `<li><strong>${esc(st.label)}</strong>, ${st.min} minutes</li>`).join('')}</ol>
    <p>Each stage shows its timer and its own work, nothing else. When the time is up the stage stays open until you move on.</p>
    <p class="actions"><button type="button" class="primary" id="start">Start the hour</button></p>
    <h3>Recent hours</h3>
    ${past.length ? `<ul class="plain">${past.map((h) => `<li>${esc(fmtDayTime(h.startedAt))}: ${h.finished ? 'all three stages' : `ended at stage ${h.stagesReached}`}</li>`).join('')}</ul>` : '<p class="empty">None yet.</p>'}`;
  document.getElementById('start').onclick = () => Hour.start();
};
