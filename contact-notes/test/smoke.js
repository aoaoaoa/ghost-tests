// Walks through all five prototypes: notes on a phone-sized screen, the rest on a desktop one.
// Run: python3 -m http.server 8765 (in contact-notes/), then node test/smoke.js
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');

const URL = process.env.APP_URL || 'http://localhost:8765/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  // Stand-in for on-device speech recognition; headless Chromium has none.
  await page.addInitScript(() => {
    class FakeSR {
      static async available() { return 'available'; }
      start() { setTimeout(() => this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'she said unity sounds like erasure' }], { isFinal: true })] })); }
      stop() { this.onend(); }
    }
    window.SpeechRecognition = FakeSR;
    delete window.webkitSpeechRecognition;
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const save = page.locator('#save');
  const needed = page.locator('#needed');

  await page.goto(URL + '#/new');
  await page.waitForSelector('#f');

  // Nothing pre-filled with prose; save starts disabled.
  for (const k of ['response', 'followUp', 'ideas', 'theirWords', 'transcript']) {
    assert.strictEqual(await page.inputValue(`[name=${k}]`), '', `${k} should start empty`);
  }
  assert(await save.isDisabled(), 'save disabled on blank note');
  assert.match(await page.locator('#win').innerText(), /hours left/);

  await page.fill('[name=contactName]', 'Amina Okafor');
  await page.fill('[name=organisation]', 'City Interfaith Council');
  await page.fill('[name=ideas]', 'Shared civic purpose');
  await page.fill('[name=response]', 'Agreed in principle, wary of the word "unity".');
  await page.fill('[name=followUp]', 'Send her the draft by Friday.');
  await page.fill('[name=author]', 'Tunde');

  // Reader required.
  assert(await save.isDisabled(), 'save disabled without reader');
  assert.match(await needed.innerText(), /a reader/);
  await page.selectOption('[name=readerChoice]', 'Office');
  assert(!(await save.isDisabled()), 'save enabled once complete');

  // A dictated transcript blocks saving until it is edited.
  await page.locator('details summary').click();
  await page.click('#mic');
  await page.waitForFunction(() => document.querySelector('[name=transcript]').value.includes('erasure'));
  await page.click('#mic');
  assert(await save.isDisabled(), 'save disabled with unedited dictation');
  assert.match(await needed.innerText(), /Edit the transcript/);

  // So does a pasted one.
  await page.fill('[name=transcript]', '');
  await page.locator('[name=transcript]').evaluate((ta) => {
    ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));
    ta.value = 'pasted from a recorder app';
  });
  await page.waitForTimeout(50);
  assert(await save.isDisabled(), 'save disabled with unedited paste');
  assert.match(await needed.innerText(), /Edit the transcript/);
  await page.fill('[name=transcript]', 'She said "unity" sounds like erasure. Worth testing "common ground" instead.');
  assert(!(await save.isDisabled()), 'save enabled after transcript edited');

  // Draft is kept when leaving at once, survives a reload, and shows its window.
  await page.click('nav >> text=Notes');
  await page.waitForSelector('text=Drafts');
  await page.reload();
  await page.waitForSelector('h2');
  assert.match(await page.locator('ul.notes').first().innerText(), /Amina Okafor[\s\S]*hours left/);

  // Open the draft and save.
  await page.click('text=Amina Okafor');
  await page.waitForSelector('#f');
  await page.click('#save');
  await page.waitForSelector('text=Note saved.');
  assert.match(await page.locator('main').innerText(), /No drafts\.[\s\S]*Week of[\s\S]*Amina Okafor/);

  // Reopening records the date.
  await page.click('text=Amina Okafor');
  await page.waitForSelector('article');
  assert.match(await page.locator('article').innerText(), /Not reopened since it was saved/);
  await page.goto(URL + '#/notes');
  await page.click('text=Amina Okafor');
  await page.waitForSelector('article');
  assert.match(await page.locator('article').innerText(), /Last reopened before this reading/);

  // Second note: known contact is recognised, idea suggestion offered, author remembered.
  await page.goto(URL + '#/new');
  await page.waitForSelector('#f');
  assert.strictEqual(await page.inputValue('[name=author]'), 'Tunde');
  await page.fill('[name=contactName]', 'amina okafor');
  assert.match(await page.locator('#known').innerText(), /Known contact/);
  assert.strictEqual(await page.inputValue('[name=organisation]'), 'City Interfaith Council');
  await page.click('[data-idea="Shared civic purpose"]');
  assert.strictEqual(await page.inputValue('[name=ideas]'), 'Shared civic purpose');

  // A space instead of a person.
  await page.goto(URL + '#/new');
  await page.waitForSelector('#f');
  await page.check('[value=space]');
  assert(await page.locator('#who-contact').isHidden());
  await page.fill('[name=spaceName]', 'Housing roundtable');
  await page.selectOption('[name=spaceKind]', 'roundtable');
  await page.fill('[name=ideas]', 'Shared civic purpose');
  await page.fill('[name=response]', 'Two councillors picked it up.');
  await page.fill('[name=followUp]', 'none');
  await page.selectOption('[name=readerChoice]', 'person');
  assert(await save.isDisabled(), 'named reader needs a name');
  await page.fill('[name=readerName]', 'Grace');
  await page.click('#save');
  await page.waitForSelector('text=Note saved.');

  // Window turns late for an old conversation.
  await page.goto(URL + '#/new');
  await page.waitForSelector('#f');
  await page.fill('[name=when]', '2026-01-01T10:00');
  assert.match(await page.locator('#win').innerText(), /window closed/);
  page.on('dialog', (d) => d.accept());
  await page.click('#discard');
  await page.waitForFunction(() => location.hash === '#/notes');

  // The rest is desktop.
  await page.setViewportSize({ width: 1280, height: 900 });
  const text = () => page.locator('main').innerText();
  const go = async (hash) => {
    await page.evaluate(() => { delete document.getElementById('main').dataset.route; });
    await page.goto(URL + hash);
    await page.waitForFunction(() => document.getElementById('main').dataset.route === location.hash);
  };

  // ---- Prototype 2: idea log ----
  await go('#/ideas');
  assert.strictEqual(await page.locator('form.entry').count(), 2, 'one line waiting per note per idea');
  const first = page.locator('form.entry', { hasText: 'Amina Okafor' });
  assert.match(await first.innerText(), /Shared civic purpose with Amina Okafor/);
  await first.locator('button').click();
  assert.strictEqual(await page.locator('form.entry').count(), 2, 'line needs a resonance');
  await first.locator('label:has-text("adopted")').click();
  await first.locator('[name=restatement]').fill('A city that belongs to all of us');
  await first.locator('button').click();
  await page.waitForSelector('text=Line saved.');
  assert.strictEqual(await page.locator('form.entry').count(), 1);
  assert.match(await text(), /Logged with 1 contact: 1 adopted/);
  await page.click('a:has-text("Shared civic purpose")');
  await page.waitForSelector('#idea-form');
  assert.match(await text(), /Amina Okafor · adopted[\s\S]*A city that belongs to all of us/);
  await page.fill('[name=markers]', 'belongs to all of us\ncommon ground');
  await page.selectOption('[name=element]', 'concept');
  await page.click('#idea-form button[type=submit]');
  await page.waitForSelector('text=Idea saved.');

  // ---- Prototype 3: the weekly hour ----
  await go('#/hour');
  await page.click('#start');
  await page.waitForSelector('#hourbar:not([hidden])');
  assert(await page.locator('nav').isHidden(), 'nav hidden during the hour');
  assert.match(await page.locator('#hourbar').innerText(), /Stage 1 of 3: Contact notes[\s\S]*(29|30):\d\d left/);
  assert.doesNotMatch(await text(), /Notes by week/, 'stage 1 shows only its own work');
  await page.goto(URL + '#/ledger');
  await page.waitForFunction(() => location.hash === '#/notes');
  await page.click('#hour-next');
  await page.waitForSelector('text=To log');
  assert.match(await page.locator('#hourbar').innerText(), /Stage 2 of 3: Idea log/);
  await page.click('#hour-next');
  await page.waitForFunction(() => location.hash === '#/hour');
  assert.match(await text(), /no cycle synthesis yet/);
  await page.reload();
  await page.waitForSelector('#hourbar:not([hidden])');
  assert.match(await page.locator('#hourbar').innerText(), /Stage 3 of 3/, 'the hour survives a reload');
  await page.click('#hour-next');
  await page.waitForSelector('text=The hour is finished.');
  assert(await page.locator('nav').isVisible());
  assert.match(await text(), /all three stages/);

  // ---- Prototype 4: cycle synthesis ----
  // An old note, saved long ago and never reopened, for the two-cycle flag.
  await page.evaluate(() => DB.put('notes', {
    id: 'old-note', status: 'saved', when: '2025-01-10T10:00', whoKind: 'contact', contactName: 'Old Contact', ideas: [],
    response: 'Old response', theirWords: '', followUp: 'none', readerChoice: 'Office', readerName: '', author: 'Tunde',
    savedAt: '2025-01-10T12:00:00.000Z', lastReopened: null, transcript: '',
  }));
  await go('#/synthesis');
  await page.click('text=Start the next synthesis');
  await page.waitForSelector('#f');
  assert.match(await page.locator('#f h2').innerText(), /Cycle 1/);
  for (const k of ['reading', 'advanced', 'next']) assert.strictEqual(await page.inputValue(`[name=${k}]`), '', `${k} starts empty`);
  const aside = page.locator('aside');
  assert.match(await aside.innerText(), /Not reopened in two cycles[\s\S]*Old Contact/);
  assert.match(await aside.innerText(), /Agreed in principle[\s\S]*A city that belongs to all of us/, 'cycle material shown as written');
  await page.fill('#q', 'roundtable');
  assert.match(await page.locator('#shown').innerText(), /^1 record/);
  await page.fill('#q', '');
  await page.fill('[name=reading]', 'Unity language reads as erasure to some; common ground travels better.');
  await page.fill('[name=advanced]', 'Shared civic purpose adopted by one council contact.');
  await page.fill('[name=next]', 'Test "common ground" with the housing roundtable.');
  assert(await page.locator('#save').isDisabled(), 'synthesis needs a reader');
  await page.selectOption('[name=readerChoice]', 'National Assembly');
  assert(!(await page.locator('#save').isDisabled()));
  assert(await page.locator('#approve').isDisabled(), 'approve only after saving');
  await page.click('#save');
  await page.waitForSelector('text=Synthesis saved.');
  await page.fill('#approver', 'Grace');
  await page.click('#approve');
  await page.waitForSelector('text=Approved.');
  assert(await page.locator('[name=reading]').getAttribute('readonly') !== null, 'approved text is fixed');
  {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#md')]);
    assert.match(fs.readFileSync(await dl.path(), 'utf8'), /# Cycle 1 synthesis[\s\S]*Approved by Grace[\s\S]*## What advanced/);
  }
  await go('#/hour');
  await page.click('#start');
  await page.click('#hour-next');
  await page.click('#hour-next');
  await page.waitForSelector('article.synthesis');
  assert.match(await text(), /Cycle 1 synthesis[\s\S]*approved by Grace/, 'stage three shows the last synthesis');
  await page.click('#hour-end');
  await page.waitForSelector('text=The hour was ended early.');

  // ---- Prototype 5: ledger, reviews and debriefs ----
  const placed = await page.evaluate(() => addMonths(today(), -7));
  await go('#/piece/new');
  await page.fill('[name=title]', 'Our streets, our common ground');
  await page.fill('[name=outlet]', 'City Herald');
  await page.fill('[name=placed]', placed);
  await page.fill('[name=collaborator]', 'Amina Okafor');
  await page.fill('[name=theme]', 'Housing');
  await page.click('[data-idea="Shared civic purpose"]');
  assert(await page.locator('#save').isDisabled(), 'piece needs a reader');
  await page.selectOption('[name=readerChoice]', 'Office');
  await page.click('#save');
  await page.waitForSelector('p.status:text-is("Saved.")');
  assert.match(await text(), /3 months[\s\S]*Write the 3-month review[\s\S]*6 months[\s\S]*Write the 6-month review[\s\S]*12 months[\s\S]*Due from/);
  await go('#/notes');
  assert.match(await text(), /Reviews due[\s\S]*3-month review[\s\S]*6-month review/);
  await page.click('text=3-month review');
  await page.waitForSelector('#f');
  assert.match(await text(), /Shared civic purpose[\s\S]*Marker phrasings: belongs to all of us · common ground/);
  assert(await page.locator('#save').isDisabled());
  await page.fill('[name=response]', 'Two letters to the editor.');
  await page.fill('[name=uptake]', 'A councillor used "common ground" in a housing debate.');
  await page.click('#save');
  await page.waitForSelector('text=3-month review saved.');
  await page.click('text=Write a debrief');
  await page.waitForSelector('#f');
  await page.fill('[name=reactions]', 'Readers asked for a follow-up piece.');
  await page.fill('[name=fromWhom]', 'Herald editor');
  await page.click('label:has-text("yes")');
  await page.selectOption('[name=readerChoice]', 'Office');
  await page.click('#save');
  await page.waitForSelector('text=Debrief saved.');
  await go('#/ledger');
  assert.match(await page.locator('table').innerText(), /Our streets, our common ground[\s\S]*City Herald[\s\S]*written\tdue/);

  // ---- Export ----
  await go('#/settings');
  for (const [x, re] of [
    ['notes-md', /## .*Amina Okafor \(City Interfaith Council\)[\s\S]*### Follow-up agreed/],
    ['notes-csv', /Housing roundtable/], ['contacts', /Amina Okafor/], ['spaces', /Housing roundtable/],
    ['ideas', /Shared civic purpose,belongs to all of us; common ground,concept/],
    ['log', /Shared civic purpose,Amina Okafor,adopted,A city that belongs to all of us/],
    ['syn', /Cycle 1 synthesis/], ['ledger-csv', /City Herald[\s\S]*Two letters/], ['ledger-md', /Debrief[\s\S]*Herald editor/],
    ['json', /"syntheses"/],
  ]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`[data-x=${x}]`)]);
    assert.match(fs.readFileSync(await dl.path(), 'utf8'), re, `export ${x}`);
  }

  // ---- Passphrase lock ----
  await page.fill('[name=a]', 'correct horse');
  await page.fill('[name=b]', 'correct horse');
  await page.click('#set-lock button');
  await page.waitForSelector('text=Passphrase set.');
  const rawNote = await page.evaluate(() => new Promise((res) => {
    indexedDB.open('contact-notes').onsuccess = (e) => {
      const r = e.target.result.transaction('notes').objectStore('notes').get('old-note');
      r.onsuccess = () => res({ sealed: r.result.sealed, plain: 'response' in r.result });
    };
  }));
  assert.deepStrictEqual(rawNote, { sealed: true, plain: false }, 'records are encrypted at rest');
  await page.reload();
  await page.waitForSelector('#unlock');
  assert(await page.locator('nav').isHidden());
  await page.fill('[name=pass]', 'wrong one');
  await page.click('#unlock button');
  await page.waitForSelector('text=does not open');
  await page.fill('[name=pass]', 'correct horse');
  await page.click('#unlock button');
  await page.waitForSelector('#unlock-off');
  await go('#/notes');
  assert.match(await text(), /Amina Okafor/);
  await go('#/settings');
  await page.click('#unlock-off');
  await page.waitForSelector('text=Passphrase removed.');
  await page.reload();
  await page.waitForSelector('#set-lock');

  await page.screenshot({ path: process.env.SHOT || 'test/last-run.png', fullPage: true });
  assert.deepStrictEqual(errors, []);
  await browser.close();
  console.log('All checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
