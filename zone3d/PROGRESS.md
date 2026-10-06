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

Known gaps (next batches): beams/lightning and tall anomaly parts are still flat on the ground; the
player's vehicle is not drawn; enemies use side-view pictures; no sky details; co-op not tested live.
