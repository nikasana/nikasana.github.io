# Feedback round checks (ground, hut terminal, giant coins, no gantry)

8/8 checks passed.

- PASS No overhead gantry, trolley or cable: the lift flies on its own ({"bridge":false,"trolley":false,"cable":false,"relief":0.18038834464350573})
- PASS The camp stands on flat ground (no ridge can hide the buildings) (relief 0.18 m over the camp)
- PASS Upgrades are only at the hut: outside it they are refused ({"outside":false,"inside":true,"aimed":true,"prompt":"Upgrade terminal · click to open the upgrade tree"})
- PASS Walk into the hut and aim at the terminal: it is targeted with a prompt ({"outside":false,"inside":true,"aimed":true,"prompt":"Upgrade terminal · click to open the upgrade tree"})
- PASS Clicking the terminal opens the upgrade tree (and does not swing the pick) ({"menu":"upgrades","dug":0})
- PASS Coins are fewer (about a third of one per m³ of ice tried, six times fewer than before) ({"density":0.04154497663551402,"found":true,"afterSmall":false,"afterBig":true,"loose":true})
- PASS A giant coin stays in the ice until it is dug out all round ({"density":0.04154497663551402,"found":true,"afterSmall":false,"afterBig":true,"loose":true})
- PASS A giant coin takes six pack slots ({"ok":true,"added":6})

## Console errors

None.
