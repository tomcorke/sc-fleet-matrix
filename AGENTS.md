# sc-fleet-matrix

## Generated data

- `pnpm build-data` writes every JSON file in `src/data/`. Change the scraper in `src/server/data-generation.ts` and regenerate; hand edits are overwritten on the next run.
- The viewer bundles `src/data/processed-data.json` at build time. The other JSON files are intermediate output.
- The scraper fetches RSI store pages one at a time and caches them in `cache/fetch-cache/`, which Git ignores. Keep it sequential so RSI isn't flooded with requests.

## Shared schema

`src/data/schema.ts` belongs to both TypeScript projects: Vite bundles it into the viewer, and Node 22 runs it directly in the scraper. Keep it to erasable TypeScript syntax and import it with an explicit `.ts` extension from `src/server`.

## Linting

Oxlint runs every code lint rule, loading SonarJS and `@stylistic` as JS plugins. ESLint isn't used because typescript-eslint supports TypeScript only below 6.1, and the project uses TypeScript 7. `oxlint-plugin.js` holds a local rule that Oxlint has no built-in equivalent for: CSS modules are imported as `STYLES`.

## Styles

Colours and font families come from custom properties in `src/client/styles/tokens.scss`, the only file Stylelint allows to contain raw values. Global stylesheets are imported once, from `src/client/main.tsx`; components import only their own `.module.scss`.
