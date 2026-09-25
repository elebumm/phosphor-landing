// Renders scripts/og-card.html to public/og.png (1200×630, the link-preview image) with a local Chrome or Edge.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find(p => p && fs.existsSync(p));
if (!browser) throw new Error('No Chrome or Edge found; set CHROME to the browser executable.');

const out = path.join(root, 'public', 'og.png');
execFileSync(browser, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1200,630', '--virtual-time-budget=8000', `--screenshot=${out}`,
  pathToFileURL(path.join(root, 'scripts', 'og-card.html')).href
], { stdio: 'inherit' });
console.log('wrote', path.relative(root, out));
