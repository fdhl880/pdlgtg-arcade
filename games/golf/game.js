import * as THREE from '/vendor/three/three.module.js';
import { consumeLaunchSplash } from '../../core/splash.js';

// Carry the menu's launch banner across the navigation, then fade it out.
consumeLaunchSplash();
import { createChannel } from '../../core/channel.js';
import { SwingDetector } from '../../core/gesture.js';
import {
  Hole, HOLE, GREEN_RADIUS, terrainHeight, PAR, pickClub,
} from './logic.js';
import {
  buildGolfCourseAssets, createGolfClub, GolfAudio,
} from './assets.js';

/**
 * Golf — renderer. One par-4 hole with lush pine forests, bunkers, water hazard,
 * drifting clouds, animated 3D club, and rich Web Audio sound effects.
 */

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 120, 420);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xfff5d8, 1.6);
sun.position.set(40, 90, 30);
scene.add(sun);

// ── Terrain mesh from the logic's height function ──────────────────────────
const W = 170;
const L = 330;                     // z from +40 (behind tee) to −290
const SEG_X = 60;
const SEG_Z = 120;
const geo = new THREE.PlaneGeometry(W, L, SEG_X, SEG_Z);
geo.rotateX(-Math.PI / 2);
{
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i) - 125;   // shift plane so it spans +40..−290
    pos.setZ(i, z);
    pos.setY(i, terrainHeight(x, z));

    const dHole = Math.hypot(x - HOLE.x, z - HOLE.z);
    // Fairway corridor from tee to green; rough outside; bright green pad.
    const t = Math.min(1, Math.max(0, -z / -HOLE.z));
    const corridorX = HOLE.x * t;
    const offFairway = Math.abs(x - corridorX);
    if (dHole < GREEN_RADIUS) c.setHex(0x7ed957);
    else if (offFairway < 14 && z < 5 && z > HOLE.z - 6) c.setHex(0x58b368);
    else c.setHex(0x3d7a4a);
    // A little height-based shading so the roll reads.
    const h = terrainHeight(x, z);
    c.offsetHSL(0, 0, h * 0.012);
    colours[i * 3] = c.r; colours[i * 3 + 1] = c.g; colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
}
const ground = new THREE.Mesh(
  geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
);
scene.add(ground);

// ── Procedural Scenery Assets: Trees, Bunkers, Pond, Clouds ────────────────
const courseAssets = buildGolfCourseAssets(scene, terrainHeight);

// ── 3D Animated Golf Club & Sound Synthesizer ──────────────────────────────
const golfClub = createGolfClub(scene);
const golfAudio = new GolfAudio();

const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

// Cup + flag.
const cup = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20),
  new THREE.MeshBasicMaterial({ color: 0x14261a }));
cup.rotation.x = -Math.PI / 2;
cup.position.set(HOLE.x, terrainHeight(HOLE.x, HOLE.z) + 0.02, HOLE.z);
scene.add(cup);
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), mat(0xf2f5f9, 0.4));
pole.position.set(HOLE.x, terrainHeight(HOLE.x, HOLE.z) + 1.7, HOLE.z);
scene.add(pole);
const flag = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.0, 4),
  new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.6, side: THREE.DoubleSide }));
flag.rotation.z = -Math.PI / 2;
flag.position.set(HOLE.x + 0.55, terrainHeight(HOLE.x, HOLE.z) + 3.0, HOLE.z);
scene.add(flag);

const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), mat(0xffffff, 0.3));
scene.add(ball);

// Aim arrow: a thin chevron on the ground pointing along the shot line.
const aimArrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 4),
  new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.9 }));
scene.add(aimArrow);

// ── Wiring ─────────────────────────────────────────────────────────────────
const swing = new SwingDetector({ onThreshold: 130, minTravel: 22 });
const hole = new Hole({ onEvent: handleEvent });
let started = false;

const channel = createChannel({
  onA: () => {
    if (!started || hole.state === 'holed') startRound();
  },
  onSample: (sample, dt, now) => {
    const s = swing.update(channel.pointer.rateDps, dt, now);
    if (s && started && hole.state === 'aim') {
      const power = Math.min(1, s.peak / 480);
      golfClub.triggerSwing(() => {
        hole.strike(power);
        golfAudio.playImpact(pickClub(hole.ball), power);
        channel.feedback({ type: 'slice', combo: 1 });
        flashPower(power);
      });
      golfAudio.playSwing();
    }
  },
});

