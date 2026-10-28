# Performance pass (Omega climax, the heaviest scene)

Measured under software WebGL (SwiftShader), so render time is not representative; the budgets are on draw calls, triangles and game logic time (each frame's tick without the render call).

| preset | draw calls | triangles | logic median (ms) | logic p95 (ms) | particles | loose coins (sky) |
|---|---|---|---|---|---|---|
| low | 206 | 414k | 12.00 | 27.20 | 157 | 70 (26) |
| ultra | 309 | 501k | 12.50 | 25.50 | 187 | 71 (26) |

6/8 checks passed.

- PASS low: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":26})
- PASS low: draw calls within budget (260) (206)
- PASS low: triangles within budget (1.2M) (414k)
- FAIL low: game logic within budget (8 ms median) (median 12.00 ms, p95 27.20 ms over 10 frames)
- PASS ultra: the heaviest scene is set up (climax, aurora, sky coins) ({"climax":true,"aurora":true,"sky":26})
- PASS ultra: draw calls within budget (420) (309)
- PASS ultra: triangles within budget (2.5M) (501k)
- FAIL ultra: game logic within budget (8 ms median) (median 12.50 ms, p95 25.50 ms over 7 frames)

## Console errors

None.
