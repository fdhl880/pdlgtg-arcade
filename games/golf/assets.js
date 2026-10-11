import * as THREE from '/vendor/three/three.module.js';
import { HOLE, GREEN_RADIUS } from './logic.js';

/**
 * Procedural 3D Golf Assets & Course Decorator
 * Creates trees, sand bunkers, water hazards, clouds, golf club, and audio.
 */

export function buildGolfCourseAssets(scene, terrainHeight) {
  const assetsGroup = new THREE.Group();
  assetsGroup.name = 'golf-scenery';

  // ── Materials ──
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const pineLeavesMat1 = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.8 });
  const pineLeavesMat2 = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });
  const oakLeavesMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.85 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xdfb76c, roughness: 0.95 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.8 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0288d1,
    roughness: 0.1,
    metalness: 0.6,
    transparent: true,
    opacity: 0.85,
  });
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    transparent: true,
    opacity: 0.9,
  });

  // ── Helper: Pine Tree ──
  function createPineTree(x, z, scale = 1) {
    const group = new THREE.Group();
    const y = terrainHeight(x, z);

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.22 * scale, 0.35 * scale, 2.5 * scale, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = (2.5 * scale) / 2;
    group.add(trunk);

    // Tier 1
    const cone1 = new THREE.Mesh(
      new THREE.ConeGeometry(2.2 * scale, 3.2 * scale, 7),
      pineLeavesMat1
    );
    cone1.position.y = (2.2 + 1.2) * scale;
    group.add(cone1);

    // Tier 2
    const cone2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.7 * scale, 2.7 * scale, 7),
      pineLeavesMat2
    );
    cone2.position.y = (3.5 + 1.2) * scale;
    group.add(cone2);

    // Tier 3
    const cone3 = new THREE.Mesh(
      new THREE.ConeGeometry(1.1 * scale, 2.0 * scale, 7),
      pineLeavesMat1
    );
    cone3.position.y = (4.7 + 1.0) * scale;
    group.add(cone3);

    group.position.set(x, y, z);
    return group;
  }

  // ── Helper: Oak / Bush Tree ──
  function createOakTree(x, z, scale = 1) {
    const group = new THREE.Group();
    const y = terrainHeight(x, z);

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * scale, 0.42 * scale, 2.8 * scale, 7),
      trunkMat
    );
    trunk.position.y = (2.8 * scale) / 2;
    group.add(trunk);

    // Foliage Clusters
    const foliageGroup = new THREE.Group();
    const f1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8 * scale, 1), oakLeavesMat);
    f1.position.set(0, 3.2 * scale, 0);
    const f2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * scale, 1), oakLeavesMat);
    f2.position.set(0.9 * scale, 2.8 * scale, 0.4 * scale);
    const f3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 * scale, 1), oakLeavesMat);
    f3.position.set(-0.8 * scale, 3.0 * scale, -0.4 * scale);

    foliageGroup.add(f1, f2, f3);
    group.add(foliageGroup);

    group.position.set(x, y, z);
    return group;
  }

  // ── Plant Trees along fairway rough & outer borders ──
  // Deterministic scatter
  for (let z = 20; z >= -270; z -= 14) {
    // Left side rough
    const xL1 = -24 - (Math.abs(z * 13) % 18);
    const xL2 = -46 - (Math.abs(z * 7) % 22);
    assetsGroup.add(createPineTree(xL1, z, 0.8 + (Math.abs(z) % 5) * 0.1));
    assetsGroup.add(createOakTree(xL2, z + 4, 0.9 + (Math.abs(z) % 4) * 0.1));

    // Right side rough
    const xR1 = 26 + (Math.abs(z * 17) % 16);
    const xR2 = 48 + (Math.abs(z * 11) % 20);
    assetsGroup.add(createOakTree(xR1, z, 0.85 + (Math.abs(z) % 4) * 0.1));
    assetsGroup.add(createPineTree(xR2, z - 3, 0.95 + (Math.abs(z) % 5) * 0.1));
  }

  // Clustered grove behind the green
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    const r = GREEN_RADIUS + 10 + (Math.sin(a * 4) * 5);
    const gx = HOLE.x + Math.sin(a) * r;
    const gz = HOLE.z - Math.cos(a) * r;
    assetsGroup.add(createPineTree(gx, gz, 0.9 + (a % 3) * 0.15));
  }

  // ── Sand Bunkers ──
  function createBunker(x, z, rx, rz) {
    const y = terrainHeight(x, z);
    const bunkerMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), sandMat);
    bunkerMesh.rotation.x = -Math.PI / 2;
    bunkerMesh.scale.set(rx, rz, 1);
    bunkerMesh.position.set(x, y + 0.04, z);
    return bunkerMesh;
  }

  // Left greenside bunker
  assetsGroup.add(createBunker(HOLE.x - 14, HOLE.z + 4, 6, 9));
  // Right greenside bunker
  assetsGroup.add(createBunker(HOLE.x + 15, HOLE.z - 6, 7, 8));
  // Fairway bunker (200m mark hazard)
  assetsGroup.add(createBunker(-14, -120, 6, 11));

  // ── Water Hazard (Scenic Pond) ──
  const pondX = 24, pondZ = -150, pondRadius = 12;
  const pondY = terrainHeight(pondX, pondZ);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(pondRadius, 32), waterMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(pondX, pondY + 0.03, pondZ);
  assetsGroup.add(pond);

  // Stones around pond
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const sx = pondX + Math.cos(angle) * (pondRadius + 0.5);
    const sz = pondZ + Math.sin(angle) * (pondRadius + 0.5);
    const sy = terrainHeight(sx, sz);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + (i % 3) * 0.25), stoneMat);
    stone.position.set(sx, sy + 0.2, sz);
    stone.scale.set(1.4, 0.6, 1.2);
    assetsGroup.add(stone);
  }

  // ── Tee Box Markers ──
  const teeMatRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
  const teeMatBlue = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
  const markerL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), teeMatRed);
  markerL.position.set(-2.5, terrainHeight(-2.5, 0) + 0.35, 0);
  const markerR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), teeMatBlue);
  markerR.position.set(2.5, terrainHeight(2.5, 0) + 0.35, 0);
  assetsGroup.add(markerL, markerR);

  // ── Distance Markers (200m, 150m, 100m to green) ──
  const markers = [
    { dist: 200, z: HOLE.z + 200, color: 0x3b82f6 }, // Blue: 200m
    { dist: 150, z: HOLE.z + 150, color: 0xf8fafc }, // White: 150m
    { dist: 100, z: HOLE.z + 100, color: 0xef4444 }, // Red: 100m
  ];
  for (const m of markers) {
    const poleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: m.color })
    );
    poleMesh.position.set(-16, terrainHeight(-16, m.z) + 0.7, m.z);
    assetsGroup.add(poleMesh);

    const poleMeshR = poleMesh.clone();
    poleMeshR.position.set(16, terrainHeight(16, m.z) + 0.7, m.z);
    assetsGroup.add(poleMeshR);
  }

  // ── Fluffy Sky Clouds ──
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Group();
    const cx = ((i * 55) % 180) - 90;
    const cy = 45 + (i % 3) * 6;
    const cz = -280 + i * 55;

    for (let j = 0; j < 5; j++) {
      const part = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + j * 1.5, 1), cloudMat);
      part.position.set((j - 2) * 5, (Math.sin(j) * 2), (j % 2) * 3);
      cloud.add(part);
    }
    cloud.position.set(cx, cy, cz);
    assetsGroup.add(cloud);
    clouds.push(cloud);
  }

  scene.add(assetsGroup);

  return {
    group: assetsGroup,
    clouds,
    pond,
    update(dt) {
      // Drift clouds slowly
      for (const c of clouds) {
        c.position.x += dt * 1.5;
        if (c.position.x > 110) c.position.x = -110;
      }
    }
  };
}

