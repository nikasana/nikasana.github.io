# Melt the Planet: design notes

Choices made where the build prompt is silent, and the reasons. Updated every batch.

## Platform and tech

- **Engine.** No game engine: three.js 0.186.1 (vendored from the npm tarball, with its addons) and plain ES modules with an import map. No build step. PeerJS 1.5.5 is vendored and loaded only when co-op is used.
- **Fonts.** Big Shoulders Display (display), Instrument Sans (body) and IBM Plex Mono (readouts), vendored from `@fontsource` with their SIL OFL licences in `vendor/fonts/`. They are licensed type, not game art; no third-party art, text or names are used.
- **Desktop guard.** Touch-only devices and screens smaller than 1024×600 see the single "needs a desktop browser" message. `?force` skips the guard for automated tests.
- **V-Sync.** Browsers always sync `requestAnimationFrame` to the display. "V-Sync off" switches the loop to a `MessageChannel` scheduler so frames are produced as fast as the frame cap allows; presentation is still composited by the browser.

## World

- **The claim.** The diggable ice is a 64 × 64 m square at the pole, with a 1.5 m untouchable wall at its edge. Outside it, the ice sheet is an analytic snow surface out to a ring of ridges 0.7–2 km away. A survey stake line marks the claim.
- **Depth without a 1 km voxel grid.** The volume is 0.5 m voxels in 8 m chunks. Only chunks within a vertical window around the player keep density data; the crater is persisted as a 128 × 128 heightmap of carved depth (5 cm steps, run-length encoded), and chunks regenerate from it. Tunnels under overhangs are not kept across reloads; the crater shape is.
- **Meshing.** Surface nets in Web Workers, padded so chunk seams match. Edited chunks jump the queue; untouched all-ice or all-air chunks never mesh.
- **Pole sun.** At a pole the sun circles the horizon at a nearly constant low elevation, so shadows sweep around the crater over a 10-minute day instead of rising and setting.
- **Lift beacon.** An overhead gantry crane spans the claim on rails along the east and west rims. Its trolley lowers the beacon on a cable to wherever you dig, so banking never means walking back up. Lift speed is an upgrade.
- **Vault pile.** Banked coins drop into a walled bin at the north rim. The pile uses a sand-pile settling model (coins slide downhill until the slope is below an angle of repose) and then freeze into instances. Its size follows the log of lifetime banked value.
- **Next goal in the world.** "The next goal is always visible" is met twice: the HUD shows the next affordable upgrade (with the hidden wait-meter glow), and the richest coin below you glints through the ice.
- **No helpers.** Automation is equipment, not workers: Seismic Stakes and Heat Seeps are planted around the beacon and fracture or melt the floor on their own.

## Ice rendering

