# CI/CD setup and operations

Workflow: [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml). Runtime: Node 24 and the pnpm version pinned in `package.json`.

## Checks and deployment

1. Every pull request targeting `main` runs locked dependency installation, `pnpm test`, `pnpm build`, and a Wrangler dry-run. No production credentials are needed.
2. A push to `main` (including a merged PR) runs those checks again and uploads the verified `dist/` as a workflow artifact.
3. The deployment job downloads that exact artifact, checks out the same commit, and deploys the Worker and assets using the locked Wrangler dependency. `--keep-vars` preserves dashboard variables; existing Worker secrets stay in Cloudflare.
4. `pnpm check:deployment` checks `/api/health`, confirms the HTML points to this build's entry assets, and compares the deployed entry files, original logo, and English MP3 clips against the local artifact. It retries briefly for propagation. It does not call a paid AI/TTS provider or write a player save.

PR jobs never deploy. Manual `workflow_dispatch` runs deploy only when the selected branch is `main`. Superseded PR checks are cancelled. Main runs share one concurrency group and are not interrupted halfway through a deployment; pending superseded runs may be replaced by GitHub. The job timeout is 15 minutes, and build artifacts are retained for 7 days.

## GitHub configuration

Repository: `gxcsoccer/Kingdom-of-Spins`.

| Setting | Where | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Actions secret in the `production` environment | Dedicated deployment token for this Worker |
| `production` deployment branch policy | GitHub environment | Allow only branch `main`, without a manual approval gate |
| `VITE_SUPABASE_URL` | Optional repository Actions variable | Override the public frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Optional repository Actions variable | Override the public publishable/anon key |

The Cloudflare account ID and Worker name are in `wrangler.jsonc`. The frontend otherwise uses the public defaults in `src/net/config.js`. Never put a Supabase service-role key in a `VITE_*` variable: these values are embedded in browser JavaScript.

The dedicated Cloudflare account API token should have **Individual Workers → Editor** scoped to **kingdom-of-spins**. It does not need DNS or account administration access for the existing `workers.dev` deployment. If Cloudflare reports a missing permission for a newly added binding or route, add only that resource's required permission. See [Cloudflare CI authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) and [Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/).

`FISH_API_KEY` remains a Cloudflare Worker secret and is not copied into Actions. `FISH_EN_VOICE_ID` is a public voice identifier in `wrangler.jsonc`.

## Run and inspect

- Open the repository's **Actions → CI / CD** page to inspect check results, deployment logs, and the recorded commit.
- To republish, select **Run workflow → main**. The selected main commit is tested before deployment.
- To check the current local production build against the live site, run `pnpm check:deployment`. An optional URL argument targets another deployment: `pnpm check:deployment https://example.workers.dev`.

Failures in tests, build, or dry-run prevent deployment. A smoke-check failure marks the run failed but does not automatically roll back; inspect the failure before changing production.

## Rollback

For an urgent rollback, inspect `pnpm exec wrangler deployments list`, then use `pnpm exec wrangler rollback <known-good-version-id>`. This restores a previously deployed Worker version; it does not undo data written by the application. For a lasting code rollback, revert the offending commit on `main` through a PR so the next deployment also contains the fix. Avoid rerunning an older successful Actions run as a rollback shortcut, because that can deploy stale source code.

## Coverage

CI runs unit and handler/integration tests, build checks, and post-deployment HTTP/asset checks. The Ego Lite browser walkthroughs are not a headless GitHub Actions suite. Physical iPad/Safari, Google sign-in, multiplayer on two devices, microphone permissions, and human voice review remain separate validation; see [the E2E notes](i18n-e2e.md).
