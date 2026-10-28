# Performance pass (Omega climax, the heaviest scene)

Measured under software WebGL (SwiftShader), so render time is not representative; the budgets are on draw calls, triangles and game logic time (each frame's tick without the render call).

| preset | settle after teleport (s) | draw calls | triangles | logic median (ms) | logic p95 (ms) | particles | loose coins (sky) |
|---|---|---|---|---|---|---|---|
| low | 120.1 | 298 | 370k | 1.80 | 5.10 | 132 | 52 (37) |
| ultra | 120.2 | 424 | 432k | 2.20 | 3.40 | 156 | 51 (29) |

6/8 checks passed.

- PASS low: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":37})
- FAIL low: draw calls within budget (260) (298)
- PASS low: triangles within budget (1.2M) (370k)
- PASS low: game logic within budget (8 ms median) (median 1.80 ms, p95 5.10 ms over 15 frames)
- PASS ultra: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":29})
- FAIL ultra: draw calls within budget (420) (424)
- PASS ultra: triangles within budget (2.5M) (432k)
- PASS ultra: game logic within budget (8 ms median) (median 2.20 ms, p95 3.40 ms over 5 frames)

## Console errors

None.
