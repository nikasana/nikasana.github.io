# Changelog

## A clearer upgrade screen
- Branch tabs along the top (All, Dig, Melt, Vision, …), each with a green count of upgrades you can buy there; picking one flies to that branch and dims the rest.
- A "Ready to buy" list on the left: everything you can afford now, best value first (★ Best value is the one that adds the most income per coin), each with its own buy button; under it "Coming up" shows the next few and how long until you can afford them. The vault and your income sit on top.
- A details panel: what the upgrade does as before → after numbers (for example Bite radius 0.526 m → 0.534 m) and how much it raises your income, a level bar, a big green BUY button with the price (or why you can't: not enough coins and how long, or what it still needs, with a button that shows that upgrade), and Buy max for several levels at once.
- Click a node to select it, click it again (or BUY, or press B) to buy, so a stray click never spends coins; the way from the core to the selected node lights up. M buys max, F shows the whole tree, / searches.
- Search: type a name and the matches are outlined, everything else dims; Enter flies to the first.
- Clearer node states: green glowing nodes with a BUY tag can be bought, 🔒 marks locked ones, maxed ones turn gold with ✓ MAX. A legend explains them.
- The screen opens at a readable zoom (and where you left it), not zoomed out over the whole tree. On phones the list folds behind a 🛒 button and the details sit bottom right.

## Needle guide
- Once you are down at the Golden Needle's depth (inside its gold band on the depth gauge), you are guided across to it: a gold ★ NEEDLE marker appears on the compass strip and the minimap, and a readout under the crosshair says how far it is and which way to go ("✦ Needle 22 m ← to your left", "↑ ahead", "→ to your right", "↓ behind you", plus "a little deeper/higher" when needed). Close up, Needle Sense's arc and readout take over as before.

## Coins, chests, the depot, a bigger tree, and a clearer depth gauge
- 23 kinds of coin, each with its own shape and look: square, hex, ring, star, orb, gem, emerald, bar, shard, pebble and vase coins, some engraved and some glowing. Each kind starts at its own depth (bronze from 2 m, down to corestone from 1,250 m), so every layer has something new; later planets bring more kinds, and every world after Frostara has a signature coin found only there. The notebook has a Coins page and a notice marks each new kind.
- Coins come in sizes from 0.65 to 1.5 times their kind's size; a coin's value grows with its size squared (a big one is worth about five small ones), and the average stays the same.
- Chests: 1% of coins near the surface and 2.3% from about 500 m down are chests, worth 40 coins of that depth; they fill 18 pack slots. Chest Hunter makes them hold more.
- The depot ⛟: a shed with a hopper next to the Outfitter's hut. Coins now count only once delivered there: stand at it and your pack pours in at the delivery speed (12 slots a second at first). The lift only carries you up. Packs are much bigger (120 slots, and pack upgrades add three times as much), so you come up now and then, not all the time. Depot upgrades: Depot Conveyor and Twin Intakes (faster), Pack Frame (a far bigger pack), and the late Pneumatic Chute and Chute Pressure that send a trickle up from anywhere. A depot marker (hexagon) shows on the map and compass.
- A much bigger upgrade tree: an outer ring of 42 new nodes (167 in all, about 2,900 levels), with masteries of up to 400 levels for digging, melting, vision and automation, the depot column, and more for the planet, climate and luck trees. They are costly, to keep you upgrading through every planet.
- Upgrade levels vary: every 5th level of a node is a ★ milestone that counts three times as much as a normal level and costs 1.75 times as much; the levels in between are a little smaller, so five levels together give what they did before. The tree marks a node whose next level is a milestone with ★, and its tip says so.
- Depth gauge redone: SURFACE at the top and this planet's GOAL depth at the bottom, with labelled marks (10, 50, 100, 250, 500 m) instead of unlabelled lines; a dot labelled YOU follows you up and down; a notch marks the deepest point dug; the Golden Needle's depth band shows in gold (bright while you are in it), and with Needle Sense a gold diamond marks its exact depth.
- Finding the needle: everyone now feels it within 8 m (Needle Sense from 19 m), and a readout under the crosshair says how far it is and whether to dig down.
- Touch: JUMP and LIFT are separate buttons. LIFT is a wide, glowing blue button that appears only next to the lift beacon in the crater; JUMP only jumps. Notices on phones are smaller, sit beside the depth gauge, and show the newest two.
- Fixed (crews): a crewmate going quiet for a moment (for example while another loads in) no longer counts as the host leaving, which could split a crew in two; a closing tab says goodbye at once, and rejoining waits longer for a busy host.
- Fixed: freeing one of the new coin kinds could stop the game with an audio error (the clink sound only knew five kinds).

## Mobile: phones and tablets
- The game opens on phones and tablets (the desktop-only block is gone) and detects touch screens; add `?touch` to try the touch controls on a desktop, or `?desktop` to turn them off.
- Touch controls: a move stick appears under your left thumb (push it to the edge to sprint), drag anywhere else to look; hold USE (the tool), ALT (its second action) and JUMP (jump, and ride the lift); LAMP toggles the lamp; tap a tool slot to switch tools; buttons for pause, upgrades, planet view, notebook, crew and music.
- The upgrade tree pans with a finger and zooms with a pinch; on touch the first tap on a node shows what it does and a second tap buys it. Menus scroll with a finger.
- Phones start on the Low preset at 60% render scale. The HUD, menus and start screen fit small screens; in portrait a hint suggests turning the phone sideways. Hints and the hut terminal say "tap USE" instead of "click" or "left mouse".

## Feedback round after Batch 8
- Fixed: the snow and ice surface was drawn over everything standing in front of it below the horizon (the lower part of buildings, posts, the hut's interior). The depth copy before the ice pass never wrote depth, because WebGL skips depth writes when the depth test is off; it now always passes the test and writes.
- The camp is flat: no wind ridges or rolling ground within about 55 m of the claim centre, so nothing low hides behind a ridge; buildings stand on the highest ground under their footprint.
- The overhead gantry, its rails, trolley and cable are gone: the lift beacon flies on its own, so the station had no purpose.
- The Outfitter's hut is a room you walk into, with a doorway facing the claim, a wooden floor and a warm light. Its upgrade terminal on the back wall shows your vault and the five cheapest upgrades (ready ones highlighted); aim at it and click to open the upgrade tree. Pressing U inside the hut still works.
- Giant coins: about 0.8 m across (gems and relics bigger), six times fewer, each worth six times more, so the value per cubic metre is unchanged. A coin only comes free once you have dug most of the way around it (its centre and 9 of 10 points on its rim and faces in open air); a giant coin takes six pack slots, so the pack fills at the same pace.

## Batch 8: Reverse Mode "Make It Snow" and final polish
- Reverse Mode, unlocked once Omega is melted through (start screen, or the travel screen after Omega): a separate survey that freezes the seven worlds back, from Frostara on.
- The torch becomes the Frost Wand (Cryo Lance, Orbital Frost Beam): it grows new ice where you aim, never inside you. Every cubic metre frozen pays like one melted, there is no meltwater, and the sea level falls instead of rising. It always snows gently around you.
- The Freeze tree mirrors the Melt tree node for node (same costs, effects and synergies, its own names, icons and descriptions), so nothing new has to be learned. Kept easy: goals are 30% of the depth and upgrades cost half, so a planet takes about half to two thirds of the time.
- The HUD shows "Ice rebuilt" against the goal; the saves list marks Reverse surveys and shows each save's planet.
- Accessibility (Settings > Accessibility): colour-safe markers (Okabe-Ito palette), captions for musical cues, and reduced flashing. Every map and compass marker now has its own shape (the Outfitter a triangle, finds a star), so colour is never the only cue.
- Key rebinding review: the HUD key hints and tool-bar keys now follow a rebind straight away (they kept the old keys before); the controls page explains swaps, lists the fixed Esc pause key, names "Notebook" as everywhere else, and says "Freeze tools" in Reverse Mode.
- In Reverse Mode the glow where the wand works is ice-blue instead of heat-orange.
- Sim: a Reverse Mode section checks that it is easier for every bot and that strategy still matters.
- Dev menu: Make It Snow (Reverse Mode).

## Batch 7: Omega
- Omega, the last world, with every rule at once: Mistral's fog, Cinderice's lava pockets and heat veins, Tidalis's current, Gale's storms and wind windows, and Auralis's auroras and sky coins. North (Convergence: everything at full strength) and South (Still Point: gentler storms, deeper lava, a slower current).
- Every kind of mutant ice can turn up on Omega, so any missing DNA can still be found there.
- The climax: in the final 15% of the planet the core wakes. The storms fall silent, a gold aurora hangs over the crater, auroras come every 35-55 s and lone sky coins every 12-22 s, and the music rises.
- Theme: All Rivers, a medley that moves through every earlier world's key, mode and voices, eight bars each, carried by one choir.
- Three time capsules, a Golden Needle and two Omega milestones ("Every rule" and "The core wakes").
- Final balance pass: the sim covers all seven planets (both poles each) and every check passes.
- Performance pass on Low and Ultra: storm snow, current motes and sky-coin sparkles now follow the particle density of the preset; `tools/perf.mjs` measures the heaviest scene (Omega's climax) against draw-call, triangle and logic-time budgets.
- Streaming hitches cut: meshing a chunk next to unloaded neighbours no longer generates those whole neighbours (it samples just the border it needs), and coins in newly loaded ice are seeded a chunk per frame, nearest first, only near you (chunks under an edit are seeded at once, so no coin is ever lost). In the perf scene the world-streaming cost per frame fell from about 12.6 ms to under 1 ms once loaded.
- The planet view names the right planet number (it said 1 of 7 everywhere).
- Dev menu: Wake the core (Omega).

## Batch 6: Auralis
- Auralis: a twilight world of violet-green ice under a standing aurora. North (Crown of Lights: auroras about every 1.5 minutes over poorer ice) and South (Quiet Pole: rarer auroras, richer ice). Theme: Sky Choir, with a new wordless choir voice.
- Full aurora events on every planet: sky coins now fall one after another through the aurora instead of all at once, sparkle as they fall, and fade if nobody catches them. Each aurora picks its own colours.
- Aurora Chain: every sky coin you catch in a row is worth 20% more (up to ×4); a coin that fades uncaught nearby breaks the chain. The HUD shows the chain while sky coins are out.
- Lone sky coins: on Auralis a single rich sky coin streaks down every 25-70 s between auroras.
- DNA tree completed: six new mutant ice types (Brineice and Pearlice on Tidalis, Ventice and Stormglass on Gale, Lumice and Prismice on Auralis), each with its own effect in the ice and a DNA node, plus the Apex Form capstone.
- Planet milestones completed: 11 for every planet (crater 25/100/500 m and 1 km, sea level 5/25/100 cm, a meltwater lake, the first capsule, the Golden Needle, Pole ice free) and one or two for each world's own rule (vein combo, wind windows, high tide, Aurora Chain, sky harvest...). The Notebook shows the current planet's set.
- Time capsules and a Golden Needle on Tidalis, Gale and Auralis, with a new tide-sealed puzzle: free the capsule and wait beside it while the tide turns.
- Planet view: aurora ribbons ring the Auralis globe.
- Co-op: optional Crew Roles (Digger, Melter, Seer, Engineer) boost your own tree, and a crew with different roles shares up to +12% income. Role icons show on name tags and in the crew screen.
- Co-op: the full Crew Milestones set (11 shared goals, from melting 1,000 m³ together to melting 1 km down together), in a scrolling list in the crew screen.
- Co-op: automatic host migration. When the host leaves, the remaining member with the lowest id takes over from their own copy and the others rejoin; nobody has to press anything.
- Co-op fixes: a crewmate who opens a time capsule or finds the Golden Needle now pays the shared vault, and the capsule disappears for everyone; crewmates' sky coins reach the vault.
- Fix: gem and relic coins (tiers 4 and 5) were not drawn when loose or embedded, so aurora coins on gem planets were invisible.
- Dev menu: milestone pickers, Sky coin now, Chain +5.

## Batch 5: Gale
- Gale: wind-scoured grey-blue ice, North (Howling Shelf: long storms, short calms that pay double) and South (Lee Basin: sheltered, gentler storms). Theme: Pressure Front.
- Weather: storms of 55-85 s cut melting to 40% with blowing snow and thick fog; calm Wind Windows of 12-20 s between them make melting pay double. The HUD shows the phase and time left.
- Climate tree: Storm Shields (5 levels) give back part of the heat a storm steals.
- Automation completed: Auto Swing keeps your dig or melt tool working while you stand still aiming at ice; Quartermaster buys the cheapest upgrade under a quarter of your vault every few seconds (never a choose-one node). Both switch on and off in the upgrade screen.
- Luck & Secrets tree: Lucky Seals, Aurora Charm, Needle Whisper, Treasure Nose and the Hidden Ledger capstone.
- Notebook: a Finds page with silhouettes for the ones not found yet, and a Capsules page that remembers every capsule across planets with its planet and seal.
- Dev menu: Next weather phase.

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
