import React from 'react';

export function LaunchOverlay({ launchingGame }) {
  if (!launchingGame) return null;

  return (
    <div className="launch-overlay">
      <div className="launch-box">
        <div className="launch-emoji">{launchingGame.emoji || '🎮'}</div>
        <h2 className="launch-title">{launchingGame.title}</h2>
        <div className="launch-tagline">{launchingGame.tagline}</div>
        <div className="launch-spinner">
          <div className="spinner-bar"></div>
        </div>
        <p className="launch-note">Memuat Game...</p>
      </div>
    </div>
  );
}
