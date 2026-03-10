import * as THREE from "three";

/**
 * Fibonacci Spiral — Golden ratio particle trail
 * Amber/gold gradient, slow unfurling rotation
 * Organic flow with neon accents
 */
export function createFibonacciSpiral(scene: THREE.Scene) {
  const group = new THREE.Group();
  const PHI = (1 + Math.sqrt(5)) / 2; // Golden ratio 1.618...

  // Build spiral from 500 points
  const pointCount = 500;
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount;
    const angle = i * 2.399963; // Golden angle in radians
    const r = Math.sqrt(i) * 0.15;

    // Spiral positions
    positions[i * 3] = r * Math.cos(angle);
    positions[i * 3 + 1] = r * Math.sin(angle);
    positions[i * 3 + 2] = (t - 0.5) * 0.5; // slight Z depth

    // Color gradient: gold → amber → neon cyan at tips
    const color = new THREE.Color();
    if (t < 0.5) {
      color.setHSL(0.12, 0.9, 0.5 + t * 0.3); // gold
    } else {
      color.lerpHSL(new THREE.Color(0x00d4ff), (t - 0.5) * 2); // transition to cyan
      color.setHSL(0.12 + (t - 0.5) * 0.7, 0.9, 0.55);
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const spiralGeo = new THREE.BufferGeometry();
  spiralGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  spiralGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const spiralMat = new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const spiralPoints = new THREE.Points(spiralGeo, spiralMat);
  spiralPoints.userData.isSpiralPoints = true;
  group.add(spiralPoints);

  // Golden ratio rectangle outlines
  let w = 1.5;
  let h = w / PHI;
  for (let i = 0; i < 8; i++) {
    const rectShape = new THREE.Shape();
    rectShape.moveTo(-w / 2, -h / 2);
    rectShape.lineTo(w / 2, -h / 2);
    rectShape.lineTo(w / 2, h / 2);
    rectShape.lineTo(-w / 2, h / 2);
    rectShape.lineTo(-w / 2, -h / 2);

    const points = rectShape.getPoints(4);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color().setHSL(0.12 + i * 0.06, 0.7, 0.5),
      transparent: true,
      opacity: 0.15 + (i * 0.03),
    });
    const line = new THREE.LineLoop(lineGeo, lineMat);
    line.rotation.z = -i * Math.PI / 2;

    // Offset based on fibonacci sequence
    const offset = (w - h) / 2;
    if (i % 4 === 0) line.position.set(offset, 0, i * 0.02);
    else if (i % 4 === 1) line.position.set(0, offset, i * 0.02);
    else if (i % 4 === 2) line.position.set(-offset, 0, i * 0.02);
    else line.position.set(0, -offset, i * 0.02);

    line.scale.setScalar(1 - i * 0.08);
    group.add(line);

    // Next fibonacci rectangle
    const temp = h;
    h = w - h;
    w = temp;
  }

  // Neon accent ring around the spiral
  const accentGeo = new THREE.TorusGeometry(3.5, 0.015, 16, 64);
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xffbf00,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.2,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  const accentRing = new THREE.Mesh(accentGeo, accentMat);
  group.add(accentRing);

  group.userData.type = "fibonacci";
  group.scale.setScalar(0.8);
  scene.add(group);

  return group;
}

export function animateFibonacciSpiral(group: THREE.Group, elapsed: number) {
  // Slow unfurling rotation
  group.rotation.z = elapsed * 0.1;

  // Gentle tilt
  group.rotation.x = Math.sin(elapsed * 0.15) * 0.12;
  group.rotation.y = Math.cos(elapsed * 0.12) * 0.08;

  // Breathing pulse: ~5.5s
  const breath = 0.8 * (1 + Math.sin(elapsed * 1.14) * 0.05);
  group.scale.setScalar(breath);

  // Animate spiral particle flow
  group.children.forEach((child) => {
    if (child.userData.isSpiralPoints) {
      const points = child as THREE.Points;
      const positions = points.geometry.attributes.position.array as Float32Array;
      const count = positions.length / 3;
      for (let i = 0; i < count; i++) {
        // Gentle Z breathing
        positions[i * 3 + 2] = ((i / count) - 0.5) * 0.5 + Math.sin(elapsed * 1.14 + i * 0.02) * 0.03;
      }
      points.geometry.attributes.position.needsUpdate = true;
    }
  });
}
