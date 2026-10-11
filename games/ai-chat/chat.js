/**
 * AI Chat Engine for pdlgtg.
 * 
 * Multi-tier AI backend:
 *  1. Pollinations.ai (free, no API key, works when online)
 *  2. Puter.js AI (free, no API key, browser-based)
 *  3. Local smart fallback (offline pattern-matching for basic conversation)
 * 
 * Designed for mobile-first interaction.
 */

const $ = (id) => document.getElementById(id);
const messagesEl = $('messages');
const inputEl = $('msg-input');
const sendBtn = $('send-btn');
const statusDot = $('status-dot');
const modelLabel = $('model-label');

// ── Conversation History ───────────────────────────────────────────────────
let history = [];
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `Kamu adalah teman ngobrol yang asik, ceria, dan seru. Kamu bisa bercerita, bercanda, memberikan fakta menarik, dan menjawab pertanyaan apa saja. Gunakan bahasa Indonesia yang santai dan gaul. Jawab dengan singkat dan menarik (maksimal 3 paragraf). Gunakan emoji sesekali untuk menambah ekspresi. Jika diminta cerita, buatlah cerita yang kreatif dan menarik.`;

// ── Message Rendering ──────────────────────────────────────────────────────
function addMessage(text, role) {
  const div = document.createElement('div');
  div.classList.add('msg', role);
  
  if (role === 'ai') {
    div.innerHTML = `<div class="ai-name">🤖 AI</div>${formatText(text)}`;
  } else {
    div.textContent = text;
  }
  
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function formatText(text) {
  // Basic markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function showTyping() {
  const div = document.createElement('div');
  div.classList.add('typing');
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function hideTyping() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

// ── AI Engine: Tier 1 - pdlgtg Server Relay (/api/chat) ───────────────────
async function askServerChat(userMsg) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg, messages: history }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.reply) {
      setStatus('online', data.model || 'ChatGPT Online');
      return data.reply.trim();
    }
    return null;
  } catch (e) {
    console.warn('Server chat relay failed:', e.message);
    return null;
  }
}

