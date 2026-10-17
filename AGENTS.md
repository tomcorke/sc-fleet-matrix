# sc-fleet-matrix

## Generated data

- `pnpm build-data` writes every JSON file in `src/data/`. Change the generator in `src/server/data-generation.ts` and regenerate; hand edits are overwritten on the next run.
- The viewer bundles `src/data/processed-data.json` at build time. The other JSON files are intermediate output.
- Source data from RSI's APIs: ship stats from the ship-matrix JSON, prices from the store GraphQL (`src/server/store-prices.ts`). Both work without signing in. Probe new GraphQL fields with real requests; introspection is disabled, but validation errors name the invalid input fields.

## Hangar and live store

The user's owned ships and live store offers load at runtime, never through the generator or `src/data/`. Hangar requests need the user's RSI sign-in. The page sends a named request kind to the unpacked Chrome extension in `extension/`; its fixed allowlist contains `hangar` and `store-offers`. The content script forwards only the kind, never a page-provided URL or request body. The background worker fetches `/account/pledges` with the browser's RSI cookies and relays the HTML to the localhost page over `window.postMessage`; `src/client/hangar/hangar.ts` parses it. RSI repeats the last page for out-of-range page numbers, so the page count comes from the pager links.

`store-offers` pages through standalone ship SKUs (product 72) with a fixed sort, returning GraphQL JSON and a fetch time. `src/client/store/store-offers.ts` parses ship IDs, USD cents from `nativePrice`, warbond status, insurance and availability. Live offers stay separate from build-time MSRP.

## Shared schema

`src/data/schema.ts` belongs to both TypeScript projects: Vite bundles it into the viewer, and Node 22 runs it directly in the generator. Keep it to erasable TypeScript syntax and import it with an explicit `.ts` extension from `src/server`.

## Linting

Oxlint runs every code lint rule, loading SonarJS and `@stylistic` as JS plugins. ESLint isn't used because typescript-eslint supports TypeScript only below 6.1, and the project uses TypeScript 7. `oxlint-plugin.js` holds a local rule that Oxlint has no built-in equivalent for: CSS modules are imported as `STYLES`.

## Styles

Colours and font families come from custom properties in `src/client/styles/tokens.scss`, the only file Stylelint allows to contain raw values. Global stylesheets are imported once, from `src/client/main.tsx`; components import only their own `.module.scss`.
