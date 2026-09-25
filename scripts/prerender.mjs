// Inline the server-rendered page into dist/index.html so the content ships as HTML.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'dist', 'index.html');
const { render } = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href);

const template = fs.readFileSync(indexPath, 'utf8');
if (!template.includes('<!--app-->')) throw new Error('dist/index.html is missing the <!--app--> marker');
fs.writeFileSync(indexPath, template.replace('<!--app-->', render()));
fs.rmSync(path.join(root, 'dist-ssr'), { recursive: true, force: true });
console.log('prerendered dist/index.html');
