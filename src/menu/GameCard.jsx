import React from 'react';
import { sounds } from './audio';

export function GameCard({ game, onLaunch }) {
  const themeColor = game.themeColor || '#00d2ff';

  return (
    <div
      className="game-card"
      style={{ '--card-accent': themeColor }}
      onMouseEnter={() => sounds.playHover()}
      onClick={() => onLaunch(game)}
    >
      <div className="card-glow" />
      <div className="card-top">
        <div className="card-emoji-wrap">
          <span className="card-emoji">{game.emoji || '🎮'}</span>
        </div>
        <div className="card-category-badge">{game.category || 'Arcade'}</div>
      </div>

      <div className="card-body">
        <h3 className="card-title">{game.title}</h3>
        <p className="card-tagline">{game.tagline}</p>
      </div>

      <div className="card-footer">
        <div className="card-tags">
          <span className="mini-badge">📱 Mobile</span>
          {game.players > 1 && <span className="mini-badge multi">👥 {game.players}P</span>}
        </div>
        <button
          className="card-play-btn"
          onClick={(e) => {
            e.stopPropagation();
            onLaunch(game);
          }}
        >
          Play <span>▶</span>
        </button>
      </div>
    </div>
  );
}
