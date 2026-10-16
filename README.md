# Star Citizen Fleet Matrix

Compares every ship in Star Citizen in a single table: size, role, speeds and store price.

There are two parts:

- **Data generator** (`src/server`). Downloads ship stats from the RSI ship-matrix API and each ship's USD MSRP from the RSI store GraphQL API, and writes the results to `src/data/`.
- **Viewer** (`src/client`). A React app that shows the generated data in a table you can sort and filter by any column.

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

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Starts the viewer at http://localhost:5173                       |
| `pnpm build`        | Type-checks and builds the viewer into `dist/`                   |
| `pnpm preview`      | Serves the built viewer                                          |
| `pnpm build-data`   | Runs the generator, and runs it again when `src/server` changes  |
| `pnpm lint`         | Lints TypeScript with Oxlint and SCSS with Stylelint             |
| `pnpm typecheck`    | Type-checks the client and generator with their separate configs |
| `pnpm test`         | Runs the generator's unit tests                                  |
| `pnpm format`       | Formats all files with Prettier                                  |
| `pnpm format:check` | Checks formatting without changing anything                      |

## Refreshing the data

`pnpm build-data` regenerates the files in `src/data/` from RSI's ship-matrix API and store GraphQL API. Neither needs an RSI account, and a full run makes about ten requests.

## Known limitations

- Ships that the store doesn't sell on their own, such as the F7A Hornet Mk II, have no price.
- The viewer includes all of the ship data in its bundle, so the built JavaScript is about 4.7MB.
