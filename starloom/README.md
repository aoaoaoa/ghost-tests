# starloom

Batches of unique, looping, 1080 × 1080 illustrations: a themed cut-paper or printed composition with one
nine-pointed star turning over it. Reproducible from `theme + seed`, unbounded in count.

Start in Claude Code with `prompts/kickoff.md`. Add worlds with `prompts/new-theme.md`.
The rules are in `CLAUDE.md`; the design is in `docs/`; the approved looks are in `reference/`.

Run a reference directly while the package is being built:

    python reference/stained_glass.py out/

Each reference writes twelve GIFs to the directory given.
