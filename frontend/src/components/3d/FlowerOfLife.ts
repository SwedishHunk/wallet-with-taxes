import * as THREE from "three";

/**
 * Flower of Life — 19 interlocking torus rings
 * Warm golden core + neon cyan edge glow
 * Slow 20s rotation + breathing pulse
 */
export function createFlowerOfLife(scene: THREE.Scene) {
  const group = new THREE.Group();
  const radius = 1.0;
  const ringRadius = 0.02;

  // Flower of Life: center + 6 around + 12 outer
  const positions: [number, number][] = [[0, 0]];

  // Inner ring: 6 circles at 60° intervals
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    positions.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }

  // Outer ring: 12 circles
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    // Between two inner circles
    const midAngle = angle + Math.PI / 6;
    positions.push([
      Math.cos(angle) * radius * 2,
      Math.sin(angle) * radius * 2,
    ]);
    positions.push([
      Math.cos(midAngle) * radius * Math.sqrt(3),
      Math.sin(midAngle) * radius * Math.sqrt(3),
    ]);
  }

  const ringGeo = new THREE.TorusGeometry(radius, ringRadius, 32, 64);

  positions.forEach(([x, y]) => {
    // Neon wireframe ring
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });
    const neonRing = new THREE.Mesh(ringGeo, neonMat);
    neonRing.position.set(x, y, 0);
    group.add(neonRing);

    // Solid subtle golden fill
    const solidMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffbf00,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const solidRing = new THREE.Mesh(ringGeo, solidMat);
    solidRing.position.set(x, y, 0);
    group.add(solidRing);
  });

  // Scan line ring (holographic effect)
  const scanGeo = new THREE.RingGeometry(0, 5, 64);
  const scanMat = new THREE.MeshBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.03,
    side: THREE.DoubleSide,
  });
  const scanLine = new THREE.Mesh(scanGeo, scanMat);
  scanLine.userData.isScanLine = true;
  group.add(scanLine);

  group.scale.setScalar(1.2);
  group.userData.type = "flower";
  scene.add(group);

  return group;
}

export function animateFlowerOfLife(group: THREE.Group, elapsed: number) {
  // Slow meditative rotation (~20s per revolution)
  group.rotation.z = elapsed * 0.314;
  group.rotation.y = Math.sin(elapsed * 0.15) * 0.15;

  // Breathing pulse: ~5.5s cycle (432Hz harmony)
  const breath = 1 + Math.sin(elapsed * 1.14) * 0.06;
  group.scale.setScalar(1.2 * breath);

  // Scan line sweep
  group.children.forEach((child) => {
    if (child.userData.isScanLine) {
      child.position.x = Math.sin(elapsed * 0.5) * 4;
      if ((child as THREE.Mesh).material) {
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
          0.03 + Math.sin(elapsed * 2) * 0.02;
      }
    }
  });

  // Neon color cycling on wireframes
  group.children.forEach((child, i) => {
    const mesh = child as THREE.Mesh;
    if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).wireframe) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const hue = (elapsed * 0.02 + i * 0.05) % 1;
      mat.emissive.setHSL(hue * 0.15 + 0.5, 0.8, 0.5); // cyan-teal range
      mat.emissiveIntensity = 0.3 + Math.sin(elapsed * 1.14 + i * 0.3) * 0.1;
    }
  });
}
