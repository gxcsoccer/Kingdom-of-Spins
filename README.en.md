<p align="center">
  <img src="public/art/logo.png" alt="Kingdom of Spins · 陀螺王国" width="560" />
</p>

<p align="center">
  <a href="README.md">中文</a> · <strong>English</strong> · <a href="https://kingdom-of-spins.deskmind-site.workers.dev">Play online</a>
</p>

# Kingdom of Spins

A Beyblade X-inspired spinning-top battle game with gameplay designed by a child, built for **Kids for AI Hackathon**.

- **Physics-driven battles:** MuJoCo rigid-body physics runs in a browser Web Worker using WebAssembly, a 4 kHz simulation, and RK4 integration.
- **Dr. Fusion:** describe a dream top, compare AI-generated designs, make a prediction, battle, and learn from the measured results.
- **Manga presentation:** halftones, comic panels, expressive lettering, and cel-shaded 3D tops.
- **Chinese and English:** localized interfaces, exploration, science storybooks, AI explanations, and speech, with layouts designed for iPad and phones. The original logo and decorative lettering stay intact.

> **Model limits:** the simulation uses simplified geometry and estimated friction and damping. It has not been calibrated against real tops. It can teach patterns and scientific reasoning, but cannot predict real tournament results. Explanations identify results as coming from an idealized model.

## How to play

From the child's original design:

> at the first of the game you can choose your starter beys and battle normal bladers and when you have 3 beys you can battle pro bladers and when you win against pro bladers you can let them be on your team … fish and dragoon is fishgoon … only the blade will change, the ratchet and the bit will not change.

| Mode | What you do |
| --- | --- |
| Adventure | Choose a starter, explore, battle opponents, earn coins, collect and fuse tops, recruit teammates, and challenge the Dragon King. |
| Battle | Practice against the CPU, test one variable at a time, or invite a friend with a room code. Multiplayer uses Cloudflare Durable Objects. |

The learning loop is **describe a goal → design → predict → battle → examine evidence → change one variable and try again**.

The game awards 3 points for an Xtreme Finish, 2 for an Over Finish, and 1 for a Spin Finish. The first player to 4 points wins; demo mode uses 2. Burst mechanics are not simulated.

## What the AI does

| Feature | Behavior |
| --- | --- |
| Fusion, `POST /api/ai/fusion/chat` | Clarifies vague wishes, then offers 2–3 designs with tradeoffs. Only the Blade changes; Ratchet and Bit stay with the selected parent. Parameters are validated and explanations cite knowledge cards. |
| Battle review, `POST /api/ai/commentary` | Explains measured battle events, links them to a science concept, and suggests a single-variable experiment. |
| Questions, `POST /api/ai/ask` | Answers questions about spinning tops using the knowledge library. |
| Drawing, `POST /api/ai/sketch` | Turns a drawing into a validated top design, using visible shape, colors, and blade features to inform its parameters and special move. |
| Science storybooks and exploration | Connect top designs, battle moments, and scene hotspots to interactive experiments, knowledge cards, and quizzes. |
| Knowledge library, `src/knowledge/cards.js` | Separates product facts, physics principles, and original game rules. |

The backend first tries Claude through Cloudflare AI Gateway. Text features can fall back to Workers AI and deterministic templates. Drawing recognition needs a working vision model and reports a retryable error if unavailable. Speech uses prerecorded character clips, Fish Audio, and browser speech, with caches separated by language and character.

## Architecture

```text
Browser
 ├─ React + Vite: manga interface
 ├─ Three.js / react-three-fiber: 3D tops and effects
 └─ Web Worker: MuJoCo physics and battle replay data
Cloudflare Worker: kingdom-of-spins
 ├─ Static assets and /api/ai/* endpoints
 ├─ /api/tts: narration and character speech
 └─ /ws/room/:code: BattleRoom Durable Object
Supabase
 └─ Parent Google sign-in, child profiles, and cloud saves protected by RLS
```

In multiplayer, both players confirm their top and launch settings. The server distributes the same simulation input, and each browser runs the deterministic battle locally. Results are checked by the server; disagreements are flagged and resolved using the host's result. Determinism is covered by `scripts/physics.test.mjs`.

## Local development

Use **Node 24**, matching CI. The pnpm version is pinned in the `packageManager` field of `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm worker:dev     # Worker: AI + multiplayer at 127.0.0.1:8787
pnpm dev            # Frontend at http://127.0.0.1:5173; proxies /api and /ws
pnpm test           # Unit and integration tests
pnpm build          # Production frontend build
pnpm deploy         # Build and deploy to Cloudflare
```

Keep local AI/TTS credentials in the ignored `.dev.vars` file. The frontend defaults to the project's public Supabase configuration. Override `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` for another environment; browser code must use a publishable/anon key.

Tests use Node's test runner and isolate saves, Durable Objects, WebSockets, timers, and provider responses. They need no sign-in or AI credentials. Live service scripts such as `scripts/room-smoke.mjs`, `scripts/room-sync.proto.mjs`, and `scripts/ai-test.mjs` run separately.

For simulation tuning, try `node scripts/balance.mjs dragoon charge 3` or `node scripts/run-battle.mjs dragoon fish`.

## CI/CD

The [GitHub Actions workflow](.github/workflows/ci-cd.yml) runs:

- **Pull requests to `main`:** locked dependency installation, unit/integration tests, a production build, and Worker bundling validation.
- **Merges into `main`:** the same checks, followed by deployment of that build to Cloudflare Workers and checks of the live health endpoint and static assets.
- **Manual deployment:** select `CI / CD` → `Run workflow` in Actions, using the `main` branch.

Only the deployment job receives production credentials; pull requests do not deploy. See [CI/CD setup and operations](docs/ci-cd.md) for credentials, concurrency, and rollback. Browser walkthroughs remain separate; see the [i18n and E2E validation notes](docs/i18n-e2e.md) for coverage and limitations.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/physics/` | Top and arena models, MuJoCo integration, battle rules |
| `src/game/` | Catalogs, story, saves, physics worker, voices |
| `src/scene/` | 3D models, arena, battle view, replays |
| `src/fusion/`, `src/ai/`, `src/knowledge/` | Fusion workshop, AI client, fallbacks, knowledge and quizzes |
| `src/explore/`, `src/flipbook/`, `src/lab/` | Exploration, interactive storybooks, controlled experiments |
| `src/i18n/` | Chinese/English localization and language selection |
| `src/ui/` | Screens and shared interface components |
| `worker/` | Cloudflare endpoints, TTS, multiplayer rooms |
| `supabase/` | Database migrations and Google sign-in configuration |

## Artwork

Place artwork in `public/art/` to replace the built-in placeholders. Asset names and conventions are documented in [CONTRACT.md](CONTRACT.md).

## Credits and licensing

- MuJoCo uses Apache-2.0; Three.js uses MIT. See [THIRD_PARTY.md](THIRD_PARTY.md).
- Beyblade is a Takara Tomy / Hasbro trademark. This is a noncommercial children's learning project with original or inspired characters and top names; it does not use official artwork.
- The physics prototype and research began with the Spin Lab handoff.
