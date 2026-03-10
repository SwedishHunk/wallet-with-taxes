import * as THREE from "three";

/**
 * Fibonacci Phyllotaxis Sphere — golden angle distribution on a 3D sphere
 * 400 glowing points + inner spiral core + subtle wireframe sphere
 * Gold/amber palette, slow meditative rotation, ~5.5s breathing pulse
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.399963 rad

export function createFibonacciSpiral(scene: THREE.Scene) {
  const group = new THREE.Group();

  // === Fibonacci sphere: 400 points via golden angle phyllotaxis ===
  const N = 520;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const R = 2.8;

  for (let i = 0; i < N; i++) {
    const t = i / N;
    const inclination = Math.acos(1 - 2 * t); // 0 → PI
    const azimuth = i * GOLDEN_ANGLE;

    positions[i * 3]     = R * Math.sin(inclination) * Math.cos(azimuth);
    positions[i * 3 + 1] = R * Math.cos(inclination);
    positions[i * 3 + 2] = R * Math.sin(inclination) * Math.sin(azimuth);

    // Gold at poles → amber at equator
    const lat = Math.abs(Math.cos(inclination));
    const color = new THREE.Color();
    color.lerpColors(new THREE.Color(0xff9f1c), new THREE.Color(0xffd700), lat);
    colors[i * 3]     = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const sphereGeo = new THREE.BufferGeometry();
  sphereGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  sphereGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const sphereMat = new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const spherePoints = new THREE.Points(sphereGeo, sphereMat);
  spherePoints.userData.isFibSphere = true;
  group.add(spherePoints);

  // === Inner golden spiral (flat, XY plane) ===
  const spiralPts: THREE.Vector3[] = [];
  for (let i = 0; i < 220; i++) {
    const angle = i * GOLDEN_ANGLE;
    const r = Math.sqrt(i) * 0.1;
    spiralPts.push(new THREE.Vector3(r * Math.cos(angle), r * Math.sin(angle), 0));
  }
  const spiralGeo = new THREE.BufferGeometry().setFromPoints(spiralPts);
  const spiralMat = new THREE.LineBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const spiralLine = new THREE.Line(spiralGeo, spiralMat);
  spiralLine.userData.isSpiral = true;
  group.add(spiralLine);

  // === Subtle wireframe sphere ===
  const wfGeo = new THREE.SphereGeometry(R, 16, 10);
  const wfMat = new THREE.MeshBasicMaterial({
    color: 0xffbf00,
    wireframe: true,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(wfGeo, wfMat));

  // === Glowing golden core ===
  const coreGeo = new THREE.SphereGeometry(0.13, 16, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.userData.isCore = true;
  group.add(core);

  group.userData.type = "fibonacci";
  scene.add(group);
  return group;
}

export function animateFibonacciSpiral(group: THREE.Group, elapsed: number) {
  // Slow rotation (~20s/revolution on Y, gentle X drift)
  group.rotation.y = elapsed * (Math.PI * 2) / 20;
  group.rotation.x = Math.sin(elapsed * 0.18) * 0.12;

  // Breathing pulse: ~5.5s
  const breath = 1 + Math.sin(elapsed * 1.14) * 0.05;
  group.scale.setScalar(breath);

  group.children.forEach((child) => {
    // Inner spiral counter-rotates slowly
    if (child.userData.isSpiral) {
      (child as THREE.Line).rotation.z = -elapsed * 0.18;
    }
    // Core glow pulse
    if (child.userData.isCore) {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + Math.sin(elapsed * 1.14) * 0.5;
    }
  });
}
