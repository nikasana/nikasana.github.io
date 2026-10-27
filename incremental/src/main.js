// Entry point: desktop guard, then boot the game.
const guard = document.getElementById('guard');

function desktopOk() {
  const fine = matchMedia('(pointer: fine)').matches;
  const coarseOnly = matchMedia('(pointer: coarse)').matches && !fine;
  const small = Math.min(screen.width, screen.height) < 600 || Math.max(screen.width, screen.height) < 1024;
  return !coarseOnly && !small;
}

if (!desktopOk() && !new URLSearchParams(location.search).has('force')) {
  guard.hidden = false;
  document.getElementById('view').remove();
} else {
  import('./game.js').then((m) => m.boot()).catch((err) => {
    console.error(err);
    guard.hidden = false;
    guard.querySelector('p').textContent = `Melt the Planet could not start: ${err.message}. It needs a desktop browser with WebGL2.`;
  });
}
