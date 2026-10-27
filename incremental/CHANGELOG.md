# Changelog

## Batch 4: Tidalis
- Tidalis: green-blue ocean ice, North (Pack Ice, strong current, gems shallow) and South (Shelf Front, slow current, relics deeper), theme Undertow.
- Current Reading: a slowly turning current carries loose coins along the ice at up to 0.9 m/s; drifting motes show where it runs, so you can catch coins downstream.
- Meltwater flows: pools run downhill to lower floors nearby, and pools that meet merge (every planet).
- Dig tier 3, the Sonic Hammer: each blow opens a crater and its shockwave breaks a ring of ice around it.
- Planet tier 2, the Heat Pipe: right mouse with the planet tool melts a narrow column straight down; the pipe also melts on its own.
- Relic coins: small turned vases with a low ring, worth 10,000 copper, deeper on Tidalis.
- Aurora events (first version): every 5-9 minutes, curtains of light fill the sky for a minute and coins drift down around you; caught coins go straight into the vault.
- Style tree: Gilded Pick, Obsidian Tools, Warm Crater Light, Wide Lens; each can be switched off in Settings > Game.

## Batch 3: Cinderice
- Cinderice: ash-dark ice over a hot core, North (Ash Crown, lava early) and South (Cold Caldera, safe for longer), a smoky red sky and an ash-grey snowfield. Theme: Iron Under Ice. Three capsules and a Golden Needle; Mistral gets its needle too.
- Lava: pockets glow orange through the ice. Melting next to one pays up to 60% more but builds heat (shown in the prompt); at full heat the lava bursts, floods the hole, freezes into basalt and scorches 30% of your pack.
- Heat Vein Mini-Hunt: hidden veins wind through the ice, traced by embers. Melting along one builds a combo up to x5 on melted value; leave the vein and it fades.
- Melt tier 3, the Orbital Laser: a beam from the sky on your designator.
- Planet tree: Satellite Mirrors (tool 3: hold to focus a wide sunbeam from orbit), Focus Lens, Mirror Array (automatic melting) and Polar Orbit.
- Climate tree: Soot Dusting and Dark Ice (albedo), Sea Wall, Greenhouse Vents.
- Mutant ice Emberice (starts a vein combo) and Obsidice (hard volcanic glass, three times the coins), with DNA Heat Skin, Ember Heart and Glass Eye.
- The snowfield takes each planet's colour.

## Batch 2: Mistral
- Mistral, the fog planet: North (Pearl Hollow) and South (Grey Reach) poles with their own strata, a pearl-grey sky and dense fog. Vision tiers and the focused lamp cut the fog.
- Planet travel: reaching a planet's goal depth completes it, saves a postcard and offers travel to the next planet with a pole choice. Legacy (from coins earned, depth reached and time spent) multiplies income there, and costs re-scale to it, so the first upgrade is as quick as on planet 1 (verified by the sim).
- Gem coins: faceted crystals with their own glassy ring, on Mistral.
- Vision tier 2, X-ray: while the lamp is focused, coins show through up to 4 m of ice and finds glow from 45 m. Tier 3, satellite radar: every find nearby on the minimap.
- Mutant ice: Glowice and Springice on Frostara, Tarfrost and Chimeice on Mistral, in tinted pockets. Springice bounces you, Tarfrost is slow to cut but doubles coins, Chimeice rings and reveals finds, Glowice shines.
- DNA tree (7 nodes at twice the usual price), unlocked by the mutant ice you find: Night Eyes, Spring Legs, Long Arms, Cold Blood, Steady Hands, Echo Sense and the More Hands capstone (every strike lands twice).
- Mutation Log in the notebook, with silhouettes for undiscovered types.
- Six time capsules; Capsule Puzzles: frost-sealed capsules open after melting next to them, fog-sealed ones under a focused lamp.
- Mistral's theme (Veiled Breath); themes unlock per planet visited. Audio tree: Wind Choir layer, Night and Glass variations, Crystal Picks sound pack.
- Planet Postcards gallery in the notebook.

## Batch 1.2: open ice and water
- Dig anywhere: the ice streams in a window around you out to 400 m from the claim; holes anywhere persist exactly. The snowfield hides itself over ice that has been meshed, so there is no seam. The lift follows you anywhere.
- 90 more finds are scattered across the open ice out to 160 m.
- Water you can work in: meltwater fills the hole it lies in (up to about chest height) instead of spreading thin. Wading slows you; deeper water makes you swim with your head above the surface (Space to rise). Steps and strikes in water splash, and the view turns green-blue under water.

