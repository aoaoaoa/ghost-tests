# Writing a theme

A theme is one world, drawn in one material. Decide both before writing a line.

## The seven that exist

| name | world | material | palette core |
|---|---|---|---|
| garden_blush | daylight tropical garden | torn pastel paper | blush, olive, chartreuse, coral |
| dusk_reef | reef at evening | torn paper, wave lines | sand, teal, indigo, terracotta |
| high_desert | mesa at noon | cut paper, agave, prickly pear | bone, cactus, rust, saffron |
| northern_night | aurora over ridgelines | layered sky strips, silhouettes | navy, ice, aurora green, gold |
| tiled_garden | Persian courtyard | glazed tile, plaster, arches | ivory, cobalt, turquoise, saffron |
| print_shop | risograph proof | misregistered ink layers, halftone | kraft, charcoal, vermilion, riso blue |
| stained_glass | rose window | leaded jewel panes | lead, ruby, amber, sapphire |

Each reference script in `reference/` is the canonical look. Port, do not reinterpret.

## Recipe for a new theme

1. **Name the world in two words.** Harbour fog. Letterpress menu. Monsoon market. If it needs a sentence,
   it is not one world yet.
2. **Pick the material.** Paper, ink, glass, tile, thread, enamel. The material decides edge quality:
   torn (jitter 6 to 8 px at S=1080), cut (clean polygon), printed (multiply layers, offset 6 to 10 px),
   leaded (dark outline 8 to 10 px).
3. **Six grounds, six inks.** Grounds are the light tones the star reads against; inks are the dark or
   saturated cuts. Name every token. A theme with twelve tokens is at the limit; eight is better.
4. **Three to five motifs**, each a function of `(d, r, ...)` under 15 lines. One motif should be unique
   to this world (a fan shell, a prickly pear, a registration mark). The star is not a motif; it is given.
5. **Compose in layers, back to front:** ground, large panels, textures clipped to regions, motifs,
   one covering panel to tie layers, final specks. Count: 6 to 12 panels, 2 to 4 motifs. More is clutter.
6. **Three star modes.** One filled, one linear, one with a counter-turning or orbiting secondary.
   The star must be the brightest or the darkest thing in its region, never mid-tone on mid-tone.
7. **Render twelve at S=480 first.** Look at the contact sheet. Kill anything muddy. Then render at 1080.

## Signs a theme is wrong

- Two pieces in a batch look like the same piece. Reduce panel count variance or widen motif placement.
- The star is hard to find. Raise its contrast against the local ground, or place it in a quieter region
  (`place_star` may sample candidate positions and pick the one with the lowest local variance).
- The palette reads as grey at thumbnail size. Drop the mid-tones; keep lights and darks.
- The loop visibly jumps. A secondary rotation is not an integer multiple of 2π/9.

## Theme ideas not yet built

harbour_fog (grey-blue, rope, buoys, lighthouse beam as the ray mode) · letterpress_menu (cream, black,
one red, type ornaments, rule lines) · monsoon_market (saffron, magenta, indigo, awnings, rain lines) ·
lantern_festival (vermilion, gold, night, paper lanterns, the star as a lantern) · quilt_block (calico
prints, patchwork grid, running stitch outlines) · deep_sea (ink black, bioluminescent teal, the star as
the only light) · snow_day (white, pale blue, graphite, footprints, pine) · terrazzo (chips in a resin
field, the star as an inlaid tile)
