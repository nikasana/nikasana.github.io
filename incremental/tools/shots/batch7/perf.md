# Performance pass (Omega climax, the heaviest scene)

Measured under software WebGL (SwiftShader), so render time is not representative; the budgets are on draw calls, triangles and game logic time (each frame's tick without the render call).

| preset | settle after teleport (s) | draw calls | triangles | logic median (ms) | logic p95 (ms) | particles | loose coins (sky) |
|---|---|---|---|---|---|---|---|
| low | 4.0 | 281 | 261k | 2.30 | 9.50 | 101 | 33 (26) |
| ultra | 6.5 | 386 | 275k | 7.10 | 14.70 | 89 | 33 (26) |

8/8 checks passed.

- PASS low: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":26})
- PASS low: draw calls within budget (340) (281)
- PASS low: triangles within budget (1.2M) (261k)
- PASS low: game logic within budget (8 ms median) (median 2.30 ms, p95 9.50 ms over 16 frames)
- PASS ultra: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":26})
- PASS ultra: draw calls within budget (490) (386)
- PASS ultra: triangles within budget (2.5M) (275k)
- PASS ultra: game logic within budget (8 ms median) (median 7.10 ms, p95 14.70 ms over 9 frames)

## Console errors

None.
