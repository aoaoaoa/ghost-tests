# Contact notes

All five prototypes in `CLAUDE.md`: contact notes, idea log, weekly hour, cycle synthesis, ledger and debriefs.

## Run it

Any static file server works. From this folder:

    python3 -m http.server 8765

Then open `http://localhost:8765` on the phone (same network, or served from the convenor's machine). Data lives in the browser's IndexedDB on that device and nowhere else.

## What it does

**Contact notes** (phone). Four prompts: who or where, the idea tested, how they responded (with their exact words, optional), the follow-up agreed. Fields start empty. Drafts are kept as you type and show the time left in the 48-hour window. Saved notes are listed by week. A note about a space can name who you spoke with there.

**Contacts.** Each contact has a page with every conversation (including spaces they attended), their idea log lines and any pieces they collaborated on, in date order.

**Idea log.** Each idea named in a saved note waits as a line to log: how it landed (rejected, neutral, interested, adopted) and how they restated it. Each idea has a reading page with every response in date order, plus its marker phrasings, kind and status.

**Weekly hour.** Three timed stages: contact notes (30 min), idea log (15), rereading the last synthesis (15). During a stage the app shows its timer and that stage's work, nothing else. The hour survives a reload.

**Cycle synthesis** (desktop). The three-part template sits beside the cycle's own notes, idea log lines and debriefs, filterable by word, idea and kind, shown as written. Save requires a reader. The convenor approves it, which fixes the text until approval is withdrawn. Records not reopened in two cycles are listed beside it for shortening or merging. Downloads as a Word document (.docx) for upload to Google Drive, where it opens in Google Docs. Built on the device; nothing is sent anywhere.

**Ledger and debriefs.** One row per piece or joint activity. Reviews fall due at 3, 6 and 12 months; each opens the piece with its ideas and marker phrasings and asks the response and uptake questions. Due reviews also show on the notes page. Debriefs record reactions, from whom, and whether the collaborator returns.

**Throughout.** Every record needs a named reader and author before it saves, and carries a last-reopened date. Cycles are three months; a record not reopened in six is flagged. Settings holds every export (Markdown and CSV), a full backup and restore, and the passphrase lock.

## Passphrase lock

With a passphrase set, every record is encrypted on the device (AES-GCM, key derived with PBKDF2) and the app opens on a lock screen. The passphrase can be changed or removed in Settings. A forgotten passphrase cannot be recovered, so take a backup first. Backups are not encrypted. The browser allows the lock only on https or localhost.

## Dictation

A transcript, dictated or pasted, is raw material. Save stays disabled until the officer has changed it.

Browser speech recognition usually sends audio to a remote service, which breaks principle 7. Dictation is therefore offered only where the browser can recognise speech on the device (`SpeechRecognition.available({ processLocally: true })`, recent Chrome). Elsewhere the officer can paste a transcript, which is held to the same rule.

## Test

With the server running:

    NODE_PATH=$(npm root -g) node test/smoke.js

It walks every prototype, notes on a 390 px viewport and the rest at desktop width, with a stand-in for on-device speech.

## Not yet

Sync between devices: the brief leaves it for later, and the convenor's machine may be enough.
