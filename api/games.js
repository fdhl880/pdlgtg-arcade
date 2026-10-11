'use strict';

const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');

  const candidates = [
    path.join(__dirname, '..', 'public', 'games-manifest.json'),
    path.join(__dirname, '..', 'games', 'games-manifest.json'),
    path.join(process.cwd(), 'public', 'games-manifest.json'),
    path.join(process.cwd(), 'games', 'games-manifest.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p, 'utf8');
        return res.end(data);
      } catch {}
    }
  }

  try {
    const app = require('../server');
    return app(req, res);
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
};
