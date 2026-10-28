# Performance pass (Omega climax, the heaviest scene)

Measured under software WebGL (SwiftShader), so render time is not representative; the budgets are on draw calls, triangles and game logic time (each frame's tick without the render call).

| preset | settle after teleport (s) | draw calls | triangles | logic median (ms) | logic p95 (ms) | particles | loose coins (sky) |
|---|---|---|---|---|---|---|---|
| low | 25.8 | 299 | 408k | 2.20 | 3.40 | 107 | 62 (28) |
| ultra | 88.8 | 426 | 453k | 2.50 | 3.50 | 160 | 56 (28) |

8/8 checks passed.

- PASS low: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":28})
- PASS low: draw calls within budget (340) (299)
- PASS low: triangles within budget (1.2M) (408k)
- PASS low: game logic within budget (8 ms median) (median 2.20 ms, p95 3.40 ms over 13 frames)
- PASS ultra: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":28})
- PASS ultra: draw calls within budget (490) (426)
- PASS ultra: triangles within budget (2.5M) (453k)
- PASS ultra: game logic within budget (8 ms median) (median 2.50 ms, p95 3.50 ms over 5 frames)

## Console errors

None.