async function askPollinations(userMsg) {
  const reply = await askServerChat(userMsg);
  if (reply) return reply;

  // Direct client fetch fallback
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const prompt = encodeURIComponent(`[System: Kamu asisten AI gaul pdlgtg Arcade. Jawab bahasa Indonesia.] User: ${userMsg}`);
    const res = await fetch(`https://text.pollinations.ai/${prompt}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.startsWith('{"error"')) throw new Error('Bad response');
    setStatus('online', 'Pollinations AI');
    return text.trim();
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

// ── AI Engine: Tier 2 - Puter.js ───────────────────────────────────────────
let puterLoaded = false;
async function loadPuter() {
  if (puterLoaded) return true;
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    puterLoaded = true;
    return true;
  } catch {
    return false;
  }
}

async function askPuter(userMsg) {
  try {
    if (!await loadPuter()) return null;
    if (!window.puter?.ai?.chat) return null;
    
    const fullPrompt = SYSTEM_PROMPT + '\n\nUser: ' + userMsg;
    const res = await window.puter.ai.chat(fullPrompt, { model: 'claude-3-5-sonnet' });
    const reply = typeof res === 'string' ? res : res?.message?.content;
    if (!reply) return null;

    setStatus('online', 'Puter AI');
    return reply.trim();
  } catch (e) {
    console.warn('Puter failed:', e.message);
    return null;
  }
}

// ── AI Engine: Tier 3 - Smart Offline Fallback ─────────────────────────────
const offlineResponses = {
  greetings: [
    'Halo! 👋 Senang ketemu kamu! Aku AI offline mode nih, tapi tetap bisa ngobrol santai!',
    'Hey hey! 🎉 Apa kabar? Meskipun aku lagi offline, kita tetap bisa seru-seruan!',
    'Hai! 😊 Selamat datang! Aku mungkin offline, tapi aku tetap bisa menemani kamu ngobrol!',
  ],
  stories: [
    '📖 **Petualangan Si Kucing Luar Angkasa**\n\nDi sebuah galaksi yang jauh, ada seekor kucing bernama Nebula. Ia punya helm astronot mini dan roket dari kardus bekas. Suatu hari, roketnya tiba-tiba benar-benar terbang! 🚀\n\nNebula mendarat di Planet Tuna, di mana semua bangunan terbuat dari ikan. "Surga..." bisiknya. Tapi ternyata, penduduk planet itu — anjing-anjing alien — tidak setuju! 🐕‍🦺\n\nSetelah negosiasi panjang (dan banyak mengeong), mereka sepakat: ikan untuk kucing, tulang untuk anjing. Perdamaian galaksi pun tercapai! ✨',
    
    '📖 **Robot Yang Belajar Bermimpi**\n\nDi kota tahun 2099, ada robot bernama ARIA yang bekerja di pabrik cokelat. Setiap hari ia menghitung, mengemas, dan mengirim. Tapi suatu malam, ada yang aneh — ia "bermimpi" tentang taman bunga! 🌸\n\nARIA bingung. Robot tidak seharusnya bermimpi. Ia pergi ke teknisi, tapi teknisi bilang, "Mungkin kamu bukan sekadar robot."\n\nSejak itu, ARIA mulai melukis bunga di setiap kotak cokelat. Penjualan naik 300%! 🎨 Ternyata, mimpi itu investasi terbaik.',
    
    '📖 **Pencuri Bintang**\n\nSeorang anak bernama Luna percaya bintang bisa dikumpulkan. Setiap malam, ia naik ke atap dengan toples kaca, mencoba menangkap cahaya bintang. 🌟\n\nSuatu malam ajaib, seekor kunang-kunang masuk ke toplesnya. "Aku bukan bintang," kata kunang-kunang itu, "tapi aku bisa jadi temanmu."\n\nLuna tersenyum. Kadang yang kita cari ada di tempat yang tidak kita duga. 💫',
  ],
  jokes: [
    '😂 Kenapa komputer tidak pernah lapar?\nKarena dia sudah punya banyak *bytes*! 🍔',
    '😂 Apa bedanya programmer sama pesulap?\nKalau pesulap bikin kelinci muncul dari topi, programmer bikin bug muncul dari mana-mana! 🐛',
    '😂 Kenapa WiFi selalu sedih?\nKarena dia merasa ga ada yang benar-benar *connect* sama dia! 📶💔',
    '😂 Knock knock!\nSiapa? \n*Java.*\nJava siapa?\nJava-b dulu aja, nanti juga ngerti! ☕',
    '😂 Kenapa AI tidak pernah menang lomba lari?\nKarena dia selalu stuck di *loop*! 🏃‍♂️🔄',
  ],
  facts: [
    '🧠 **Fakta Keren!** Gurita punya 3 jantung dan darahnya berwarna biru! Mereka juga bisa mengubah warna kulit dalam hitungan milidetik. Basically, mereka superhero laut! 🐙',
    '🧠 **Tahukah kamu?** Madu tidak pernah basi! Arkeolog pernah menemukan madu berumur 3000 tahun di piramida Mesir, dan masih bisa dimakan! 🍯',
    '🧠 **Mind-blown!** Otak manusia menggunakan 20% dari total energi tubuh, padahal beratnya cuma 2% dari berat badan. Otak kamu literally lebih power-hungry dari HP gaming! 🧠⚡',
    '🧠 **Fun Fact:** Ada lebih banyak bintang di alam semesta daripada butiran pasir di seluruh pantai di Bumi. Sekitar 70 sextillion (7 × 10²²) bintang! ✨',
    '🧠 **Wow!** Pisang itu secara teknis adalah berry, tapi stroberi bukan! Dunia botani memang penuh twist! 🍌🍓',
  ],
  poems: [
    '🌙 **Malam Ini**\n\nBintang bermain petak umpet\nDi balik awan yang berselimut\nBulan tersenyum, mengangguk pelan\nMenemani dunia yang mulai diam\n\nAngin berbisik lembut di telinga\nMembawa mimpi untuk semua\nMalam ini, semuanya indah\nDi bawah langit yang tak terbatas ✨',
    
    '🌙 **Digital Dreams**\n\nDi dalam layar yang menyala\nAda dunia tanpa batas\nPixel-pixel menari-nari\nMembentuk cerita yang tak pernah habis\n\nKita terhubung, walau berjauhan\nMelalui kabel dan gelombang\nTeknologi membawa kita dekat\nDalam pelukan digital yang hangat 💻✨',
  ],
  trivia: [
    '🎯 Ayo main tebak-tebakan!\n\n**Pertanyaan:** Hewan apa yang bisa terbang tapi bukan burung, dan aktif di malam hari?\n\n💡 *Jawabannya: Kelelawar!* Mereka adalah satu-satunya mamalia yang benar-benar bisa terbang! 🦇',
    '🎯 Tebak-tebakan!\n\n**Pertanyaan:** Negara mana yang punya lebih banyak piramida dari Mesir?\n\n💡 *Jawabannya: Sudan!* Sudan punya sekitar 255 piramida, sementara Mesir "hanya" punya 138! 🏛️',
  ],
  music: [
    '🎵 Rekomendasi lagu santai:\n\n1. **Lofi Hip Hop** — Channel YouTube "Lofi Girl" ☕\n2. **Cigarettes After Sex** — "Apocalypse" 🌙\n3. **Keshi** — "beside you" 💜\n4. **Tulus** — "Hati-Hati di Jalan" 🇮🇩\n5. **Wave to Earth** — "seasons" 🌊\n\nSemoga bisa bikin mood kamu makin chill! 😌',
  ],
  horror: [
    '👻 **Pesan Terakhir**\n\nJam 3 pagi. HP Rara bergetar. Ada pesan dari nomor tidak dikenal:\n\n*"Jangan lihat ke belakang."*\n\nRara tertawa. Pasti teman iseng. Tapi kemudian pesan kedua masuk:\n\n*"Aku serius. Jangan."*\n\nRara mulai merinding. Pesan ketiga:\n\n*"Kalau kamu sudah membaca ini... sudah terlambat."*\n\nLampu kamarnya mati. Dan di kegelapan, ia mendengar... suara napas. Bukan napasnya. 😱',
  ],
  tips: [
    '💡 **Tips Hidup Berguna:**\n\n1. 🧊 **Ice Cube Trick** — Taruh es batu di atas nasi di microwave. Nasi jadi lembut lagi!\n2. 📱 **Airplane Mode** — Charge HP dalam mode pesawat, bisa 2x lebih cepat!\n3. 🧠 **20-20-20 Rule** — Setiap 20 menit menatap layar, lihat sesuatu 20 kaki jauhnya selama 20 detik.\n4. 😴 **Coffee Nap** — Minum kopi lalu tidur 20 menit. Bangun pas kafeinnya mulai kerja!\n5. 📝 **2-Minute Rule** — Kalau tugas bisa selesai dalam 2 menit, kerjakan sekarang juga!',
  ],
  default: [
    'Hmm, aku lagi offline nih jadi terbatas! 😅 Tapi coba tanya aku tentang cerita, jokes, fakta, atau puisi — aku punya banyak koleksi! 📚',
    'Wah, topik menarik! Sayangnya aku lagi offline mode. 😊 Coba klik salah satu tombol di atas untuk ngobrol seru! 🎯',
    'Aku mengerti! Meskipun offline, aku tetap bisa cerita, bercanda, atau kasih fakta menarik. Mau coba yang mana? 🤔',
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function offlineReply(msg) {
  const lower = msg.toLowerCase();
  
  if (/^(hai|halo|hello|hi|hey|yo|apa kabar|assalam|selamat)/.test(lower)) {
    return pickRandom(offlineResponses.greetings);
  }
  if (/cerita|dongeng|story|kisah/.test(lower)) {
    return pickRandom(offlineResponses.stories);
  }
  if (/joke|lucu|ketawa|humor|bercanda|jokes/.test(lower)) {
    return pickRandom(offlineResponses.jokes);
  }
  if (/fakta|fact|menarik|random|unik/.test(lower)) {
    return pickRandom(offlineResponses.facts);
  }
  if (/puisi|poem|sajak|pantun/.test(lower)) {
    return pickRandom(offlineResponses.poems);
  }
  if (/tebak|quiz|trivia|kuis/.test(lower)) {
    return pickRandom(offlineResponses.trivia);
  }
  if (/lagu|musik|music|song|rekomendasikan/.test(lower)) {
    return pickRandom(offlineResponses.music);
  }
  if (/horor|horror|seram|hantu|takut/.test(lower)) {
    return pickRandom(offlineResponses.horror);
  }
  if (/tips|saran|advice|berguna|helpful/.test(lower)) {
    return pickRandom(offlineResponses.tips);
  }
  if (/siapa kamu|kamu siapa|nama kamu|who are you/.test(lower)) {
    return 'Aku adalah AI Chat assistant di pdlgtg! 🤖 Aku bisa bercerita, bercanda, kasih fakta menarik, dan menemani kamu ngobrol. Meskipun sedang offline, aku tetap seru kok! ✨';
  }
  if (/terima kasih|makasih|thanks|thank you/.test(lower)) {
    return 'Sama-sama! 😊 Senang bisa membantu! Kalau butuh apa-apa lagi, langsung aja bilang ya! 💜';
  }
  
  return pickRandom(offlineResponses.default);
}

// ── Status Management ──────────────────────────────────────────────────────
function setStatus(state, label) {
  statusDot.className = '';
  if (state === 'online') {
    statusDot.classList.add(''); // green by default
  } else if (state === 'offline') {
    statusDot.classList.add('offline');
  } else {
    statusDot.classList.add('error');
  }
  modelLabel.textContent = label;
}

// ── Main Send Logic ────────────────────────────────────────────────────────
let sending = false;

async function sendMessage(text) {
  if (!text.trim() || sending) return;
  sending = true;
  sendBtn.disabled = true;

  const userMsg = text.trim();
  inputEl.value = '';
  addMessage(userMsg, 'user');
  
  history.push({ role: 'user', content: userMsg });
  if (history.length > MAX_HISTORY * 2) {
    history = history.slice(-MAX_HISTORY);
  }

  showTyping();

  let reply = null;

  // Tier 1: Pollinations
  reply = await askPollinations(userMsg);

  // Tier 2: Puter.js
  if (!reply) {
    reply = await askPuter(userMsg);
  }

  // Tier 3: Offline fallback
  if (!reply) {
    setStatus('offline', 'Offline Mode');
    // Simulate thinking delay for natural feel
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
    reply = offlineReply(userMsg);
  }

  hideTyping();
  addMessage(reply, 'ai');
  
  history.push({ role: 'assistant', content: reply });

  sending = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

// ── Event Handlers ─────────────────────────────────────────────────────────
sendBtn.addEventListener('click', () => sendMessage(inputEl.value));

inputEl.addEventListener('input', () => {
  sendBtn.disabled = !inputEl.value.trim() || sending;
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(inputEl.value);
  }
});

// Quick action buttons
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const msg = btn.dataset.msg;
    if (msg) sendMessage(msg);
  });
});

// ── Initialization ─────────────────────────────────────────────────────────
async function init() {
  setStatus('offline', 'Initializing...');
  
  // Test connectivity
  try {
    const test = await fetch('https://text.pollinations.ai/', { 
      method: 'HEAD', 
      signal: AbortSignal.timeout(5000) 
    });
    if (test.ok) {
      setStatus('online', 'Pollinations AI');
    } else {
      throw new Error('not ok');
    }
  } catch {
    // Try puter
    if (await loadPuter()) {
      setStatus('online', 'Puter AI');
    } else {
      setStatus('offline', 'Offline Mode');
    }
  }

  sendBtn.disabled = false;
  inputEl.focus();
  
  // Warm greeting
  setTimeout(() => {
    addMessage('Halo! 👋 Aku AI asisten di pdlgtg. Mau ngobrol, cerita, jokes, atau apa aja — langsung aja ketik! Atau klik salah satu tombol di atas buat mulai 🎯', 'ai');
  }, 500);
}

init();
