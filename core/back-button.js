/**
 * pdlgtg Universal Back Button
 * Provides a consistent, accessible, high-contrast floating "Back to Menu"
 * button across all games for both Mobile and Desktop devices.
 */
(() => {
  if (document.getElementById('pdlgtg-universal-back-btn')) return;

  // Insert styles
  const style = document.createElement('style');
  style.id = 'pdlgtg-universal-back-style';
  style.textContent = `
    #pdlgtg-universal-back-btn {
      position: fixed;
      top: max(12px, env(safe-area-inset-top, 12px));
      left: max(12px, env(safe-area-inset-left, 12px));
      z-index: 9999999;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 16px;
      background: rgba(15, 23, 42, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Outfit", sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-decoration: none;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.06);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
                  background 0.2s ease,
                  box-shadow 0.2s ease;
      touch-action: manipulation;
    }
    #pdlgtg-universal-back-btn:hover {
      transform: scale(1.06);
      background: rgba(30, 41, 59, 0.95);
      border-color: rgba(56, 189, 248, 0.6);
      box-shadow: 0 6px 26px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.45);
      color: #38bdf8;
    }
    #pdlgtg-universal-back-btn:active {
      transform: scale(0.96);
      background: rgba(15, 23, 42, 0.98);
    }
    #pdlgtg-universal-back-btn svg {
      width: 15px;
      height: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }
    #pdlgtg-universal-back-btn span.label {
      line-height: 1;
      display: inline-block;
    }
    @media (max-width: 600px) {
      #pdlgtg-universal-back-btn {
        padding: 8px 13px;
        font-size: 12px;
        gap: 5px;
      }
      #pdlgtg-universal-back-btn svg {
        width: 14px;
        height: 14px;
      }
    }
  `;
  document.head.appendChild(style);

  // Play a quick pleasant Web Audio beep on back
  function playBackChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch { /* ignore */ }
  }

  // Create back button
  const btn = document.createElement('a');
  btn.id = 'pdlgtg-universal-back-btn';
  btn.href = '/';
  btn.setAttribute('aria-label', 'Return to Main Menu');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" />
    </svg>
    <span class="label">Menu</span>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    playBackChime();
    if (navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => {
      window.location.href = '/';
    }, 80);
  });

  // Attach when DOM is ready
  if (document.body) {
    document.body.appendChild(btn);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(btn));
  }

  // Keyboard shortcut: Escape or Backspace (if not in input)
  window.addEventListener('keydown', (e) => {
    if (e.target && ['input', 'textarea', 'select'].includes(e.target.tagName?.toLowerCase())) return;
    if (e.key === 'Escape' && !document.querySelector('.pause-menu:not([hidden]), #pause:not([hidden])')) {
      // If no local pause modal is open, return home
      playBackChime();
      setTimeout(() => { window.location.href = '/'; }, 100);
    }
  });
})();
