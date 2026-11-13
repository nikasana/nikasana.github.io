# Lift: progress

Live: https://nikasana.github.io/lift/

## Batch 9: Polish (done)

Plan: performance, comfort settings, the first minute and a balance pass. Check: the targets under "Design pillars" and "Performance" are measured and met.

Measured:

| Target | Result | How |
|---|---|---|
| A room takes 20–40 s | 33–36 s at floors 0, 3, 6 and 9 (room 8 → 26 m) at the matching tier | `test/batch9.test.js`, lawnmower sweep simulation |
| A wave takes 1–2 min | 80–110 s (floor 0 waves 1 and 3, floor 3 waves 1 and 5) | `test/batch9.test.js` |
| Skill moves the result by about ±40 % | slow hands −32 %, sharp hands +35 % Glow/s with the same upgrades | `test/batch9.test.js` |
| Neither layer wins alone | floor-0 tools on floor 3 take >120 s per room | `test/batch9.test.js` |
| An active minute = 5–10 idle minutes | simulation: 9.4–9.8 (floor 0), 7.7–8.2 (floor 3), 7.4–8.8 (floor 6). Browser bot, real loop, floor 0: 9.5 desktop / 8.2 phone | `test/batch6.test.js`, e2e B6 |
| First upgrade in about 30 s | ~19 s of efficient simulated sweeping; browser bot 10–17 s (a person is slower) | `test/batch9.test.js`, e2e B9 |
| ≤ 4 dynamic lights, InstancedMesh clutter, no shadows, capped pixel ratio | 4 point lights; all clutter, Tide and flying items instanced | e2e B9 |
| Draw calls and triangles | desktop L1 41 calls / 88 k triangles, L3 62 / 0.41 M, L5 75 / 1.65 M. Phone L1 33 / 0.11 M, L2 33 / 0.11 M, L3 48 / 0.47 M (with a wave on screen) | e2e B9, `renderer.info` |
| CPU cost of game logic | 0.3–0.4 ms per frame with a wave and the tool active | e2e B9 |
| 60 fps integrated GPU / 30 fps mid-range phone | **Not measurable here.** The container has only software GL (2–20 fps for any scene). Auto graphics starts at level 4 on desktop and 2 on phones and steps down while fps stays under 45 / 27, so the target is enforced at runtime | — |

Changes:
- Walking speed now scales with room size (0.4 + 0.45 m/s per metre of room), so rooms take the same time at every depth ("scale grows, reaction time does not").
- Clutter geometry detail follows the graphics level: levels 1–2 use 20-triangle items, cutting triangles 4–7×.
- The rooms around the lift always hold a full room of balls (300 units), so the first minute doesn't depend on the seed. Cell worth is 0.85 and the cheapest upgrade costs 350.
- First minute: you start in the lift with its doors open onto a ball room, and the HUD shows one line of control hints until the first room is mostly cleared.
- Comfort: warm mode, FOV slider, no head bob (the camera never bobs), H always returns to the lift, graphics levels and sensitivity.
- Saves now run strictly one after another, so a burst of autosaves can't land out of order.
- The test tooling gained a lawnmower bot and per-device runs (`DEVICES=desktop`).

Checks run: `node --test` 62/62; browser batches 1–9 on desktop and phone.

## Batch 8: Co-op (done)

Plan: the Net module, the shared house, ping, and saves in every browser. Check: two browsers join by link and hold a wave; a guest can host the house afterwards; solo is unaffected.

