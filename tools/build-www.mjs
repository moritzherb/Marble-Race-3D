// Builds www/, the web content of the Android and iOS apps (Capacitor copies it into each
// native project on `npx cap sync`). It is the prototype (scripts, ad settings and the hint
// tables) with two changes:
//   - three.js is copied in from node_modules instead of loaded from a CDN, so the game
//     works without a connection;
//   - Capacitor's runtime (capacitor.js) loads before the game, which connects the native
//     plugins, AdMob among them.
//
//   npm run build:www

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'prototype');
const out = join(root, 'www');
const need = (path, pkg) => {
  if (!existsSync(path)) throw new Error(`${path} is missing: run npm install (needs ${pkg})`);
  return path;
};

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'src', 'vendor'), { recursive: true });
cpSync(join(src, 'src'), join(out, 'src'), { recursive: true });
cpSync(join(src, 'ads-config.json'), join(out, 'ads-config.json'));
cpSync(join(src, 'hints'), join(out, 'hints'), { recursive: true });
cpSync(need(join(root, 'node_modules/three/build/three.module.js'), 'three'), join(out, 'src/vendor/three.module.js'));
cpSync(need(join(root, 'node_modules/@capacitor/core/dist/capacitor.js'), '@capacitor/core'), join(out, 'capacitor.js'));

const threeShim = join(out, 'src/three.js');
const shim = readFileSync(threeShim, 'utf8');
if (!shim.includes('cdn.jsdelivr.net/npm/three@0.170.0/')) throw new Error('src/three.js no longer points at three@0.170.0; update build-www.mjs and the three version in package.json');
writeFileSync(threeShim, shim.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/build\/three\.module\.js/g, './vendor/three.module.js'));

const html = readFileSync(join(src, 'index.html'), 'utf8');
const entry = '<script type="module" src="./src/main.js"></script>';
if (!html.includes(entry)) throw new Error('index.html no longer loads ./src/main.js; update build-www.mjs');
writeFileSync(join(out, 'index.html'), html.replace(entry, `<script src="./capacitor.js"></script>\n${entry}`));

console.log(`wrote ${out}`);
