import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './Navbar';
import { HeroBanner } from './HeroBanner';
import { GameCard } from './GameCard';
import { PairingModal } from './PairingModal';
import { AIChatDrawer } from './AIChatDrawer';
import { LaunchOverlay } from './LaunchOverlay';
import { sounds } from './audio';

const CATEGORIES = [
  { id: 'all', label: 'Semua Game', emoji: '🌟' },
  { id: 'Racing', label: 'Balapan', emoji: '🏎️' },
  { id: 'Action', label: 'Aksi & Tarung', emoji: '🍉' },
  { id: 'Sports', label: 'Olahraga', emoji: '🏓' },
  { id: 'Casual', label: 'Santai', emoji: '✈️' },
  { id: 'Creative', label: 'Kreatif', emoji: '🎨' },
  { id: 'AI', label: 'AI Companion', emoji: '🤖' },
];

export function App() {
  const [games, setGames] = useState([]);
  const [pairingData, setPairingData] = useState(null);
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [launchingGame, setLaunchingGame] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Fetch games & pairing data (with CDN manifest fallback)
  useEffect(() => {
    fetch('/api/games')
      .then((r) => {
        if (!r.ok) throw new Error('API failed');
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setGames(data);
        else throw new Error('Empty data');
      })
      .catch(() => {
        fetch('/games-manifest.json')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) setGames(data);
          })
          .catch((err) => console.error('Error fetching games manifest:', err));
      });

    fetch('/api/pairing')
      .then((r) => {
        if (!r.ok) throw new Error('Pairing API failed');
        return r.json();
      })
      .then((data) => setPairingData(data))
      .catch(() => {
        const hostUrl = window.location.origin + '/controller';
        setPairingData({ url: hostUrl, httpUrl: hostUrl });
      });
  }, []);

  // Connect to Socket.IO for remote presence detection
  useEffect(() => {
    if (typeof window.io !== 'undefined') {
      try {
        const socket = window.io();
        socket.on('presence', (data) => {
          setIsRemoteConnected(!!data?.controller);
        });
        return () => socket.disconnect();
      } catch (err) {
        console.warn('Socket.io error:', err);
      }
    }
  }, []);

  // Filtered games
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchCat =
        activeCategory === 'all' ||
        (game.category && game.category.toLowerCase() === activeCategory.toLowerCase());
      const matchSearch =
        !searchQuery ||
        game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (game.tagline && game.tagline.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [games, activeCategory, searchQuery]);

  const featuredGame = useMemo(() => {
    return games.find((g) => g.slug === 'mario-kart') || games[0];
  }, [games]);

  const handleLaunch = (game) => {
    sounds.playLaunch();
    setLaunchingGame(game);
    setTimeout(() => {
      window.location.href = game.url;
    }, 700);
  };

  const toggleSound = () => {
    const next = sounds.toggle();
    setSoundEnabled(next);
  };

  return (
    <div className="arcade-app-container">
      <Navbar
        isRemoteConnected={isRemoteConnected}
        onOpenPairing={() => {
          sounds.playSelect();
          setIsPairingOpen(true);
        }}
        onOpenAI={() => {
          sounds.playSelect();
          setIsAIOpen(true);
        }}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      <main className="arcade-main-content">
        {/* Hero Highlight */}
        <HeroBanner featuredGame={featuredGame} onLaunch={handleLaunch} />

        {/* Filter & Search Bar */}
        <section className="arcade-filter-section">
          <div className="category-scroll-container">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  sounds.playTab();
                  setActiveCategory(cat.id);
                }}
              >
                <span className="cat-emoji">{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="search-bar-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Cari game..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {/* Games Grid */}
        <section className="arcade-grid-section">
          <div className="grid-header">
            <h2 className="section-title">
              Daftar Permainan <span className="game-count">({filteredGames.length})</span>
            </h2>
            <p className="section-sub">
              Dapat dimainkan dengan HP Remote, Layar Sentuh Mobile, ataupun Keyboard PC.
            </p>
          </div>

          {filteredGames.length > 0 ? (
            <div className="games-grid">
              {filteredGames.map((game) => (
                <GameCard key={game.slug} game={game} onLaunch={handleLaunch} />
              ))}
            </div>
          ) : (
            <div className="no-games-found">
              <span className="no-games-icon">👾</span>
              <p>Tidak ada game yang cocok dengan pencarian.</p>
              <button
                className="reset-filter-btn"
                onClick={() => {
                  setActiveCategory('all');
                  setSearchQuery('');
                }}
              >
                Reset Filter
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="arcade-footer">
        <div className="footer-content">
          <p>© 2026 pdlgtg Arcade Hub · Mobile & Motion Ready · 100% Offline</p>
          <div className="footer-links">
            <button onClick={() => setIsPairingOpen(true)}>📲 Hubungkan Remote HP</button>
            <button onClick={() => setIsAIOpen(true)}>🤖 Tanya AI Bot</button>
          </div>
        </div>
      </footer>

      {/* Modals & Overlays */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        pairingData={pairingData}
        isRemoteConnected={isRemoteConnected}
      />

      <AIChatDrawer isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />

      <LaunchOverlay launchingGame={launchingGame} />
    </div>
  );
}
