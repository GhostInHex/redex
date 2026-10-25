# Redex

See how code evaluates, one step at a time. Redex is a browser-based playground for a small functional language, with step-by-step playback, prediction practice, 12 lesson examples, and shareable programs and embeds.

## Start locally

```sh
npm ci
npm run dev
```

Open the printed URL. The landing page is at `/` and the playground is at `/play`. Choose a lesson or run your own source. No backend or account setup is required.

## Build and check

```sh
npm test
npm run typecheck
npm run build
npm run preview -- --port 5177
```

With the preview server running, use `BASE_URL=http://localhost:5177 npm run test:frontend` for the Chromium frontend smoke test. Install its browser once with `npx playwright install chromium`.

[Frontend instructions](docs/FRONTEND.md) cover screenshots, static deployment, shared-link compatibility and Glaze attribution. The app is React and TypeScript on Vite. Parsing, evaluation and trace generation live in `src/lang`; the landing page and playground live in `src/ui`. Glaze components and semantic tokens are vendored from `arla6ka/design.how` under the upstream MIT license.

This frontend builds on the locally verified R1–R5 fixes. Its source does not imply that the existing GitHub PR branches have been updated.
