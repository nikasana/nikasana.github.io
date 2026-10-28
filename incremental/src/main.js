// Entry point: boot the game (desktop with mouse and keyboard, or a phone or tablet with touch controls).
const guard = document.getElementById('guard');

import('./game.js').then((m) => m.boot()).catch((err) => {
  console.error(err);
  guard.hidden = false;
  guard.querySelector('p').textContent = `Melt the Planet could not start: ${err.message}. It needs a browser with WebGL2.`;
});
