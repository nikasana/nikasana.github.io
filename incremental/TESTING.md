# Melt the Planet: testing guide

How to reach and check every feature. Each batch adds a section; earlier sections stay so the whole game can be retested.

**Dev menu:** open the game with `?dev=1` (for example `https://nikasana.github.io/incremental/?dev=1`), click into the game, then press the backquote key (`` ` ``). Every dev action flags the save as dev-modified.

**Automated checks:**
- `node tools/sim.mjs --write` rewrites `tools/sim-report.md` and exits non-zero if any economy check fails.
- `node tools/playtest.mjs` plays a scripted session with Playwright (it needs `python3 -m http.server 8123` running in `incremental/`). It writes screenshots and `report.md` to `tools/shots/<batch>/`.

**Save fixtures:** every batch leaves a save in `tools/saves/`. To load one, open Settings → Game, paste the code from the `.code.txt` file into the box, and press **Load from code**.

---

## Batch 2: Mistral

Automated: `node incremental/tools/batch2.mjs` (screenshots and report in `tools/shots/batch2/`).

| New | How to reach it | Dev menu | Working looks like |
|---|---|---|---|
| Planet travel | Reach Frostara's goal depth (1,000 m) | Events: Complete this planet | Travel screen with Mistral's two poles and your legacy; Travel takes you there; Stay keeps you here (Pause has Travel later) |
| Mistral | Travel there | World: planet Mistral, Go | Pearl-grey fog and sky; Rime crust at the top of the North pole |
| Legacy and re-scaling | Travel | Legacy: Set | Income ×legacy on arrival; the first upgrade still takes about 2 s |
| Gem coins | Dig below about 25 m on Mistral | Coins: +Gem | Faceted crystals with a glassy ring |
| X-ray | Vision tree: X-ray (after Depth Lens) | Upgrades: vis_xray Max | Focus the lamp on a wall: coins show through about 4 m of ice |
| Satellite radar | Vision tree: Satellite Radar | Upgrades: vis_radar Max | Finds appear as coloured dots on the minimap |
| Mutant ice | Dig into a tinted pocket | Events: Mutant ice ahead | A notice names the type; its DNA nodes unlock; Springice bounces, Tarfrost doubles coins, Chimeice rings and shows finds |
| DNA tree | Upgrades, below the planet | Upgrades: dna_* | Nodes need their mutant ice; prices are double |
| Mutation Log | Notebook (J), Mutation log tab | — | Found types with perks, silhouettes for the rest |
| Capsule Puzzles | Capsules at 42 m (Frostara) and on Mistral | Events: Time capsule here | Sealed capsules show progress in the prompt; melting next to them or a focused lamp opens them |
| Audio tree, variations | Upgrades: Audio (left); Music (M) | Upgrades: aud_* | Night variation slows the theme; Glass is quicker; Wind Choir adds bowed voices; Crystal Picks rings the pick |
| Postcards | Complete a planet; Notebook, Postcards tab | Events: Complete this planet | A captioned still of the planet |

## Batch 1: Frostara and co-op

### First minutes
| Check | How to reach | Working looks like |
|---|---|---|
| Desktop-only guard | Open on a phone, or in a window narrower than 1024 px on a small screen | One centred message: "Melt the Planet needs a desktop browser with mouse and keyboard." |
| Pole pick | First visit, or Settings → Game → Erase save | Start screen with North (Glacier Crown) and South (Old Shelf) cards and their strata colours. |
| Instant start | Begin, click into the game, hold left mouse on the ice in front of you | Chips fly and the pack bar fills within a second. Standing near the glowing beacon banks the pack, and the first upgrade (Honed Edge, about 2.6 coins) is affordable within a few seconds. |
| Banking | Stay within about 3 m of the beacon while carrying coins | Coins streak into the beacon, "+N" floats up, the vault number rises, and coins drop onto the pile in the bin at the north rim. |
| Lift beacon follows | Dig down, or use dev **Dig shaft to depth** | The gantry bridge and trolley move over you and the beacon lowers on its cable to hover beside you. Lift Winch makes it faster. |
| Pack full | Dig without banking until the bar is full | The bar turns orange and "Pack full · bank at the lift beacon" shows. Freed coins stay on the floor. |

### Tools
| Check | How to reach | Working looks like |
|---|---|---|
| Pick | Key 1, hold left mouse | The swing animates (the camera never shakes), the ice cracks white around the hit, and the chip sound varies on every strike. |
| Heavy strike | Pick, hold right mouse, release | A bigger bite with a lower crack. |
| Drill (Dig tier 2) | Buy Drill (or dev **Max Dig**) | A spinning bit with a whine and a powder spray, plus continuous small bites. |
| Torch (Melt tier 1) | Buy Torch, press 2, hold left mouse | Flame from the nozzle, a glowing orange edge on the ice, steam, drips and a wet sheen. A meltwater pool forms below. |
| Steam lance (Melt tier 2) | Buy Steam Lance (or dev **Max Melt**) | A longer barrel with brass coils, a stronger flame and bigger steam. |
| Lamp (Vision tier 1) | Buy Lamp, press 4 | A brighter beam that lights the inside of the ice. Holding left mouse focuses it and shows a richness reading in the bottom-left readouts. `F` toggles it. |
| Meltwater refreeze | Melt, then leave the pool alone for about 15 s | A milky skin creeps in from the edge, then the pool freezes into a clear lens of ice with a creak. Anti-Refreeze gives you longer. |

### Ice and world
| Check | How to reach | Working looks like |
|---|---|---|
| Refractive ice | Look into any pit | Thin ice is clear, thick ice goes cyan then deep blue, and coins inside show through, sharper near the surface and blurred deeper. |
| Ice Gradient Reading | Look at walls deeper than about 3 m | Richer ice is a touch deeper and greener. Digging those spots counts toward the Gradient Reader resonance. |
| Crater Walls Tell Stories | Dev **Dig shaft to depth** 30 m, look at the walls | Layered strata (firn, bubble ice, blue glacier ice) with thin dust lines, and fossils (a coiled shell, a fish spine, a frond) visible in the walls. |
| Core Depth Marker | Right edge of the HUD | A thin gauge from SURFACE to CORE 1,400 m on a square-root scale; the marker moves as the crater deepens. |
| Pole Pick Variations | Start on North, then on South (dev **World** → pole) | North starts in soft white firn; South starts in harder shelf ice with silver close to the surface. |
| Next goal in the ice | Dig a little, look down | A star glint pulses at the richest coin below you, visible through the ice. |

### Economy
| Check | How to reach | Working looks like |
|---|---|---|
| Upgrade tree | `U` | Four trees (Dig, Melt, Vision, Automation) around the planet core. Drag to pan, scroll to zoom. Affordable nodes glow; hover shows effects, cost and the time to afford. |
| Wait Meter (hidden) | Watch "Next goal" at the top | A soft glow behind it grows as you get close to affording it; no numbers. |
| Resonances | Play, or dev **Trigger resonance** | A "Resonance" notice and a chord. The notebook (`J`) fills in the entry; unfound ones show only a riddle. |
| Automation | Buy Seismic Stake or Heat Seep (dev **Max Automation**) | Small fractures open on the floor near the beacon on their own, their coins streak up the cable, and income continues while idle. |
| Offline progress | Close the tab with automation bought and come back after a few minutes, or dev **Simulate 1 h away** | A "While you were away" card with the coins earned, capped at 8 hours. |
| Wave wait curve | `node tools/sim.mjs` | All checks PASS; see `tools/sim-report.md`. |

### Events
| Check | How to reach | Working looks like |
|---|---|---|
| Milestones | Reach a 25 m crater or a 5 cm sea rise, or dev **Events** → milestone buttons | A notice, a short musical motif and a coin bonus; listed in the notebook's Milestones tab. |
| Time capsule | Frozen about 14 m down near the middle, or dev **Time capsule here** | A brass capsule with a glowing seam shows through the ice. When freed and reached it opens with a chime, a lore line and coins. |
| Golden Needle | Hidden 35–60 m down. Needle Sense shows a faint arc around the crosshair pointing to it. Or dev **Golden Needle here** / **Reveal needle** | A stinger, a flash and a large reward; marked found in the notebook. |
| Sea level and heat | Melt a lot, or watch the HUD and planet view | The sea-level readout climbs and the heat rings on the globe spread. |

### Planet view
| Check | How to reach | Working looks like |
|---|---|---|
| Transition | `Tab` | The camera rises out of the crater with a white-blue fade, then pulls back from the pole to orbit. `Tab` or `Esc` returns. |
| Globe | In the planet view | Clouds, atmosphere rim and stars. Your pole shows the crater glowing brighter with depth, orange heat rings spreading as the crater deepens (Planet Map Rings), and the ice-cap edge retreating. The readouts show crater depth, sea level, heat spread and core depth. Drag to turn, scroll to zoom. |

### Audio and music
| Check | How to reach | Working looks like |
|---|---|---|
| Score | Click into the game | Soft pads and glass harmonica at the surface. Dig deeper (dev shaft to 30 m, then 200 m): mallet pulses enter, then a drone, then bowed metal and brass. `M` lists themes (Frostara's is unlocked) and switches music off and on. |
| Effects | Dig, melt, walk, bank | Varied chips and cracks, the drill whine, torch roar and steam hiss, coin clinks by tier, footsteps that differ on snow and ice, and reverb that grows with depth. |
| Volumes | Settings → Audio | Master, music, effects and ambience sliders work independently. |

### Settings and saves
| Check | How to reach | Working looks like |
|---|---|---|
| Graphics | Esc → Settings → Graphics | Low/Medium/High/Ultra presets; render scale, V-Sync, frame cap (30/60/120/144/unlimited), FOV, and toggles for AO, bloom, SMAA, grading, grain, vignette and fog. Ice detail, particles, shadow quality and tone mapping change visibly. |
| Performance overlay | Settings → Graphics → Performance overlay | Top-right FPS, frame time with a graph, draw calls and triangles. |
| Key rebinding | Settings → Controls | Click a key cap, press a new key; clashing actions swap. "Reset keys" restores defaults. |
| Auto-save | Play for 10 s, reload | You come back where you were; the pause screen shows "Saved N s ago". |
| Export / import | Settings → Game → Make save code, then Load from code | The same vault, crater and upgrades come back. |
| Hard reset | Settings → Game → Erase save | A confirmation, then the start screen. |
| Earlier saves | Load `tools/saves/batch1-playtest.code.txt` | Loads without errors. |

### Co-op crews
| Check | How to reach | Working looks like |
|---|---|---|
| Create | `C` → Create crew | A six-letter code, a Copy invite link button and the member list. A fresh crater starts; your solo save is kept. |
| Join by link | Open the copied link (`?join=CODE`) in another browser | The joiner arrives beside the beacon in the same crater with the same vault. |
| Offline two-tab test | Tab 1: `?coopdebug=1` → `C` → Create. Tab 2: open the link (it carries `coopdebug=1`) | Same as above, over a BroadcastChannel; no network needed. |
| Sync | Dig in one tab | The edit, chips and sound appear in the other tab. Banking in either tab raises the shared vault. Buying in a member tab goes through the host. |
| Avatars | Look at your crewmate | A parka-clad figure with a name tag, walking, holding a tool, and swinging or aiming it while working. |
| Crew milestones | `C` screen, or dev **Crew:** buttons | Progress bars. Completing one gives every member a permanent bonus that also applies solo. |
| Host leaves | Close the host tab | The member sees "Host left", keeps playing from their copy and retries automatically. **Resume as host** on the crew screen re-opens the same code. |

### Batch 1.2 checks
1. Walk 60 m or more past the stake line and dig: the ice opens there like in the claim, the snow around the hole has no seam, and the hole is still there after walking away and back. The lift follows you out.
2. Melt a lot of ice in a narrow hole: the water rises in the hole. Walk in: wading is slower and splashes; in water deeper than your chest you swim (Space rises), and with your head under the view turns green-blue.
3. Performance (High, start view): about 235 draw calls and 210k triangles in the overlay.

### Round 2 checks
1. Dig a narrow shaft 10 m down with a side tunnel, ride the lift up, walk away, come back: the shaft and tunnel are exactly as dug. Reload the page: still exact.
2. Press U away from the blue Outfitter's hut: a notice sends you there; at the hut, U opens the upgrades. The hut shows as ▣ on the compass and minimap, and its ground cannot be dug.
3. Dig into a crater wall: coins show through up to about a metre of ice, mostly in horizontal seams; freed coins hang visible for a moment before flying to the pack.
4. Find a glowing find in the ice, dig it free and walk to it: a notice names it with its reward (coins, a boost such as faster swings, or a permanent relic).
5. Stand still at the bottom of a shaft: the view does not move at all.
6. Open and close any menu with its key or Esc: play resumes without a click (Esc from play still opens Pause).
7. Start screen with saves: every survey and crew is listed; Continue loads it; Begin a new survey keeps the old ones; Delete asks first.
8. Two tabs with ?coopdebug=1: host digs a tunnel, member joins: the tunnel is identical for both; both see each other's avatar; a find opened by one vanishes for the other.

### Dev menu coverage (Batch 1)
Jump planet and pole, dig a shaft to any depth, noclip and teleport; add copper, silver or gold, add one minute or one hour of income, fill the pack; set Legacy; add, max or reset any node or whole tree; spawn the time capsule or the needle, reveal the needle; trigger each milestone, crew milestone and resonance; refreeze pools; ×10 and ×100 time; simulate 1 h or 8 h away; live debug readout (measured vs model income, live wait for the next goal, inflation, active resonances, chunk and particle counts, draw calls).
