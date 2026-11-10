# River Puzzle: art breakdown

Every object in the game, where it comes from, and the prompt to make it.

- **Look:** cartoon 3D, like the green level-select reference: chunky rounded shapes, bright colours, soft shading, dark outlines.
- **Camera:** isometric (board seen from a corner, no perspective). Models are seen from two sides, so the back matters less but must exist.
- **Engine:** three.js. The game draws the dark outlines and cartoon shading itself, so **models must not have black outlines painted on** (they would look smudgy).
- **Scale and position don't matter:** the game fits each model to its tile automatically. Just keep each model upright and centred.

## The whole list

| # | Object | Where it appears | Made by | File name |
|---|---|---|---|---|
| 1 | Hero (kid explorer) | Walks the path | **Tripo + rig + animations** | `hero.glb` |
| 2 | Cottage | Goal on every level; village on the level map | **Tripo** | `cottage.glb` |
| 3 | Boulder | Rock tiles that block the way | **Tripo** | `rock-a.glb` |
| 4 | Boulder cluster | Variety for rock tiles | **Tripo** | `rock-b.glb` |
| 5 | Stepping stone | Piece, covers 1 water tile | **Tripo** | `stone.glb` |
| 6 | Plank bridge | Piece, covers 2 water tiles | **Tripo** | `plank.glb` |
| 7 | Log | Piece, covers 3 water tiles | **Tripo** | `log.glb` |
| 8 | Round tree | Decoration round the board and map | **Tripo** | `tree-a.glb` |
| 9 | Tall round tree | Decoration, variety | **Tripo** | `tree-b.glb` |
| 10 | Bush | Decoration | **Tripo** | `bush.glb` |
| 11 | Rounded hill | Background around the board and map | **Tripo** | `hill.glb` |
| 12 | Level pedestal | Level map, one per level | **Tripo** | `pedestal.glb` |
| 13 | Padlock | Sits on locked pedestals, pops off when unlocked | **Tripo** | `padlock.glb` |
| 14 | Grass tiles | Every land square | Code | — |
| 15 | Water | River squares, animated ripples and sparkle | Code | — |
| 16 | River bank | Brown earth edge where grass meets water | Code | — |
| 17 | Start marker | Small stone disc under the hero at the start | Code | — |
| 18 | Flowers, grass tufts, pebbles | Scattered on grass (dozens of copies) | Code | — |
| 19 | Lily pads | On some water squares (not on puzzle tiles) | Code | — |
| 20 | Map path | Light green path linking pedestals | Code | — |
| 21 | Splash, ripples, dust puffs, sparkles | Effects | Code | — |
| 22 | Panel, buttons, piece tray, stars, popups | Screen overlay (2D) | Code | — |
| 23 | Sounds | Splash, thunk, steps, win jingle | Free CC0 packs | — |

**Why some are code:** grass and water repeat dozens of times and must join seamlessly; water has to move; small scattered things are cheaper as code. Everything else is from Tripo.

Until your models arrive, the game uses simple code-made stand-ins with the same file names, so each model drops straight in when ready.

## Budgets (8 GB laptop, integrated graphics)

| Object | Max triangles | Texture |
|---|---|---|
| Hero | 5,000 | 1024 |
| Cottage, hill | 3,000 | 1024 |
| Trees, bush | 2,000 | 512 |
| Rocks, stone, plank, log, pedestal, padlock | 1,000 | 512 |

Use Tripo's low-poly / face-limit option to hit these. Export everything as **.glb**. Put the files in `river-puzzle/models/`. The game picks each one up automatically.

## How to make each one

1. In Gemini, paste the object's prompt **plus the style block** below.
2. Check the image: one object, white background, no outlines, nothing cut off. Regenerate if not.
3. In Tripo: image to 3D, low-poly, texture on. Export .glb with the file name from the table.
4. Hero only: also rig and animate (see the hero section).

Keep all the Gemini work in **one chat**. It keeps the style more consistent from object to object.

### Style block (add to the end of every prompt)

> Style: stylised cartoon 3D game asset for a cosy puzzle game. Chunky, rounded, slightly exaggerated shapes. Bright saturated colours in large simple areas with soft gentle shading. No black outlines, no fine texture detail, no text, no logo. One single object, centred, seen in 3/4 view from slightly above. Plain pure white background, soft even studio lighting, no cast shadow, no ground.

