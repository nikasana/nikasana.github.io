// Every user-facing string lives here.
import { RU } from './strings_ru.js';
export const STRINGS = {
  en: {
    title: 'Lift',
    tagline: 'A quiet game about clearing and lighting an endless house. A game about an experience, not a treatment.',
    start: 'Begin', continue: 'Continue',
    hintDesktop: 'WASD walk · mouse look · hold left button: clear and polish · E: switch / lift panel · Shift: slide · G: gadget (wheel picks) · Q: ping · M: map · H: back to the lift',
    hintTouch: 'Left thumb walk · drag right side to look · hold TOOL · USE at a switch or the lift panel',
    clickToLook: 'Click to look around',
    glow: 'Glow',
    hudRoom: '{glow} ✦  ·  clear {c}%  ·  polish {p}%{lit}',
    hudLit: '  ·  lit',
    hudCabin: '{glow} ✦  ·  +{rate}/s  ·  the lift',
    switchBuy: 'E: light this room — {cost} ✦',
    switchBuyTouch: 'USE: light this room — {cost} ✦',
    switchFar: 'Too far from the light network',
    switchLit: 'This room is lit',
    switchPoor: 'Needs {cost} ✦',
    panelOpen: 'E: lift panel', panelOpenTouch: 'USE: lift panel',
    roomCleared: 'Cleared', roomPolished: 'Polished', roomLit: 'Lit',
    saved: 'Saved', loading: 'Loading…',
    // touch buttons
    bTool: 'TOOL', bUse: 'USE', bSlide: 'SLIDE', bMap: 'MAP', bHome: 'HOME', bGadget: 'ITEM',
    // panel
    close: 'Close', tabFloors: 'Floors', tabUpgrades: 'Upgrades', tabHelpers: 'Helpers', tabSorties: 'Sorties',
    tabGadgets: 'Gadgets', tabAnchors: 'Anchors', tabCatalog: 'Catalog', tabDiary: 'Diary', tabSettings: 'Settings',
    settings: 'Settings', fov: 'Field of view', sensitivity: 'Look sensitivity', volume: 'Volume', warmMode: 'Warm mode (dusk becomes warm half-light)',
    authorNotes: "Author's notes", language: 'Language', exportSave: 'Export save', importSave: 'Import save',
    importPrompt: 'Paste a save text here', importDone: 'Save imported', importBad: 'That text is not a save',
    resetGame: 'Start a new house', resetConfirm: 'Start a new house? Everything here is forgotten.',
    resume: 'Resume',
    hintDesktop2: 'Shift: slide on lit, polished floor · M: map',
    sealedOpen: 'E: open the sealed door — {cost} ✦', sealedOpenTouch: 'USE: open the sealed door — {cost} ✦', sealedOpened: 'The door gives way',
    floorOpen: 'Floor {n} is open — ride the lift down', floorArrive: 'Floor {n}', floorName: 'Floor {n}', floorHere: 'you are here',
    floorInfo: '{lit} rooms lit · rooms {size} m wide', floorLocked: 'Not open yet', floorGo: 'Ride',
    floorNext: 'The next floor opens when this floor is calm. ({lit} rooms lit)',
    catalogInfo: '{n} entries · +{pct}% Glow', catalogEmpty: 'Rare finds and special rooms are kept here.', catalogNew: 'Catalog: {name}',
    cat_set_tree: 'A tree under a skylight', cat_set_chair: 'A chair under a lamp', cat_set_stairs: 'Stairs to a glowing window',
    cat_set_aquarium: 'A quiet aquarium', cat_set_door: 'A door standing on its own', cat_set_moon: 'A small moon',
    cat_find_marble: 'A marble', cat_find_key: 'A small key', cat_find_button: 'A button', cat_find_shell: 'A shell', cat_find_ribbon: 'A ribbon',
    cat_find_thimble: 'A thimble', cat_find_feather: 'A feather', cat_find_pebble: 'A smooth pebble', cat_find_bell: 'A tiny bell', cat_find_star: 'A paper star',
    graphics: 'Graphics', graphicsNote: 'Higher levels look richer and cost more frame rate. Auto starts high and steps down if the game slows.',
    qAuto: 'Auto (now {n})', q1: '1 · Low', q2: '2 · Medium', q3: '3 · High', q4: '4 · Very high', q5: '5 · Ultra',
    music: 'Music',
    up_power: 'Shovel power', up_reach: 'Shovel reach', up_speed: 'Brush speed', up_shine: 'Brush shine', up_bright: 'Lamp brightness', up_wiring: 'Lamp wiring',
    fl_power: '“Eat something warm”', fl_reach: '“Open a window”', fl_speed: '“Put on music”', fl_shine: '“Make the bed”', fl_bright: '“Get some sleep”', fl_wiring: '“Call a friend”',
    ef_power: 'Clears {a}/s → {b}/s on this floor', ef_reach: 'Tool {a} m → {b} m wide', ef_speed: 'Polish {a}/s → {b}/s', ef_shine: 'Polish counts ×{a} → ×{b}',
    ef_bright: 'Lamp level {a} → {b}', ef_wiring: 'Wire {a} → {b} rooms from the light',
    track_shovel: 'Shovel', track_brush: 'Brush', track_lamp: 'Lamp', trackLevel: 'level {n}', abilityAt: 'ability at level {n}', abilityReady: 'ability unlocked',
    buyFor: '{cost} ✦', lvl: 'Lv {n}',
    balanceNote: 'Balance bonus: +{pct}% Glow (10% per level of your lowest track).',
    h_sweeper: 'Sweeper bot', h_mop: 'Mop bot', h_firefly: 'Firefly',
    hd_sweeper: 'Gathers clutter in rooms you have visited.', hd_mop: 'Polishes the floors the sweepers bared.', hd_firefly: 'Carries the glow of finished cells home.',
    pipeInfo: 'Pipeline: {rate} cells/s · the slowest stage sets the pace.', pipeNeck: 'Bottleneck: {name}', pipeIdle: 'No helpers yet. Each stage needs at least one.',
    auraNote: 'Helpers in your room work twice as fast.',
    topGlow: '{glow} ✦', topRate: '+{rate}/s', topFloor: 'Floor {n}', topRank: 'rank {n}', topRested: 'rested ×{n}',
    welcomeBack: 'Welcome back', awayFor: 'Away for {time}.', awayGlow: 'Glow earned: {glow} ✦ (half pace while away)', awayRooms: 'Rooms your helpers finished: {n}',
    awayRested: 'Rested charges: {n} — the next sortie or wave pays double.', awayWave: 'A wave is ready to be called.', ok: 'Carry on',
    hours: '{n} h', minutes: '{n} min',
    tideTitle: 'The Tide', noise: 'Noise {n}%', wavesHeld: 'Waves held {a} / {b}', rankLine: 'Floor rank {r} · cleared {c} · polished {p} · lit {l} rooms (rank needs {n} of each per step)',
    forecast: 'Pressure {p}, Strength {s} — {mood}', mood_calm: 'calm', mood_close: 'close', mood_hard: 'hard',
    waveName: 'Wave {k} of {n}', greatTide: 'The Great Tide', frontsLine: 'Fronts: {list}', side_0: 'north', side_1: 'east', side_2: 'south', side_3: 'west',
    openSides: 'Nothing lit to the {list} — the Tide would walk straight to the lift.', callWave: 'Call the wave', waveLocked: 'Reach floor rank {k} to call this wave.',
    floorQuiet: 'This floor is Quiet. Income ×2, no random Tides.', waveActive: 'A wave is under way.',
    tideComing: 'The Tide is coming — from the {dir}', tideStirs: 'The Tide stirs — from the {dir}', tideHeld: 'The wave ebbs. +{glow} ✦', tideHeldRested: 'The wave ebbs. +{glow} ✦ (rested ×2)',
    tideBounced: 'The wave turns away at once. +{glow} ✦', tideLost: 'The Tide reached the lift. Nothing banked is lost — the retry will be 10% weaker.',
    tideFlood: 'A room went dark', floorQuietNow: 'The floor is Quiet', hudTide: '  ·  the Tide {t}', doorShut: 'E: shut this door (holds {n} s)', doorShutTouch: 'USE: shut this door (holds {n} s)',
    rankUp: 'Floor rank {n}',
    lang_auto: 'Auto (from the browser)', lang_en: 'English', lang_ru: 'Русский',
    tabTogether: 'Together', coopTitle: 'Play together', coopNote: 'Invite up to three friends by link. You keep your own Glow and upgrades; the house belongs to the host. Q drops a pillar of light.',
    coopHost: 'Invite a friend', coopLink: 'Send this link:', coopCopy: 'Copy link', coopCopied: 'Link copied', coopPlayers: '{n} in the house', coopLeave: 'Leave and go home',
    coopJoining: 'Joining a friend’s house…', coopJoined: 'You are in a friend’s house', coopFail: 'Could not reach the other house — carrying on alone.', coopFull: 'That house is full.',
    coopGuestWave: 'The host calls the waves.', coopShared: 'Shared houses you have visited', coopHostShared: 'Host this house', coopNone: 'None yet.', coopSomeone: 'Someone joined', coopLeft: 'Someone left',
    note_0: 'Checked the door twice. Didn’t go a third time.', note_1: 'Neighbours laughing behind the wall. It was a film.', note_2: 'Kept the lights on all night. Morning came anyway.',
    note_3: 'Wrote a list of everything. It was shorter than it felt.', note_4: 'Heard my name in the hallway. It was the radiator.',
    note_5: 'Walked to the shop today. Nobody was looking.', note_6: 'Answered a message I’d been avoiding. It was fine.', note_7: 'Spilled the tea. Made another one.',
    note_8: 'Sat on the stairs for a while. The house didn’t mind.', note_9: 'Left one dish in the sink on purpose.',
    note_10: 'Opened the curtains before I had decided to.', note_11: 'Someone waved. I waved back. That was all.', note_12: 'The kettle clicked off and I noticed I was humming.',
    note_13: 'Took the long way round. The light was nice.', note_14: 'Forgot to worry until lunch.',
    note_15: 'Slept through. Didn’t count the hours.', note_16: 'Bought flowers for no reason.', note_17: 'The quiet felt like a room, not a hole.',
    note_18: 'Laughed at my own joke. Out loud.', note_19: 'Nothing happened today. It was good.',
    noteFound: 'A note: “{text}”', notesTitle: 'Notes from someone who lived here', notesNone: 'Notes turn up in cleared rooms, and always in sealed ones.',
    ach_leftRoom: 'Left the room', ach_oneThing: 'One thing at a time', ach_asked: 'Asked instead of assuming', ach_enough: 'Let it be enough', ach_whole: 'Stayed for all of it',
    ach_madeItBack: 'Made it back', ach_rested: 'Rested', ach_night: 'Called it a night', ach_keptGoing: 'Kept going', ach_noticed: 'Noticed something nice',
    achd_leftRoom: 'Stepped out of the lift.', achd_oneThing: 'Cleared, polished and lit one room.', achd_asked: 'Tested a sign.', achd_enough: 'Held a wave.', achd_whole: 'Held a Great Tide.',
    achd_madeItBack: 'A clean exit from a sortie.', achd_rested: 'Came back after time away.', achd_night: 'Let the night end at Dawn.', achd_keptGoing: 'Reached floor 3.', achd_noticed: 'Found something for the catalog.',
    achGot: 'Small win: {name}', achTitle: 'Small wins', diaryTitle: 'Diary', diaryNone: 'At Dawn you may write one line here.',
    anchorsTitle: 'Anchors', anchorsNote: 'Each Anchor is a habit that stays with you through every Dawn. Duplicates add +10 % Glow each.',
    and_clock: 'Untested false signs fade.', and_notebook: 'Signs test faster.', and_coin: 'Fewer false signs.', and_phone: 'Now and then a true ray points the way.',
    and_mirror: 'False signs look paler.', and_window: 'A larger map.', anchorNone: 'not found yet', anchorRank: 'rank {n}', phoneRay: 'Someone answered — a ray on the map',
    dawnTitle: 'Dawn', dawnLocked: 'Dawn comes once you reach floor 3.', dawnInfo: 'Clarity +{n} (each point +10 % Glow forever). You keep Clarity, Anchors, catalog, notes, small wins, diary and settings; the house, Glow, upgrades and helpers start again.',
    dawnLine: 'One line for the diary (optional)', dawnGo: 'Let the night end', dawnConfirm: 'Let the night end? A new house waits in the morning.', dawnDone: 'Dawn. Clarity {n}.', clarityNow: 'Clarity {n} · +{pct} % Glow',
    tabLong: 'Diary',
    ab_dash: 'Dash', ab_gloss: 'Gloss', ab_flash: 'Flash', abilityUnlocked: 'New ability: {name} (key {k})', abilityCooling: '{name} in {s} s',
    abd_dash: 'A lunge that ploughs a clear trench.', abd_gloss: '5 s of instant polish; the Tide slides back off gloss.', abd_flash: 'Nearby lamps pulse, push the wave back and relight fading lamps.',
    flowFull: 'Flow — your helpers’ aura reaches the next rooms', boostLamp: 'E: boost this lamp for the wave — {cost} ✦', boostLampTouch: 'USE: boost this lamp for the wave — {cost} ✦', lampBoosted: 'The lamp burns brighter',
    loud: 'Loud mode (×2 reward, Tides return)', abilitiesTitle: 'Abilities',
    so_haul: 'Haul', so_check: 'Check', so_search: 'Search', so_chain: 'Chain', so_line: 'Line', so_hall: 'Great hall', so_deep: 'Deep run',
    sod_haul: 'Collect {n} {mat}.', sod_check: 'Test {n} signs.', sod_search: 'Find the Anchor by its signs.', sod_chain: 'Light {n} rooms in an unbroken line from the lift.',
    sod_line: 'Carry light from the lift to the marked room.', sod_hall: 'Finish one enormous hall: clear, polish and light it.', sod_deep: 'Haul on three floors in a row: {a}, {b}, {c}.',
    act_clear: 'Clear', act_polish: 'Polish', act_light: 'Light', act_all: 'All three',
    mut_draft: 'Draft — the Tide moves faster', mut_double: 'Double clutter — clearing is slower', mut_fog: 'Thick fog', mut_slick: 'Slick floor', mut_echo: 'Echo — twice the signs, false ones too',
    mut_gold: 'Gold vein — clearing pays double', mut_dim: 'Dim lamps — rooms hold less', mut_quiet: 'Quiet hour — no Tides, lower reward',
    risk: 'Risk {n}', riskNote: 'Higher risk: stronger, more frequent Tides, ×{m} reward.', startSortie: 'Set out', reward: 'Reward {glow} ✦',
    sortieActive: 'Out now: {name} · {p} / {g}', abandon: 'Let it go', sortieStarted: 'Sortie: {name}', sortieDoneHud: '  ·  {name} {p}/{g}',
    extractNow: 'The lift bell rings — back to the lift within {t} s for +50 %', extractHud: '  ·  back to the lift {t}', sortiePaid: 'Sortie done. +{glow} ✦', sortiePaidClean: 'Clean exit! +{glow} ✦ (+50 %)',
    mat_balls: 'balls', mat_foam: 'foam', mat_paper: 'paper', mat_leaves: 'leaves', mat_books: 'books', mat_popcorn: 'popcorn',
    g_glowstick: 'Glowstick', g_soap: 'Soap strip', g_plane: 'Paper plane', g_bookmark: 'Bookmark', g_sprout: 'Sprout', g_snack: 'Snack',
    gd_glowstick: 'Thrown ahead: keeps a room lit for a minute. A lit vent stops its front.', gd_soap: 'Laid in the doorway you face: the Tide passes 3× slower.',
    gd_plane: 'Flies ahead and maps five rooms.', gd_bookmark: 'Placed here; use it again elsewhere to come straight back.', gd_sprout: 'Planted in a lit room: it never floods again.', gd_snack: '30 s of double combo.',
    gadgetBuy: '{n} {mat}', owned: '×{n}', selected: 'selected', select: 'Select', gadgetUsed: '{name}', gadgetNone: 'No {name} left — the lift sells them for materials',
    gadgetHud: '  ·  {name} ×{n}', materials: 'Materials', bookmarkBack: 'Back to the bookmark', sproutNeedsLight: 'Sprouts need a lit room',
    signLetGo: 'Let go', signTrue: 'It glows — a ray on the map', signTest: 'Hold the tool on the sign…', anchorTake: 'E: take the {name}', anchorTakeTouch: 'USE: take the {name}',
    an_clock: 'Clock', an_notebook: 'Notebook', an_coin: 'Coin', an_phone: 'Phone', an_mirror: 'Mirror', an_window: 'Window',
    anchorFound: 'Anchor: {name} — “{habit}”', hb_clock: 'Wait', hb_notebook: 'Check', hb_coin: 'Coincidences happen', hb_phone: 'Ask someone', hb_mirror: 'Not everything is about me', hb_window: 'Look wider', randomTideLine: 'Random Tides come while the floor is loud.',
  },
};

STRINGS.ru = RU;
export const LANGS = ['en', 'ru'];
// Default from the browser, fallback English.
export function detectLang(list = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || []) {
  for (const l of list) { const c = String(l || '').slice(0, 2).toLowerCase(); if (STRINGS[c]) return c; }
  return 'en';
}
let lang = 'en';
export function setLang(l) { lang = STRINGS[l] ? l : 'en'; }
export function getLang() { return lang; }
export function t(key, vars) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 1000) return a < 10 && a % 1 ? n.toFixed(1) : Math.floor(n).toString();
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  let u = -1, v = n;
  while (Math.abs(v) >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return (Math.abs(v) < 100 ? v.toFixed(1) : Math.floor(v).toString()) + units[u];
}
