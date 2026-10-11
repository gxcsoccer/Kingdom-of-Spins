# Kingdom of Spins — build contract (hackathon, due 2026-10-11 19:00)

Shared rules for everyone working in this repo in parallel. Read before editing.

## Stack
- Frontend: Vite + React 19 (JSX, no TS) + Three.js via @react-three/fiber / drei / postprocessing, zustand for state.
- Physics: MuJoCo 3.15 WASM in a Web Worker (`src/physics/*`). Idealized model, **not calibrated** — UI must say "模型结果" where results are shown; never claim real-world prediction.
- Hosting: **Cloudflare Workers** (static assets from `dist/` + `worker/index.js` for `/api/*`), Workers AI binding `AI` with model `@cf/openai/gpt-oss-120b` (free plan, ~2 s/call), Durable Objects for PvP rooms.
- Auth + data: **Supabase** (Google OAuth for parents; parent creates kid profiles; saves in Postgres with RLS). Supabase JS client in the browser with anon key. Game must remain fully playable offline/guest (localStorage) when Supabase or Google config is missing.
- Dev: `pnpm dev` (vite, proxies `/api` → `127.0.0.1:8787`) + `npx wrangler dev` (worker). Use `--registry=https://registry.npmjs.org` for pnpm installs (the default mirror is flaky).

## File ownership (avoid editing others' files; coordinate through the interfaces below)
| Area | Owner | Files |
|---|---|---|
| Physics, battle runner, game state, story flow, app shell/screens | main agent | `src/physics/*`, `src/game/*`, `src/App.jsx`, `src/main.jsx`, `src/ui/*` |
| 3D art: bey models, stadium, battle scene, effects, showcase | art agent | `src/scene/*`, `public/art/*` (placeholders) |
| Backend: worker routing, Supabase auth/profiles/saves, DO PvP rooms | backend agent | `worker/*` (except `worker/ai.js`), `wrangler.jsonc`, `supabase/*`, `src/net/*` |
| AI fusion + knowledge + fusion workshop UI | AI agent | `worker/ai.js`, `src/ai/*`, `src/fusion/*`, `src/knowledge/*` |
| Shared look & feel | main agent (others may append clearly-scoped classes) | `src/styles/theme.css` |

## Art direction: Japanese manga (少年漫画) style
- Bold black ink outlines, cel/toon shading (2–3 tone steps), screentone/halftone dots for shadows, speed lines, impact frames.
- Palette: paper white `#fbf8f1`, ink `#111`, plus each bey's primary/accent colour as spot colour; hero accent red `#ff2d4a`, electric yellow `#ffd400`.
- Typography: heavy condensed display for titles (system fallback stack OK: "Arial Black", "PingFang SC" heavy), manga SFX in katakana/Chinese onomatopoeia on impacts (ドン！ ガキン！ 轰！ 锵！).
- UI panels look like manga panels: thick black borders, slight skew, drop shadow offset `6px 6px 0 #111`.
- 3D: MeshToonMaterial with a 3-step gradient map + drei `<Outlines>` (black), bloom only on sparks/energy, halftone-ish post if cheap. Spin blur = translucent ring/streak, not motion-blur pass.
- Art assets the user may later provide go under `public/art/` (see list in README). Always ship a procedural/CSS fallback so nothing breaks if a file is missing.

## Bey object (game level)
```js
{ id, name, zh, type: 'attack'|'defense'|'stamina'|'balance',
  colors: {primary, secondary, accent},
  blade: { wings: 2|3|4, reach: .022-.030 (m), ring: 20-85 (% blade mass on outer ring), mass: 24-40 (g), style: same enum as type },
  ratchet: { height: 55|60|70, prongs: 3-5 },   // fixed through fusion
  bit: 'needle'|'ball'|'flat'|'rush',            // fixed through fusion
  lore, parents?: [idA, idB], fusedBy?: 'ai'|'template', knowledge?: [...] }
```
Catalog: `src/game/beys.js`. Physics conversion: `specFromBey(bey)` / `makePart(spec)` / `wingOutline(spec, i)` in `src/physics/model.js` (use `wingOutline` for visual blade silhouettes so visuals match collision hulls).

## Battle playback interface (main agent → art agent)
Physics runs in a worker and streams 60 Hz samples. The scene receives a `player` object:
```js
player.getTime()        // current playback time (s), already handles pause/slow-mo
player.getState(t)      // {time, bodies:[{p:[x,y,z], q:[w,x,y,z], rpm, tilt}, ...]} interpolated, physics coords
player.events           // array, grows: {time,type:'collision',point,intensity 0..1,relSpeed} | {time,type:'dash',body} | {time,type:'finish',winner,reason:'xtreme'|'over'|'spin'|'judge',points}
player.beys             // [beyA, beyB]
```
Physics coordinates: meters, **Z up**, quaternion `[w,x,y,z]`. Render inside `<group rotation-x={-Math.PI/2} scale={10}>` and use physics coords directly. Top local frame: spin axis +Z, blade plane z≈0 (thickness ±3.5 mm), tip at z = −spec.tipDepth (~19 mm). Right-spin (counter-clockwise from above).
Arena: `ARENA` + `floorHeight(x,y)` + `pocketAt(angle)` in model.js — flat centre r<70 mm, slope rising 20 mm to r=185 mm, rim ledge, wall at r≈189 mm (height z 10–60 mm), 3 wall gaps: segments 0–1 = Xtreme pocket, 11–12 and 21–22 = over pockets (32 segments).

## AI API (AI agent implements in `worker/ai.js`, backend agent mounts under `/api/ai/*`)
- `POST /api/ai/fusion/chat` `{parents:[beyA,beyB], wish: string, history?: [...]}` → `{reply, question?, candidates?: [Bey...]}` — clarifying question first if the wish is vague; candidates (2–3) validated server-side (only blade fields change; ratchet+bit inherited from a chosen parent; clamped ranges), each with `why`, `tradeoff`, `knowledge: [{title, body, layer:'official'|'physics'|'design'}]`.
- `POST /api/ai/commentary` `{summary}` (from `Battle.summary()`) → `{headline, story:[...], science:{title, body}, tryNext}` — must cite real events (times/rpm) from the summary; say "在这个模型里".
- Always return a deterministic template fallback on model failure/timeout (8 s).
