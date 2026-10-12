# English localization and touch-screen E2E

Branch: `feat/i18n`. Tested locally on 2026-10-12 with Ego Lite.

## Language behavior

- Supported locales are `zh-CN` and `en`. Japanese is not a supported locale.
- The original `/art/logo.png`, Japanese decorative lettering, and other existing artwork stay the same in both languages. Functional UI, accessible labels, explanations, and speech are localized; decorative lettering is not a Japanese locale.
- The language menu appears on the title, map, and standard navigation bars. The choice is stored in `kos.locale`; first visits use the browser language, with Chinese as the fallback.
- Switching language reloads the page so static knowledge cards, chapters, and game catalogs use the same language. It preserves profiles, collection IDs, progress, and player-written names.
- `src/i18n/en.json` maps Chinese source strings to English. Use `tr('message with {0}', [value])` for UI text. Translate complete sentences rather than joining translated fragments. Keep IDs, schema keys, and physics verdict enums unchanged.
- AI, exploration, storybook, speech recognition, and TTS requests carry the selected locale. Server fallback generation is request-scoped, including concurrent Chinese and English requests. English length limits preserve words and spaces.

## English speech

English character lines use their prerecorded English clips first. Other English narration tries `/api/tts`, then falls back to an English `speechSynthesis` voice. Voice caches include both locale and character identity; English never reuses a Chinese clip.

