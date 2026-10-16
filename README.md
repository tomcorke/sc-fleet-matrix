# Star Citizen Fleet Matrix

Compares every ship in Star Citizen in a single table: size, role, speeds and store price.

There are two parts:

- **Data scraper** (`src/server`). Downloads the ship list from the RSI ship-matrix API, reads each ship's store page for its USD price, and writes the results to `src/data/`.
- **Viewer** (`src/client`). A React app that shows the scraped data, sorted by ship size.

## Prerequisites

- Node.js 22.18 or later. Run `nvm use` to switch to the version in `.nvmrc`.
- pnpm 10. Run `corepack enable` to get the version pinned in `package.json`.

## Setup

```sh
pnpm install
pnpm dev
```

`pnpm install` also sets up the pre-commit hook. The hook formats and lints the files you've staged.

## Commands

| Command             | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `pnpm dev`          | Starts the viewer at http://localhost:5173                     |
| `pnpm build`        | Type-checks and builds the viewer into `dist/`                 |
| `pnpm preview`      | Serves the built viewer                                        |
| `pnpm build-data`   | Runs the scraper, and runs it again when `src/server` changes  |
| `pnpm lint`         | Lints TypeScript with Oxlint and SCSS with Stylelint           |
| `pnpm typecheck`    | Type-checks the client and scraper with their separate configs |
| `pnpm test`         | Runs the scraper's unit tests                                  |
| `pnpm format`       | Formats all files with Prettier                                |
| `pnpm format:check` | Checks formatting without changing anything                    |

## Refreshing the data

`pnpm build-data` regenerates the files in `src/data/`. It fetches store pages one at a time and keeps a copy of each in `cache/fetch-cache/`, so later runs only download pages it hasn't seen. To pick up a price change, delete that ship's file from the cache.

## Known limitations

- Ships that the store doesn't sell on their own, such as the F7A Hornet Mk II, have no price.
- The viewer includes all of the ship data in its bundle, so the built JavaScript is about 4.7MB.
