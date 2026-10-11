# Kingdom of Spins — Art Prompts v2

**Why v2:** the v1 map is a monochrome Chinese ink-wash landscape with an empty centre, while the characters are full-colour Japanese anime, so the two styles clash. The map also shows nothing related to spinning tops. v2 settles on one style (**full-colour Japanese shonen anime game art**) and fixes the map layout with exact coordinates, so the code can place hotspots on the right landmarks.

Keep from v1: the 10 blader portraits, the 3 doctor portraits, 4 avatars, logo, beys and emblems. They already match the v2 style. Redo: the **world map** (P0), the **3 location backgrounds** (P1), and add the **map landmark icons** (P1).

---

## 0. Style bible (prepend to EVERY prompt)

```
STYLE: Japanese shonen anime game key art, like a modern spinning-top battle anime / monster-collecting RPG overworld.
Full colour cel shading (2–3 tone steps), bold clean black ink outlines (thicker on silhouettes, thinner inside),
small printed screentone dots ONLY inside shadows, crisp highlights, bright sunny daytime, saturated but harmonious palette.
Palette anchors: ink #111111, paper #FBF8F1, hero red #FF2D4A, lightning yellow #FFD400, sky cyan #29B6FF, grass green #3DD68C.
Lighting from top-left. Clean, readable shapes for kids aged 8–12. Energetic, adventurous, friendly.
NOT Chinese ink-wash painting, NOT monochrome/greyscale, NOT watercolor, NOT photorealistic, NOT 3D render, NOT pixel art.
No text, no letters, no numbers, no logos, no watermark, no UI, no frames or borders.
All designs original; no resemblance to any existing franchise characters, logos or toys.
```

---

## 1. P0 · World map — `bg/map.jpg`, 2560×1440 (16:9), JPG

The map is the main screen, so every landmark must be at its coordinate. **(x%, y%) is measured from the top-left corner.** The code places a round character medallion about 7% wide at each blader coordinate, so keep the ground around those points readable: no busy detail under them, and no key building directly behind them.

```
[STYLE BIBLE]
SUBJECT: A bird's-eye 3/4 top-down illustrated fantasy world map of "the Kingdom of Spins" — an island kingdom where
everything is themed around battle spinning tops. Sunny ocean around a large main island plus small islets. Roads glow
faintly gold and wind through the regions in a progression path (bottom-left → left mountains → right peaks → top-right castle).
Every region is visually distinct and themed around tops: stadium bowls carved into hills, top-shaped rooftops, spiral
towers, gear-and-ratchet bridges, launcher-shaped monuments.

LANDMARKS AT EXACT POSITIONS (percent of width, height from top-left):
- CENTRE (50%, 45%): the Grand Stadium — a huge colosseum with a giant bowl-shaped battle arena seen from above, a bright
  yellow-and-black hazard ring inside the bowl, three gaps in the outer wall, banners, crowds as tiny dots. The visual heart
  of the map; it fills the middle (no empty space).
- STARTER VILLAGE, bottom-left (8–30%, 68–92%): cozy red-roofed houses, a small grassy practice stadium, a harbour with boats.
  Leave clear ground spots at (11%, 74%), (19%, 86%), (27%, 77%) for three medallions.
- PRO MOUNTAINS, left/upper-left (6–36%, 14–56%): three themed pro arenas on cliffs —
  * Thunder Tower at (12%, 28%): blue spiral tower with lightning rods, electric blue accents.
  * Ice Crystal Arena at (31%, 20%): frozen lake stadium with cyan crystals.
  * Iron Fortress at (13%, 51%): grey metal fortress with giant gears and rivets, orange warning lights.
- SUPER-PRO PEAKS, right (64–94%, 16–70%): three dramatic arenas on high peaks —
  * Shadow Ninja Temple at (89%, 63%): purple bamboo forest with a hidden pagoda, purple mist.
  * Volcano Arena at (85%, 40%): stadium inside a volcano rim with red-orange lava glow.
  * Star Observatory at (72%, 18%): futuristic pink-and-white observatory dome with holographic rings.
- DRAGON CASTLE, top-right (84–98%, 4–28%), castle centre at (91%, 15%): a menacing red-black castle on a crag shaped like a
  coiled dragon, red dragon statues, storm clouds and lightning around it only (the rest of the map stays sunny).
- SERVICE PLACES on the central-south coast (keep these as small, clear building icons on the ground):
  * Fusion Lab at (47%, 74%): white dome lab with a glowing yellow lightning furnace and antenna.
  * Blind-Box Shop at (36%, 70%): colourful market stall with a giant mystery capsule box on the roof.
  * Battle Dojo at (58%, 70%): Japanese dojo building with a small arena in its courtyard.
  * Library at (53%, 87%): round scroll-roofed library on a small islet.
  * Home Base at (66%, 85%): treehouse base with a backpack-shaped tent.
- Faint dotted gold path connecting, in order: village → Iron Fortress → Thunder Tower → Ice Crystal Arena → (across the
  Grand Stadium bridge) → Star Observatory → Volcano Arena → Shadow Temple → Dragon Castle.
COMPOSITION: whole island visible edge to edge, ocean margins about 3%, no labels, no text, no compass rose with letters.
```

