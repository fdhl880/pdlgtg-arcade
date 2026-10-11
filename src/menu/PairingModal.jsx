import React, { useState } from 'react';
import { sounds } from './audio';

export function PairingModal({ isOpen, onClose, pairingData, isRemoteConnected }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyUrl = () => {
    sounds.playSelect();
    const url = pairingData?.url || window.location.origin + '/controller';
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">📱</span>
            <h2>Hubungkan HP Jadi Remote (Wii Motion)</h2>
          </div>
          <button className="modal-close" onClick={() => { sounds.playBack(); onClose(); }}>✕</button>
        </div>

        <div className="modal-body">
          <div className="qr-container">
            {pairingData?.qr ? (
              <img src={pairingData.qr} alt="Scan to pair remote" className="qr-image" />
            ) : (
              <div className="qr-placeholder">Generating QR Code...</div>
            )}
            <div className={`status-pill ${isRemoteConnected ? 'connected' : 'waiting'}`}>
              <span className="dot"></span>
              {isRemoteConnected ? 'HP Terhubung (Player 1 Active)' : 'Menunggu Koneksi Remote...'}
            </div>
          </div>

          <div className="instructions-panel">
            <h3>Langkah Mudah:</h3>
            <ol>
              <li>Buka kamera atau pemindai QR di HP Anda, lalu arahkan ke kode QR.</li>
              <li>Ketuk tautan yang muncul untuk membuka kontroler.</li>
              <li>Pegang HP mendatar / menyamping (horizontal). Gerakan tangan Anda sekarang jadi sensor motion kontroler!</li>
            </ol>

            <div className="url-copy-box">
              <input
                type="text"
                readOnly
                value={pairingData?.url || ''}
                className="url-input"
              />
              <button onClick={copyUrl} className="copy-btn">
                {copied ? '✓ Tersalin!' : 'Salin URL'}
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <p className="footer-note">💡 Tip: Anda juga bisa langsung bermain dengan Keyboard PC atau Touchscreen HP!</p>
          <button className="action-btn" onClick={() => { sounds.playSelect(); onClose(); }}>Selesai</button>
        </div>
      </div>
    </div>
  );
}
