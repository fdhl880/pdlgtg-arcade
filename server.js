'use strict';

/**
 * pdlgtg — LAN relay server.
 *
 * Serves the clients and pipes messages between them:
 *   /                     → game launcher
 *   /controller           → phone controller (the "remote", shared by all games)
 *   /games/<slug>/        → a game's PC client
 *
 * The server holds no game state. It is a dumb, low-latency switchboard so the
 * phone's orientation stream reaches the PC with as few hops as possible.
 */

const { exec } = require('child_process');
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const path = require('path');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const { ensureCert, localAddresses } = require('./scripts/gen-cert');

const PORT = Number(process.env.PORT) || 8443;
const IS_RENDER = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
const FORCE_HTTP = process.env.HTTP === '1' || IS_RENDER;
const GAMES_DIR = path.join(__dirname, 'games');

const app = express();
app.use(express.json());
// no-cache (NOT no-store): browsers must revalidate every file against its
// ETag on each load, so a plain reload after a git pull always runs current
// code — while unchanged files still come back as cheap 304s. Heuristic
// freshness on module scripts otherwise happily serves a stale game.js.
const NO_CACHE = { setHeaders: (res) => res.set('Cache-Control', 'no-cache') };
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], ...NO_CACHE }));
app.use('/games', express.static(GAMES_DIR, { extensions: ['html'], ...NO_CACHE }));
// The shared motion engine, imported directly by games as ES modules.
app.use('/core', express.static(path.join(__dirname, 'core'), NO_CACHE));
// Three.js straight from node_modules — no build step, no bundler.
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));
app.use('/vendor/three-examples', express.static(path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm')));
app.use('/assets', express.static(path.join(__dirname, 'assets'), NO_CACHE));
// Optional audio overrides. Gitignored: nothing copyrighted ships by default.
app.use('/audio', express.static(path.join(__dirname, 'audio'), { fallthrough: true }));

/**
 * Discover games from disk rather than a hardcoded list: a game is any folder
 * under games/ with an index.html. Dropping in a new folder is the whole
 * install step.
 *
 * game.json may set `hidden: true` to keep a game off the menu (still
 * reachable by URL) and `order` (lower first) to pin its menu position;
 * unordered games follow alphabetically.
 */
function listGames() {
  let entries;
  try {
    entries = fs.readdirSync(GAMES_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(GAMES_DIR, e.name, 'index.html')))
    .map((e) => {
      const meta = { title: e.name, tagline: '', emoji: '🎮' };
      try {
        Object.assign(meta, JSON.parse(fs.readFileSync(path.join(GAMES_DIR, e.name, 'game.json'), 'utf8')));
      } catch { /* game.json is optional */ }
      return { slug: e.name, url: `/games/${e.name}/`, ...meta };
    })
    .filter((g) => !g.hidden)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title));
}

app.get('/api/games', (_req, res) => res.json(listGames()));

/**
 * A fresh id per server run. Clients tie their saved calibration to it, so
 * calibration happens once when you `npm start` and is then inherited by every
 * page for the life of that run — restart the server and you calibrate again.
 */
const BOOT_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
app.get('/api/session', (_req, res) => res.json({ bootId: BOOT_ID }));

