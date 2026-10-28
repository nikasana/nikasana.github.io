# Performance pass (Omega climax, the heaviest scene)

Measured under software WebGL (SwiftShader), so render time is not representative; the budgets are on draw calls, triangles and game logic time (each frame's tick without the render call).

| preset | settle after teleport (s) | draw calls | triangles | logic median (ms) | logic p95 (ms) | particles | loose coins (sky) |
|---|---|---|---|---|---|---|---|
| low | 6.8 | 281 | 257k | 2.60 | 7.40 | 87 | 34 (27) |
| ultra | 7.5 | 371 | 281k | 8.30 | 11.60 | 130 | 33 (26) |

7/8 checks passed.

- PASS low: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":27})
- PASS low: draw calls within budget (340) (281)
- PASS low: triangles within budget (1.2M) (257k)
- PASS low: game logic within budget (8 ms median) (median 2.60 ms, p95 7.40 ms over 13 frames)
- PASS ultra: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":26})
- PASS ultra: draw calls within budget (490) (371)
- PASS ultra: triangles within budget (2.5M) (281k)
- FAIL ultra: game logic within budget (8 ms median) (median 8.30 ms, p95 11.60 ms over 7 frames)

## Console errors

None.
