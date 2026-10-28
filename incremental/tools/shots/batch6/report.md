# Batch 6 checks

20/20 checks passed.

- PASS Auralis loads with its Sky Choir theme and a standing aurora ({"planet":"auralis","theme":"auralis","choir":1,"ambient":0.22,"mutants":"lumice,prismice","capsules":3,"needle":true})
- PASS Auralis has its own mutant ice, three capsules and a Golden Needle ({"planet":"auralis","theme":"auralis","choir":1,"ambient":0.22,"mutants":"lumice,prismice","capsules":3,"needle":true})
- PASS Catching sky coins in a row builds the Aurora Chain ({"n":4,"gains":[300,359,419,479]})
- PASS Each catch in the chain is worth more than the last (300 < 359 < 419 < 479)
- PASS A sky coin that fades uncaught breaks the chain ({"before":4,"after":0})
- PASS Lone sky coins (relic tier) fall between auroras on Auralis
- PASS The Aurora Chain milestone pays out ({"chain":true,"n":1})
- PASS Notebook lists this planet's milestones (general plus Auralis) (13 cards)
- PASS Auralis mutant ice is discovered (Lumice calls a sky coin) ({"type":"prismice","found":true,"sky":0})
- PASS DNA tree completed: every mutant type has DNA and the Apex Form capstone unlocks ({"types":12,"apex":1,"walk0":1.1,"walk1":1.2000000000000002})
- PASS Tide-sealed capsules open after the tide turns ({"found":true,"open":true})
- PASS Aurora ribbons ring the Auralis globe
- PASS Auralis save code exported for the fixtures (4278 chars)
- PASS Three crewmates in one crew (joined true true)
- PASS Crew Roles: three roles share a mixed-crew bonus, and your role boosts its tree ({"mix":1.08,"role":"melter","mult":0})
- PASS A crewmate's sky catch counts toward the crew milestone
- PASS Crew screen lists the full crew milestone set (11 rows)
- PASS Host migration: a member takes over the crew on their own (hosts 1)
- PASS The other member rejoins the new host
- PASS The crater keeps syncing after migration

## Console errors

None.
