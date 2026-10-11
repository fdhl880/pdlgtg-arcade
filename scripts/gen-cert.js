'use strict';

/**
 * Self-signed cert generator.
 *
 * Why this exists: DeviceOrientationEvent.requestPermission() only resolves in a
 * secure context. `http://192.168.x.x` is NOT a secure context, so a plain-HTTP
 * LAN server can never read the phone's IMU. HTTPS with a self-signed cert is —
 * you just have to click through the browser warning once on the phone.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { X509Certificate } = require('crypto');

const CERT_DIR = path.join(__dirname, '..', 'certs');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CRT_PATH = path.join(CERT_DIR, 'cert.pem');

/** Every non-internal IPv4 address, so the cert covers whichever LAN IP is live. */
function localAddresses() {
  const out = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

/** Does the existing cert still cover every address we're about to serve on? */
function certCoversCurrentIps(quiet) {
  try {
    let text = '';
    try {
      const crtContent = fs.readFileSync(CRT_PATH);
      const cert = new X509Certificate(crtContent);
      text = cert.subjectAltName || '';
    } catch {
      text = execFileSync('openssl', ['x509', '-in', CRT_PATH, '-noout', '-ext', 'subjectAltName'], {
        encoding: 'utf8',
      });
    }
    const missing = localAddresses().filter((ip) => !text.includes(ip));
    if (missing.length && !quiet) {
      console.log(`[cert] regenerating — cert predates current address ${missing.join(', ')}`);
    }
    return missing.length === 0;
  } catch {
    return false;
  }
}

function generateCertPureJs(ips, quiet) {
  try {
    const script = `
      const selfsigned = require('selfsigned');
      const fs = require('fs');
      (async () => {
        const ips = ${JSON.stringify(ips)};
        const altNames = [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          ...ips.map(ip => ({ type: 7, ip }))
        ];
        const pems = await selfsigned.generate([{ name: 'commonName', value: 'pdlgtg.local' }], {
          days: 825,
          keySize: 2048,
          algorithm: 'sha256',
          extensions: [{ name: 'subjectAltName', altNames }]
        });
        fs.writeFileSync(${JSON.stringify(KEY_PATH)}, pems.private);
        fs.writeFileSync(${JSON.stringify(CRT_PATH)}, pems.cert);
      })();
    `;
    execFileSync(process.execPath, ['-e', script], { stdio: quiet ? 'ignore' : 'inherit' });
    return true;
  } catch (err) {
    if (!quiet) console.error('[cert] pure-JS fallback error:', err.message);
    return false;
  }
}

function ensureCert({ quiet = false } = {}) {
  // A cert pinned to an old DHCP lease still loads, but the phone then hits a
  // NAME_INVALID error that looks nothing like "self-signed" — so check the
  // SANs rather than just the file's existence.
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CRT_PATH) && certCoversCurrentIps(quiet)) {
    return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CRT_PATH) };
  }

  fs.mkdirSync(CERT_DIR, { recursive: true });

  const ips = localAddresses();
  const altNames = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)].join(',');
  let generated = false;

  try {
    execFileSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', KEY_PATH,
        '-out', CRT_PATH,
        '-days', '825',
        '-subj', '/CN=pdlgtg.local',
        '-addext', `subjectAltName=${altNames}`,
      ],
      { stdio: 'ignore' }
    );
    generated = true;
  } catch (err) {
    // Fallback to pure JS certificate generator using selfsigned
    generated = generateCertPureJs(ips, quiet);
  }

  if (!generated || !fs.existsSync(KEY_PATH) || !fs.existsSync(CRT_PATH)) {
    if (!quiet) {
      console.error('[cert] could not generate certificate — falling back to plain HTTP.');
    }
    return null;
  }

  if (!quiet) console.log(`[cert] generated self-signed cert for ${altNames}`);
  return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CRT_PATH) };
}

module.exports = { ensureCert, localAddresses, CERT_DIR };

if (require.main === module) ensureCert();