function startRound() {
  golfAudio.ensureContext();
  started = true;
  hole.state = 'aim';
  hole.strokes = 0;
  hole.ball = { x: 0, y: terrainHeight(0, 0), z: 0, vx: 0, vy: 0, vz: 0 };
  $('overlay').classList.add('hide');
  syncHud();
}

function flashPower(p) {
  const el = $('power');
  if (!el) return;
  el.style.width = `${Math.round(p * 100)}%`;
  el.parentElement.classList.add('on');
  clearTimeout(flashPower.t);
  flashPower.t = setTimeout(() => el.parentElement.classList.remove('on'), 1200);
}

const SCORE_NAMES = { '-2': 'EAGLE', '-1': 'BIRDIE', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE BOGEY' };

function handleEvent(e) {
  if (e.type === 'strike') {
    syncHud();
  } else if (e.type === 'settled') {
    syncHud();
    golfAudio.playBounce();
    $('banner').textContent = e.onGreen ? 'ON THE GREEN' : `${e.distance.toFixed(0)}m to the pin`;
    $('banner').classList.add('on');
    clearTimeout(handleEvent.t);
    handleEvent.t = setTimeout(() => $('banner').classList.remove('on'), 1400);
  } else if (e.type === 'holed') {
    const diff = e.strokes - PAR;
    const name = SCORE_NAMES[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
    $('panel').innerHTML = `<h1>⛳ <em>${name}!</em></h1>
      <p>Holed in ${e.strokes} (par ${PAR}).</p>
      <button type="button" id="start-btn" class="overlay-start-btn">Play Again 🏌️</button>
      <div class="cta"><strong>A</strong> or <strong>Space</strong> play again · <strong>B</strong> menu</div>`;
    const newBtn = $('start-btn');
    if (newBtn) newBtn.onclick = startRound;
    $('overlay').classList.remove('hide');
    channel.feedback({ type: 'slice', combo: 3 });
    channel.audio.play('swipe');
    golfAudio.playCupSink();
    golfAudio.playCheer();
  }
}

function syncHud() {
  $('strokes').textContent = `stroke ${hole.strokes + (hole.state === 'aim' ? 1 : 0)} · par ${PAR}`;
  $('club').textContent = pickClub(hole.ball);
  $('dist').textContent = `${hole.distanceToHole().toFixed(0)}m`;
}

// ── Touch & Screen Controls ────────────────────────────────────────────────
let aimLeftActive = false;
let aimRightActive = false;
let manualAimAngle = 0;
let chargingSwing = false;
let chargeStartTime = 0;

const btnAimLeft = $('aim-left');
const btnAimRight = $('aim-right');
const btnTouchSwing = $('touch-swing');
const btnStart = $('start-btn');

if (btnStart) {
  btnStart.addEventListener('click', (e) => {
    e.stopPropagation();
    startRound();
  });
}

function bindHold(el, onDown, onUp) {
  if (!el) return;
  const down = (e) => {
    e.preventDefault();
    e.stopPropagation();
    golfAudio.ensureContext();
    onDown();
  };
  const up = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onUp();
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

bindHold(btnAimLeft, () => { aimLeftActive = true; }, () => { aimLeftActive = false; });
bindHold(btnAimRight, () => { aimRightActive = true; }, () => { aimRightActive = false; });

if (btnTouchSwing) {
  btnTouchSwing.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    golfAudio.ensureContext();
    if (!started || hole.state === 'holed') {
      startRound();
      return;
    }
    if (hole.state !== 'aim') return;
    chargingSwing = true;
    chargeStartTime = performance.now();
  });

  const releaseSwing = (e) => {
    if (!chargingSwing) return;
    chargingSwing = false;
    const duration = (performance.now() - chargeStartTime) / 1000;
    // Oscillate power between 0.35 and 1.0 based on charge duration
    const cycle = (Math.sin(duration * 3.5 - Math.PI / 2) + 1) / 2;
    const power = Math.max(0.35, Math.min(1.0, 0.4 + cycle * 0.6));

    golfClub.triggerSwing(() => {
      hole.strike(power);
      flashPower(power);
      golfAudio.playImpact(pickClub(hole.ball), power);
    });
    golfAudio.playSwing();
  };

  btnTouchSwing.addEventListener('pointerup', releaseSwing);
  btnTouchSwing.addEventListener('pointercancel', releaseSwing);
}

// Keyboard shortcuts for aim and swing
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.code === 'KeyJ') {
    manualAimAngle -= 0.06;
  } else if (e.key === 'ArrowRight' || e.code === 'KeyL') {
    manualAimAngle += 0.06;
  } else if (e.key === ' ' || e.code === 'Enter') {
    if (!started || hole.state === 'holed') {
      startRound();
    } else if (hole.state === 'aim') {
      const power = 0.85;
      golfClub.triggerSwing(() => {
        hole.strike(power);
        flashPower(power);
        golfAudio.playImpact(pickClub(hole.ball), power);
      });
      golfAudio.playSwing();
    }
  }
});