function generateSmartReply(query) {
  const q = (query || '').toLowerCase();
  if (/mario|kart|balap|drift|item/.test(q)) {
    return "🏎️ **Tips Pro Mario Kart di pdlgtg:**\n\n1. **Rocket Start:** Tahan tombol gas tepat saat angka '2' mulai memudar di hitungan countdown buat dapat dorongan instan!\n2. **Mini-Turbo Drift:** Tahan tombol Drift saat menikung sampai keluar percikan api biru/oranye/ungu buat boost ekstra!\n3. **Item Defense:** Simpan pisang (banana) atau green shell di belakang mobil buat menangkal red shell lawan!\n4. **Glider Tech:** Saat melayang di udara, arahkan kemiringan ke bawah sedikit biar dapat kecepatan luncur optimal.";
  }
  if (/remote|hp|controller|pairing|connect|sensor|gyro/.test(q)) {
    return "📱 **Panduan Remote HP pdlgtg:**\n\n1. Pastikan HP dan PC berada di **jaringan Wi-Fi yang sama**.\n2. Buka URL controller atau scan QR Code di menu utama.\n3. Izinkan sensor **Motion & Orientation** saat browser HP meminta izin.\n4. Pegang HP secara mendatar (*landscape*) saat kalibrasi dimulai.\n5. Gerakkan HP seperti setir mobil atau ayunan pedang untuk mengontrol game!";
  }
  if (/fruit|ninja|buah|tebas/.test(q)) {
    return "🍉 **Tips Fruit Ninja:**\n\n1. Tebas buah sekaligus 3+ buat dapat Combo bonus poin!\n2. Waspadai bom bertanda 'X' merah — hindari mengayun ke arah bom!\n3. Manfaatkan pisang beku (*Freeze Banana*) dan pisang frenzy buat skor maksimal.";
  }
  if (/alien|space|tembak|pesawat/.test(q)) {
    return "🚀 **Tips Alien Attack:**\n\n1. Gerakkan HP untuk mengarahkan bidikan laser pesawat.\n2. Hancurkan armada alien formasi depan sebelum mereka mendekati pertahananmu!\n3. Ambil power-up shield dan multi-laser untuk daya hancur berlipat.";
  }
  if (/sword|pedang|duel/.test(q)) {
    return "⚔️ **Tips Swordplay:**\n\n1. Ayunkan HP dengan mantap untuk menebas.\n2. Tahan tombol Shield untuk memblokir tebasan lawan.\n3. Serang tepat setelah lawan terpental karena blokirmu!";
  }
  if (/flappy|burung/.test(q)) {
    return "🐦 **Tips Flappy Phone 3D:**\n\n1. Miringkan HP ke atas (pitch up) dengan ritme halus untuk mengepakkan sayap burung 3D.\n2. Jaga kestabilan ketinggian di tengah-tengah pipa hijau.\n3. Jangan terlalu sering mengangkat drastis agar tidak menabrak atap pipa!";
  }
  if (/joke|lelucon|lucu|humor/.test(q)) {
    const jokes = [
      "😂 Kenapa komputer ga pernah lapar? Karena dia udah kenyang makan *bytes*! 🍔",
      "😂 Apa bedanya programmer sama pesulap? Kalau pesulap bikin kelinci keluar dari topi, programmer bikin bug keluar dari mana-mana! 🐛",
      "😂 Kenapa sinyal WiFi suka galau? Karena merasa ga ada yang bener-bener *connect* sama perasaannya! 📶💔",
      "😂 Knock knock!\n*Siapa?*\n*Java.*\n*Java siapa?*\n*Java-b dulu pertanyaanku baru kuberi tahu!* ☕"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
  if (/cerita|story|dongeng/.test(q)) {
    return "📖 **Legenda Pembalap Bintang pdlgtg:**\n\nDi sirkuit galaksi Mushroom Cup, seorang pembalap misterius menunggangi kart bertenaga surya. Saat lap terakhir, ia tertinggal di posisi 8. Lawan-lawan di depannya saling melempar Red Shell dan Banana.\n\nTepat di tikungan tajam anti-gravitasi, ia melakukan drift ekstrem hingga percikan api ungu menyala. Dengan dorongan Super Mini-Turbo dan satu Star emas, ia melesat menembus garis finish hanya selisih 0.01 detik! 🏆 Keberanian dan drift sempurna selalu mengalahkan keberuntungan!";
  }
  if (/code|coding|program|javascript|python|react|teknologi|tech|engine/.test(q)) {
    return "💻 **Tips Coding & Tech Stack pdlgtg:**\n\nArcade ini dibangun dengan teknologi canggih:\n- **Node.js + Express** untuk LAN relay latency ultra-rendah (<10ms)\n- **Socket.io** streaming sensor gyroskop HP 60Hz real-time\n- **Three.js (WebGL)** rendering grafis 3D kualitas konsol dengan custom shaders\n- **ES Modules & React 19** untuk antarmuka launcher yang modern dan smooth\n\nAda konsep teknis atau game engine yang mau kamu tanyakan?";
  }
  if (/hai|halo|hello|pagi|siang|malam|apa kabar|assalam/.test(q)) {
    return "Halo! 👋 Aku **PyroBot**, asisten AI kamu di pdlgtg Arcade! Aku siap bantu kamu dengan tips game, trik balapan, cerita seru, info coding, atau sekadar ngobrol santai seperti di ChatGPT. Mau bahas apa hari ini? 🎮";
  }
  return `Halo! Pertanyaan yang sangat menarik tentang "${query}". Sebagai AI companion di pdlgtg Arcade, aku siap membantu kamu mengeksplorasi semua game 3D kami (Mario Kart, Fruit Ninja, Alien Attack, Swordplay, Flappy Phone 3D, dll) serta berdiskusi seputar gaming, matematika, coding, atau cerita seru! Ada yang ingin kamu bahas lebih mendalam? 🎮✨`;
}

let localModelGenerator = null;
let modelLoading = false;

async function getLocalModel() {
  if (localModelGenerator) return localModelGenerator;
  if (modelLoading) return null;
  try {
    modelLoading = true;
    const { pipeline, env } = require('@huggingface/transformers');
    env.cacheDir = path.join(__dirname, 'models', 'cache');
    localModelGenerator = await pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', {
      dtype: 'q4',
      device: 'cpu'
    });
    modelLoading = false;
    return localModelGenerator;
  } catch (err) {
    modelLoading = false;
    console.warn('[AI] Local Qwen model load error:', err.message);
    return null;
  }
}

