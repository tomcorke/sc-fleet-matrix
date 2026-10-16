# sc-fleet-matrix

## Generated data

- `pnpm build-data` writes every JSON file in `src/data/`. Change the scraper in `src/server/data-generation.ts` and regenerate; hand edits are overwritten on the next run.
- The viewer bundles `src/data/processed-data.json` at build time. The other JSON files are intermediate output.
- The scraper fetches RSI store pages one at a time and caches them in `cache/fetch-cache/`, which Git ignores. Keep it sequential so RSI isn't flooded with requests.

## Shared schema

`src/data/schema.ts` belongs to both TypeScript projects: Vite bundles it into the viewer, and Node 22 runs it directly in the scraper. Keep it to erasable TypeScript syntax and import it with an explicit `.ts` extension from `src/server`.

## Linting

The lint rules are copied from [aion2](https://github.com/tomcorke/aion2); keep the two in step. aion2 lints with ESLint and typescript-eslint, but typescript-eslint supports TypeScript only below 6.1, so this project runs those rules in Oxlint instead. `oxlint-plugin.js` holds the one aion2 rule Oxlint can't express (CSS modules imported as `STYLES`).

## Styles

Colours and font families come from custom properties in `src/client/styles/tokens.scss`, the only file Stylelint allows to contain raw values. Global stylesheets are imported once, from `src/client/main.tsx`; components import only their own `.module.scss`.
