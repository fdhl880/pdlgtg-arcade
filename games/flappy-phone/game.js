import * as THREE from '/vendor/three/three.module.js';
import { consumeLaunchSplash } from '../../core/splash.js';
consumeLaunchSplash();

import { GameLink } from '../../core/net.js';
import { axesFromSample, gripTilt } from '../../core/orientation.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ── Three.js Setup ─────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();

// Sky gradient via large sphere
const skyGeo = new THREE.SphereGeometry(80, 16, 12);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor: { value: new THREE.Color(0x4a90d9) },
    bottomColor: { value: new THREE.Color(0x87ceeb) },
    offset: { value: 10 },
    exponent: { value: 0.4 },
  },
  vertexShader: `
    varying vec3 vPos;
    void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;
    varying vec3 vPos;
    void main() {
      float h = normalize(vPos + offset).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// Camera
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
camera.position.set(0, 2, 8);
camera.lookAt(0, 1.5, 0);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xfff5e0, 1.6);
sun.position.set(8, 15, 10);
sun.castShadow = true;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -5;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const fillLight = new THREE.DirectionalLight(0x8ecae6, 0.4);
fillLight.position.set(-5, 3, -5);
scene.add(fillLight);

// ── Materials ──────────────────────────────────────────────────────────────
const mat = (c, r = 0.6, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

// ── Ground ─────────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x5daa3e, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Rolling ground stripe (closer)
const groundStripe = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x4a9832, roughness: 0.9 })
);
groundStripe.rotation.x = -Math.PI / 2;
groundStripe.position.set(0, 0.005, 4);
scene.add(groundStripe);

// ── Background trees (decorative) ──────────────────────────────────────────
function makeTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), mat(0x8B6914, 0.9));
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(0x2d8a4e, 0.8));
  leaves.position.y = 1.6;
  leaves.castShadow = true;
  g.add(trunk, leaves);
  g.position.set(x, 0, z);
  return g;
}
for (let i = 0; i < 20; i++) {
  const x = (Math.random() - 0.5) * 40;
  const z = -5 - Math.random() * 30;
  scene.add(makeTree(x, z));
}

// ── Clouds ─────────────────────────────────────────────────────────────────
const cloudGroup = new THREE.Group();
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
function makeCloud(x, y, z, scale) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r = 0.6 + Math.random() * 0.5;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cloudMat);
    puff.position.set((i - 1.5) * 0.8, Math.random() * 0.3, Math.random() * 0.3);
    g.add(puff);
  }
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  return g;
}
for (let i = 0; i < 12; i++) {
  const cloud = makeCloud(
    (Math.random() - 0.5) * 50,
    6 + Math.random() * 8,
    -10 - Math.random() * 30,
    0.5 + Math.random() * 1.0
  );
  cloud.userData.speed = 0.02 + Math.random() * 0.03;
  cloudGroup.add(cloud);
}
scene.add(cloudGroup);

// ── Bird (3D procedural) ───────────────────────────────────────────────────
const birdGroup = new THREE.Group();

// Body
const bodyMat = mat(0xf4c815, 0.5, 0.05);
const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), bodyMat);
body.scale.set(1, 0.85, 1.15);
body.castShadow = true;
birdGroup.add(body);

// Eye (right)
const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xffffff, 0.3));
eyeWhite.position.set(0.18, 0.1, 0.25);
birdGroup.add(eyeWhite);
const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat(0x111111, 0.2));
pupil.position.set(0.24, 0.1, 0.3);
birdGroup.add(pupil);

// Eye (left)
const eyeWhite2 = eyeWhite.clone();
eyeWhite2.position.set(-0.18, 0.1, 0.25);
birdGroup.add(eyeWhite2);
const pupil2 = pupil.clone();
pupil2.position.set(-0.24, 0.1, 0.3);
birdGroup.add(pupil2);

// Beak
const beakGeo = new THREE.ConeGeometry(0.12, 0.25, 6);
beakGeo.rotateX(Math.PI / 2);
const beak = new THREE.Mesh(beakGeo, mat(0xe86101, 0.4));
beak.position.set(0, -0.02, 0.45);
birdGroup.add(beak);

// Wings
const wingGeo = new THREE.BoxGeometry(0.5, 0.06, 0.25);
const wingMat = mat(0xdaaf12, 0.5, 0.05);
const wingL = new THREE.Mesh(wingGeo, wingMat);
wingL.position.set(-0.35, 0.05, 0);
birdGroup.add(wingL);
const wingR = new THREE.Mesh(wingGeo, wingMat);
wingR.position.set(0.35, 0.05, 0);
birdGroup.add(wingR);

// Tail
const tailGeo = new THREE.BoxGeometry(0.18, 0.06, 0.2);
const tail = new THREE.Mesh(tailGeo, mat(0xd49a10, 0.5));
tail.position.set(0, 0.1, -0.4);
tail.rotation.x = -0.3;
birdGroup.add(tail);

birdGroup.position.set(0, 3, 4);
scene.add(birdGroup);

// ── Pipes (3D metallic) ───────────────────────────────────────────────────
const PIPE_RADIUS = 0.5;
const PIPE_GAP = 3.8;
const PIPE_SPACING = 6;
const PIPE_SPEED = 4.5;

const pipeMat = new THREE.MeshStandardMaterial({
  color: 0x45b34e,
  roughness: 0.35,
  metalness: 0.6,
});
const pipeCapMat = new THREE.MeshStandardMaterial({
  color: 0x3a9a42,
  roughness: 0.3,
  metalness: 0.7,
});

function makePipe3D(gapCenterY) {
  const g = new THREE.Group();

  // Top pipe (grows upward from gap)
  const topH = gapCenterY - PIPE_GAP / 2;
  if (topH > 0.1) {
    const topPipe = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, topH, 16), pipeMat);
    topPipe.position.y = gapCenterY - PIPE_GAP / 2 - topH / 2;
    // Flip so it hangs from top
    topPipe.position.y = topH / 2 + (gapCenterY - PIPE_GAP / 2);
    // Actually: top pipe goes from gapTop to sky
    topPipe.position.y = gapCenterY + PIPE_GAP / 2 + topH / 2;
    // Let me just compute properly
    const gapTop = gapCenterY + PIPE_GAP / 2;
    const topPipeH = 20 - gapTop; // extends to sky
    topPipe.geometry.dispose();
    topPipe.geometry = new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, topPipeH, 16);
    topPipe.position.y = gapTop + topPipeH / 2;
    topPipe.castShadow = true;
    g.add(topPipe);

    // Top cap (lip)
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(PIPE_RADIUS * 1.3, PIPE_RADIUS * 1.3, 0.3, 16),
      pipeCapMat
    );
    topCap.position.y = gapTop + 0.15;
    topCap.castShadow = true;
    g.add(topCap);
  }

  // Bottom pipe
  const gapBottom = gapCenterY - PIPE_GAP / 2;
  if (gapBottom > 0.1) {
    const botPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, gapBottom, 16),
      pipeMat
    );
    botPipe.position.y = gapBottom / 2;
    botPipe.castShadow = true;
    g.add(botPipe);

    // Bottom cap (lip)
    const botCap = new THREE.Mesh(
      new THREE.CylinderGeometry(PIPE_RADIUS * 1.3, PIPE_RADIUS * 1.3, 0.3, 16),
      pipeCapMat
    );
    botCap.position.y = gapBottom - 0.15;
    botCap.castShadow = true;
    g.add(botCap);
  }

  g.userData.gapCenterY = gapCenterY;
  g.userData.scored = false;
  return g;
}

const pipes3D = [];

// ── Particle system for score effect ──────────────────────────────────────
const particles = [];
function spawnParticles(x, y, z, color = 0xf4c815) {
  for (let i = 0; i < 12; i++) {
    const geo = new THREE.SphereGeometry(0.05 + Math.random() * 0.06, 6, 4);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    m.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 3 + 1,
      (Math.random() - 0.5) * 2
    );
    m.userData.life = 1.0;
    scene.add(m);
    particles.push(m);
  }
}

// ── Game State ─────────────────────────────────────────────────────────────
const STATE_START = 0;
const STATE_PLAY = 1;
const STATE_DEAD = 2;

let state = STATE_START;
let score = 0;
let birdY = 3;
let birdV = 0;
const gravity = 9.8;
const jumpStrength = -4.5;
let pipeTimer = 0;

function resetGame() {
  state = STATE_PLAY;
  score = 0;
  birdY = 3;
  birdV = 0;
  pipeTimer = 0;
  // Remove all pipes
  for (const p of pipes3D) scene.remove(p);
  pipes3D.length = 0;
  // Remove particles
  for (const p of particles) scene.remove(p);
  particles.length = 0;
  $('score').innerText = score;
  $('overlay').classList.add('hide');
  $('popup').classList.remove('on');
}

function jump() {
  if (state === STATE_START || state === STATE_DEAD) {
    resetGame();
  } else {
    birdV = jumpStrength;
  }
}

// ── Controller ────────────────────────────────────────────────────────────
const link = new GameLink({
  onOrientation: (sample, slot) => {
    if (state !== STATE_PLAY) return;
    const axes = axesFromSample(sample);
    const tilt = gripTilt(axes);
    if (tilt.pitch > 10) birdV -= 0.6;
    else if (tilt.pitch < -10) birdV += 0.4;
    if (birdV < -6) birdV = -6;
    if (birdV > 8) birdV = 8;
  },
  onCommand: (cmd, slot) => {
    if (cmd.type === 'button' && cmd.button === 'A') jump();
    else if (cmd.type === 'button' && cmd.button === 'B') location.href = '/';
  },
  onPresence: (pr) => {
    const on = pr.controller > 0;
    $('dot').classList.toggle('on', on);
    $('link-t').textContent = on ? 'remote connected' : 'no remote connected';
  },
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'KeyA') jump();
  if (e.code === 'KeyB') location.href = '/';
});
canvas.addEventListener('pointerdown', () => jump());

// ── Game Loop ──────────────────────────────────────────────────────────────
let lastTime = performance.now();
let wingAngle = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 1 / 20);
  lastTime = now;
  if (dt <= 0) return;

  // Animate clouds
  for (const cloud of cloudGroup.children) {
    cloud.position.x -= cloud.userData.speed;
    if (cloud.position.x < -30) cloud.position.x = 30;
  }

  if (state === STATE_START) {
    // Idle bob
    birdGroup.position.y = 3 + Math.sin(now * 0.003) * 0.3;
    birdGroup.rotation.z = 0;
    wingAngle = Math.sin(now * 0.008) * 0.4;
    wingL.rotation.z = wingAngle;
    wingR.rotation.z = -wingAngle;
  }

  if (state === STATE_PLAY) {
    // Physics
    birdV += gravity * dt;
    birdY -= birdV * dt;

    // Bird position & rotation
    birdGroup.position.y = birdY;
    birdGroup.rotation.z = THREE.MathUtils.clamp(birdV * 0.08, -0.7, 0.7);

    // Wing flapping
    wingAngle = Math.sin(now * 0.015) * 0.6;
    wingL.rotation.z = wingAngle;
    wingR.rotation.z = -wingAngle;

    // Spawn pipes
    pipeTimer += dt;
    if (pipeTimer > PIPE_SPACING / PIPE_SPEED) {
      pipeTimer = 0;
      const gapY = 1.8 + Math.random() * 3.5;
      const pipe = makePipe3D(gapY);
      pipe.position.set(0, 0, -20);
      scene.add(pipe);
      pipes3D.push(pipe);
    }

    // Move pipes toward camera
    for (let i = pipes3D.length - 1; i >= 0; i--) {
      const p = pipes3D[i];
      p.position.z += PIPE_SPEED * dt;

      // Scoring (when pipe passes bird z)
      if (!p.userData.scored && p.position.z > birdGroup.position.z) {
        p.userData.scored = true;
        score++;
        $('score').innerText = score;
        spawnParticles(birdGroup.position.x, birdGroup.position.y, birdGroup.position.z, 0x00ff88);
      }

      // Collision detection
      const dz = Math.abs(p.position.z - birdGroup.position.z);
      if (dz < PIPE_RADIUS * 1.3) {
        const gapTop = p.userData.gapCenterY + PIPE_GAP / 2;
        const gapBottom = p.userData.gapCenterY - PIPE_GAP / 2;
        if (birdY > gapTop - 0.15 || birdY < gapBottom + 0.15) {
          state = STATE_DEAD;
          die();
        }
      }

      // Remove past camera
      if (p.position.z > 12) {
        scene.remove(p);
        pipes3D.splice(i, 1);
      }
    }

    // Ground collision
    if (birdY < 0.5) {
      birdY = 0.5;
      state = STATE_DEAD;
      die();
    }

    // Ceiling
    if (birdY > 12) {
      birdY = 12;
      birdV = 0;
    }
  }

  if (state === STATE_DEAD) {
    birdV += gravity * dt;
    birdY -= birdV * dt;
    if (birdY < 0.5) birdY = 0.5;
    birdGroup.position.y = birdY;
    birdGroup.rotation.z = Math.min(birdGroup.rotation.z + dt * 3, Math.PI / 2);
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= dt * 1.5;
    if (p.userData.life <= 0) {
      scene.remove(p);
      particles.splice(i, 1);
      continue;
    }
    p.position.add(p.userData.vel.clone().multiplyScalar(dt));
    p.userData.vel.y -= 6 * dt;
    p.material.opacity = p.userData.life;
    p.material.transparent = true;
    p.scale.setScalar(p.userData.life);
  }

  // Camera slight follow
  camera.position.y += (birdY * 0.15 + 1.5 - camera.position.y) * 0.03;

  renderer.render(scene, camera);
}

function die() {
  spawnParticles(birdGroup.position.x, birdGroup.position.y, birdGroup.position.z, 0xff4444);
  $('popup').innerText = `Game Over!\nScore: ${score}`;
  $('popup').classList.add('on');
  setTimeout(() => {
    $('overlay').classList.remove('hide');
  }, 1200);
}

function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
