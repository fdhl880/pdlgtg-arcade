'use strict';

const QRCode = require('qrcode');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'pdlgtg.vercel.app';
    const effectiveUrl = `${proto}://${host}/controller`;
    const qr = await QRCode.toDataURL(effectiveUrl, {
      margin: 1,
      width: 320,
      color: { dark: '#0b0e14', light: '#ffffff' },
    });
    res.end(JSON.stringify({ url: effectiveUrl, qr, httpUrl: effectiveUrl }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
};