The existing Fish Audio integration needs `FISH_API_KEY`. `wrangler.jsonc` now sets `FISH_EN_VOICE_ID=99ae169b7b464781aaf876f483295582`, the public [Wise Companion Voice](https://fish.audio/m/99ae169b7b464781aaf876f483295582/) (English, older male, warm/calm narration). This is a public voice ID, not a credential. The local `.dev.vars` has the same selection. The Chinese doctor voice remains separate; unavailable server speech still falls back to the device's English voice.

A follow-up live check on 2026-10-12 confirmed the voice metadata is `trained`, `public`, and `en`. Calling the actual `worker/tts.js` handler with the existing Fish API key and a short English science explanation returned HTTP 200, `audio/mpeg`, and 53,706 bytes of MP3. The sample is at `/tmp/kos-i18n/voices/english-doctor.mp3`. The voice configuration has not been deployed.

## Results

| Check | Result |
| --- | --- |
| `pnpm test` | 96 passed, 0 failed |
| `pnpm build` | Passed |
| `pnpm exec wrangler deploy --dry-run` | Passed; no deployment |
| `git diff --check` | Passed |
| Layout sweep | 7 screens × 3 viewports; all 21 without document horizontal overflow |
| Storybook overlay | All 3 viewports: no inner horizontal overflow, images visible, navigation reachable |

Viewports: iPad portrait **820 × 1180**, iPad landscape **1180 × 820**, phone **390 × 844**, with touch emulation. The seven screens were map, collection, shop, codex, exploration, versus, and fusion. Screenshots were visually reviewed in addition to DOM size checks.

Actual Ego interactions completed:

1. Select English, choose the starter top, and enter the adventure map.
2. Fuse Dragoon and Fish using the English wish “Black and red metal dragon claws, lightning patterns, strong attack. Name it Rocket”. Inspect three English candidates, choose one, make a prediction, and save Rocket into the collection.
3. Enter a CPU match, make the launch prediction, drag the launcher, and complete three physics-driven rounds. The result was a 1–2 loss; review and navigation remained accessible.
4. Open the battle lab, change the bit to Needle, predict the outcome, and run all six A/B simulations. The result and guided explanation appeared in English.
5. Enable narration through the actual UI. Instrumentation observed `SpeechSynthesisUtterance.lang === 'en-US'` and an `en-US` voice while forwarding to the real browser `speak` method.
6. Navigate exploration using an English compass sign and reach the Harbor market.
7. Switch English → Chinese → English through the menu. The serialized E2E save remained byte-for-byte identical.
8. Open the rotational inertia storybook, make a guess, read its pages, run the interactive experiment, answer the quiz, and earn the Inertia Master badge. Check the book at all three sizes.

Issues found and fixed during these runs included unreachable fusion save buttons, English compass key mismatches, overflowing iPad route signs, overlapping phone launch controls, a crowded map language menu, overflowing codex pagination, and a phone storybook grid wider than its viewport.

This first browser run used **Chromium touch emulation**, not physical iPad/iPhone Safari. AI routes used the real local handlers with deterministic offline fallbacks. Google sign-in, multiplayer networking, and microphone permission flows were not exercised. Automated tests additionally cover English model-response postprocessing and the Fish English voice request contract.

## Follow-up walkthrough with live services

A second Ego Lite walkthrough used Vite on `4195` and the real Wrangler worker on `8795`, including the configured AI providers and Fish Audio:

- Created and saved **Sky Comet** from an English wish. Fusion and science Q&A returned HTTP 200 with `via: "claude"`.
- Found and fixed English questions without a question mark being routed to fusion. Repeating “Why does outer rim weight help stamina” now called `/api/ai/ask`, answered in English, and preserved the existing designs.
- Confirmed English `/api/tts` requests returned HTTP 200 and generated audio actually reached the browser's `playing` event. The instrumentation forwarded the original fetch/play calls; audio was not mocked.
- Launched Sky Comet with the drag control, completed two physics-driven rounds against Mist Fish, and reached the 0–2 result. Checked iPad portrait result/review, answered a review question, opened the landscape lab and next-step page, and returned to the map with 8 tops and 360 coins.
- The review AI provider failed once (`Unified billing service unavailable`, then fallback-provider timeout). The game continued with its English template review and working narration. This run therefore verifies live fusion/Q&A and the review fallback, not a successful live model-generated review.
- On a 390 × 844 phone viewport, completed the inertia storybook, interactive experiment, quiz, and badge flow.
- Verified the restored original logo and decorative lettering on iPad and phone, with no document horizontal overflow. All art assets remain unchanged.
- Fixed a model-output cleanup issue that turned “See ph-inertia!” into “See !”; English prose now uses the card title. Also corrected missing spaces in English review time phrases and the lab instruction. Regression tests cover the observed prose failures.

Artifacts are in `/tmp/kos-live-walkthrough/`: `network.json`, `ipad-original-logo.png`, `phone-title-original-art.png`, `ipad-english-question-fixed.png`, `ipad-launch.png`, `ipad-result.png`, `ipad-review.png`, `ipad-lab.png`, `phone-book.png`, and `phone-book-badge.png`. The instrumented game page recorded no window errors or unhandled promise rejections. These remain Chromium touch-emulation checks; physical iPad Safari is not covered.

## Reproduce locally

### Saved exploration regression

A user-reported mixed-language Harbor Bay screen exposed a gap in the initial sweep: scene snapshots, narration, completed quests, and pending quizzes were being rendered directly from an older Chinese save. `localizeExploreState` now projects authored saved text into the selected language at render time, including narration sent to TTS. It does not migrate or overwrite progress, route history, hiding plans, IDs, quiz answer order, or the save itself. Saved English prose can also be displayed in Chinese.

Ego Lite reproduced the exact **High tide** scene using a Chinese fixture. Its title, four hotspot labels, route sign, doctor text, and completed quests all displayed English. English → Chinese → English left the serialized save byte-for-byte identical. The Read aloud button sent English text with `locale: en`; a resumed Chinese tides quiz displayed English, awarded +10 for the correct answer, and returned to exploration. Subsequent hotspot inspection and walking to Low-tide path also stayed English.

Long hotspot labels now stay inside phone widths, the scene title sits above the route signs, and minimap labels wrap and fit within the SVG with connecting lines to their nodes. iPad portrait/landscape and a 390 px phone were checked. Five regression tests cover old saves across both regions, language reversal, nested messages, pending quizzes, and minimap label bounds/overlap. Art assets remain unchanged. Screenshots and logs are in `/tmp/kos-explore-locale/`.

### Battle-mode preview

The battle-mode CPU entry also received a visual correction: both hero tops now use `BeyShowcase` with the same camera, lighting, scale, and model-axis spin. The old hover rule rotated the entire PNG/DOM presentation; that rule is removed. Ego Lite checked desktop hover, iPad, phone, and opening CPU setup. Both hero slots contain 3D showcases and no PNGs, with no CSS rotation on their containers and no document horizontal overflow. Screenshots/build log: `/tmp/kos-versus-3d/`.

### Start the local app

Start these in separate terminals:

```sh
node scripts/e2e-offline-server.mjs
KOS_API=127.0.0.1:8795 pnpm dev --port 4195
```

For live services, replace the first command with `pnpm exec wrangler dev --port 8795 --persist-to .wrangler/state-i18n` and use the existing local provider configuration. Do not start the offline and live workers on the same port. The normal app is at `http://127.0.0.1:4195/`.

Open `http://127.0.0.1:4195/src/testing/sandbox.html?screen=map`. The development-only fixture uses its own `kos-e2e-save` slot and does not write to an account or cloud save. Add `&reset` to reset that fixture; use `?starter&reset` to test starter selection. Normal navigation retains the fixture entry URL.

For the repeatable layout sweep, create one Ego TaskSpace, retain its numeric ID, and prepend `globalThis.E2E_SPACE_ID = <id>;` to `scripts/e2e-layout.mjs` before passing the combined JavaScript to `ego-browser nodejs`. It reuses `p1` by default; set `globalThis.E2E_PAGE = 'p2'` if testing in an already-created second page. The script selects English through the UI when necessary and writes screenshots, snapshots, and `layout.json` to `/tmp/kos-i18n/e2e` (override with `globalThis.E2E_ARTIFACTS`). It deliberately leaves TaskSpace completion to the caller so functional tests can continue in the same space. Finish that space once after all testing.

```sh
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
```

The 13 localization tests in `scripts/i18n.test.mjs` cover catalog placeholders and UI coverage, locale persistence, name/ID preservation, English question routing, English wishes and fallback content, readable science prose, word limits, simultaneous locales, AI postprocessing, browser voice selection, and the English TTS reference.

### English character voices

Character taunts previously used the doctor's English reference; short effects could use a different device voice. Character IDs now travel through launch taunts, teammate calls, `/api/tts`, and both cache keys. Ten casting/delivery profiles use four public English references, with distinct pacing and expression. The doctor keeps `FISH_EN_VOICE_ID`. The 10 taunts and 3 teammate calls are shipped as 128 kbps clips, generated with `node scripts/gen-voice-en.mjs` (or append a character ID). Optional `FISH_EN_<CHARACTER_ID>_VOICE_ID` overrides apply to live synthesis and to subsequent clip generation. The original Chinese clips and artwork are unchanged.

The character page now has a Read aloud button. Replaying stops the previous clip; closing the page stops playback. A missing clip falls back to live synthesis with the same character ID. An autoplay denial does not waste a synthesis request. Mobile character pages scroll to fit their speech and action panels, so English buttons are not cropped.

Ego Lite TaskSpace 148 exercised all 10 real battle-intro clips through their `ended` event, without substituting device speech or making live requests. It also checked replay/exit cancellation, simulated autoplay denial, and the original Chinese boss clip. The live English boss endpoint returned HTTP 200/audio MPEG. iPad portrait, landscape, and phone character pages were checked. Artifacts: `/tmp/kos-character-voices/` (`e2e.json`, screenshots, audio measurements, local transcription reports, and test/build logs). ASR is a pronunciation/completeness cross-check, not a subjective listening review; invented names and the “Gale Launch” call were ambiguous in local Whisper transcription. Physical iPad Safari and human listening are not covered.

The live preview worker uses `pnpm exec wrangler dev --port 8795 --persist-to .wrangler/state-i18n` to keep its local SQLite state separate from another development worker. No deployment was performed.


### PR validation and remaining coverage

The final PR validation reran all **96 Node tests**, production build, Worker dry-run, whitespace checks, and the **21-case Ego Lite layout sweep** against this branch. Artifacts: `/tmp/kos-pr-validation/`. The Node suite includes unit and handler/integration tests; no line or branch coverage percentage has been measured.

The layout sweep is a repeatable checked-in script. It waits for finite entrance animations, images, and typed exploration prose before capturing screenshots, and checks that both versus previews are mounted. The functional walkthroughs described above were agent-operated browser sessions with recorded evidence; they are not yet a single automated E2E suite or a CI gate. This repository currently has no GitHub Actions workflow running them.

Remaining validation: physical iPad/iPhone Safari, real Google sign-in and account/profile switching end-to-end, two-device multiplayer, microphone permission/recognition flows, and human voice-performance review. Live review generation hit a provider failure during the walkthrough, so that run only establishes the English fallback behavior. These limitations should remain visible in the PR rather than describing the test coverage as exhaustive.
