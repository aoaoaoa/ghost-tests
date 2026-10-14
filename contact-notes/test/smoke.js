// Walks through prototype 1 on a phone-sized screen.
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
  assert.match(await page.locator('article').innerText(), /Last reopened before today's reading/);

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

  // Exports.
  await page.goto(URL + '#/export');
  for (const [x, re] of [['md', /## .*Amina Okafor \(City Interfaith Council\)[\s\S]*### Follow-up agreed/], ['notes', /Housing roundtable/], ['contacts', /Amina Okafor/]]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`[data-x=${x}]`)]);
    assert.match(fs.readFileSync(await dl.path(), 'utf8'), re, `export ${x}`);
  }

  // Window turns late for an old conversation.
  await page.goto(URL + '#/new');
  await page.waitForSelector('#f');
  await page.fill('[name=when]', '2026-01-01T10:00');
  assert.match(await page.locator('#win').innerText(), /window closed/);

  await page.screenshot({ path: process.env.SHOT || 'test/last-run.png', fullPage: true });
  assert.deepStrictEqual(errors, []);
  await browser.close();
  console.log('All checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
