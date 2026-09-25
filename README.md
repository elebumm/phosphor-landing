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

Pushing to `main` runs `.github/workflows/pages.yml`, which builds the site and publishes `dist/` to GitHub Pages at [phosphorai.app](https://phosphorai.app).

The custom domain is set in the repo's Pages settings, with "Enforce HTTPS" on. DNS for `phosphorai.app` is managed in Cloudflare:

- apex A records to GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- apex AAAA records: `2606:50c0:8000::153` through `2606:50c0:8003::153`
- `www` CNAME to `elebumm.github.io` (GitHub redirects it to the apex)

All records are DNS-only (grey cloud). GitHub issues and renews the HTTPS certificate itself, and turning on the Cloudflare proxy can block those renewals.

## Layout

- `src/App.jsx`: the page. Markup and animation logic come from the design; styles stay inline, as in the design.
- `src/phaseMorph.jsx`: the shared illustration in "How it works", whose pieces move between the five phases.
- `src/css.js`: turns the design's inline CSS strings into React style objects (cached).
- `src/styles.css`: global styles, hover/active states and the FAQ disclosures.
- `public/icon.png`: favicon and Apple touch icon.
- `public/og.png`: the link-preview image (see below).
- `public/media/`: the example short and its poster.

## Download buttons

When the page loads, it asks the GitHub API for the latest published release of `elebumm/phosphor-releases` and links each button straight to its installer, matched by file name:

| Button | File |
| --- | --- |
| Mac (Apple silicon, the default) | `Phosphor-X.Y.Z-mac-arm64.dmg` |
| Mac (Intel, when Chrome or Edge reports an Intel Mac, and as the "Intel Mac?" link) | `Phosphor-X.Y.Z-mac-x64.dmg` |
| Windows | `Phosphor-X.Y.Z-win-x64-setup.exe` |

Until a release is published, the API answers 404 and the buttons read "coming soon" and link to the repository, where visitors can watch for releases. If GitHub can't be reached, and in the prerendered HTML, the buttons link to the Releases page. Drafts and pre-releases are ignored. Phones and tablets get a note that Phosphor runs on Mac and Windows, plus a button to share or copy the link.

Updating is currently a re-download, and the page says so under the Get started buttons and in the FAQ. Change both if the app starts installing updates itself.

## Example short

`public/media/sloppenheimer.mp4` is a web copy of a short made with Phosphor: 720 × 1280 H.264 at about 1 Mbit/s, AAC audio, metadata stripped, with the index at the front so it starts playing quickly. It plays muted while on screen and loads nothing until then. To replace it, encode the new master the same way and update the facts in the "Made with Phosphor" section:

```bash
ffmpeg -i master.mp4 -map 0:v:0 -map 0:a:0 -map_metadata -1 -vf scale=720:1280:flags=lanczos -c:v libx264 -preset slow -crf 25 -maxrate 1600k -bufsize 3200k -profile:v high -level 4.0 -pix_fmt yuv420p -c:a aac -b:a 128k -ac 2 -movflags +faststart public/media/sloppenheimer.mp4
```

## Link previews and analytics

`public/og.png` is rendered from `scripts/og-card.html`. After editing the card, run `npm run og` (it uses a local Chrome or Edge; set `CHROME` to point at another browser).

Page views go to Cloudflare Web Analytics (no cookies). `src/main.jsx` adds the beacon only on phosphorai.app, so local previews aren't counted. The numbers are under Analytics & Logs › Web Analytics in the Cloudflare dashboard. GitHub counts installer downloads on each release.
