# sc-fleet-matrix

## Knowledge base

- Before looking up Star Citizen information, pricing, insurance, upgrades, marketplace offers or research processes, read `E:/working/star-citizen-knowledge-base/AGENTS.md` and search that repository first. Use `qmd --index star-citizen-knowledge-base search "specific terms" -c knowledge -n 5`, then read the full matching notes and their sources. Follow its `docs/search.md` for archive searches, index maintenance or direct Markdown fallback.
- Before completing a task that discovers new research, information or reusable research processes, persist them in the knowledge base's relevant topics or process documentation. Update sources, actual check dates, uncertainty and dependent calculations together; keep unverified reports attributed rather than treating them as facts. Follow that repository's branch, validation, merge and QMD-refresh workflow.
- Keep maintained Star Citizen knowledge in that repository, not sandbox research notes or this application's generated data. Ad hoc downloads and scratch artifacts may remain in `E:/working/agent-sandbox/research/<topic>/`; application code and project-specific implementation instructions remain here. Never persist account data, cookies or tokens in the knowledge base.

## Generated data

- `pnpm build-data` fetches each source into `src/data/sources/` exactly as received, then `src/server/normalise.ts` merges them into `src/data/processed-data.json`. Pass `--offline` to the generator to renormalise stored sources without fetching. Hand edits to generated JSON are overwritten.
- Every source becomes stats: a definition (label, kind, source) plus per-ship values keyed by stat ID, with a missing key meaning no data. The viewer offers every stat as a selectable column and shows coverage from the missing keys, so normalise source quirks (RSI's zero-for-unknown, casing, nested counts) in the normaliser rather than the viewer.
- The ship-feature source is copied from the newest `evidence/snapshots/*/ship-features.json` in the knowledge base. Game data from `api.star-citizen.wiki` (stock loadouts) joins ships only through that snapshot's reviewed `api_source.uuid` matches, because several game vehicles share a matrix ID.
- Source data from RSI's APIs: ship stats from the ship-matrix JSON, prices from the store GraphQL (`src/server/store-prices.ts`). Both work without signing in. Probe new GraphQL fields with real requests; introspection is disabled, but validation errors name the invalid input fields.

## Hangar and live store

The user's owned ships and live store offers load at runtime, never through the generator or `src/data/`. Hangar requests need the user's RSI sign-in. The page sends a named request kind to the unpacked Chrome extension in `extension/`; its fixed allowlist contains `hangar`, `store-offers`, `upgrade-data` and `credit`. The content script forwards only the kind, never a page-provided URL or request body. The app only plans: melts, purchases and upgrade applications are never sent to RSI. The background worker fetches `/account/pledges` with the browser's RSI cookies and relays the HTML to the localhost page over `window.postMessage`; `src/client/hangar/hangar.ts` parses it. RSI repeats the last page for out-of-range page numbers, so the page count comes from the pager links.

`store-offers` pages through standalone ship SKUs (product 72) with a fixed sort, returning GraphQL JSON and a fetch time. `src/client/store/store-offers.ts` parses ship IDs, USD cents from `nativePrice`, warbond status, insurance and availability. Live offers stay separate from build-time MSRP.

`upgrade-data` establishes the upgrade token context (`setAuthToken`, then `setContextToken`) before fetching a fixed `filterShips` query. `src/client/store/upgrade-data.ts` parses valid source IDs and USD MSRPs, plus current target SKUs. SKU prices are target prices, not upgrade differences; standard upgrades use target MSRP, warbonds use SKU price, and both subtract source MSRP. Upgrade insurance comes from the trade-in pledge, not the standalone offer.

`credit` reads the store credit balance from the cart totals (`store.cart.totals.credits.amount`, USD cents) with `account.isAnonymous` to detect a signed-out browser.

## RSI account safety

Treat the RSI account as read-only: the app must never melt, upgrade, buy, gift or otherwise change it. The extension may issue GET page requests and read-only GraphQL queries only (RSI GraphQL queries use HTTP POST); never send mutations or other write requests. The planner only describes possible steps and never executes them.

## Shared schema

`src/data/schema.ts` belongs to both TypeScript projects: Vite bundles it into the viewer, and Node 22 runs it directly in the generator. Keep it to erasable TypeScript syntax and import it with an explicit `.ts` extension from `src/server`.

## Linting

Oxlint runs every code lint rule, loading SonarJS and `@stylistic` as JS plugins. ESLint isn't used because typescript-eslint supports TypeScript only below 6.1, and the project uses TypeScript 7. `oxlint-plugin.js` holds a local rule that Oxlint has no built-in equivalent for: CSS modules are imported as `STYLES`.

## Styles

Colours and font families come from custom properties in `src/client/styles/tokens.scss`, the only file Stylelint allows to contain raw values. Global stylesheets are imported once, from `src/client/main.tsx`; components import only their own `.module.scss`.

## Extension detection

The content script stamps its manifest version on `<html data-sc-fleet-hangar>` at `document_start`. `src/client/extension.ts` compares it with the version Vite reads from `extension/manifest.json`; on a mismatch the viewer hides the hangar, store offers and planner. Bump the manifest version with every extension change so stale installs drop to the matrix-only view.

## Publishing

`publish` is the GitHub Pages branch, holding the built site at its root and served at `https://sc-fleet-matrix.corke.dev/`. `public/CNAME` sets the domain; `public/.nojekyll` disables Jekyll. The header shows the short SHA of the built `main` commit.

For each release, in one shell so recorded values stay fixed:

1. From a clean, up-to-date `main` (`git pull --ff-only origin main`; `git status --porcelain` empty), record `main_commit=$(git rev-parse HEAD)` and `main_short=$(git rev-parse --short HEAD)`.
2. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build`. Confirm `main` still points to `main_commit` and the worktree is clean.
3. Fetch `origin/publish` and check it out in a temporary worktree under `E:\working\worktrees`. Replace its contents with `dist/` (use `git clean -fdx` only there), keeping `CNAME` and `.nojekyll` at the root.
4. Commit with subject `Publish main@<main_short>` and body `Source-main-commit: <main_commit>`, then push to `origin/publish`.
5. Remove the temporary worktree after the push succeeds, and confirm the site serves the new SHA. If the push fails, keep the worktree while investigating.
