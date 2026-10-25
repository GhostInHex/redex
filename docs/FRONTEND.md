# Run and deploy the Redex frontend

The frontend contains a landing page with a live evaluator demo and the existing Watch/Practice playground. It builds on the verified R1–R5 history. This feature is on `feat/showcase`; publishing it requires repository write access.

## Run it locally

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed URL. `/` opens the landing page; `/play` opens the playground. Lesson links carry their exact source in `#p=...`. Programs execute in the browser; there is no application backend or account service.

## Check the production build

```sh
npm test
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 5177
```

In a second terminal:

```sh
npx playwright install chromium
BASE_URL=http://127.0.0.1:5177 npm run test:frontend
```

`FRONTEND_ARTIFACTS=/absolute/path` saves desktop/mobile screenshots and a JSON result summary. The smoke script tests the real hero trace, Watch/Practice, canonical and legacy links, malformed links, embed navigation, reload, 320/390px layouts, and console errors. It works against the production preview and uses the real URL encoding protocol without dev-server imports.

The retained `scratch/r5-practice/regression.mjs` covers the deeper Practice regression scenarios. It currently uses Vite source imports, so run it against the dev server with `BASE_URL` set to that server.

## Deploy static output

Publish the `dist` directory produced by `npm run build`. The build includes `dist/play/index.html` so a plain static host can serve `/play/` without an application server. It also includes Netlify/Cloudflare Pages `_redirects` for `/play`, and the repository has equivalent Vercel rewrites. Test both `/play` and `/play/` directly on the chosen host after deployment. Do not rewrite JS or CSS asset requests to HTML.

The default Vite base is `/`. For deployment below a prefix, build with `vite build --base=/prefix/` through the build script as appropriate and serve both generated HTML entry points below that prefix. Generated program links read `import.meta.env.BASE_URL`. If the host performs a trailing-slash redirect, it must preserve query strings and program hashes in the browser.

Compatibility routes:

- `/#p=...` still opens the shared program directly.
- A malformed `#p=` still opens the editor with a fallback notice.
- `/?embed=1#p=...` and `/play?embed=1#p=...` open the compact stepper.
- Embed's full-editor link opens `/play#p=...` without the embed flag.
- Ordinary root anchors such as `/#how-it-works` remain landing-page navigation.
- Hash changes and browser history navigation reclassify the page and program entry.

A per-tab draft is stored in session storage so a plain `/play` visit can restore editing after navigating Home. Explicit shared programs and invalid-link fallback take precedence. If storage is disabled, evaluation still works.

## Glaze attribution

The visual system is Glaze from [arla6ka/design.how](https://github.com/arla6ka/design.how), by Arlan Marat, licensed under MIT. The complete upstream license is in `src/components/glaze/LICENSE`.

Button, Card, Panel, theme CSS, portal support, utilities and icons were installed from the official `https://design.how/r/glaze/` registry on 25 October 2026. Vendor source is in `src/components/glaze` and `src/lib/glaze`; its upstream comments are retained. Tailwind and alias configuration integrate the copied components into Vite. Official Glaze Sans/Mono fonts are not redistributed; Glaze's documented system-font fallbacks apply. The app uses the official light ink/paper tokens, pill controls, shell cards and primary-button glass recipe.

The existing native Share dialog is deliberately retained so its verified keyboard containment and clipboard fallback remain intact. It is styled with Glaze overlay/field roles. Existing expression picks and timeline controls retain their behavior and accessible names.

Team names, hackathon name, submission URLs, usage statistics and awards were not supplied and are not invented in the page.
