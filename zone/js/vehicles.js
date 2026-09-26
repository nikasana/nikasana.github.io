'use strict';
// ----- vehicles: stand next to one and a circle fills to hop on; dash jumps off -----
const VEH_HOLD = 0.8;
function vehAuto(dt) {
  if (!G || G.state !== 'play' || World.kind !== 'over') return;
  if (P.veh) { P.vehHold = 0; return; }
  const v = nearVehicle();
  if (G.t < 2 && v) P.vehSkip = v; // don't grab the bike parked at the spawn point right away
  if (P.vehSkip && (!v || v !== P.vehSkip)) P.vehSkip = null; // walked away from the bike you just left
  if (v && v !== P.vehSkip && P.dashT <= 0) { P.vehHold = (P.vehHold || 0) + dt; P.vehNear = v; if (P.vehHold >= VEH_HOLD) { P.vehHold = 0; toggleVehicle(); } }
  else { P.vehHold = 0; P.vehNear = null; }
}
const _s6HzUp = Hz.update.bind(Hz);
Hz.update = function (dt) { _s6HzUp(dt); vehAuto(dt); };
const _s6Tog = toggleVehicle;
toggleVehicle = function () { const was = P.veh; _s6Tog(); if (!was && P.veh) P.vehT = G.t; if (was && !P.veh) { P.vehSkip = was; P.vehHold = 0; } };
const _s6Dash = tryDash;
tryDash = function () {
  if (G && G.state === 'play' && P.veh) { const v = P.veh; toggleVehicle(); P.vehSkip = v; P.dashCd = 0; _s6Dash(); return; }
  _s6Dash();
};
function drawVehPrompt() {
  if (World.kind !== 'over' || G.state !== 'play') return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const v = !P.veh && P.vehNear && P.vehHold > 0 ? P.vehNear : null;
  if (v) {
    const k = P.vehHold / VEH_HOLD, x = v.x, y = v.y - 16;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffe070'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(VEH[v.kind].icon, x, y - 44);
  } else if (P.veh && G.t - (P.vehT || 0) < 3.5) {
    const s = touch ? 'Dash to jump off' : '[Space] jump off';
    ctx.font = 'bold 13px Oswald, sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(s).width + 18, x = P.x, y = P.y - 80;
    ctx.fillStyle = 'rgba(20,18,12,0.7)'; ctx.fillRect(x - w / 2, y - 15, w, 22);
    ctx.strokeStyle = 'rgba(255,224,112,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - 15, w, 22);
    ctx.fillStyle = '#ffe070'; ctx.fillText(s, x, y + 1);
  }
}
