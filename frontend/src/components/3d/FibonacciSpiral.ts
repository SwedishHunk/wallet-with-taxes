import * as THREE from "three";

/**
 * Tree of Life — Kabbalistic Etz Chaim
 * 10 Sephiroth + 22 sacred paths + Da'at (hidden) + flowing energy
 * Teal/cyan palette, slow meditative rotation, ~5.5s breathing pulse
 */

// ── Sephiroth positions, sphere radii, emissive colours ──────────────────────
const SEPH = [
  { p: [ 0.0,  2.7,  0.00], r: 0.175, emit: 0xe0f2fe }, // 0  Keter    (Crown)
  { p: [ 1.45, 2.0,  0.15], r: 0.130, emit: 0x67e8f9 }, // 1  Chokmah  (Wisdom)
  { p: [-1.45, 2.0, -0.15], r: 0.130, emit: 0x2dd4bf }, // 2  Binah    (Understanding)
  { p: [ 1.45, 0.8,  0.10], r: 0.130, emit: 0x22d3ee }, // 3  Chesed   (Mercy)
  { p: [-1.45, 0.8, -0.10], r: 0.130, emit: 0x22d3ee }, // 4  Geburah  (Strength)
  { p: [ 0.0,  0.1,  0.00], r: 0.165, emit: 0x67e8f9 }, // 5  Tiferet  (Beauty)
  { p: [ 1.45,-0.9,  0.08], r: 0.120, emit: 0x2dd4bf }, // 6  Netzach  (Victory)
  { p: [-1.45,-0.9, -0.08], r: 0.120, emit: 0x2dd4bf }, // 7  Hod      (Splendour)
  { p: [ 0.0, -1.75, 0.00], r: 0.140, emit: 0x22d3ee }, // 8  Yesod    (Foundation)
  { p: [ 0.0, -2.75, 0.00], r: 0.160, emit: 0x0891b2 }, // 9  Malkuth  (Kingdom)
];

// Da'at — hidden sephirah, very faint
const DAAT = { p: [0.0, 1.42, 0.0], r: 0.095, emit: 0x67e8f9 };