// ── Loop ───────────────────────────────────────────────────────────────────
let last = performance.now();
let fps = 0; let frames = 0; let fpsMark = last;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  if (dt <= 0) return;
  frames += 1;
  if (now - fpsMark >= 500) { fps = (frames * 1000) / (now - fpsMark); frames = 0; fpsMark = now; }

  // Update aim offsets from buttons
  if (aimLeftActive) manualAimAngle -= dt * 0.9;
  if (aimRightActive) manualAimAngle += dt * 0.9;

  const aim = channel.poll(now);
  if (hole.state === 'aim') {
    const pointerX = (aim.x - 0.5) * 0.7;
    hole.aimOffset = pointerX + manualAimAngle;
  }

  // Live power bar display during touch charge
  if (chargingSwing && hole.state === 'aim') {
    const duration = (now - chargeStartTime) / 1000;
    const cycle = (Math.sin(duration * 3.5 - Math.PI / 2) + 1) / 2;
    const p = Math.max(0.35, Math.min(1.0, 0.4 + cycle * 0.6));
    const el = $('power');
    if (el) {
      el.style.width = `${Math.round(p * 100)}%`;
      el.parentElement.classList.add('on');
    }
  }

  courseAssets.update(dt);
  hole.update(now, dt);
  step(now, dt);
  renderer.render(scene, camera);
}

/** Scene/camera sync — split out for verification. */
function step(now, dt) {
  const b = hole.ball;
  ball.position.set(b.x, b.y + 0.16, b.z);

  const heading = hole.headingToHole() + hole.aimOffset;
  aimArrow.visible = started && hole.state === 'aim';
  if (aimArrow.visible) {
    const ax = b.x + Math.sin(heading) * 5;
    const az = b.z - Math.cos(heading) * 5;
    aimArrow.position.set(ax, terrainHeight(ax, az) + 0.4, az);
    aimArrow.rotation.set(-Math.PI / 2, 0, 0);
    aimArrow.rotation.y = -heading + Math.PI;
    aimArrow.rotateX(-Math.PI / 2);
  }

  // Update animated 3D golf club
  golfClub.update(b, heading, hole.state, dt);

  // Chase camera: behind the ball along the shot line; closer for putts.
  const putter = pickClub(b) === 'putter';
  const back = putter ? 6 : 14;
  const height = putter ? 3 : 7;
  const cx = b.x - Math.sin(heading) * back;
  const cz = b.z + Math.cos(heading) * back;
  const cy = Math.max(terrainHeight(cx, cz) + 1.5, b.y + height);
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 3));
  camera.lookAt(b.x, b.y + 1, b.z);

  flag.rotation.y = now / 900;
}

function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  channel.pointer.setViewport(w, h);
}
window.addEventListener('resize', resize);

setInterval(() => {
  if (!$('debug').classList.contains('on')) return;
  $('debug').textContent = [
    `fps       ${fps.toFixed(0)}`,
    `state     ${hole.state} · strokes ${hole.strokes}`,
    `ball      ${hole.ball.x.toFixed(1)}, ${hole.ball.z.toFixed(1)} (${hole.distanceToHole().toFixed(1)}m out)`,
    `gyro map  ${channel.pointer.describeMap()}`,
    `sensor    ${channel.link.rate.toFixed(0)} Hz`,
  ].join('\n');
}, 250);

resize();
syncHud();
camera.position.set(0, terrainHeight(0, 14) + 8, 14);
camera.lookAt(0, 0, -40);
requestAnimationFrame(frame);

window.__pdlgtg = {
  hole, channel, pointer: channel.pointer, scene, camera, renderer, step, startRound,
  fps: () => fps,
};
