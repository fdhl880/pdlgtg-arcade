'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('[vercel-build] 1. Preparing Three.js & Socket.io vendor assets...');
// Copy Three.js to vendor/ and public/vendor/
const threeBuild = path.join(ROOT_DIR, 'node_modules', 'three', 'build');
const threeExamples = path.join(ROOT_DIR, 'node_modules', 'three', 'examples', 'jsm');
copyDir(threeBuild, path.join(ROOT_DIR, 'vendor', 'three'));
copyDir(threeExamples, path.join(ROOT_DIR, 'vendor', 'three-examples'));
copyDir(threeBuild, path.join(PUBLIC_DIR, 'vendor', 'three'));
copyDir(threeExamples, path.join(PUBLIC_DIR, 'vendor', 'three-examples'));

// Remove unused Addons.js barrel file to avoid any legacy bundler/Babel issues
const addons1 = path.join(ROOT_DIR, 'vendor', 'three-examples', 'Addons.js');
if (fs.existsSync(addons1)) fs.unlinkSync(addons1);
const addons2 = path.join(PUBLIC_DIR, 'vendor', 'three-examples', 'Addons.js');
if (fs.existsSync(addons2)) fs.unlinkSync(addons2);

// Copy Socket.io client to public/socket.io/
const socketIoClient = path.join(ROOT_DIR, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js');
if (fs.existsSync(socketIoClient)) {
  copyFile(socketIoClient, path.join(PUBLIC_DIR, 'socket.io', 'socket.io.js'));
  console.log('[vercel-build] Copied socket.io.js to public/socket.io/');
}

console.log('[vercel-build] 2. Syncing games, core, assets & audio into public/ for Vercel CDN...');
copyDir(path.join(ROOT_DIR, 'core'), path.join(PUBLIC_DIR, 'core'));
copyDir(path.join(ROOT_DIR, 'games'), path.join(PUBLIC_DIR, 'games'));
copyDir(path.join(ROOT_DIR, 'assets'), path.join(PUBLIC_DIR, 'assets'));

const audioDir = path.join(ROOT_DIR, 'audio');
if (fs.existsSync(audioDir)) {
  copyDir(audioDir, path.join(PUBLIC_DIR, 'audio'));
}

console.log('[vercel-build] 3. Generating games manifest...');
const GAMES_DIR = path.join(ROOT_DIR, 'games');
let gamesList = [];
try {
  const entries = fs.readdirSync(GAMES_DIR, { withFileTypes: true });
  gamesList = entries
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(GAMES_DIR, e.name, 'index.html')))
    .map((e) => {
      const meta = { title: e.name, tagline: '', emoji: '🎮' };
      try {
        Object.assign(meta, JSON.parse(fs.readFileSync(path.join(GAMES_DIR, e.name, 'game.json'), 'utf8')));
      } catch {}
      return { slug: e.name, url: `/games/${e.name}/`, ...meta };
    })
    .filter((g) => !g.hidden)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title));
} catch (err) {
  console.warn('[vercel-build] Could not list games from disk:', err.message);
}

if (gamesList.length > 0) {
  const manifestData = JSON.stringify(gamesList, null, 2);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'games-manifest.json'), manifestData, 'utf8');
  fs.writeFileSync(path.join(GAMES_DIR, 'games-manifest.json'), manifestData, 'utf8');
  console.log(`[vercel-build] Successfully indexed ${gamesList.length} games into games-manifest.json`);
}

// Ensure entrypoint shims exist in public/ and root
const shimContent = "'use strict';\\nmodule.exports = require('../server.js');\\n".replace(/\\\\n/g, '\n');
fs.writeFileSync(path.join(PUBLIC_DIR, 'server.js'), shimContent, 'utf8');
fs.writeFileSync(path.join(PUBLIC_DIR, 'index.js'), shimContent, 'utf8');
const rootShim = "'use strict';\\nmodule.exports = require('./server.js');\\n".replace(/\\\\n/g, '\n');
fs.writeFileSync(path.join(ROOT_DIR, 'index.js'), rootShim, 'utf8');
console.log('[vercel-build] Ensured server.js and index.js entrypoints exist in both root and public/');

console.log('[vercel-build] Done! All public static assets are ready for Vercel Edge CDN deployment.');
