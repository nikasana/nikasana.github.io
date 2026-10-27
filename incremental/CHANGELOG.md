# Changelog

## Batch 1 fixes, round 1 (playtest feedback)
- Fixed black rectangles that could cover part of the screen: one invalid (NaN) pixel was being spread by the bloom blur into a large block. A cleanup pass now scrubs invalid pixels before bloom, and the ice, particle and water shaders guard their own output.
- Fixed hovering over freshly dug holes: the collision field reported phantom floors where crater spheres overlap. Contacts are now checked against real ice, and the player drops down the shaft as it is dug.
- The player is slightly slimmer, and the smallest pick crater is wide enough to follow down.
- Looking down extends your reach, so you can always hit the floor of the hole you are standing in.
- Digging and melting now erode the thin one-voxel ridges and plates left between overlapping craters, so no hard-to-hit slivers of ice remain.

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