- **True thickness.** The opaque scene renders first into a mipmapped target. The ice's back faces render into a depth-only target. The ice shader refracts the opaque image and attenuates it by the real distance through the ice (front face to the nearer of the back face or the opaque surface), so thin ice is clear and thick ice goes cyan, then deep blue. Blur grows with thickness, so coins are sharp near the surface and soft deeper down.
- **Lighting.** The ice is lit as a white Lambert surface so sun, cascaded shadows and image-based light all count, then the body is composed from the refracted scene, Beer–Lambert absorption, strata-tinted in-scatter, and bubbles and fracture planes ray-marched along the refracted ray.
- **CSM addon bug.** The vendored CSM addon replaces three's light chunk with an older copy that lacks the `material.dfg` set-up, which left every specular term undefined (metals rendered black). `render/sky.js` re-inserts the missing block at runtime.
- **Physical vs standard.** The ice uses the standard PBR material (F0 0.04) rather than the physical one (ice's true F0 is 0.018); the physical variant produced NaNs on some GL backends.

## Economy

- **Wait curve.** Costs grow per node level (1.25 base, lowered by resonances) plus a small inflation on every purchase. Each active resonance damps that inflation, so a coherent build keeps prices flat for longer. This is what makes the drift depend on strategy.
- **"Effective growth"** in the sim report is measured, not configured: the price of a level over the price of the previous level of the same node, including inflation in between. Random play lands near 1.5, cheapest-first and ROI near 1.28, the synergy-aware bot near 1.21.
- **Average player.** The cheapest-first bot stands in for an average player: 1–3 s waits early, 15–20 s late, a planet in about 75 minutes. The ROI and synergy bots finish in 25–30 minutes; good play is meant to be much faster.
- **Uncapped efficiency.** Collection and banking efficiency are not capped at 100%: the part above 100% pays out as bonus value at the vault, so collection and lift upgrades never go dead.
- **Coin value.** Half of an area's value comes out as fine coin dust (straight into the pack as you dig); the other half sits in the embedded coins, whose value scales with depth and tier.
- **Crew milestones** are stored in a per-browser profile and apply to every game on that browser, solo included ("permanent bonus for every member").

## Co-op

- **Host authority.** The host applies every edit and owns the vault and upgrades. Members apply their own edits immediately and send them as seeded brush operations; the host relays them. Bank requests carry coin ids, and the host ignores ids it has already credited.
- **Crew saves.** Every member saves the crew's state in a `crew.<code>` slot. If the host leaves, members keep playing from their copy, retry the host every few seconds, and can resume as host with the same code.
- **Fresh crater.** Creating a crew starts a fresh campaign; the solo save is kept separately and comes back when you leave.

## Audio

- Everything is synthesised with Web Audio: no samples. Effects vary pitch, timing and partials on every play. Reverb crossfades from open air to a long shaft impulse as the crater deepens.
- The score is seeded generative "glacial orchestral electronics" in D lydian for Frostara, with layers entering by crater depth: pads, glass harmonica and ice grains at the surface; mallet pulse and drone in the middle depths; bowed metal, soft brass and a low pulse deep down; faster pulse near the core.

## Controls

- Defaults follow the prompt. Two extra rebindable keys: `J` opens the notebook (collections) and `F` toggles the lamp.
- The pick has a secondary heavy strike (hold right mouse to charge); the torch's secondary is a wide, gentler spray; the vision tool's secondary toggles the lamp.

## Why not just dig straight down? (round 2)
- Coins sit in horizontal seams every 5.5 m, with barren ice between; a seam is worth following sideways.
- Finds are scattered across the whole claim, mostly away from the starting column, and change with depth.
- Upgrades are only sold at the Outfitter's hut on the surface, so every upgrade is a trip up the lift and back.
- Dig and melt multiply each other (thermal shock, crack seep): swapping tools on one face beats pushing one tool down.
- What is left: a straight shaft is still the fastest way to depth. Batch 1.2 (water) and later planets add more reasons to spread out.

## World persistence
- The heightmap of carved depth is kept for coarse streaming and the planet view; every chunk that was ever edited also keeps its exact density, in memory, in saves (run-length encoded) and in crew snapshots.

## Batch 2: travel, legacy and Mistral
- Legacy multiplies income on the next planet: legacy x (1 + 0.15 log10(1 + coins earned) + 0.4 min(1, depth / goal) + 0.2 min(1, time / 1 h)). Costs re-scale by the same factor times the planet's coin density relative to Frostara, so waits on arrival match planet 1 (the sim checks the first wait after travel for every bot).
- Mistral's fog is real exponential fog (density 0.022) plus a sky veil; each Vision tier divides the fog density, and the focused lamp divides it again, so Vision is how you see on Mistral.
- Mutant ice pockets are placed per planet and pole from the seed; the 12 nearest are passed to the ice shader. Finding a type is remembered across planets, so its DNA stays unlocked.
- DNA nodes cost twice a comparable node; bots in the sim never find mutant ice, so the wait curve does not depend on DNA.
- Postcards are a captioned still of the frame when the planet is completed, stored as a small JPEG in the profile.

## Batch 3: Cinderice
- Lava is the risk on Cinderice: melting is the fast tool, and near lava it is faster still (value x up to 1.6), but heat builds at 0.35/s at the pocket edge and decays at 0.12/s, so short bursts are safe and long burns are not. Digging never builds heat.
- A burst refills the hole with a fill op (shared in co-op) and costs 30% of the pack, never banked coins. Heat Skin (Emberice DNA) slows the heat and protects the pack.
- Veins are random walks of 14 points from 3-15 m deep; within 1 m of one, the combo grows 0.6/s to x5 and multiplies melted value by 1 + 0.35 (combo - 1).
- Lava pockets share the ice shader's 12 pocket slots with mutant ice (nearest first) and glow over 1.7x their radius.
- The mirror sunbeam is modelled in the sim as extra melt volume (0.8 x mirror power), so the Planet tree is part of the economy proof.

## Batch 4: Tidalis
- The current is a smooth field of angle a = 1.3 sin(0.021x + t) + 1.1 cos(0.027z - 0.7t) + t, turning slowly with t = time x 0.004, at 0.9 m/s. Loose coins blend toward it and are also carried directly (contact friction would otherwise cancel it), never into a wall.
- Pools test six directions a step beyond their edge once a second on average and slide half-way toward the lowest open floor; overlapping pools on the same floor merge their volume.
- The sonic hammer trades swing speed (-25%) for a wider bite and a six-crater ring per blow; the sim sees only its stats, so its wait curve is part of the proof.
- Aurora coins are worth 12 s of income each and go straight to the vault so a full pack never wastes an aurora. In co-op only the host runs the aurora in this batch.
- Style is cosmetic only and never touches the economy.

## Batch 5: Gale
- Weather is a two-phase cycle (storm, calm) with lengths drawn from the planet's ranges. The sim uses the time-weighted average melt factor: (storm x inStorm + calm x 2) / (storm + calm), where inStorm = 0.4 North, 0.7 South, lifted toward 1 by Storm Shields. Digging is never touched by weather, so storms push players toward the pick and calms toward the torch.
- Auto Swing counts as +0.12 activity in the sim; it only works while standing still and aiming at ice, so it saves effort rather than replacing play.
- Quartermaster spends at most a quarter of the vault per buy and skips choose-one nodes so it never makes a permanent choice for the player.
- Luck nodes are small, capped boosts (capsules, auroras, finds, the needle hint) so collecting stays a side reward next to the main economy.

## Batch 6: Auralis
- Auralis trades ice for sky: coin density is 6.4 (Frostara-like planets 7-8) and the sim adds a sky income share of 34% North and 20% South, lifted by Aurora Charm and Sky Eyes. Sky coins are priced in seconds of measured income (12 s each, 24 s for a lone coin), so they scale with progress and never break the wait curve.
- The Aurora Chain multiplier is 1 + 0.2 × (catches - 1), capped at ×4 after 16 catches. Only coins within 30 m of you break it when they fade, so a chain is never lost to a coin you could not have reached.
- Sky coins fall at 1.6 m/s from 8-12 m and hover for the rest of a 20 s life (30 s for lone coins): long enough to walk to, short enough that order matters.
- Milestone counters (sky coins, finds, capsules, wind windows, best chain, best vein combo) live in econ.actions, so a crewmate's progress reaches the host the same way resonance actions do. Running bests are sent as "max", not added.
- Crew Roles are +15% on one stat of your tree, only while in a crew; the shared mix bonus is +4% per extra distinct role (max +12% with four). It is small on purpose: roles reward talking about who does what, not forcing it.
- Host migration elects the lowest peer id among the remaining members, so every member reaches the same answer without a vote. The heir waits 1.5 s, then hosts the crew code from its own copy; if the old id is still held it rejoins instead and tries again.
- The DNA capstone Apex Form needs mutant ice from three worlds (More Hands, Salt Blood, Wind Runner, Sky Eyes), so it lands late in a campaign.
- With the full milestone set, lump bonuses late in a planet flattened the ROI bot's late waits enough to flip the drift ordering, even at 20 s each. Milestones are now treated like the other windfalls (capsules, finds, the needle, sky coins): the sim records them but does not pay them, so its checks measure the steady purchase curve. Their in-game size was also cut to 60-150 s of income so they read as a treat, not a skip.

## Batch 7: Omega
- Omega stacks the rules at reduced strength so the combination stays fair: storms take melting to 55% (not 40%) and calms pay ×1.8, the current runs at 0.6 m/s, lava starts at 20 m, and auroras come every 2-3 minutes with a 15% sky share (10% South).
- The climax changes no steady rates except the weather (the model treats the storms as over past 85% of the goal depth). Its rewards are windfalls: auroras every 35-55 s and lone sky coins every 12-22 s, paid in seconds of income like every sky coin. That keeps the wait curve intact while the last stretch feels like a finale.
- The medley rebuilds the theme every eight bars from the next world's theme (key, mode, progression, tempo range and voice weights), keeps a choir of at least 0.5 throughout, and still applies the chosen Audio variation.
- Performance: Omega's climax is the heaviest scene (dug crater, lava glow, aurora, 20+ sky coins, storm particles before the climax). Every new per-frame effect added since Batch 4 is now scaled by the preset's particle density, and the perf tool checks draw calls, triangles and logic time against fixed budgets for Low and Ultra.
- Profiling the perf scene showed the frame cost was not rendering features but streaming: gatherPadded generated full 16³ blocks for every unloaded neighbour just to read a 2-voxel border (now analytic per border voxel, same formula as generateChunk), and every chunk load seeded ~1,600 coin candidates with a noise lookup each on the spot. Seeding is now queued: at most ~1.5 ms a frame (at least one chunk), nearest first, only within the coin draw distance plus a chunk; an edit seeds the chunks it touches before it changes them, so freed coins still come out exactly as before.