> Tip: if your tool supports it, generate at 2560×1440 directly. Otherwise generate at 16:9 and upscale. After it comes back, check that the landmarks land on the coordinates above. If any are off by more than 3%, tell me the new coordinates and I'll update the code.

---

## 2. P1 · Map landmark icons — `places/<id>.png`, 512×512 transparent PNG

These are used as tappable "building" buttons on the map and as headers on the character and shop pages. **Isolated cutout, standing on a small round patch of ground, 3/4 view, transparent background.**

| File | Subject |
|---|---|
| `places/shop.png` | Blind-box shop stall with a giant mystery capsule box (red/yellow, a question-mark shape made of light, no letters) |
| `places/lab.png` | Fusion lab dome with a glowing yellow lightning furnace, antenna, tiny doctor silhouette in the doorway |
| `places/dojo.png` | Japanese battle dojo with a small bowl stadium in front, red banners (blank) |
| `places/library.png` | Round library with a scroll-shaped roof, glowing books floating |
| `places/home.png` | Treehouse base with a backpack-shaped tent and a launcher hanging on a hook |
| `places/arena-thunder.png` | Raiga's Thunder Tower arena (blue lightning) |
| `places/arena-ice.png` | Hyomi's Ice Crystal Arena (cyan crystals) |
| `places/arena-iron.png` | Iwaki's Iron Fortress (grey gears, orange lights) |
| `places/arena-shadow.png` | Shadow's Ninja Temple (purple bamboo, mist) |
| `places/arena-volcano.png` | Blaze's Volcano Arena (lava glow) |
| `places/arena-star.png` | Nova's Star Observatory (pink holo rings) |
| `places/castle.png` | Ryuoh's Dragon Castle (red-black, dragon statues, storm aura) |

Common prompt suffix:
```
[STYLE BIBLE] Isolated game map landmark icon, 3/4 top-down view, standing on a small round patch of ground,
centred, 8% transparent padding, genuine alpha transparency, readable at 96 px, no text.
```

---

## 3. P1 · Location backgrounds — `bg/arena.jpg`, `bg/lab.jpg`, `bg/shop.jpg`, 2560×1440 JPG

These sit behind UI panels. The v1 versions are monochrome with a pure-white centre. v2 should be in **colour**, with the centre about 25% brighter and less detailed so the UI stays readable, while keeping a real scene behind it, not a white hole.

- `bg/arena.jpg`: `[STYLE BIBLE] Inside the Grand Stadium at night: packed cheering crowd as stylised shapes, spotlights, giant screens (blank), the battle bowl lit in the middle distance, confetti, dramatic rim light. Centre area softly bright and low-detail.`
- `bg/lab.jpg`: `[STYLE BIBLE] Inside the Fusion Lab: workbenches with spinning-top parts, glowing yellow fusion furnace, holographic blueprint panels (no text), robot arms, tool walls, warm-white light. Centre area softly bright and low-detail.`
- `bg/shop.jpg`: `[STYLE BIBLE] Inside the blind-box shop: shelves of colourful mystery capsules and top parts, hanging lanterns, a glowing capsule machine, cheerful shopkeeper corner. Centre area softly bright and low-detail.`

---

## 4. Optional fixes to existing assets

- `beys/dragoon.png` and `beys/bossdragoon.png`: the in-game physics model has **3 blades**, but the art shows 4–5. If you redo them, prompt "exactly three blade wings, 120° apart".
- Character portraits: no change needed, they already match.

---

## Delivery

Use the same file names as v1 (plus the new `places/`), put them under `public/art/` (or in `art-delivery/<date>/public/art/`), and tell me when they're ready. I'll compress them, check the coordinates, and wire up the map landmark icons and colour backgrounds.