app.post('/api/chat', async (req, res) => {
  const { message, messages } = req.body || {};
  let userText = message;
  if (!userText && Array.isArray(messages)) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    userText = lastUser?.content || '';
  }
  if (!userText || typeof userText !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const queryText = userText.trim();

  // Try fast online fetch with 8 second timeout
  const askPollinations = () => new Promise((resolve, reject) => {
    const prompt = `[Instruksi: Kamu adalah asisten AI yang ramah, seru, dan pintar di pdlgtg Arcade. Jawab dalam bahasa Indonesia yang asik, ramah, dan gaul.] Pertanyaan: ${queryText}`;
    const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt);
    const apiReq = https.get(url, { timeout: 8000 }, (apiRes) => {
      let body = '';
      apiRes.on('data', chunk => body += chunk);
      apiRes.on('end', () => {
        if (apiRes.statusCode === 200 && body.trim() && !body.startsWith('{"error"') && !body.startsWith('<!doctype')) {
          resolve(body.trim());
        } else {
          reject(new Error(`Status ${apiRes.statusCode}`));
        }
      });
    });
    apiReq.on('error', reject);
    apiReq.on('timeout', () => { apiReq.destroy(); reject(new Error('timeout')); });
  });

  try {
    const reply = await askPollinations();
    return res.json({ reply, model: 'ChatGPT (Online)' });
  } catch (err) {
    // Offline mode: Run the embedded Qwen 2.5 neural model!
    const gen = await getLocalModel();
    if (gen) {
      try {
        const msgs = [
          { role: 'system', content: 'Kamu adalah PyroBot, asisten AI gaul di pdlgtg Arcade. Jawab ramah dan informatif dalam bahasa Indonesia.' },
          { role: 'user', content: queryText }
        ];
        const prompt = gen.tokenizer.apply_chat_template(msgs, { tokenize: false, add_generation_prompt: true });
        const output = await gen(prompt, { max_new_tokens: 150, temperature: 0.7, do_sample: true });
        const text = output[0]?.generated_text?.slice(prompt.length)?.trim();
        if (text) {
          return res.json({ reply: text, model: 'Qwen 2.5 (Offline Neural)' });
        }
      } catch (genErr) {
        console.warn('Local Qwen generation error:', genErr.message);
      }
    }
    const fallback = generateSmartReply(queryText);
    return res.json({ reply: fallback, model: 'PyroBot (Smart Local)' });
  }
});

