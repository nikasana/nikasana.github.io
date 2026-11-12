# Lift: progress

Live: https://nikasana.github.io/lift/

## Batch 1: MVP (done)

Plan: walking on desktop and touch, one biome (Playroom), 16×16 cell grid per room with clutter piles and grime, Clear / Polish / Light, Glow, lamps bought at the room switch, IndexedDB save. Check: a room can be finished in under a minute on both; a reload keeps it.

Delivered:
- `src/config.js` holds every tunable number. `src/rng.js` is a seedable hash/RNG. `src/world.js` makes rooms as a pure function of hash(seed, floor, x, z), with a biome table. `src/roomstate.js` holds cell state, and `src/game.js` holds rules and economy.
- Rendering (`src/render/*`): only the current room and its 8 neighbours are loaded. Clutter is an InstancedMesh, the floor is a per-cell texture (grime → colour), and there are no shadows, at most 4 point lights and a capped pixel ratio. Unlit rooms are soft blue dusk and lit rooms warm to amber. The cabin at (0,0) is warm wood with a console.
- Input: WASD, Pointer Lock mouse look, hold LMB = tool, E = switch/panel, H = cabin, Esc = settings. Touch: left-thumb joystick, drag right side to look, TOOL / USE / HOME / menu buttons. Buttons for later batches stay hidden.
- Tool: a circle ahead of the player. It clears where there is clutter (items fly to you) and otherwise polishes. Combo up to ×2 for sweeping without a pause. The last 5 % of a phase finishes itself. Dust settles slowly in unlit rooms.
- Lamps: bought at the switch (north wall, next to the doorway), within wiring reach of the lit network. Price rises with the number of lamps on the floor. Strength = lamp × cleared × polish, and income/s is based on Strength using timestamp deltas.
- Saving: IndexedDB, autosave every 10 s and after purchases, plus when the tab is hidden. Export/import as text in Settings.
- All UI text is in `src/strings.js`.

Checks run:
- `node --test test/*.test.js`: 10/10 pass. They cover determinism, room finished in under 60 s in a sweep simulation (≈35 s), lamps and wiring, timestamp income, save round trip, wall/doorway collision, and dust.
- `node tools/e2e.mjs` (headless Chromium, 1280×720 desktop and Pixel 7 with touch): a bot drives the real update loop (input, collision, tool). The first room is finished in about 49–50 s of game time on both, the lamp is bought, the room is still finished and lit after a reload, and there are no console errors.

Decisions (spec silent):
- Lamps need wiring reach: Manhattan distance ≤ 1 + Wiring level from a lit room or the cabin.
- Warm rooms come already lit for free and don't count toward the lamp price.
- Cells under props start polished.
- Each cell action also pays 0.36 s of current idle income (hand power scales with income).
- Starting rates were tuned to clear 4 and polish 4 units/s, so a sweep finishes a room in about 35 s.

Known issues:
- Real frame rate is unmeasured. Headless software GL gives 2 fps desktop / 15–18 fps phone, which says nothing about a real GPU. Draw calls run to roughly 20 per room; merging wall geometry is planned for the Polish batch.
- The switch is always on the north wall.
- Only the Playroom biome so far. Sliding, map, floors and the panel shop come in later batches.