// 22 sacred paths (0-indexed into SEPH)
const PATHS: [number, number][] = [
  [0,1],[0,2],[0,5],
  [1,2],[1,3],[1,5],
  [2,4],[2,5],
  [3,4],[3,5],[3,6],
  [4,5],[4,7],
  [5,6],[5,7],[5,8],
  [6,7],[6,8],[6,9],
  [7,8],[7,9],
  [8,9],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function vec(p: number[]) { return new THREE.Vector3(p[0], p[1], p[2]); }

export function createFibonacciSpiral(scene: THREE.Scene) {
  const group = new THREE.Group();

  // ── 10 Sephiroth orbs ──────────────────────────────────────────────────────
  SEPH.forEach((s, idx) => {
    const geo = new THREE.SphereGeometry(s.r, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: s.emit,
      emissive: s.emit,
      emissiveIntensity: idx === 5 ? 2.2 : 1.6,   // Tiferet brightest
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(s.p[0], s.p[1], s.p[2]);
    mesh.userData.isSeph = true;
    mesh.userData.sephIdx = idx;
    mesh.userData.baseEmissive = idx === 5 ? 2.2 : 1.6;
    group.add(mesh);

    // Outer glow halo per orb
    const haloGeo = new THREE.SphereGeometry(s.r * 2.2, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: s.emit,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(mesh.position);
    group.add(halo);
  });

  // ── Da'at (hidden, translucent ring) ───────────────────────────────────────
  const daatGeo = new THREE.TorusGeometry(DAAT.r, 0.02, 12, 48);
  const daatMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const daat = new THREE.Mesh(daatGeo, daatMat);
  daat.position.set(DAAT.p[0], DAAT.p[1], DAAT.p[2]);
  daat.userData.isDaat = true;
  group.add(daat);

  // ── 22 sacred path lines ───────────────────────────────────────────────────
  PATHS.forEach(([a, b]) => {
    const from = vec(SEPH[a].p);
    const to   = vec(SEPH[b].p);
    const pts  = [from, to];
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const mat  = new THREE.LineBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    group.add(new THREE.Line(geo, mat));
  });

  // ── Flowing energy particles along every path ──────────────────────────────
  // 5 particles per path, each with a phase offset → wave-like flow illusion
  const flowPositions: number[] = [];
  const flowPhases: number[]    = [];
  const FLOW_PER_PATH = 5;

  PATHS.forEach(([a, b]) => {
    const from = vec(SEPH[a].p);
    const to   = vec(SEPH[b].p);
    for (let k = 0; k < FLOW_PER_PATH; k++) {
      const t = k / FLOW_PER_PATH;
      const pt = from.clone().lerp(to, t);
      flowPositions.push(pt.x, pt.y, pt.z);
      flowPhases.push(t * Math.PI * 2);      // phase spread along path
    }
  });

  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(flowPositions), 3)
  );
  const flowMat = new THREE.PointsMaterial({
    color: 0x67e8f9,
    size: 0.045,
    transparent: true,
    opacity: 0.80,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const flowParticles = new THREE.Points(flowGeo, flowMat);
  flowParticles.userData.isFlow = true;
  flowParticles.userData.phases = flowPhases;
  group.add(flowParticles);

  // ── Outer egg / oval outline (vesica piscis form of the tree) ──────────────
  const ovalPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    ovalPts.push(new THREE.Vector3(
      Math.cos(a) * 1.85,
      Math.sin(a) * 3.0,
      0
    ));
  }
  const ovalGeo = new THREE.BufferGeometry().setFromPoints(ovalPts);
  const ovalMat = new THREE.LineBasicMaterial({
    color: 0x0891b2,
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
  });
  const oval = new THREE.Line(ovalGeo, ovalMat);
  oval.userData.isOval = true;
  group.add(oval);

  // ── Two ambient halo rings around the whole tree ───────────────────────────
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.010, 8, 140),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.16, depthWrite: false })
  );
  ring1.rotation.x = Math.PI / 2;
  ring1.userData.isRing1 = true;
  group.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.007, 8, 140),
    new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.11, depthWrite: false })
  );
  ring2.rotation.x = Math.PI / 3;
  ring2.rotation.z = Math.PI / 5;
  ring2.userData.isRing2 = true;
  group.add(ring2);

  group.userData.type = "fibonacci";
  scene.add(group);
  return group;
}

export function animateFibonacciSpiral(group: THREE.Group, elapsed: number) {
  // Slow Y rotation (~24s/revolution) + gentle X drift
  group.rotation.y = elapsed * (Math.PI * 2) / 24;
  group.rotation.x = Math.sin(elapsed * 0.15) * 0.10;

  // 5.5s breathing pulse
  const breath = 1 + Math.sin(elapsed * 1.14) * 0.04;
  group.scale.setScalar(breath);

  group.children.forEach((child) => {
    // Sephiroth — staggered glow pulse per index
    if (child.userData.isSeph) {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const offset = child.userData.sephIdx * 0.62;   // phase stagger
      const base   = child.userData.baseEmissive as number;
      mat.emissiveIntensity = base + Math.sin(elapsed * 1.14 + offset) * 0.55;
    }

    // Da'at ring — slow independent spin
    if (child.userData.isDaat) {
      child.rotation.z = elapsed * 0.30;
      child.rotation.x = elapsed * 0.18;
    }

    // Flowing particles — wave opacity across phases
    if (child.userData.isFlow) {
      const mat    = (child as THREE.Points).material as THREE.PointsMaterial;
      // phases data available in child.userData.phases for future per-vertex animation
      // Global wave: particles light up in sequence along each path
      const wave = elapsed * 2.5;
      // Use overall opacity as base; per-vertex color would be ideal but
      // we create a global pulsing wave that shifts the whole set
      mat.opacity = 0.55 + Math.sin(wave) * 0.25;
    }

    // Ambient rings drift
    if (child.userData.isRing1) child.rotation.y = elapsed * 0.18;
    if (child.userData.isRing2) child.rotation.y = -elapsed * 0.12;

    // Oval outline very slow Z tilt sway
    if (child.userData.isOval) {
      child.rotation.z = Math.sin(elapsed * 0.20) * 0.05;
    }
  });
}
