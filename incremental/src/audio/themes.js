// Music themes (data). Each planet adds a theme; the Audio tree unlocks variations.
// root: MIDI note of the tonic. mode: scale intervals. prog: chord roots as scale degrees (0-based).
export const THEMES = [
  {
    id: 'frostara', name: 'Crystal Survey', planet: 'frostara',
    desc: 'Frostara. Bright glass and slow light over a lydian drone.',
    root: 62, mode: [0, 2, 4, 6, 7, 9, 11], prog: [0, 1, 5, 3, 0, 4, 1, 3],
    bpm: [58, 96], bright: 1.0, glass: 1.0, mallet: 1.0, brass: 0.8, bowed: 0.9, perc: 0.8,
  },
  {
    id: 'mistral', name: 'Veiled Breath', planet: 'mistral',
    desc: 'Mistral. Breathy, half-heard, behind fog: a dorian drone with soft bowed swells.',
    root: 57, mode: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 4, 0, 5, 3, 4],
    bpm: [52, 84], bright: 0.6, glass: 0.7, mallet: 0.6, brass: 0.5, bowed: 1.2, perc: 0.5,
  },
  { id: 'cinderice', name: 'Iron Under Ice', planet: 'cinderice', desc: 'Cinderice. Dark metal and heat.', locked: true },
  { id: 'tidalis', name: 'Undertow', planet: 'tidalis', desc: 'Tidalis. Flowing arpeggios.', locked: true },
  { id: 'gale', name: 'Pressure Front', planet: 'gale', desc: 'Gale. Driving percussion and wind.', locked: true },
  { id: 'auralis', name: 'Sky Choir', planet: 'auralis', desc: 'Auralis. Shimmering choir pads.', locked: true },
  { id: 'omega', name: 'All Rivers', planet: 'omega', desc: 'Omega. Every theme at once.', locked: true },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

// Variations (Audio tree): applied on top of any theme.
export const VARIATIONS = [
  { id: 'base', name: 'As written', node: null, desc: 'The theme as it is.' },
  { id: 'night', name: 'Night variation', node: 'aud_night', desc: 'Slower and darker, for long digs.', mod: { bpm: 0.8, bright: 0.6, glass: 0.8 } },
  { id: 'glass', name: 'Glass variation', node: 'aud_glass', desc: 'Quicker, brighter, more bells.', mod: { bpm: 1.15, bright: 1.4, glass: 1.5 } },
  { id: 'choir', name: 'Wind choir', node: 'aud_choir', desc: 'An ambient layer of slow bowed voices.', mod: { bowed: 1.8, bright: 0.9 } },
];
export const VARIATION_BY_ID = Object.fromEntries(VARIATIONS.map((v) => [v.id, v]));
