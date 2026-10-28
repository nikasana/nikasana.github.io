// Reverse Mode, "Make It Snow": you freeze worlds instead of melting them. The Freeze tree mirrors the
// Melt tree node for node: same ids, costs, effects and synergies (so the economy and the wait curve are
// the same, only kinder), with its own names, icons and descriptions. The melt tool family becomes the
// freeze tool, and everything that melted ice now grows it.

export const FREEZE_TREE = { name: 'Freeze', icon: '❄️', color: '#9fe6ff' };
export const FREEZE_TIERS = ['Frost wand', 'Cryo lance', 'Orbital frost beam'];
export const REVERSE = { goal: 0.3, scale: 0.5 };   // goal depth fraction and cost scale: kept short and easy

export const FREEZE_SKIN = {
  melt_torch: { name: 'Frost Wand', icon: '❄️', desc: 'Tool tier 1: freeze the air over an area into new ice. Each cubic metre you freeze pays like a cubic metre melted.' },
  melt_flame: { name: 'Colder Breath', icon: '🌬️', desc: 'More frost per second.' },
  melt_fan: { name: 'Snow Fan', icon: '🪭', desc: 'A wider spray of frost.' },
  melt_linger: { name: 'Slow Thaw', icon: '⏳', desc: 'New ice stays loose longer, so your pick cuts it easily.' },
  melt_fuel: { name: 'Brine Mix', icon: '🧪', desc: 'A colder mix in the wand.' },
  melt_drain: { name: 'Snow Drift', icon: '🌨️', desc: 'Drifting snow carries coins to you.' },
  melt_focus: { name: 'Needle Frost', icon: '🎯', desc: 'Commit to a needle of frost: far colder, much narrower, and the ice it makes shatters under the pick. Locks Wide Flurry.' },
  melt_bloom: { name: 'Wide Flurry', icon: '🌸', desc: 'Commit to a broad, gentle cold: a much wider spray that keeps new ice soft for longer. Locks Needle Frost.' },
  melt_lance: { name: 'Cryo Lance', icon: '🧊', desc: 'Tool tier 2: a jet of liquid cold.' },
  melt_pressure: { name: 'Cryo Valve', icon: '🎛️', desc: 'Colder jet at higher pressure.' },
  melt_steam: { name: 'Hoarfrost Bloom', icon: '☁️', desc: 'The frost spreads wider.' },
  melt_boil: { name: 'Deep Freeze', icon: '🫧', desc: 'The cold sinks into the ice around it.' },
  melt_refreeze: { name: 'Clean Freeze', icon: '🧂', desc: 'Freezing is more efficient and the new ice is clearer.' },
  melt_sear: { name: 'Rime Tip', icon: '🔆', desc: 'Rime-coated coins are worth more.' },
  melt_jet: { name: 'Twin Cryo Jets', icon: '🚀', desc: 'Two jets of cold.' },
  melt_heat: { name: 'Latent Cold', icon: '🌨️', desc: 'Cold lingers in the ice.' },
  melt_glow: { name: 'Frost Edge', icon: '🌟', desc: 'Frosted edges reveal value.' },
  melt_plasma: { name: 'Cold Sheath', icon: '🔵', desc: 'A wide, blue-white sheath of frost.' },
  melt_laser: { name: 'Orbital Frost Beam', icon: '🛰️', desc: 'Tool tier 3: a satellite answers your designator with a column of falling snow that freezes a wide shaft of new ice.' },
  melt_master: { name: 'Cryo Mastery', icon: '❄️', desc: 'Capstone. Complete command of cold: much stronger freezing, and frost pours into every gap.' },
  hy_seep: { name: 'Crack Rime', icon: '🫠', desc: 'Dig + Freeze. Frost fills fresh pick cracks: freezing next to them is much faster.' },
  hy_forge: { name: 'Cryo Forge', icon: '🔥', desc: 'Dig + Freeze. Coins struck from fresh ice come out polished; shock craters grow.' },
  hy_kiln: { name: 'Frost Stakes', icon: '🧱', desc: 'Freeze + Automation. Cold lingers in the stakes, and stake craters freeze back for your pick.' },
};

// a node as the player sees it (Freeze skin in Reverse Mode)
export function skinNode(n, reverse) {
  const s = reverse && FREEZE_SKIN[n.id];
  return s ? { ...n, ...s } : n;
}
