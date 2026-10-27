# Changelog

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
