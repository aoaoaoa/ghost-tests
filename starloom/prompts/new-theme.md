# New theme prompt

Fill the three blanks and paste.

---

New theme: `<snake_name>`. World: <two words>. Material: <paper | ink | glass | tile | thread | enamel>.

Follow docs/THEMES.md, "Recipe for a new theme", step by step. Before writing code, list the palette
tokens (six grounds, six inks, named) and the three to five motifs in one short block and wait for my
reply. Then write `themes/<snake_name>.py` under 150 lines, using `draw.py` helpers, with three star
modes. Render thirty-six at S=480, write the contact sheet, and tell me which pieces you would reject
and why. Do not render at 1080 until I say the theme is right.

---

# Batch prompt

Render <N> of `<theme>` with `--unique`, format <gif | apng | mp4>, and give me the contact sheet and
the manifest path. If any piece fails the contrast-at-the-star rule in docs/TASTE.md, say which seeds
and leave them out of the delivery.
