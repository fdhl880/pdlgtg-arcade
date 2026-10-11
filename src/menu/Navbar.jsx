import React, { useState, useEffect } from 'react';
import { sounds } from './audio';

export function Navbar({
  isRemoteConnected,
  onOpenPairing,
  onOpenAI,
  soundEnabled,
  onToggleSound,
}) {
  const [time, setTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    sounds.playSelect();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="arcade-navbar">
      <div className="nav-brand">
        <div className="brand-logo-icon">🕹️</div>
        <div>
          <span className="brand-title">PDLGTG <span className="brand-highlight">ARCADE</span></span>
          <span className="brand-badge">NEXT-GEN HUB</span>
        </div>
      </div>

      <div className="nav-center-status">
        <button
          className={`connection-pill ${isRemoteConnected ? 'online' : 'standby'}`}
          onClick={onOpenPairing}
          title="Klik untuk menghubungkan remote HP"
        >
          <span className="status-dot"></span>
          <span className="status-text">
            {isRemoteConnected ? 'HP Controller Aktif' : 'Sambungkan HP Remote'}
          </span>
          <span className="qr-mini-icon">📲</span>
        </button>
      </div>

      <div className="nav-actions">
        <button
          className="nav-btn ai-btn"
          onClick={() => {
            sounds.playSelect();
            onOpenAI();
          }}
          title="Buka Teman AI"
        >
          <span>🤖</span> <span className="btn-label">AI Buddy</span>
        </button>

        <button
          className="nav-btn icon-only"
          onClick={onToggleSound}
          title={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>

        <button
          className="nav-btn icon-only"
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? '🗗' : '⛶'}
        </button>

        <div className="nav-clock">{time}</div>
      </div>
    </header>
  );
}