/**
 * 3D Golf Club (Driver / Iron / Putter)
 * Animated club that aims with heading and plays swing arc!
 */
export function createGolfClub(scene) {
  const clubGroup = new THREE.Group();
  clubGroup.name = 'player-golf-club';

  // Materials
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x90a4ae,
    metalness: 0.8,
    roughness: 0.2,
  });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x263238,
    metalness: 0.7,
    roughness: 0.3,
  });

  // Shaft (1.1m long)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 1.1, 8), shaftMat);
  shaft.position.y = 0.55;

  // Grip (top 0.3m)
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), gripMat);
  grip.position.y = 0.95;

  // Club Head (Driver box/wedge)
  const headGeo = new THREE.BoxGeometry(0.12, 0.08, 0.06);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0.06, 0.04, 0);

  clubGroup.add(shaft);
  clubGroup.add(grip);
  clubGroup.add(head);

  scene.add(clubGroup);

  let swingProgress = 0;
  let isSwinging = false;

  return {
    group: clubGroup,
    triggerSwing(onImpact) {
      if (isSwinging) return;
      isSwinging = true;
      swingProgress = 0;
      this.onImpact = onImpact;
    },
    update(ballPos, heading, state, dt) {
      if (state !== 'aim' && !isSwinging) {
        clubGroup.visible = false;
        return;
      }
      clubGroup.visible = true;

      // Position next to ball
      const offsetX = Math.cos(heading) * 0.45;
      const offsetZ = Math.sin(heading) * 0.45;
      clubGroup.position.set(ballPos.x + offsetX, ballPos.y, ballPos.z + offsetZ);

      if (!isSwinging) {
        // Aim stance: tilted along target line
        clubGroup.rotation.set(0, -heading + Math.PI / 2, 0.45);
      } else {
        // Play swing animation
        swingProgress += dt * 4.5;
        if (swingProgress < 0.45) {
          // Backswing
          const t = swingProgress / 0.45;
          clubGroup.rotation.set(-t * 1.8, -heading + Math.PI / 2, 0.45 + t * 0.8);
        } else if (swingProgress < 0.65) {
          // Downswing to impact
          const t = (swingProgress - 0.45) / 0.2;
          clubGroup.rotation.set((-1.8) * (1 - t), -heading + Math.PI / 2, 1.25 * (1 - t));
          if (t >= 0.9 && this.onImpact) {
            this.onImpact();
            this.onImpact = null;
          }
        } else if (swingProgress < 1.0) {
          // Follow-through
          const t = (swingProgress - 0.65) / 0.35;
          clubGroup.rotation.set(t * 1.6, -heading + Math.PI / 2, -t * 0.6);
        } else {
          isSwinging = false;
          swingProgress = 0;
        }
      }
    }
  };
}

/**
 * Golf Web Audio Synthesizer
 * Provides crisp driver cracks, iron clanks, turf bounce, cup rattles, and crowd cheers!
 */
export class GolfAudio {
  constructor() {
    this.ctx = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  playSwing() {
    this.ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // White noise whoosh
      const bufferSize = this.ctx.sampleRate * 0.18;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.18);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch { /* audio */ }
  }

  playImpact(club, power = 1) {
    this.ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const p = Math.max(0.2, power);

      if (club === 'driver') {
        // High-velocity whip-crack driver sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.09);
        gain.gain.setValueAtTime(0.5 * p, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (club === 'putter') {
        // Gentle wood/click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
        gain.gain.setValueAtTime(0.18 * p, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else {
        // Iron solid click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        gain.gain.setValueAtTime(0.35 * p, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      }
    } catch { /* audio */ }
  }

  playBounce() {
    this.ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch { /* audio */ }
  }

  playCupSink() {
    this.ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [0, 0.05, 0.11].forEach((t, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime([800, 1100, 650][i], now + t);
        gain.gain.setValueAtTime(0.18, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.09);
      });
    } catch { /* audio */ }
  }

  playCheer() {
    this.ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Synthesized crowd applause
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch { /* audio */ }
  }
}
