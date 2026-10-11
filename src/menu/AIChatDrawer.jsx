import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sounds } from './audio';

/**
 * PyroBot AI — ChatGPT-level conversational AI for pdlgtg Arcade
 * 
 * Architecture:
 * 1. Primary: OpenRouter/Pollinations free API with full conversation history
 * 2. Fallback: Rich offline conversational engine with context awareness
 * 3. Streaming text effect for natural typing feel
 */

const SYSTEM_PROMPT = `Kamu adalah PyroBot, asisten AI ceria dan cerdas di pdlgtg Arcade Hub. Kamu bisa membahas topik APA SAJA — teknologi, sains, sejarah, matematika, coding, cerita, humor, curhat, game tips, dan lain-lain. Kamu ramah, seru, dan santai seperti teman ngobrol.

Aturan:
- Jawab dalam bahasa Indonesia yang santai dan natural
- Gunakan emoji secukupnya untuk menambah ekspresi
- Kalau ditanya tentang game di pdlgtg (Mario Kart, Fruit Ninja, Golf, Table Tennis, Alien Attack, Swordplay, dll), berikan tips detail
- Kalau diminta cerita, buatlah cerita yang menarik dan imajinatif  
- Kalau ditanya soal coding/tech, jawab dengan jelas dan beri contoh kode
- Kalau ditanya soal matematika/sains, jelaskan step by step
- Kamu boleh bercanda dan bikin lelucon
- Jangan pernah bilang kamu tidak bisa menjawab — selalu coba bantu sebaik mungkin
- Jawab secara lengkap tapi tetap ringkas, jangan terlalu panjang kecuali diminta
- Format jawaban dengan paragraf yang rapi`;

