# ZoneBonk 3D: progress

A first-person 3D version of the game in `../zone`. It loads the original page and scripts from `../zone/`
(never copied, never edited), so every mechanic, save, menu, the casino and co-op are the original code.
Only the drawing and the controls are new (`js/r3d.js`, three.js in `vendor/`).

Saves are shared with the 2D game (same site, same browser storage).

## Batch plan (each batch is pushed playable)

1. **MVP**: 3D world, first-person camera, mouse/touch look, movement relative to the view, aim where you
   look, buildings, fences and wrecks as 3D blocks, trees/props/mutants/pickups as sprites, bullets and
   particles in 3D, ground effects (anomalies, gems, hazards) on the floor, damage numbers, screen effects,
   gun + crosshair, off-screen arrows, fog, day/night. Title screen stays 2D.
2. Labs and interiors with 3D walls, co-op teammates and guests looking around, enemy health bars,
   anomalies and beams standing up in 3D, enemy projectiles, focus fire with the crosshair, vehicles.
3. Phone performance and quality tiers, 3D settings (sensitivity, FOV, invert, aim mode), sky, rain/snow,
   flashlight at night, per-weapon visuals.
4. Full feature sweep in 3D (emissions, story, events, bosses, contracts, evac, pets…), bug fixing, tests.
5+. Polish.

## How to play

Open `/zone3d/` on the same site as the game (https://nikasana.github.io/zone3d/).
- PC: click the view to capture the mouse, move the mouse to look, WASD to move (relative to where you look),
  Space dash, Esc pause (frees the mouse). Click on a mutant while the mouse is captured = focus fire.
- Phone: left side of the screen is the movement stick, drag on the right side to look around.
- Settings → "3D view": aiming (where you look / automatic 360° like the flat game), look sensitivity,
  field of view, invert up/down.

## Status

Progress: about 80% (batches 1–4 of the plan). Remaining: polish from your testing + real-device FPS.

### Batch 1 (MVP): done
- Loads the original page and scripts from `../zone/`; title screen and menus are the original 2D ones.
- 3D world: terrain tiles, buildings (enterable houses keep their doorway), fences, wrecks as blocks;
  lab corridors with walls; trees, props, mutants, crates, pickups, artifacts, locked stashes and
  co-op teammates as upright sprites made by the game's own drawing code.
- Flat effects (anomalies, gems, hazards, explosions, decals, auras) drawn on the ground by the original
  renderer; bullets, enemy shots, sparks, thrown things as glowing 3D points.
- First-person camera with head bob, dash FOV kick, camera shake; fog; day/night; fog weather; labs darker.
- Aiming: weapons shoot at the mutant inside a cone in front of you (crosshair brackets it); "automatic"
  setting restores the 360° aim. Standing still, dash goes where you look.
- Screen layer: crosshair, gun with recoil and muzzle flash, damage numbers, elite/boss health bars and
  names, stun stars, teammate names, markers/edge arrows for bosses, quests, events, shelter in emissions,
  emission/radiation/psi/low-HP/flash/fade tints.
- Tested: desktop and phone views, movement/strafe/stick directions, touch look, aim cone vs automatic,
  dash direction, pause, lab in/out, 5-minute simulated soak (bosses, emission, lab) with no errors.

### Batch 2: done
- Standing in 3D now: the tall part of every anomaly (animated), parked vehicles, crystals, the watcher's
  eye, the companion dog, quest people (escort/guard scientists, with health bar), teammates.
- Tornadoes as spinning dust columns, the train as real 3D carriages, beams/lightning/sniper lasers as
  glowing 3D lines coming out of your gun, coloured glow rings around elites, alphas and mutated mutants.
- On screen: stagger meters, rescue labels, broken vehicle / escape jeep labels.
- Scenery you stand inside (trees, bushes) turns see-through instead of filling the screen.
- Co-op tested with two tabs (offline test mode): lobby, start, both players in 3D, the guest moves where
  they look and the host sees them standing with their name.

### Batch 3: done
- Picture quality follows the game's graphics setting: view distance, flat-effects resolution, render
  resolution, particle budget, grass/reeds hidden on the lighter settings (phones start on Ultra-low).
- Sky dome (overcast by day, sunset glow, dark with stars at night, red in an emission blast).
- Weather on screen: rain streaks, snowflakes, heat / radiation storm / psi tints; fog shortens the view.
- Night and labs: flashlight look (edges dark, middle lit).
- Riding: bike handlebars or jeep hood instead of the gun, with the fuel gauge.
- The gun in your hands matches your first weapon (pistol, rifle, shotgun, launcher, energy weapon);
  bullets keep their colours by type (flames, arrows, lasers, acid, saws…).

### Batch 4: done (feature sweep)
- All 13 maps load and play in 3D (zone, pripyat, npp, zaton, wasteland, metro, blackout, winter,
  mountain, flooded, volcanic, duga, noosphere) with no errors.
- All 14 bosses spawn and show (incl. The Monolith, gunship, hologram).
- Markers for the newer goals: stash notes, courier package, evac zone, rescues, hot zone.
- Wildfires get standing flames and a smoke column.
- Tutorial texts explain looking and aiming in 3D (translated).
- UI flows: settings (3D rows save), map, pause, death screen, back to the 2D title (screen restored),
  new run, tutorial, co-op lobby → run.
- Lightest settings redraw the flat ground layer every second frame (less work on weak phones).

Known gaps: enemies and props use side-view pictures (classic shooter style); smoke from camps/events
and some event objects are still flat on the ground; real-device FPS not measured here (the test
browser has no GPU).