Delivered (`src/net.js`, `src/render/others.js`, the Together tab):
- The Net module is optional. It's created only when you invite or open an invite link (`#room=CODE`), and the game never needs it.
- PeerJS 1.5.4 (vendored, loaded on demand) connects a host and up to three guests; a fifth player is told the house is full. There is no lobby and no text chat.
- The host owns the house: seed, room state, floor progress, waves and the Tide simulation, rebroadcast to guests 5×/s.
- Each player keeps their own Glow, upgrades, helpers, Clarity, sorties and gadgets, and takes their earnings home.
- Room edits merge by taking the minimum of clutter and grime, since hands only ever make rooms cleaner, so simultaneous work never conflicts. Floods come from the host as authoritative "set" updates.
- Lamps, shut doors, sweeping and lamp boosts at the fronts, and sortie points all go to the host.
- Anchors found go to everyone. False signs differ per player (a per-browser salt) and true ones are shared.
- Q drops a pillar of light for everyone. Other players appear as soft figures of light (no faces).
- Wave pressure is ×1.5 per extra player.
- Saves: every browser keeps its own house in its own save and a copy of each shared house (`shared:CODE`). Any player can host that house later from the Together tab.
- On connection failure: a quiet message, your own house comes back, and you continue solo.
- `?profile=name` keeps a separate save slot, so several people can share one machine (and tests can open two "browsers" in one).

Checks run:
- `node --test`: 57 pass. Two Net instances over BroadcastChannel join and share the seed and lit rooms while each keeps their own Glow. Also tested: pressure ×1.5, guest clearing merges into the host, host floods are authoritative, Anchors reach everyone, ping, a guest's saved copy hosted for a third player, and a fifth player turned away.
- Browser (desktop + phone): two tabs of the real game, host and guest via an invite link (`&local=1`). Same seed and 2 players; the guest's clearing reached the host; the host's wave was seen by the guest and held on both; after both left, the guest hosted the saved house and a third tab joined it with the same seed and lit rooms. No errors in the other tabs. The full solo regression (batches 1–7) passes.

Not run:
- Real WebRTC through PeerJS. This sandbox can't reach the public PeerJS broker (0.peerjs.com), so the browser test used the module's same-browser BroadcastChannel transport. The PeerJS path uses the same message layer but is untested here.

## Batch 7: Long game (done)

Plan: signs, Anchors, Dawn, notes, achievements, the cosmetic layer and audio. Check: two true rays meet on the Anchor; Dawn keeps what it should.

Delivered (`src/longgame.js`, plus the signs and Anchors from batch 5):
- The six Anchors' habits work:
  - Clock "Wait": half the untested false signs fade.
  - Notebook "Check": tests take 0.55× as long.
  - Coin "Coincidences happen": the true share rises to 75 %.
  - Phone "Ask someone": a dotted true ray every 2 min.
  - Mirror "Not everything is about me": false signs look paler.
  - Window "Look wider": the map shows 11 rooms out instead of 7.
  - Duplicates raise rank (+10 % Glow each).
  - The Anchors tab lists them.
