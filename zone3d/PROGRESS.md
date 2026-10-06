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

## v2 plan (from the feedback after batch 5)

Goal: playable first-person, real 3D models instead of flat pictures, a gun you actually shoot, 3D
anomalies, better light. Built procedurally in code (no artist assets can be downloaded here), so the
look is stylised low-poly, not photoreal.

- **v2-A (MVP)**: playability (most new mutants come from in front, mutants slightly slower in 3D and slowed
  while behind you up close, stronger rear warnings), hold/progress rings and prompts that were only
  painted on the ground now float in the air and show at the crosshair, a shootable gun (hitscan through
  the crosshair, its own upgrade levels in level-up cards / auto-pick, auto-fire option, fire button on
  phones), a 3D gun model with upgrade attachments, sun + sky light on buildings.
- **v2-B**: 3D animated models for people (stalkers, teammates, bandits, soldiers, zombies, Monolith,
  quest NPCs) and the common mutants (dogs, boars, flesh, rats, cats, pseudodogs, snorks).
- **v2-C**: 3D models for the rest of the mutants and all bosses; hit reactions and death falls.
- **v2-D**: 3D anomalies (electro arcs, burner flames, gravity vortex, acid…), 3D trees/rocks/crates,
  vehicles, pickups and artifacts.
- **v2-E**: weapon models per weapon, impacts, shell casings, muzzle light, shadows on high settings.
- **v2-F**: phone performance tiers for all of the above, co-op player models, full test sweep.

### v2 status
- **v2-A: done.** Most new mutants arrive from in front/sides (80% of those that would appear behind
  are moved to the front); mutants move at 0.82× speed in 3D and at 0.5–0.7× while close behind you
  out of sight; hold rings and prompts that were only painted on the ground (boarding, hatches, towers,
  rescues, camps…) show in the air and at the crosshair; the **Stalker Rifle** (hit-scan through the
  crosshair, 8 upgrade levels through level-up cards / auto-pick: damage, fire rate, piercing, red-dot,
  double tap, heavy rounds, drum magazine) with a 3D model whose attachments follow its level, tracers,
  muzzle flash; left mouse = fire, right mouse = focus fire, FIRE button on touch screens, optional
  auto-fire (on by default on phones); sun and sky light on buildings.
- **v2-B: done.** 3D animated, lit models instead of pictures for every enemy the game draws as a
  person (detected automatically: zombie, bandit, soldier, sniper, Monolith, exoskeleton, ghost, mirror)
  plus snork, controller, karlik, burer, and the four-legged mutants (dog, pseudodog, psy-dog, pack alpha,
  cat, tushkano, rat queen, boar, flesh); teammates, quest people and the companion dog too. Walk/run
  cycles, guns raised, zombies reaching out, attacks when close, flinch when hit, elite colour tint, soft
  ground shadows, bodies fall over and sink away. A whole horde is 3 draw calls.
- **v2-C: done.** Every enemy and boss is now a 3D model: bloodsuckers (shimmer see-through when cloaked),
  izlom (long arm), phantoms/wraiths/holograms (see-through, wraiths float), gorilla, shrieker, mimic,
  psy-deer (antlers), wolf, spider, rat king, larva/snake/serpent (segmented, follow their path), sparks
  and poltergeists (glowing orbs with circling debris), the watching eye, bats and crows (flapping
  wings); bosses: pseudogiant, chimera (two heads, horns), behemoth (tusks, spikes), matriarch, controller
  prime, izlom lord, poltergeist king, the gunship (spinning rotor) and the Monolith (glowing crystal).

## How to play

Open `/zone3d/` on the same site as the game (https://nikasana.github.io/zone3d/).
- PC: click the view to capture the mouse, move the mouse to look, WASD to move (relative to where you look),
  left mouse = fire the rifle, right mouse = focus fire, Space dash, Esc pause (frees the mouse).
- Phone: left side of the screen is the movement stick, drag on the right side to look around, 🔥 = fire.
- Settings → "3D view": aiming (where you look / automatic 360° like the flat game), look sensitivity,
  field of view, invert up/down.

## Status

Progress: about 88% (batches 1–5). Remaining: polish from your testing + real-device FPS.

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

### Batch 4.1: done
- Red arcs around the crosshair point to whatever just hurt you; orange chevrons show mutants close by but
  out of sight (behind or beside you); a white hit marker flashes when your weapons land a hit.

### Batch 5: done (polish)
- Title screen: a slow 3D flight over the Zone behind the menus (2D on the Potato setting).
- Right mouse button + drag turns the view too (for browsers that refuse to capture the mouse); mouse-look
  spikes some browsers send after capturing the mouse are clamped.
- A mutant right in your face turns half see-through so a melee attacker does not blank out the view.
- Sprite atlas pages no longer keep a CPU copy (less memory).
- Minimap shows a light cone in the direction you look.
- When you die the camera drops to the ground.
- Phones get a slightly wider aim cone (thumb aiming).
- View distance adapts for the session: it shortens if frames are slow for a while, grows back when smooth.

Known gaps: enemies and props use side-view pictures (classic shooter style); smoke from camps/events
and some event objects are still flat on the ground; real-device FPS not measured here (the test
browser has no GPU).