Palette to keep everything matching: leaf green with yellow-green highlights, teal-green hills, warm honey-brown wood, soft grey stone, cream walls, red-brown roof.

### 1. Hero: `hero.glb`

> Full-body character design for a 3D model: a cute chibi kid explorer. Big head (about one third of total height), small rounded body, short stubby arms and legs. Wide straw hat, red short-sleeve shirt, blue shorts, brown boots, small brown backpack. Big friendly eyes, rosy cheeks, small smile. Standing in a T-pose, arms straight out to the sides, legs slightly apart, full front view facing the camera. Plain white background, even soft lighting, no shadows, no ground, no text, no black outlines. One character only.

Then in the same chat: *"Same character, same T-pose, seen from directly behind."* Give Tripo both views.

In Tripo: generate, then **auto-rig (humanoid)**, then add these animations. Name them exactly like this (or export one file each as `hero-idle.glb`, `hero-walk.glb` and so on):

| Animation | Used when | Notes |
|---|---|---|
| `idle` | Waiting at the start | Gentle breathing or looking around, loops |
| `walk` | Walking along the path | Loops; a bouncy, happy walk suits the style |
| `hop` | Stepping onto a stone or plank | One short jump |
| `fall` | Splashing into the river | Arms flailing, losing balance |
| `cheer` | Reaching the cottage | Jump with arms up |

If Tripo has no hop or cheer, any jump works for both. If it has no fall, the game fakes one by tipping the hero over.

### 2. Cottage: `cottage.glb`

> A small cosy fairytale cottage: cream plaster walls, a rounded arched wooden door with iron studs, a curved red-brown wooden shingle roof with curly ends at the eaves, one small round window, sitting on a low grey stone base. Compact, nearly square footprint.

### 3. Boulder: `rock-a.glb`

> A single chunky grey boulder, rounded and slightly lumpy with a few soft flat facets, lighter grey on top, a small patch of green moss on top. About as wide as it is tall.

### 4. Boulder cluster: `rock-b.glb`

> A cluster of three rounded grey boulders of different sizes pressed together, one large and two small, soft facets, lighter grey tops, a little green moss. Wider than tall, nearly square footprint.

### 5. Stepping stone: `stone.glb`

> A flat round river stepping stone, smooth pale grey, with a wide flat top you could stand on. About four times as wide as it is tall. A slightly darker wet band around the bottom edge.

### 6. Plank bridge: `plank.glb`

> A short wooden footbridge section: four wooden planks laid side by side across two thin support beams underneath. Warm honey-brown wood with a few simple grain lines and rounded corners, flat walkable top. Exactly twice as long as it is wide, lying flat.

### 7. Log: `log.glb`

> A single fallen tree log lying flat on its side, about three times as long as it is wide. Brown bark with a few chunky ridges, light tan cut ends showing tree rings, a small patch of moss on top. The top is fairly flat so you could walk along it.

### 8. Round tree: `tree-a.glb`

> A round bushy cartoon tree: short thick brown trunk with a few chunky roots, one big round fluffy canopy made of puffy leaf clumps, bright green with lighter yellow-green highlights on the top clumps.

### 9. Tall round tree: `tree-b.glb`

> A tall cartoon tree: slim brown trunk, a canopy of two stacked round puffy leaf clusters (bigger at the bottom, smaller on top), bright green with yellow-green highlights.

### 10. Bush: `bush.glb`

> A round fluffy bush made of puffy leaf clumps, wider than tall, no trunk visible, bright green with lighter yellow-green highlights on top.

### 11. Rounded hill: `hill.glb`

> A tall rounded hill shaped like a soft cone with a rounded top, smooth surface. Deep teal-green at the bottom fading to warm olive-gold near the top, a few shallow round dimples, a small white shine spot at the peak.

### 12. Level pedestal: `pedestal.glb`

> A round stone pedestal for a level select map: a short wide cylinder in two tiers, dark grey stone sides, a lighter grey flat top ring, softly rounded worn edges. Much wider than tall.

### 13. Padlock: `padlock.glb`

> A chunky cartoon padlock: rounded rectangular grey metal body with a black keyhole on the front, a thick curved grey shackle on top. Simple bold shapes.

## Later (not needed for version 1)

Reeds, fence posts, a signpost, mushrooms, a small dock, more tree types for the Forest area.
