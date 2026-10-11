import React from 'react';
import { sounds } from './audio';

export function HeroBanner({ featuredGame, onLaunch }) {
  if (!featuredGame) return null;

  return (
    <div className="hero-banner" onClick={() => onLaunch(featuredGame)}>
      <div className="hero-backdrop-glow" />
      <div className="hero-content">
        <div className="hero-badge">⭐ FEATURED HIGHLIGHT · 150cc</div>
        <h1 className="hero-title">
          <span>🏎️</span> {featuredGame.title}
        </h1>
        <p className="hero-description">
          {featuredGame.tagline || 'Rasakan sensasi balapan 3D penuh aksi di Mushroom Stadium! Drift, lempar shell, dan pacu kecepatan maksimal di layar HP atau PC Anda.'}
        </p>

        <div className="hero-features">
          <span className="hero-chip">✨ Full 3D Stadium</span>
          <span className="hero-chip">⚡ Mini-Turbo Drift</span>
          <span className="hero-chip">📱 On-Screen Touch & Gyro</span>
          <span className="hero-chip">🎮 Remote Motion</span>
        </div>

        <div className="hero-actions">
          <button
            className="hero-play-btn"
            onClick={(e) => {
              e.stopPropagation();
              onLaunch(featuredGame);
            }}
          >
            Mulai Balapan Sekarang <span>🚀</span>
          </button>
        </div>
      </div>

      <div className="hero-visual">
        <div className="hero-badge-circle">
          <span className="big-emoji">🏎️</span>
          <div className="pulse-ring"></div>
        </div>
      </div>
    </div>
  );
}
