# Performance pass (Omega climax, the heaviest scene)

Measured under software WebGL (SwiftShader), so render time is not representative; the budgets are on draw calls, triangles and game logic time (each frame's tick without the render call).

| preset | settle after teleport (s) | draw calls | triangles | logic median (ms) | logic p95 (ms) | particles | loose coins (sky) |
|---|---|---|---|---|---|---|---|
| low | 34.9 | 299 | 401k | 2.90 | 9.30 | 137 | 57 (28) |
| ultra | 107.3 | 414 | 445k | 5.20 | 6.60 | 175 | 54 (28) |

8/8 checks passed.

- PASS low: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":28})
- PASS low: draw calls within budget (340) (299)
- PASS low: triangles within budget (1.2M) (401k)
- PASS low: game logic within budget (8 ms median) (median 2.90 ms, p95 9.30 ms over 13 frames)
- PASS ultra: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":28})
- PASS ultra: draw calls within budget (490) (414)
- PASS ultra: triangles within budget (2.5M) (445k)
- PASS ultra: game logic within budget (8 ms median) (median 5.20 ms, p95 6.60 ms over 5 frames)

## Console errors

None.
