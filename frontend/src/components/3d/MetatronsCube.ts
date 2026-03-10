import * as THREE from "three";

/**
 * Metatron's Cube — Fruit of Life (13 circles) with all centers connected
 * Gold/amber palette, slow meditative rotation (~20s/revolution)
 * Breathing pulse synced to ~5.5s cycle
 */
export function createMetatronsCube(scene: THREE.Scene) {
  const group = new THREE.Group();

  // === 13 centers: 1 center + 6 at radius r + 6 at radius 2r ===
  const r = 1.1;
  const centers: THREE.Vector3[] = [];

  centers.push(new THREE.Vector3(0, 0, 0));

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    centers.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
  }

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    centers.push(new THREE.Vector3(Math.cos(angle) * r * 2, Math.sin(angle) * r * 2, 0));
  }

  // === Torus ring at each center ===
  centers.forEach((pos, idx) => {
    const ringRadius = idx === 0 ? 0.22 : idx < 7 ? 0.2 : 0.18;
    const color = idx === 0 ? 0xffd700 : idx < 7 ? 0xffbf00 : 0xff9f1c;
    const torusGeo = new THREE.TorusGeometry(ringRadius, 0.012, 8, 48);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    const torus = new THREE.Mesh(torusGeo, mat);
    torus.position.copy(pos);
    torus.userData.isRing = true;
    group.add(torus);
  });

  // === Lines connecting all 13 centers ===
  const linePoints: number[] = [];
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      linePoints.push(
        centers[i].x, centers[i].y, centers[i].z,
        centers[j].x, centers[j].y, centers[j].z,
      );
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePoints, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  group.add(lines);

  // === Holographic scan line ===
  const scanGeo = new THREE.PlaneGeometry(5, 0.015);
  const scanMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const scanLine = new THREE.Mesh(scanGeo, scanMat);
  scanLine.userData.isScanLine = true;
  group.add(scanLine);

  // === Energy particles ===
  const particleCount = 100;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const c = centers[Math.floor(Math.random() * centers.length)];
    particlePositions[i * 3] = c.x + (Math.random() - 0.5) * 0.5;
    particlePositions[i * 3 + 1] = c.y + (Math.random() - 0.5) * 0.5;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.035,
    color: 0xffd700,
    transparent: true,
    opacity: 0.65,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.userData.isParticle = true;
  group.add(particles);

  group.userData.type = "metatron";
  scene.add(group);

  return group;
}

export function animateMetatronsCube(group: THREE.Group, elapsed: number) {
  // Breathing pulse: ~5.5s cycle
  const breath = 1 + Math.sin(elapsed * 1.14) * 0.06;
  group.scale.setScalar(breath);

  // Slow rotation (~20s/revolution)
  group.rotation.z = elapsed * (Math.PI * 2) / 20;

  // Gentle tilt
  group.rotation.x = Math.sin(elapsed * 0.18) * 0.07;

  group.children.forEach((child) => {
    // Golden emissive pulse on torus rings
    const mesh = child as THREE.Mesh;
    if (mesh.userData.isRing && mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 1.14) * 0.2;
    }

    // Scan line sweep (vertical oscillation)
    if (mesh.userData.isScanLine) {
      mesh.position.y = Math.sin(elapsed * 0.6) * 2.2;
      (mesh.material as THREE.MeshBasicMaterial).opacity =
        0.15 + Math.abs(Math.sin(elapsed * 0.6)) * 0.2;
    }

    // Particles counter-rotate slowly
    if (child.userData.isParticle) {
      (child as THREE.Points).rotation.z = -elapsed * 0.07;
    }
  });
}
