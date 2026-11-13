// Every user-facing string lives here.
export const STRINGS = {
  en: {
    title: 'Lift',
    tagline: 'A quiet game about clearing and lighting an endless house. A game about an experience, not a treatment.',
    start: 'Begin', continue: 'Continue',
    hintDesktop: 'WASD walk · mouse look · hold left button: clear and polish · E: switch / lift panel · Shift: slide · M: map · H: back to the lift',
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
  },
};

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
