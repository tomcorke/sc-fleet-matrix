import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(
  readFileSync('extension/manifest.json', 'utf8'),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(
      // Build-time only; git comes from the developer's own PATH.
      // oxlint-disable-next-line sonarjs/no-os-command-from-path
      execSync('git rev-parse --short HEAD').toString().trim(),
    ),
    __EXTENSION_VERSION__: JSON.stringify(version),
  },
});
