import * as THREE from "three";

/**
 * Merkaba — Star Tetrahedron (two interlocking tetrahedrons)
 * Counter-rotating with rose/teal neon glow
 * Breathing pulse synced to ~5.5s cycle
 */
export function createMerkaba(scene: THREE.Scene) {
  const group = new THREE.Group();

  // Tetrahedron pointing UP
  const geoUp = new THREE.TetrahedronGeometry(1.5, 0);
  const matUpWire = new THREE.MeshStandardMaterial({
    color: 0xff6b9d,
    emissive: 0xff6b9d,
    emissiveIntensity: 0.4,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
  });
  const matUpSolid = new THREE.MeshStandardMaterial({
    color: 0xff6b9d,
    emissive: 0xff6b9d,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide,
  });
  const tetraUp = new THREE.Mesh(geoUp, matUpWire);
  const tetraUpSolid = new THREE.Mesh(geoUp, matUpSolid);
  tetraUp.userData.direction = "up";
  tetraUpSolid.userData.direction = "up";

  // Tetrahedron pointing DOWN (rotated 180° on X)
  const geoDown = new THREE.TetrahedronGeometry(1.5, 0);
  const matDownWire = new THREE.MeshStandardMaterial({
    color: 0x4fd1c5,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.4,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
  });
  const matDownSolid = new THREE.MeshStandardMaterial({
    color: 0x4fd1c5,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide,
  });
  const tetraDown = new THREE.Mesh(geoDown, matDownWire);
  const tetraDownSolid = new THREE.Mesh(geoDown, matDownSolid);
  tetraDown.rotation.x = Math.PI;
  tetraDownSolid.rotation.x = Math.PI;
  tetraDown.userData.direction = "down";
  tetraDownSolid.userData.direction = "down";

  group.add(tetraUp);
  group.add(tetraUpSolid);
  group.add(tetraDown);
  group.add(tetraDownSolid);

  // Energy particles along edges
  const particleCount = 80;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 1.5 + (Math.random() - 0.5) * 0.3;
    particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    particlePositions[i * 3 + 1] = r * Math.cos(phi);
    particlePositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.04,
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.userData.isParticle = true;
  group.add(particles);

  group.userData.type = "merkaba";
  scene.add(group);

  return group;
}

export function animateMerkaba(group: THREE.Group, elapsed: number) {
  // Breathing pulse: ~5.5s
  const breath = 1 + Math.sin(elapsed * 1.14) * 0.08;
  group.scale.setScalar(breath);

  // Counter-rotation
  group.children.forEach((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.userData.direction === "up") {
      mesh.rotation.y = elapsed * 0.2;
    } else if (mesh.userData.direction === "down") {
      mesh.rotation.y = -elapsed * 0.2;
    }
    if (mesh.userData.isParticle) {
      mesh.rotation.y = elapsed * 0.15;
      mesh.rotation.x = Math.sin(elapsed * 0.3) * 0.1;
    }
  });

  // Gentle overall tilt
  group.rotation.x = Math.sin(elapsed * 0.18) * 0.1;
  group.rotation.z = Math.cos(elapsed * 0.12) * 0.05;

  // Neon pulse on wireframes
  group.children.forEach((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).wireframe) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(elapsed * 1.14) * 0.15;
    }
  });
}