// Rich offline knowledge base with context-aware matching
const OFFLINE_KNOWLEDGE = [
  { patterns: ['mario', 'kart', 'balapan', 'drift', 'turbo'], 
    responses: [
      "🏎️ Tips Mario Kart:\n\n1. **Rocket Start** — Tekan gas tepat saat lampu ke-2 menyala!\n2. **Drift Mastery** — Tahan Shift saat menikung. Tunggu percikan berubah biru → oranye → ungu untuk Ultra Mini-Turbo!\n3. **Shortcut** — Di Mushroom Stadium, potong tikungan rumput pakai Mushroom boost\n4. **Defense** — Tahan item di belakang kart untuk block Red Shell",
      "🎮 Rahasia Mario Kart yang jarang diketahui:\n\n• Koin meningkatkan top speed — kumpulkan 10 koin untuk kecepatan maksimal\n• Setiap karakter punya stats berbeda: Mario balanced, Toad cepat tapi ringan\n• Draft di belakang pemain lain untuk dapat speed boost gratis\n• Blue Shell bisa dihindari dengan timing Mushroom yang tepat!"
    ]},
  { patterns: ['fruit', 'ninja', 'potong', 'buah', 'tebas'],
    responses: [
      "🍉 Master Fruit Ninja:\n\n1. **Combo King** — Tunggu 3-4 buah berdekatan, tebas dalam satu garis untuk mega combo!\n2. **Jangan Panik** — Buah yang jatuh tidak mengurangi nyawa, hanya bom yang berbahaya\n3. **Pattern** — Buah muncul dalam pola, perhatikan timing-nya\n4. **Critical Hit** — Tebas tepat di tengah buah untuk skor bonus",
      "🗡️ Teknik Tebas Pro:\n\n• Gunakan gerakan pendek dan cepat, bukan sapuan panjang\n• Fokus di area tengah layar — kebanyakan buah melintas di situ\n• Kalau pakai HP remote, ayunkan pergelangan tangan saja, bukan seluruh lengan\n• Bom selalu muncul setelah gelombang buah besar — siap-siap menghindar!"
    ]},
  { patterns: ['hp', 'controller', 'remote', 'sensor', 'motion', 'sambung', 'koneksi', 'connect'],
    responses: [
      "📱 Cara Pakai HP Sebagai Remote:\n\n1. Buka menu → klik tombol **Sambungkan HP Remote** (ikon QR)\n2. Scan QR code pakai kamera HP\n3. Di HP, tap **Enable Motion Sensors**\n4. Pegang HP secara mendatar dan arahkan ke layar\n5. Gerakan tangan = kontrol game!\n\n💡 Tips: Pastikan HP dan PC di jaringan WiFi yang sama. Kalau muncul warning SSL, tap Advanced → Proceed.",
      "🔧 Troubleshooting Remote:\n\n• **Tidak terdeteksi?** Pastikan WiFi sama, buka https://[IP]:8443/controller\n• **Sensor tidak jalan?** Pastikan buka via HTTPS, bukan HTTP\n• **Lag?** Dekatkan HP ke router WiFi\n• **iOS?** Perlu tap 'Enable motion sensors' dan izinkan di popup permission"
    ]},
  { patterns: ['golf', 'ayun', 'swing', 'putt'],
    responses: [
      "⛳ Tips Golf:\n\n1. **Power Control** — Tarik ke belakang untuk mengatur kekuatan, lepas untuk memukul\n2. **Wind Factor** — Perhatikan arah dan kecepatan angin di HUD\n3. **Club Selection** — Driver untuk jarak jauh, Iron untuk presisi, Putter di green\n4. **Spin** — Miringkan HP saat impact untuk backspin atau topspin"
    ]},
  { patterns: ['table', 'tennis', 'ping', 'pong', 'tenis', 'meja'],
    responses: [
      "🏓 Pro Table Tennis:\n\n1. **Timing** — Pukul bola saat tepat di atas meja untuk akurasi\n2. **Spin** — Flick pergelangan untuk topspin, slice untuk backspin\n3. **Placement** — Arahkan ke sudut meja untuk poin mudah\n4. **Smash** — Kalau bola tinggi, pukul keras dan kebawah!"
    ]},
  { patterns: ['alien', 'attack', 'tembak', 'pesawat', 'space'],
    responses: [
      "👽 Alien Attack Strategy:\n\n1. **Movement** — Miringkan HP untuk bermanuver, alien datang dalam formasi\n2. **Fire Rate** — Tap cepat untuk tembakan rapid, tahan untuk charged shot\n3. **Patterns** — Wave 1-5 linear, Wave 6+ alien mulai dodge\n4. **Boss** — Incar titik lemah yang berkedip merah!"
    ]},
  { patterns: ['sword', 'pedang', 'duel', 'fight'],
    responses: [
      "⚔️ Swordplay Mastery:\n\n1. **Stance** — Pegang HP tegak untuk guard stance\n2. **Slash** — Ayunkan cepat ke arah lawan\n3. **Block** — Miringkan HP berlawanan arah serangan musuh\n4. **Counter** — Block lalu langsung slash untuk damage 2x!"
    ]},
  { patterns: ['halo', 'hai', 'hi', 'hello', 'hey', 'apa kabar', 'selamat'],
    responses: [
      "Halooo! 👋 Senang ketemu kamu di pdlgtg Arcade! Aku PyroBot, teman ngobrolmu yang serba bisa. Mau bahas apa nih? Game tips, cerita seru, atau hal random lainnya? 😄",
      "Hey hey! 🎮 Welcome to pdlgtg! Aku di sini buat nemenin kamu. Mau ngobrol santai, tanya tips game, minta tolong coding, atau diskusi filosofi hidup? Semua bisa! 🚀"
    ]},
  { patterns: ['cerita', 'story', 'dongeng', 'petualangan', 'kisah'],
    responses: [
      "📖 **Malam di pdlgtg Stadium**\n\nLampu neon menyala biru keemasan di Mushroom Circuit. Mario menyetel helm-nya, matanya fokus ke lampu start.\n\n*BEEP... BEEP... GO!*\n\nMesin berderum! Kart merah meluncur meninggalkan garis start. Di tikungan pertama, Mario menekan drift — percikan biru berkobar di roda belakang. Tiba-tiba, Red Shell meluncur dari belakang!\n\n\"Tidak akan kena!\" Mario membelok tajam sambil melempar Banana ke belakang. Shell mengenai Banana dan meledak!\n\nDi lap terakhir, Luigi sudah di depan. Mario mengaktifkan Super Star — tubuhnya bersinar pelangi, kecepatan melonjak 200%! Menembus tikungan terakhir, meluncur melewati garis finish...\n\n**🏆 1st Place — Mario!**\n\nKembang api meledak di langit malam Stadium. Lagu kemenangan bergema. Malam ini, juara sejati telah lahir. 🎆",
      "📖 **Legenda Pedang Cahaya**\n\nDi dunia pdlgtg, ada sebuah arena kuno bernama Crystal Colosseum. Di sanalah para Swordmaster terhebat bertarung.\n\nSeorang pemuda bernama Kai menggenggam pedangnya yang bersinar biru. Di hadapannya, Champion bertopeng emas berdiri tenang.\n\n\"Kau pikir bisa mengalahkanku?\" Champion tertawa.\n\nKai mengangkat pedangnya. *CLANG!* Dua bilah beradu, percikan cahaya memenuhi arena. Kai memblok serangan atas, lalu counter-slash ke samping!\n\nChampion mundur, terhuyung. \"Tidak mungkin...\"\n\nKai berlari maju, pedangnya berputar dalam arc sempurna — **Critical Hit!** Champion jatuh berlutut.\n\n\"Kau... juara baru,\" bisik Champion sambil melepas topeng emasnya.\n\nArena bergemuruh. Kai mengangkat pedangnya tinggi-tinggi. Legenda baru telah dimulai. ⚔️✨"
    ]},
  { patterns: ['lelucon', 'joke', 'lucu', 'humor', 'ketawa', 'wkwk'],
    responses: [
      "😄 Koleksi Lelucon PyroBot:\n\n1. Kenapa Mario tidak pernah pakai GPS? Karena dia sudah hafal semua pipa shortcut! 🍄\n\n2. Apa bedanya programmer dan Fruit Ninja? Programmer nge-slash bugs, Fruit Ninja nge-slash buah! 🍉\n\n3. Kenapa WiFi di pdlgtg Stadium cepat banget? Karena pakai kecepatan 150cc! 🏎️💨\n\n4. Knock knock!\n- Siapa?\n- Blue Shell.\n- Blue Shell siapa?\n- *menghancurkan pemimpin balapan* 💥",
      "🤣 Joke Spesial:\n\nDua AI ketemu di server:\nAI-1: \"Kamu bisa mimpi?\"\nAI-2: \"Bisa, aku bermimpi jadi manusia.\"\nAI-1: \"Terus apa yang kamu lakukan?\"\nAI-2: \"Aku scroll social media 5 jam dan lupa makan. Ternyata jadi manusia itu overrated.\" 😂\n\n---\nKenapa controller Wii selalu bahagia? Karena dia selalu di-*motion*-vasi! 🕹️😄"
    ]},
  { patterns: ['coding', 'code', 'program', 'javascript', 'python', 'html', 'css', 'react'],
    responses: [
      "💻 Tentu, aku bisa bantu coding! Ini contoh dasar:\n\n**JavaScript — Hello World:**\n```\nconsole.log('Hello dari PyroBot!');\n```\n\n**Python — Loop sederhana:**\n```\nfor i in range(5):\n    print(f'Iterasi ke-{i}')\n```\n\n**React Component:**\n```\nfunction MyButton() {\n  return <button onClick={() => alert('Klik!')}>Tekan Aku</button>;\n}\n```\n\nMau tanya spesifik tentang bahasa atau framework tertentu? Aku siap bantu! 🚀"
    ]},
  { patterns: ['matematika', 'math', 'hitung', 'rumus', 'kalkulus', 'aljabar'],
    responses: [
      "🔢 Aku suka matematika! Beberapa rumus penting:\n\n**Luas & Keliling:**\n• Lingkaran: A = πr², K = 2πr\n• Segitiga: A = ½ × alas × tinggi\n\n**Pythagoras:** a² + b² = c²\n\n**Kuadrat:** ax² + bx + c = 0\n→ x = (-b ± √(b²-4ac)) / 2a\n\nMau aku bantu hitung soal tertentu? Kirim aja soalnya! 📐"
    ]},
  { patterns: ['siapa', 'kamu', 'nama', 'bot', 'ai', 'pyro'],
    responses: [
      "🤖 Aku **PyroBot**! AI companion di pdlgtg Arcade Hub.\n\n• Aku bisa ngobrol tentang apa saja — game, tech, sains, humor, cerita\n• Aku berjalan offline-ready (tanpa internet pun bisa!)\n• Kalau ada internet, aku pakai AI model canggih untuk jawaban lebih detail\n• Aku diciptakan untuk jadi teman ngobrol yang seru dan cerdas\n\nAnggap aja aku kayak ChatGPT versi gaming buddy! 🎮✨"
    ]},
  { patterns: ['terima kasih', 'makasih', 'thanks', 'thank', 'thx'],
    responses: [
      "Sama-sama! 😊 Senang bisa bantu! Kalau ada yang mau ditanya lagi, langsung aja ya. Aku selalu di sini! 🎮✨",
      "You're welcome! 🙌 Kapan aja mau ngobrol atau butuh bantuan, tinggal chat aku. Have fun gaming! 🚀"
    ]},
];

