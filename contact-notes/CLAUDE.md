# Handoff brief: documentation app for discourse and defence officers

Drop this file into the project root as `CLAUDE.md`, or point Claude Code at it with "read handoff-brief.md and build prototype 1".

## Purpose

An app for a small volunteer office (two to six people) that spends 80 percent of its time in conversation with social actors and 20 percent recording what it learned. The officers are unfamiliar with documentation. The app's job is to make the 20 percent easy to start and hard to skip, while keeping the thinking with the officer.

The governing criterion, decided in consultation: the tool must make the officer think and write and keep that thinking visible. It must not produce the record for them. Four commercial tools (Superhuman Docs, Tettra, ClickUp, Slite) were reviewed and rejected on this criterion; each sells the removal of writing.

## Users

- Officer: attends spaces and conversations, writes contact notes, maintains the idea log.
- Convenor: runs cycle reflection meetings, writes the cycle synthesis, checks the records exist and were used.
- National Assembly reader: reads the cycle synthesis twice a year; never edits.

## The four records

| Record | Written when | Length | Reader | Answers |
| --- | --- | --- | --- | --- |
| Contact note | Within 48 hours of a conversation or space | 5 to 10 lines | Office | Who, where, what idea was tested, how they responded, agreed follow-up |
| Idea log | Updated as contact notes accumulate | One line per idea per contact | Office | Which ideas resonate, with whom, in what words they restate them |
| Cycle synthesis | At each cycle reflection meeting (every 3 to 4 months) | One page | National Assembly | What the office now reads in the discourse, what advanced, what it will try next |
| Collaborator debrief | After each placed op-ed or joint activity | Half a page | Office and ledger | Reactions received, by whom, whether the collaborator returns |

An op-ed ledger sits on top: one row per placed piece with theme, outlet, collaborator, date, marker concepts and phrasings, and response and uptake recorded at 3, 6 and 12 months.

## Design principles (enforce these in the build)

1. The officer writes the first sentence. No field is pre-filled with generated prose. Templates supply headings and prompts, never text.
2. Voice capture is allowed only for the contact note, and only as a transcript the officer must edit before saving. The save button is disabled until the transcript has been changed.
3. No AI drafting of the cycle synthesis. The app may show the officer their own contact notes and idea log entries for the cycle side by side with the synthesis template. It may not summarize them.
4. Verification is built in. Every record carries a "last reopened" date. A record not reopened in two cycles is flagged for shortening or merging, and the flag is shown at the next reflection meeting.
5. Every record has a named reader. Creating a record requires choosing one. A record with no reader cannot be saved.
6. Time-boxed. The weekly documentation session is one hour: 30 minutes contact notes, 15 minutes idea log, 15 minutes rereading the last synthesis. The app shows a timer per stage and nothing else during that stage.
7. Nothing about a social actor leaves the office's own storage. No third-party AI calls on contact data until a data-handling review is passed. Local-first storage.
8. Plain words. No dashboard language, no "insights", no badges.

## Data model (minimum)

- Contact: name, organisation, role, relationship strength (one of: new, developing, close), first met, last contact.
- Space: name, date, kind (conference, roundtable, visit, online), attendees (contacts).
- ContactNote: date, contact or space, idea(s) tested, response (free text), their words (verbatim phrase, optional), follow-up, author, reader, last reopened.
- Idea: label, marker phrasing(s), concept vs messaging element, first introduced, status.
- IdeaLogEntry: idea, contact, date, resonance (one of: rejected, neutral, interested, adopted), their restatement (free text).
- Piece: title, outlet, collaborator, date placed, theme, ideas carried, reach fields, response fields at 3/6/12 months, uptake fields at 3/6/12 months.
- Debrief: piece, date, reactions, from whom, collaborator returned (yes/no/unknown).
- CycleSynthesis: cycle number, date, reading of the discourse, what advanced, next cycle, author, reader, approved by convenor.

## Prototype sequence

Build in this order. Each is usable on its own.

1. **Contact note capture.** Create a contact note in under two minutes on a phone. Template with the five prompts. Voice transcript optional, must be edited before save. List of notes by week. Shows the 48-hour window on each unsaved draft.
2. **Idea log.** Ideas as a list; adding a note tags ideas; a per-idea view shows every contact's response and restatement in date order. The view is a reading page, not a chart.
3. **Weekly hour.** The timed three-stage session. Stage three displays the last cycle synthesis read-only.
4. **Cycle synthesis.** Template on the left, the cycle's notes and idea entries on the right, filterable. Save requires a reader. Convenor approval state.
5. **Ledger and debrief.** Pieces table; debrief form; reminders at 3, 6 and 12 months that open the piece with its ideas and ask the uptake questions.

## Technical suggestions

- Single-user local-first web app to start (SQLite or IndexedDB), with sync as a later step. The office may never need multi-device sync if the convenor's machine is the record.
- No authentication in prototype 1. Add a passphrase lock in prototype 2.
- Export everything to Markdown and CSV at any time. The records must outlive the app.
- Mobile-first for prototype 1 only; the rest is desktop.

## Open questions for the officers

- Which cycle length: three months or four?
- Does the Assembly want the synthesis as a page in the app or as an exported document?
- Should collaborators (non-officers) be able to write debriefs themselves, or does the officer write them after a conversation?
- What is the office's existing storage (Google Workspace, local files) so export formats match?

## Sources behind this brief

- Office of Public Discourse, *Evolving Engagement with the Wider Society*, draft, October 2026
- Office of Public Discourse, *A National Spiritual Assembly's Engagement with its Office of External Affairs: An Illustrative Case Study*, draft, October 2026
- Diátaxis (diataxis.fr): keep records for looking up (contact note) apart from records for understanding (synthesis)
- Emerson, Fretz and Shaw, *Writing Ethnographic Fieldnotes*: jottings in the moment, full notes within a day
- Working doc from this consultation: "Documentation as a Fifth of the Work"
