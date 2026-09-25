# Phosphor landing page

The marketing site for [Phosphor](https://github.com/elebumm/phosphor-releases/releases/latest), the desktop app that turns your footage into a finished short.

It's built from the "Phosphor Landing" design in Claude Design and implemented with React and Vite. The build prerenders the page to static HTML, so the content loads without JavaScript. Once the script runs, it adds the animations.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build     # outputs static files to dist/
npm run preview   # serves dist/ locally
```

`npm run build` runs a client build, then a server build of `src/entry-server.jsx`. It then runs `scripts/prerender.mjs`, which writes the rendered markup into `dist/index.html`.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`, which builds the site and publishes `dist/` to GitHub Pages. The build uses relative asset paths, so it also works on a custom domain.

## Layout

- `src/App.jsx`: the page. Markup and animation logic come from the design; styles stay inline, as in the design.
- `src/css.js`: turns the design's inline CSS strings into React style objects (cached).
- `src/styles.css`: global styles and hover/active states.
- `public/icon.png`: favicon.

Download buttons point at the latest release in `elebumm/phosphor-releases`.