const tls = FORCE_HTTP ? null : ensureCert();
const httpServer = http.createServer(app);
const httpsServer = tls ? https.createServer(tls, app) : null;
const scheme = tls ? 'https' : 'http';

const lanIp = localAddresses()[0] || 'localhost';
const controllerUrl = `${scheme}://${lanIp}:${PORT}/controller`;

// The PC client fetches this to render a scannable join code.
app.get('/api/pairing', async (req, res) => {
  try {
    const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
    const forwardedProto = req.headers['x-forwarded-proto'] || (tls ? 'https' : 'http');
    const effectiveUrl = forwardedHost
      ? `${forwardedProto}://${forwardedHost}/controller`
      : controllerUrl;

    const qr = await QRCode.toDataURL(effectiveUrl, {
      margin: 1,
      width: 320,
      color: { dark: '#0b0e14', light: '#ffffff' },
    });
    res.json({ url: effectiveUrl, qr, httpUrl: effectiveUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const io = new Server({
  // Orientation samples are tiny and constant; skip the polling handshake.
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
  cors: { origin: '*' },
});
io.attach(httpServer);
if (httpsServer) io.attach(httpsServer);

const server = httpsServer ? net.createServer((socket) => {
  socket.once('data', (buffer) => {
    // 22 (0x16) is TLS Handshake Record
    const isTls = buffer[0] === 22;
    const target = isTls ? httpsServer : httpServer;
    socket.pause();
    socket.unshift(buffer);
    target.emit('connection', socket);
    process.nextTick(() => socket.resume());
  });
  socket.on('error', () => {});
}) : httpServer;

/** socket.id → 'game' | 'controller' */
const roles = new Map();

function countOf(role) {
  let n = 0;
  for (const r of roles.values()) if (r === role) n += 1;
  return n;
}

/**
 * Player slots. Only slot 0 is used today, but tagging every packet with its
 * slot from the start means adding a second phone later is a feature, not a
 * protocol migration.
 */
const MAX_PLAYERS = 4;
const slots = new Array(MAX_PLAYERS).fill(null);   // index → socket.id

function assignSlot(socketId) {
  const free = slots.indexOf(null);
  if (free === -1) return -1;
  slots[free] = socketId;
  return free;
}

function releaseSlot(socketId) {
  const i = slots.indexOf(socketId);
  if (i !== -1) slots[i] = null;
}

const slotOf = (socketId) => slots.indexOf(socketId);

function broadcastPresence() {
  io.emit('presence', {
    game: countOf('game'),
    controller: countOf('controller'),
    slots: slots.map((id, i) => ({ slot: i, occupied: id !== null })),
  });
}

io.on('connection', (socket) => {
  socket.on('register', (role) => {
    if (role !== 'game' && role !== 'controller') return;
    roles.set(socket.id, role);
    socket.join(role);

    if (role === 'controller') {
      const slot = assignSlot(socket.id);
      if (slot === -1) {
        socket.emit('slot-denied', { reason: 'all player slots full', max: MAX_PLAYERS });
        console.log(`[io] controller rejected — ${MAX_PLAYERS} slots full (${socket.id})`);
        return;
      }
      socket.emit('slot', { slot });
      console.log(`[io] controller connected as player ${slot + 1} (${socket.id})`);
    } else {
      console.log(`[io] game connected (${socket.id})`);
    }
    broadcastPresence();
  });

  // Latency probe. Echoed straight back so the game can measure a true round
  // trip — a one-way timestamp would need synchronised clocks across devices.
  socket.on('ping-probe', (data) => socket.to('controller').emit('ping-probe', data));
  socket.on('pong-probe', (data) => socket.to('game').emit('pong-probe', data));

  // Phone → PC.
  //
  // NOT volatile. Socket.IO discards volatile packets whenever the transport
  // reports itself unwritable, which on the long-polling transport is most of
  // the time — so a connection that falls back to polling (easy to trigger with
  // a self-signed cert) drops effectively the entire orientation stream while
  // ordinary emits still get through. That failure is invisible: the phone
  // connects, commands work, and the blade simply never moves. The payload is
  // ~100 bytes at 60Hz; the rate cap on the sender is the real backpressure.
  socket.on('orientation', (data) => {
    socket.to('game').emit('orientation', { ...data, slot: slotOf(socket.id) });
  });

  socket.on('motion', (data) => {
    socket.to('game').emit('motion', { ...data, slot: slotOf(socket.id) });
  });

  // Phone → PC control actions: calibrate, start, pause, sensitivity nudges.
  socket.on('command', (data) => {
    socket.to('game').emit('command', { ...data, slot: slotOf(socket.id) });
  });

  // PC → phone feedback: hits (haptics), score, game state.
  //
  // A message with a `slot` goes to that one phone only — e.g. a multiplayer
  // slice should buzz the hand that swung it, not every hand in the lobby.
  // Anything without a slot broadcasts to every controller, unchanged from
  // before slots existed — every existing single-player game's feedback
  // calls omit it, so this is purely additive.
  socket.on('feedback', (data) => {
    if (typeof data.slot === 'number' && slots[data.slot]) {
      io.to(slots[data.slot]).emit('feedback', data);
    } else {
      socket.to('controller').emit('feedback', data);
    }
  });

  socket.on('disconnect', () => {
    const role = roles.get(socket.id);
    roles.delete(socket.id);
    releaseSlot(socket.id);
    if (role) console.log(`[io] ${role} disconnected (${socket.id})`);
    broadcastPresence();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const line = '─'.repeat(52);
  console.log(`\n${line}`);
  console.log('  🕹  pdlgtg — Arcade Gaming Hub');
  console.log(line);
  console.log(`  Launcher      ${scheme}://localhost:${PORT}/`);
  console.log(`  Phone remote  ${controllerUrl}`);
  const games = listGames();
  console.log(`\n  ${games.length} game${games.length === 1 ? '' : 's'}:`);
  for (const g of games) console.log(`    ${g.emoji}  ${g.title}  →  ${g.url}`);
  if (!tls) {
    console.log('\n  ⚠  Running plain HTTP. Phone sensors will NOT work off');
    console.log('     localhost — browsers gate the IMU behind a secure context.');
  } else {
    console.log('\n  ⚠  Self-signed cert: the phone will show a warning once.');
    console.log('     Tap Advanced → Proceed. Sensors need HTTPS to unlock.');
  }

  // One command, whole console: npm start also opens the TV browser — its
  // own Chrome profile so the autoplay flag genuinely applies (handing the
  // URL to an already-running Chrome silently drops process flags).
  // HTTP dev mode and NO_OPEN=1 skip this.
  if (tls && process.platform === 'darwin' && !process.env.NO_OPEN) {
    exec('open -na "Google Chrome" --args'
      + ' --user-data-dir="$HOME/.pdlgtg-chrome" --no-first-run --no-default-browser-check'
      + ` --autoplay-policy=no-user-gesture-required --new-window https://localhost:${PORT}/`);
    console.log('\n  📺 Opening the console in Chrome (autoplay enabled)…');
    console.log('     Skip with NO_OPEN=1 npm start.');
  }
  console.log(`${line}\n`);
});
