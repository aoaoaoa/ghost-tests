# Contact notes (prototype 1)

The first of five prototypes in `CLAUDE.md`: writing a contact note on a phone within 48 hours of a conversation or space.

## Run it

Any static file server works. From this folder:

    python3 -m http.server 8765

Then open `http://localhost:8765` on the phone (same network, or served from the convenor's machine). Data lives in the browser's IndexedDB on that device and nowhere else.

## What it does

- A note answers four prompts: who or where, the idea tested, how they responded (with their exact words, optional), and the follow-up agreed. Fields start empty; the app supplies prompts, never text.
- A note cannot be saved without a reader (Office, Convenor, or a named person) or an author.
- Drafts are kept as you type and listed with the time left in the 48-hour window.
- Saved notes are listed by week. Opening a note records the date it was last reopened.
- Contacts and spaces are created from the note; a known name fills in organisation and role.
- Export: notes as Markdown and CSV, contacts and spaces as CSV, and a full JSON backup with restore.

## Dictation

A transcript, dictated or pasted, is raw material. Save stays disabled until the officer has changed it.

Browser speech recognition usually sends audio to a remote service, which breaks principle 7. Dictation is therefore offered only where the browser can recognise speech on the device (`SpeechRecognition.available({ processLocally: true })`, recent Chrome). Elsewhere the officer can paste a transcript, which is held to the same rule.

## Test

With the server running:

    NODE_PATH=$(npm root -g) node test/smoke.js

It walks the whole flow on a 390 px viewport with a stand-in for on-device speech.

## Not yet

Idea log, weekly hour, cycle synthesis, ledger (prototypes 2 to 5); the two-cycle "not reopened" flag (the date is stored now); space attendees; passphrase lock.
