# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Google AdSense

Ad units load only in production when a valid publisher ID, a slot ID, and the site's consent choice are present. Development continues to show preview cards.

1. Add and verify PlanetMusic's production domain in AdSense, then wait for site approval.
2. Create responsive ad units. Put the publisher ID (`ca-pub-...`) and slot IDs in the matching `VITE_ADSENSE_*` entries in your ignored `.env.local` or deployment environment. `VITE_ADSENSE_SLOT_DEFAULT` can temporarily supply one slot to every placement; named slots let you report placements separately.
3. Publish the exact seller entry provided by AdSense as `public/ads.txt`, then redeploy.
4. For visitors in the EEA, UK, or Switzerland, configure a Google-certified consent management platform in AdSense. The existing site notice is not a substitute for that requirement.

Vite embeds `VITE_` values in client code, so use these only for public publisher and slot IDs, never secret credentials.

## Deezer backend

Deezer requests use same-origin `/api/*` routes handled by the Cloudflare Pages Function. The Function adds its private backend gateway token; do not put that token, the Flask `SECRET_KEY`, an app password, or Deezer ARL in frontend code or Cloudflare Pages build variables. Deezer ARL is requested only for download/stream actions and held in page memory.

For local backend testing, copy `.dev.vars.example` to `.dev.vars` and replace its placeholder with the same `BACKEND_GATEWAY_TOKEN` value used by Render. The `.dev.vars` file is ignored by Git. Start the local Cloudflare Pages runtime with `npm run dev:pages`, then open `http://127.0.0.1:8788`. This runs the Pages Function locally, so the browser calls same-origin `/api/*` routes and the token stays in the local server process rather than frontend code. Do not use `npm run dev` for API testing; plain Vite does not run Pages Functions.