- Dawn (Diary tab, from floor 3): Clarity = floor(√(night's Glow / 50 000)), each point +10 % Glow forever. It resets Glow, upgrades, helpers, floors and the house with a new seed, and keeps Clarity, Anchors, catalog, notes, small wins, diary and settings. You may write one diary line first.
- 20 notes from a previous resident, calmer with depth (5 per tier, opened at floors 0 / 1 / 3 / 5). They turn up when a room holding one is cleared (1 room in 25, and every sealed room) and are kept in the Diary.
- 10 small wins: Left the room, One thing at a time, Asked instead of assuming, Let it be enough, Stayed for all of it, Made it back, Rested, Called it a night, Kept going, Noticed something nice.
- Cosmetics:
  - The house warms from blue to amber as a floor is lit (grade, fog, music filter), fully on Quiet floors.
  - The cabin gains a mug (first lamp), a plant (first wave held), a blanket (first Quiet floor) and a drawing (first Dawn or 5 small wins).
- Author's notes toggle (Settings) shows one line per biome from the editable `AUTHOR_NOTES` table (draft placeholders) on the HUD.
- Audio: each biome retunes the room tone. Music changes key per biome and warms when lit (batch 2), with the Quiet layer and Tide swell (batch 4).

Checks run:
- `node --test`: 54/54 pass. Rays meet on the Anchor (3 seeds) and it can be taken only once, after its cell is cleared. Also tested: Notebook / Coin / Phone / duplicate bonus, Dawn keeps and resets (plus a save round trip), notes calmer with depth (all 20 reachable deep down, sealed rooms always hold one), small wins, cosmetics, author's notes for every biome.
- Browser (desktop + phone):
  - Two true signs tested with the real tool gave rays that meet exactly on the Anchor's room (mirror / coin).
  - E took the Anchor.
  - Dawn from the Diary tab with a diary line: Clarity 0 → 3, Anchors and diary kept; Glow, upgrades, floors and seed reset.
  - The cabin shows the drawing and blanket after Dawn.
  - Batches 1–6 still pass.

## Batch 6: Action (done)

Plan: abilities, Flow, aura, on-the-spot boosts, bounce, Loud mode, and feedback polish (hit-stop, wider FOV on slide and dash, sound that scales with quantity). Check: an active minute is worth 5–10 idle minutes at floors 0, 3 and 6.

Delivered (`src/action.js`):
- Abilities unlock at level 5 of each track, on keys 1–3 (touch buttons 1–3 appear when unlocked):
  - Dash (Shovel): a 6 m lunge that ploughs a clear trench.
  - Gloss (Brush): 5 s of ×20 polish; fronts pressing on your room slide back.
  - Flash (Lamp): lamps within 2 rooms pulse, relight lamps that went out, add +30 % for the wave and push contacted fronts back a room.
  - Each cooldown shortens 2 % per helper of that track's stage (sweepers / mops / fireflies), down to 35 %.
- Flow: a meter (thin bar at the bottom) filled by continuous action, 3× faster when you switch between Clear, Polish and Light. At full Flow the helpers' aura (×2 work) also covers neighbouring rooms.
- Glow at the front: during a wave, E at a lit room's switch spends Glow (half a lamp's price) to boost that lamp +30 % for the wave.
- Bounce at 3× pressure (logic from batch 4) pays the full reward at once.
- Loud mode: on Quiet floors each sortie offer has a Loud option (×2 reward; random Tides come back for the sortie).
- Feedback: hit-stop (Dash, Flash), FOV +18 on Dash and +8 while sliding, both easing back. Clear sounds layer more voices with more quantity; Dash plays a big clear.

Checks run:
- `node --test`: 49/49 pass. Simulated active minute vs idle minute, 2 seeds per floor: 9.96 / 9.73 on floor 0, 6.95 / 6.79 on floor 3, 5.64 / 8.22 on floor 6, all within 5–10. Also tested: unlocks and cooldowns, Dash trench, Gloss, Flash, Flow ×3 and full-Flow aura, lamp boost, Loud mode. A new test checks that every string key the code uses exists in the strings table.
- Browser (desktop + phone):
  - Dash moved 6 m and cleared a trench (112 / 86 clutter units) with the FOV kick.
  - Flash relit a lamp that had gone out.
  - The bot playing a real minute on floor 0 earned 5.4× / 6.1× the idle minute (in-game income runs on wall-clock time, so this excludes the idle income during that minute; counting it would add about 1).
  - Flow reached full. Batches 1–5 still pass.

Known issues:
- Floor 0's simulated ratio sits near the top of the band (9.7–10.0). The browser bot measures about 6.
- Ability readiness on touch buttons shows only as opacity.

## Batch 5: Sorties (done)

Plan: the board, six sortie types, rank, extraction, risk, mutators and gadgets. Check: every type completes; a clean exit pays +50 %.

Delivered (`src/sorties.js`, `src/gadgets.js`, `src/signs.js`, `src/render/signfx.js`):
- The board (Sorties tab) always offers one sortie per action:
  - Clear: Haul (collect an amount of one biome's material).
  - Polish: Check (test N signs) or Search (find the region's Anchor).
  - Light: Chain (N lit rooms in a straight line from the lift) or Line (connect the lift to a marked room through lit rooms).
  - Every third rank adds a Great hall: an enormous room (4× clutter, tall ceiling) to clear, polish and light.
  - Rank 10 adds a Deep run (hauls on three floors in a row).
- Completing a sortie adds 4 points to its floor meter (a Great hall adds to all three), so it raises rank. Each rank gives +5 % income on that floor.
- Extraction: when the goal is met the lift bell rings and a final Tide starts. Reaching the lift within 90 s is a clean exit (+50 %). Missing it costs only the bonus; H returns at once without it. Rested charges double the payout.
- Risk 1–5 is chosen per offer: ×1 to ×2 reward, with stronger and more frequent Tides while the sortie is out.
- One mutator per sortie, each changing a rule while out: Draft (the Tide moves 1.6× faster), Double clutter (clearing ×0.5), Thick fog, Slick floor, Echo (twice the signs, the extras false), Gold vein (clearing pays ×2), Dim lamps (Strength ×0.6), Quiet hour (no Tides, ×0.7 reward).
- Gadgets (Gadgets tab; G uses, mouse wheel picks; on touch, ITEM). Each costs 30 of its biome's material:
  - Glowstick: lights the room ahead for a minute. A glowstick in a vent room stops that front.
  - Soap strip: the Tide passes the doorway 3× slower.
  - Paper plane: maps five rooms ahead.
  - Bookmark: place, then use again to return.
  - Sprout: the room never floods.
  - Snack: 30 s of double combo.
- Signs and Anchors (core here, long game in batch 7): one Anchor per 10×10 region. Signs appear on polished floors in 35 % of rooms, 60 % of them true. Holding the tool on a sign for 1.5 s tests it: a false one dissolves with a small reward and "Let go"; a true one glows and adds a ray to the map. Anchors lie under clutter and are taken with E. Signs are abstract symbols with an arrow (rings, triangle, diamond, wave, spiral, cross, dots, arc), never eyes, faces, people, cameras, digits or letters.
- Q drops a pillar of light (ping).

Checks run:
- `node --test`: 40/40 pass. Every sortie type completes (Haul, Check, Search, Chain, Line, Great hall, Deep run). A clean exit pays exactly 1.5× and the timer running out pays 1×. Also covered: risk 5 = 2×, Quiet hour 0.7×, sortie points raise rank and +5 % income per rank, mutators change rules, every gadget works, sign shares (35 % / 60 %), two true rays meet exactly on the Anchor, and co-op true signs are shared while false ones differ.
- Browser (desktop + phone):
  - A Haul started from the board was played with the bot until the bell; walking back to the lift paid exactly +50 % (440 → 660 and 520 → 780).
  - Holding the tool on a true sign tested it and added a ray.
  - A paper plane bought and thrown with G mapped five rooms.
  - Batches 1–4 still pass and there are no console errors.

Decisions:
- Check and Search need signs, so the sign and Anchor core landed here rather than in batch 7.
- Line targets are 4 + rank rooms out. A Great hall is a marked room 3–4 rooms from the lift.
- The final Tide of an extraction is one front at 55–95 % (rising with risk). Quiet hour skips it.

## Batch 4: The Tide (done)

Plan: waves, Strength against pressure, forecast, soft fail, Noise, Quiet floor, and the beauty pass. Check: floor 0 waves hold with idle hands; a Great Tide needs play.

Delivered (`src/tide.js` pure, `src/render/tidefx.js` visuals):
- The Tide is the clutter returning. Each front starts at a glowing vent in a dark room and travels room by room along lanes toward the lift. At every lit room it presses on the doorway in 5 s pulses. If the room's defense beats the pressure, it holds; if not, the lamp goes out and clutter floods back.
- Defense = room Strength × (1 + player boost ≤ 60 % + helper share ≤ 20 %; 0 on a Great Tide). The player adds Strength by sweeping or polishing in a contacted room and by shutting doors (E near a doorway during a wave; each holds 20 s, contact pauses while shut). Lighting a front's vent room ends the flow from that side.
- Floor 0 has 3 waves at 50 / 65 / 80 %; later floors have 5 at 50 / 70 / 90 / 110 / 140 % of average room Strength. Fronts grow from one direction to four, and the last wave is the Great Tide from every side. Wave k unlocks at floor rank k, where rank = lowest of the cleared / polished / lit floor meters (4 rooms each per rank, plus sortie points in batch 5).
- Forecast in the Floors tab, e.g. "Pressure 65, Strength 100 — calm / close / hard". It lists the fronts and warns about sides with nothing lit.
- Soft fail: if any lane reaches the lift, the wave isn't counted. Flooded rooms keep their lamp but must be cleared again, nothing banked is lost, and the retry is 10 % weaker.
- A bounce at 3× pressure turns the wave away at once with full reward. Rested charges double a wave's reward. Co-op pressure is ×1.5 per extra player.
- Noise falls one step per held wave. Holding the Great Tide makes the floor Quiet: income ×2, no random Tides, warmer grade and fog, the string layer in the music, and the next floor unlocks. This replaces the batch 2 interim rule. Random Tides (one front at 40 %) come every ~5 min while a floor is loud.
- Beauty pass:
  - The wave is a body of instanced biome clutter (500–3200 items by graphics level) with a curling crest and a shader-drawn glowing front line.
  - Motion per biome: balls roll and bounce, foam swells, paper flutters, leaves spiral, books stack, popcorn pops.
  - Items warm near lit rooms. Where a front breaks on a lit doorway there's a 0.55 s slow-motion beat, a spark spray and a sound swell, plus a fine continuous spray while it presses.
  - A held wave ebbs: items roll back, shrink and dissolve into rising motes.
  - The surf sound follows the nearest front; vents glow on the floor and on the map; fronts show on the map.
  - Items never come through walls, only doorways.

Checks run:
- `node --test`: 33/33 pass.
  - Floor 0: 3 seeds × 3 waves all hold idle; floor 0 never exceeds 80 %; each wave lasts 80–110 s.
  - Floor 2: waves 1–4 hold idle with helpers; the Great Tide is lost idle and held with play.
  - Also covered: soft fail (lamps stay, Glow kept, wave not counted, retry ×0.9), forecast moods, rank gating, vent lighting, doors, co-op ×2.25 for 3 players.
- Browser (desktop + phone): rank 5–6 from the meters, and all three floor-0 waves held through the real game loop with idle hands (80 / 90 / 110 s, 0 floods). The wave was drawn with 2400 items (desktop, level 4) / 900 (phone). Floor 0 went Quiet and floor 1 opened. No console errors.

Decisions:
- Lanes come in along each lit row or column from outside, then along the axis to the lift. A side with nothing lit is an open side; the forecast warns about it.
- Fronts come first from the sides where the house is strongest.
- "Helpers alone hold at most 80 %" is modelled as a helper share capped at +20 % of a room's Strength, and none against a Great Tide.
- An active wave isn't saved. A reload ends it with no result, and lamps that went out during it are relit.

## Batch 3: Economy (done)

Plan: upgrade tracks, helper pipeline, guards against single-action play, the panel shop, offline progress and the catalog. Check: in simulated play, balanced play outpaces any single-action play.

Delivered (`src/economy.js`, panel tabs in `src/main.js`):
- Three tracks with two upgrades each: Shovel (power, reach), Brush (speed, shine), Lamp (brightness, wiring). A power tier is ×4 for ×6 the cost. Each upgrade has a flavour name ("Get some sleep", "Open a window", ...) and the panel shows its effect before → after.
- Helpers form a three-stage pipeline (Sweeper bot → Mop bot → Firefly). Throughput is the slowest stage, the panel names the bottleneck, and price is ×1.15 per purchase. Helpers work only in visited rooms, finishing them one at a time nearest you first, twice as fast in your room (aura).
- Guards: balance bonus of +10 % Glow per level of your lowest track. Floor rank (lowest of three floor meters) is in place and fed by sorties in batch 5.
- Hand power scales with income: every cell you clear or polish also pays 0.36 s of current idle income.
- Offline: 50 % income for up to 8 h, helpers keep extending territory, and you earn a rested charge per 2 h (max 3). The return screen reports time away, Glow, rooms finished and rested charges.
- The panel's top line shows Glow, income per second, floor and rank. Upgrades, Helpers, Floors, Catalog and Settings tabs fit a phone.

Checks run:
- `node --test`: 27/27 pass. In a 20-minute simulated night (3 seeds), balanced play earned 10–17× clear-only, 40–48× polish-only and 17–18× light-only. The first upgrade is affordable after about 19 s of efficient sweeping (about 30 s for a person). Also tested: power tier ×4 / cost ×6, the pipeline bottleneck, visited-only helpers with aura, the balance bonus, and offline (half pace, 8 h cap, rested, short gaps ignored).
- Browser (desktop + phone): the panel opens in the lift, an upgrade and one of each helper are bought from the panel, helpers clear cells, and a reload after 3 h away shows the return screen. Batches 1–2 still pass and there are no console errors.

Decisions:
- Fireflies are the pipeline's last stage. They carry finished cells' Glow home rather than buying lamps for you, so they never spend your Glow without asking.
- Track level = the sum of that track's two upgrade levels.

## Batch 2: World (done)

Plan: seeded infinite rooms, the lift and floors, six biomes, modifiers, set pieces, map and sliding. Check: walk 30 rooms out and back and get the same rooms at a steady frame rate. Added on request: five graphics levels plus Auto, and a generative score.

Delivered:
- Six biomes, each a row in `BIOMES` (palette, clutter shape, Tide character, ceiling range, music key). Each floor mixes two of them 70/30 in 8×8 patches; the lift's 5×5 neighbourhood always uses the floor's main biome.
- Modifiers: normal 80 %, deep (3× clutter) 10 %, warm (finished and lit for free) 5 %, sealed 5 %. Sealed rooms have 5× clutter, and their doorways stay shut until you pay Glow at the door.
- Six primitive set pieces (tree under a skylight, chair under a lamp, stairs to a glowing window, aquarium, a lone door, a small moon), one room in 40. Each becomes a catalog entry (+1 % Glow), as do the rare finds (1 cell in 500).
- Doors per doorway (shut doors hold for a time; used by the Tide in batch 4).
- The lift: a Floors tab in the panel rides between open floors. Room size is 8 + 2×floor (max 30).
- Map (M / MAP): known rooms coloured by state (cleared, polished, lit), plus the lift, sealed rooms, set pieces and a player arrow. It has layers for later overlays.
- Sliding (Shift / SLIDE) on lit, polished floor at 2× walking speed with momentum.
- Graphics levels 1–5 + Auto (Settings):
  1. Flat Lambert materials, no post-processing.
  2. Physically based materials, ACES tone mapping, contact shading.
  3. Glossy polished floors with reflections, light shafts, dust motes, vignette and split-tone grading.
  4. Half-resolution bloom, more clutter.
  5. Full-resolution bloom, film grain, densest clutter.
  Auto starts at 4 on desktop and 2 on phones, and steps down when frames stay under 45 / 27 fps.
- Music (`src/music.js`): a generative score, all synthesized. Detuned pads on a per-biome chord progression, a bell-piano melody whose density follows player activity, a bass pulse, a string layer for Quiet floors and a Tide swell layer, all through a generated convolution reverb. Its volume is separate from sound effects.

Checks run:
- `node --test`: 20/20 pass. New tests: rooms are a pure function, room size, modifier and set-piece frequencies, 70/30 patches, deep/warm, sealed doors, door timers, catalog, lift, save.
- `node tools/e2e.mjs <url> 1,2` (desktop 1280×720 and Pixel 7 with touch): walked 30 rooms out and back, with 31 rooms seen and 0 mismatches on the return. 9 rooms are loaded and memory stays bounded (55 rooms kept). Frame time doesn't grow; levels 1, 3 and 5 all render. No console errors.

Decisions:
- The next floor opens after 8 lit rooms. This is an interim rule until batch 4 (Quiet floors).
- The lift's 5×5 neighbourhood always uses the main biome, so the first room is always a ball room.
- Set pieces don't collide (you walk through the tree).

Known issues:
- Frame time numbers come from software GL and don't reflect a real GPU.
- Doorways to sealed rooms show door panels from both sides.

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