## Batch 1 fixes, round 2 (playtest feedback)
- Holes stay exactly as dug: every edited chunk keeps its exact ice, through streaming, saves and co-op joins. Before, far chunks were rebuilt from a smoothed depth map and narrow shafts partly filled back in.
- Upgrades are bought at the Outfitter's hut, a blue hut on undiggable ground a short walk from the start. Pressing U elsewhere points you there; it is marked on the compass and minimap.
- Coins: fewer, gathered in horizontal seams about every 5.5 m that wander a little, so following a seam sideways pays better than digging straight down. Frozen coins are drawn through the ice (up to 1.3 m in), are 1.8x larger, and pop out visibly before flying to your pack.
- Finds frozen in the ice, varied by depth: lanterns, satchels and pick heads near the surface; supply chests, fuel thermoses and survey drones deeper; expedition crates, meteorite shards, tusks and reliquaries deep down. Rewards are coin bursts that grow with depth, short tool boosts or permanent income relics.
- Upgrade trees redesigned: dig and melt feed each other (warm ice digs out wider, cracked ice melts faster), choose-one style keystones in every tree, mechanic nodes, cross-tree nodes between neighbouring trees, capstones, and shorter chains of identical upgrades. Old saves are trimmed to the new level caps.
- Lift: it parks in open space next to you or right above your head in a narrow shaft, cannot drift away, and is recalled to your side if it ever falls far behind. Holding Space beside it rides it instead of jumping.
- Compass strip and north-up minimap with the lift, the vault, the Outfitter and crewmates.
- The pick's point lands exactly on the spot it strikes; the drill bit touches the surface while boring.
- No jitter while standing still in a hole; no more clicking to resume after menus (any key or click retakes the mouse).
- Saved playthroughs: the start screen lists every solo survey and crew save to continue, resume as host, rejoin or delete; new surveys get their own save. Pause menu: Saves & new game.
- Co-op shares one exact world: joiners get the edited ice exactly, only the host refreezes meltwater, and finds opened by anyone vanish for the crew and pay the shared vault.
- Distant loose coins use a low-poly model (1.6M to 0.7M triangles in a busy shaft).

## Batch 1 fixes, round 1 (playtest feedback)
- Fixed black rectangles that could cover part of the screen: one invalid (NaN) pixel was being spread by the bloom blur into a large block. A cleanup pass now scrubs invalid pixels before bloom, and the ice, particle and water shaders guard their own output.
- Fixed hovering over freshly dug holes: the collision field reported phantom floors where crater spheres overlap. Contacts are now checked against real ice, and the player drops down the shaft as it is dug.
- The player is slightly slimmer, and the smallest pick crater is wide enough to follow down.
- Looking down extends your reach, so you can always hit the floor of the hole you are standing in.
- Digging and melting now erode the thin one-voxel ridges and plates left between overlapping craters, so no hard-to-hit slivers of ice remain.
- Hovering over a hole now steers you toward its open side, so you drop into the shaft you dig.
- The lift beacon is easy to find: a column of light rises from it, and a marker always shows where it is (pinned to the screen edge when it is out of view), with its distance and whether you are banking.
- The HUD explains the pack: coins wait in your pack until banked at the lift beacon, which follows you. First-time tips explain a full pack and riding the lift out of the crater.
- Co-op: a crewmate in a background or slow tab no longer vanishes. Hidden tabs keep sending their position, the timeout is longer, and closing a tab says goodbye at once.

## Batch 1 (MVP): Frostara and co-op

### World and graphics
- Frostara with North (Glacier Crown) and South (Old Shelf) poles, each with its own strata.
- Destructible ice: a 64 × 64 m claim of 0.5 m voxels meshed with surface nets in Web Workers, streamed by depth, saved as a carved-depth heightmap.
- Refractive ice by true thickness, Beer–Lambert absorption, strata-tinted glow, bubbles and fracture planes, frost and snow with glints, wet sheen and a glowing edge where melted, white fracture lines where dug.
- Polar sky with the sun circling the horizon, image-based lighting, cascaded sun shadows, GTAO, bloom, ACES or AgX tone mapping, per-planet grading, SMAA, film grain, vignette, height fog and crater mist.
- Snowfield to the horizon with wind ripples and a far ridge line; survey stake line; gantry crane with trolley, cable and lift beacon; coin vault with a settling pile; survey hut.
- Coins (copper, silver, gold) with their own shapes and engraved PBR materials, frozen in the ice and visible through it; freed coins fall, bounce and are pulled into your pack.
- Meltwater pools that ripple, carry light coins to their centre and refreeze into clear ice.
- A time capsule, the Golden Needle and fossils frozen in the strata.
- GPU particles: ice shards, frost dust, steam, flame, sparks, drips, glints and coin streaks.
- Planet view with a procedural globe: ice caps, oceans, clouds, atmosphere, crater glow, heat rings and a fly-out transition.

### Play
- First-person controller that collides with the ice field; rebindable keys; Pointer Lock.
- Tools: pick (with heavy strike) and drill; torch and steam lance; lamp. Held models animate; the camera never shakes.
- Pack, carry capacity and banking at the lift beacon, which follows you down the crater.
- 59 upgrade nodes in four trees (Dig, Melt, Vision, Automation) in a pannable, zoomable graph.
- 14 hidden resonances with a notebook; strategy-dependent cost growth and damped purchase inflation.
- Two planet milestones; crew milestones; offline progress up to 8 hours.
- HUD: vault, income, pack, next goal with the hidden wait meter, tools, crater depth against the core, stratum and readouts, lift and needle hints.

### Audio
- Synthesised effects with per-play variation and depth-dependent reverb.
- A generative score ("Crystal Survey") whose layers enter with crater depth, with cues for resonances, milestones, capsules and the needle.

### Systems
- Versioned saves with migrations, separate solo and crew slots, export/import codes, hard reset, auto-save every 10 s and on exit.
- Co-op crews: room codes and join links, host-authoritative sync of seeded brush operations, shared vault and upgrades, avatars with name tags, crew saves on every member, resume-as-host, `?coopdebug=1` two-tab transport.
- Settings: presets, render scale, V-Sync, frame cap, FOV, every effect toggle, audio volumes, sensitivity, key rebinding, scientific notation.
- Dev menu (`?dev=1`, backquote) covering every Batch 1 feature; performance overlay.
- `tools/sim.mjs` economy simulation with four bots; `tools/playtest.mjs` scripted Playwright session with screenshots.