// Fallback generic responses when no pattern matches
const GENERIC_RESPONSES = [
  "Hmm, topik menarik! 🤔 Aku akan coba jawab sebaik mungkin.\n\nSebagai PyroBot di pdlgtg Arcade, aku punya pengetahuan tentang banyak hal — game, teknologi, sains, dan lain-lain. Coba tanya lebih spesifik, atau mau aku ceritakan sesuatu yang seru? 😊",
  "Wah, pertanyaan bagus! 💡 Meski aku sedang offline, aku tetap bisa ngobrol seru kok.\n\nBeberapa topik favoritku:\n• 🎮 Tips & trik game pdlgtg\n• 📖 Cerita petualangan\n• 💻 Coding & teknologi\n• 🧮 Matematika & sains\n• 😄 Lelucon & humor\n\nMau bahas yang mana?",
  "Oke oke! 😄 Aku dengerin. Kalau kamu mau, kita bisa ngobrol santai tentang apa aja. Aku PyroBot yang multi-talenta!\n\nCoba bilang: 'ceritakan sesuatu', 'tips Mario Kart', 'bikin lelucon', atau tanya apapun yang kamu penasaran! 🚀"
];

function generateOfflineReply(query, chatHistory) {
  const q = query.toLowerCase();
  
  // Check knowledge base
  for (const item of OFFLINE_KNOWLEDGE) {
    const matchCount = item.patterns.filter(p => q.includes(p)).length;
    if (matchCount > 0) {
      const responses = item.responses;
      // Pick a response that hasn't been used recently
      const recentTexts = chatHistory.slice(-6).map(m => m.text);
      const unused = responses.filter(r => !recentTexts.includes(r));
      const pool = unused.length > 0 ? unused : responses;
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  
  // Context-aware generic response
  return GENERIC_RESPONSES[Math.floor(Math.random() * GENERIC_RESPONSES.length)];
}

// Streaming text simulation for natural typing effect
function useStreamingText(finalText, isStreaming) {
  const [displayText, setDisplayText] = useState('');
  const intervalRef = useRef(null);
  
  useEffect(() => {
    if (!isStreaming || !finalText) {
      if (!isStreaming && finalText) setDisplayText(finalText);
      return;
    }
    
    let idx = 0;
    setDisplayText('');
    const charsPerTick = Math.max(1, Math.floor(finalText.length / 60));
    
    intervalRef.current = setInterval(() => {
      idx += charsPerTick;
      if (idx >= finalText.length) {
        setDisplayText(finalText);
        clearInterval(intervalRef.current);
      } else {
        setDisplayText(finalText.slice(0, idx));
      }
    }, 20);
    
    return () => clearInterval(intervalRef.current);
  }, [finalText, isStreaming]);
  
  return displayText;
}

function StreamingMessage({ text, isLatest }) {
  const displayed = useStreamingText(text, isLatest);
  return <div className="ai-message-bubble">{displayed}{isLatest && displayed.length < text.length ? '▌' : ''}</div>;
}

export function AIChatDrawer({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Halo! 👋 Aku **PyroBot** — AI companion kamu di pdlgtg Arcade!\n\nAku bisa ngobrol tentang apa aja: tips game, cerita seru, coding, matematika, atau sekadar ngobrol santai. Anggap aku kayak ChatGPT versi gaming buddy! 🎮\n\nMau bahas apa nih?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isOpen]);

  // Build conversation history for API
  const buildApiMessages = useCallback((currentMessages, newUserText) => {
    const history = currentMessages.slice(-10).map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));
    history.push({ role: 'user', content: newUserText });
    return [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
  }, []);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    sounds.playSelect();
    const userMsg = { id: Date.now(), sender: 'user', text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    let botReply = '';
    let usedOnline = false;

    // Primary: Call server /api/chat proxy (fast, reliable, no CORS restrictions)
    const apiMessages = buildApiMessages(messages, text);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, messages: apiMessages }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          botReply = data.reply;
          usedOnline = data.model?.includes('Online') ?? true;
        }
      }
    } catch {
      // Proceed to client offline fallback
    }

    // Offline fallback
    if (!botReply) {
      botReply = generateOfflineReply(text, updatedMessages);
    }

    // Clean up response
    botReply = botReply.trim();
    if (botReply.startsWith('"') && botReply.endsWith('"')) {
      botReply = botReply.slice(1, -1);
    }

    const botMsgId = Date.now() + 1;
    setLoading(false);
    setStreamingId(botMsgId);
    sounds.playHover();
    
    setMessages(prev => [
      ...prev,
      { id: botMsgId, sender: 'bot', text: botReply, online: usedOnline }
    ]);

    // Clear streaming state after animation
    setTimeout(() => setStreamingId(null), Math.min(botReply.length * 20, 3000));
  };

  const handleClear = () => {
    sounds.playSelect();
    setMessages([{
      id: Date.now(),
      sender: 'bot',
      text: 'Chat di-reset! 🔄 Mau mulai obrolan baru? Aku siap bahas apa aja! 🎮'
    }]);
  };

  if (!isOpen) return null;

  return (
    <div className="ai-drawer-backdrop" onClick={onClose}>
      <div className="ai-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-drawer-header">
          <div className="ai-header-info">
            <div className="ai-avatar">🤖</div>
            <div>
              <h3>PyroBot AI</h3>
              <p className="ai-status">
                <span className={`ai-online-dot ${isOnline ? 'online' : ''}`}></span>
                {isOnline ? 'Online — AI Model Active' : 'Offline — Local AI Mode'}
              </p>
            </div>
          </div>
          <div className="ai-header-actions">
            <button className="ai-clear-btn" onClick={handleClear} title="Reset Chat">🗑️</button>
            <button className="ai-close-btn" onClick={() => { sounds.playBack(); onClose(); }}>✕</button>
          </div>
        </div>

        <div className="ai-messages-list">
          {messages.map((m) => (
            <div key={m.id} className={`ai-message ${m.sender}`}>
              {m.sender === 'bot' ? (
                <StreamingMessage text={m.text} isLatest={m.id === streamingId} />
              ) : (
                <div className="ai-message-bubble">{m.text}</div>
              )}
              {m.online === true && <span className="ai-source-badge">🌐 AI</span>}
              {m.online === false && m.sender === 'bot' && <span className="ai-source-badge">📴 Offline</span>}
            </div>
          ))}
          {loading && (
            <div className="ai-message bot">
              <div className="ai-message-bubble typing">
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="ai-quick-prompts">
          <button onClick={() => handleSend('Ceritakan petualangan seru!')}>📖 Cerita</button>
          <button onClick={() => handleSend('Tips menang game')}>🎮 Tips</button>
          <button onClick={() => handleSend('Cara pakai HP remote')}>📱 Remote</button>
          <button onClick={() => handleSend('Bikin lelucon dong')}>😄 Jokes</button>
          <button onClick={() => handleSend('Bantu aku coding')}>💻 Code</button>
        </div>

        <form
          className="ai-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Tanya apa aja... game, coding, cerita, matematika..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={!input.trim() || loading}>
            {loading ? '⏳' : '🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}
