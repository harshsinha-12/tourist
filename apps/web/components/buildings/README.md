# File buildings

Every `CitySnapshot.buildings` entry renders one `FileBuilding` React component.
The city no longer depends on the generated island image. Ground and roads come
from snapshot bounds; building positions come from the repository layout generator.

The surrounding island art is kept separately in `assets/environment`. The three
transparent sheets are split into 33 published sprites by
`scripts/split-environment-sheets.py`; `CityCanvas` places those sprites for trees,
roads, lamps, vehicles, piers, ships, clouds, fountains, and landmarks. Their
motion is deliberately expressed in the renderer so the same art can be reused
at different positions and speeds.

## Add or change a design

1. Add an entry to [`assets/buildings/catalog.json`](../../../../assets/buildings/catalog.json)
   with the file extensions and language aliases that should use the building.
   Extensions take priority over language metadata; matching ignores case.
2. Drop the generated PNG in `assets/buildings/sources/{id}.png`, named after the
   catalog `id` (`javascript.png` → `.js` / `.mjs` / `.cjs`).
3. Run `pnpm prepare-buildings` (or `--watch` while artwork is still landing).
   That converts new PNGs to transparent webp sprites, copies the catalog into
   the web app, and publishes `available-sprites.json`.
4. Types without a sprite yet keep using the SVG `BuildingModel` stand-in, so the
   city stays complete while generation is in progress.

Unmapped files always use the `generic` catalog entry. The matching layer is
separate from rendering, so adding a design requires no changes to `CityCanvas`
or the snapshot schema. File purpose remains in the inspector; language
determines architecture. Files over 400 LOC receive an extra floor on the SVG
stand-in. Landmarks reuse the same catalog artwork.

## Verification

`pnpm test` includes extension precedence, language aliases, unknown types,
source-PNG-to-catalog coverage, and dense-directory layout containment.
`pnpm typecheck` and `pnpm build` validate the components and application.
