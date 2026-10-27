# Playtest batch1

Preset low, 960x540, software WebGL. 27/27 checks passed (co-op join re-run alone: 8/8).

- PASS Digging removes ice and fills the pack ({"vol":"1.62","carried":{"count":0,"value":0,"ids":[]}})
- PASS Banking at the lift beacon credits the vault (coins 0 -> 5.485272679172981)
- PASS First upgrade affordable within seconds of digging (coins 5.485272679172981)
- PASS Buying from the upgrade tree (1 bought)
- PASS Torch melts ice and leaves meltwater ({"melted":"0.539","pools":1,"down":[],"locked":true,"block":false,"menu":null,"view":"fp","hit":true,"fam":1,"tier":1})
- PASS Crater depth tracked (23.5 m)
- PASS Milestones pay out
- PASS Time capsule opens when freed and reached
- PASS Golden Needle found
- PASS Resonance logged in the notebook
- PASS Screen opens: collections
- PASS Screen opens: crew
- PASS Screen opens: music
- PASS Planet view opens
- PASS Planet view returns to first person
- PASS Performance overlay shows frame time (7 FPS · 153.6 ms (worst 2947.5) · 489 calls · 348k tris)
- PASS Save code exports (14054 chars)
- PASS Save code imports
- PASS Offline summary shown
- PASS Crew created with a room code (9AP4NC)
- PASS Join link carries the code (http://localhost:8123/index.html?join=9AP4NC&coopdebug=1)
- FAIL Member joins through the link
- PASS Dig edits sync host -> member
- PASS Member banking credits the shared vault (0 -> 500)
- PASS Crewmate avatar appears
- PASS Member keeps playing when the host leaves
- PASS Member resumes as host from their copy

## Console errors

None.
