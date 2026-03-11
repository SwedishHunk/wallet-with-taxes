import { useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import * as THREE from "three";
import { createFlowerOfLife, animateFlowerOfLife } from "./FlowerOfLife";
import { createMerkaba, animateMerkaba } from "./Merkaba";
import { createFibonacciSpiral, animateFibonacciSpiral } from "./FibonacciSpiral";
import { createMetatronsCube, animateMetatronsCube } from "./MetatronsCube";

type Props = {
  intensity?: "full" | "subtle";
  sacredGeometry?: "flower" | "merkaba" | "fibonacci" | "metatron";
};

// ─── Ambient fill: scattered sacred geometry decorating the void ─────────────

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function addTorus(group: THREE.Group, x: number, y: number, z: number, r: number, color: number, opacity: number) {
  const geo = new THREE.TorusGeometry(r, 0.007, 8, 48);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
}

function createAmbientFill(scene: THREE.Scene, type: string): THREE.Group {
  const group = new THREE.Group();

  if (type === "flower") {
    const placements = [
      { x: -5.2, y: 2.8,  z: -2.0, r: 0.50, c: 0x00d4ff, o: 0.14 },
      { x:  5.0, y: -2.6, z: -1.8, r: 0.38, c: 0xffd700, o: 0.16 },
      { x: -3.8, y: -3.5, z: -2.5, r: 0.60, c: 0x4fd1c5, o: 0.12 },
      { x:  4.5, y:  3.3, z: -2.2, r: 0.34, c: 0xffd700, o: 0.15 },
      { x: -5.5, y:  0.2, z: -3.0, r: 0.44, c: 0x00d4ff, o: 0.11 },
      { x:  5.5, y:  0.8, z: -2.5, r: 0.40, c: 0x4fd1c5, o: 0.13 },
      { x:  0.5, y:  4.5, z: -2.3, r: 0.52, c: 0xffd700, o: 0.12 },
      { x: -0.5, y: -4.5, z: -2.0, r: 0.36, c: 0x00d4ff, o: 0.14 },
      { x: -3.0, y:  4.0, z: -3.0, r: 0.28, c: 0xffbf00, o: 0.10 },
      { x:  3.2, y: -4.0, z: -2.8, r: 0.42, c: 0xffbf00, o: 0.12 },
    ];
    placements.forEach(({ x, y, z, r, c, o }) => addTorus(group, x, y, z, r, c, o));

    [{ x: -4.8, y: -1.5, z: -2.5 }, { x: 4.8, y: 2.0, z: -3.0 }].forEach(({ x, y, z }) => {
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        addTorus(group, x + Math.cos(a) * 0.22, y + Math.sin(a) * 0.22, z, 0.22, 0xffd700, 0.11);
      }
    });
  }

  if (type === "metatron") {
    const rings = [
      { x: -5.3, y:  2.2, z: -2.2, r: 0.48, o: 0.13 },
      { x:  5.0, y: -2.5, z: -1.8, r: 0.38, o: 0.14 },
      { x: -4.5, y: -3.2, z: -2.5, r: 0.34, o: 0.12 },
      { x:  4.5, y:  3.0, z: -2.3, r: 0.44, o: 0.13 },
      { x: -5.8, y: -0.5, z: -3.0, r: 0.30, o: 0.10 },
      { x:  5.8, y:  0.5, z: -2.5, r: 0.36, o: 0.11 },
      { x:  0.0, y:  4.5, z: -2.5, r: 0.40, o: 0.12 },
      { x:  0.0, y: -4.5, z: -2.2, r: 0.32, o: 0.13 },
    ];
    rings.forEach(({ x, y, z, r, o }) => addTorus(group, x, y, z, r, 0xffd700, o));

    [
      { x: -4.8, y:  1.2, z: -3.0, s: 0.45 },
      { x:  4.8, y: -1.2, z: -2.5, s: 0.38 },
      { x:  0.0, y:  4.0, z: -3.0, s: 0.34 },
      { x: -2.5, y: -4.0, z: -2.8, s: 0.30 },
    ].forEach(({ x, y, z, s }) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 3; i++) {
        const a = (i * Math.PI * 2) / 3 - Math.PI / 6;
        pts.push(new THREE.Vector3(x + Math.cos(a) * s, y + Math.sin(a) * s, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xffbf00, transparent: true, opacity: 0.13, depthWrite: false });
      group.add(new THREE.Line(geo, mat));
    });

    [{ x: -5.5, y: -2.5, z: -2.8 }, { x: 5.5, y: 2.5, z: -2.5 }].forEach(({ x, y, z }) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 3;
        pts.push(new THREE.Vector3(x + Math.cos(a) * 0.38, y + Math.sin(a) * 0.38, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.11, depthWrite: false });
      group.add(new THREE.Line(geo, mat));
    });
  }

  if (type === "fibonacci") {
    [
      { x: -5.2, y:  2.0, z: -2.5 },
      { x:  5.0, y: -2.0, z: -2.0 },
      { x: -4.0, y: -3.5, z: -3.0 },
      { x:  4.5, y:  3.0, z: -2.5 },
      { x: -5.8, y:  0.0, z: -2.8 },
      { x:  5.8, y:  0.0, z: -2.3 },
    ].forEach(({ x, y, z }) => {
      const n = 35;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(i) * 0.07;
        const a = i * GOLDEN_ANGLE;
        pos[i * 3]     = x + r * Math.cos(a);
        pos[i * 3 + 1] = y + r * Math.sin(a);
        pos[i * 3 + 2] = z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      group.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.055, color: 0xffd700, transparent: true, opacity: 0.28,
        sizeAttenuation: true, depthWrite: false,
      })));
    });

    [
      { x: -4.8, y: -1.2, z: -2.5 },
      { x:  4.8, y:  1.5, z: -2.0 },
      { x: -2.0, y:  4.2, z: -3.0 },
      { x:  2.0, y: -4.2, z: -2.8 },
    ].forEach(({ x, y, z }) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 60; i++) {
        const r = Math.sqrt(i) * 0.055;
        const a = i * GOLDEN_ANGLE;
        pts.push(new THREE.Vector3(x + r * Math.cos(a), y + r * Math.sin(a), z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xffbf00, transparent: true, opacity: 0.20, depthWrite: false });
      group.add(new THREE.Line(geo, mat));
    });
  }

  scene.add(group);
  return group;
}

function animateAmbientFill(group: THREE.Group, elapsed: number) {
  group.rotation.z = elapsed * 0.018;

  group.children.forEach((child, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    const speed = 0.015 + (i % 4) * 0.008;
    child.rotation.z = elapsed * speed * dir;

    const anyChild = child as THREE.Mesh | THREE.Line | THREE.Points;
    if (anyChild.material) {
      const mat = anyChild.material as THREE.Material & { opacity?: number };
      if (mat.opacity !== undefined) {
        const base = 0.08 + (i % 5) * 0.02;
        mat.opacity = base + Math.sin(elapsed * 0.7 + i * 0.9) * 0.04;
      }
    }
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CyberpunkScene({
  intensity = "full",
  sacredGeometry,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSubtle = intensity === "subtle";

  // Route transition: refs shared between location-watch effect and animation loop
  const routeTransRef = useRef({ active: false, progress: 0 });
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      routeTransRef.current = { active: true, progress: 0 };
    }
  }, [location.pathname]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // === Renderer ===
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // === Scene & Camera ===
    const scene = new THREE.Scene();

    // Nebula fog — deep space purple-black, density 0.022 for subtle depth
    scene.fog = new THREE.FogExp2(0x05030f, 0.022);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    // === Lighting — warm 432Hz palette with neon accents ===
    scene.add(new THREE.AmbientLight(0xfff8e7, 0.1));

    const warmLight = new THREE.DirectionalLight(0xffd700, 0.2);
    warmLight.position.set(5, 5, 5);
    scene.add(warmLight);

    const cyanLight = new THREE.PointLight(0x00d4ff, 0.5, 15);
    cyanLight.position.set(-4, 3, 2);
    scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 0.35, 12);
    purpleLight.position.set(4, -2, 3);
    scene.add(purpleLight);

    const roseLight = new THREE.PointLight(0xff6b9d, 0.25, 10);
    roseLight.position.set(0, -4, 4);
    scene.add(roseLight);

    const goldLight = new THREE.PointLight(0xffd700, 0.3, 12);
    goldLight.position.set(0, 3, 3);
    scene.add(goldLight);

    // === Star field ===
    const starCount = isSubtle ? 1000 : 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 100;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.06, color: 0xffe8a0, transparent: true, opacity: 0.5,
      sizeAttenuation: true, depthWrite: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // === Warm neon particles ===
    function createParticles(count: number, color: number) {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 16;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.1, color, transparent: true, opacity: 0.4,
        sizeAttenuation: true, depthWrite: false,
      });
      return new THREE.Points(geo, mat);
    }
    const goldParticles = createParticles(isSubtle ? 15 : 40, 0xffd700);
    const tealParticles = createParticles(isSubtle ? 10 : 25, 0x4fd1c5);
    scene.add(goldParticles);
    scene.add(tealParticles);

    // === Frequency rings — 432Hz sound wave pulses ===
    // 6 thin torus rings, each cycling at 5.5s, staggered so one fires every ~0.9s
    const RING_COUNT = 6;
    const RING_CYCLE = 5.5;
    const ringMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const geo = new THREE.TorusGeometry(1, 0.008, 8, 96);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      // Torus lies in XY plane by default — correct for camera looking along Z
      scene.add(ring);
      ringMeshes.push(ring);
    }

    // === Sacred Geometry (centerpiece) ===
    let sacredGroup: THREE.Group | null = null;
    if (sacredGeometry === "flower") {
      sacredGroup = createFlowerOfLife(scene);
    } else if (sacredGeometry === "merkaba") {
      sacredGroup = createMerkaba(scene);
    } else if (sacredGeometry === "fibonacci") {
      sacredGroup = createFibonacciSpiral(scene);
    } else if (sacredGeometry === "metatron") {
      sacredGroup = createMetatronsCube(scene);
    }

    // Start materialized (scale 0 for page-entry materialization)
    if (sacredGroup) sacredGroup.scale.setScalar(0);

    // === Ambient fill (surrounding void) ===
    const ambientGroup = sacredGeometry ? createAmbientFill(scene, sacredGeometry) : null;

    // === Mouse tracking ===
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // === Scroll tracking (for depth parallax) ===
    const scroll = { y: window.scrollY };
    const onScroll = () => { scroll.y = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    // === Resize ===
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // === Animation loop ===
    const clock = new THREE.Clock();
    let animId: number;

    // Proximity boost: smoothed value for mouse proximity reaction
    let proximityBoost = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // ── Stars ──
      stars.rotation.y += 0.0002;
      stars.rotation.x += 0.0001;

      // ── Floating particles ──
      const goldArr = goldParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < goldArr.length / 3; i++) {
        goldArr[i * 3 + 1] += Math.sin(elapsed + i) * 0.0008;
      }
      goldParticles.geometry.attributes.position.needsUpdate = true;

      const tealArr = tealParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < tealArr.length / 3; i++) {
        tealArr[i * 3 + 1] += Math.cos(elapsed + i * 0.7) * 0.0008;
      }
      tealParticles.geometry.attributes.position.needsUpdate = true;

      // ── Frequency rings (432Hz sound wave pulses at 5.5s cadence) ──
      ringMeshes.forEach((ring, i) => {
        // Each ring gets a staggered phase offset so they fire sequentially
        const phase = ((elapsed / RING_CYCLE) + (i / RING_COUNT)) % 1; // 0..1
        const scale = 0.08 + phase * 3.8; // expand from tiny to wide
        ring.scale.setScalar(scale);
        // Bright at birth, fade as it expands — easeOut
        const alpha = Math.pow(1 - phase, 1.6);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.22 * alpha;
        // Color temperature shifts subtly: inner rings more teal, outer more violet
        const colorT = phase;
        (ring.material as THREE.MeshBasicMaterial).color.setRGB(
          colorT * 0.66,
          0.83 - colorT * 0.50,
          1.0,
        );
      });

      // ── Sacred geometry centerpiece ──
      if (sacredGroup) {
        // Page-entry materialization: scale 0 → 1 over 2s with easeOutCubic
        if (elapsed < 2.0) {
          const t = elapsed / 2.0;
          const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
          sacredGroup.scale.setScalar(eased);
        } else {
          // Route transition: spin-down then spin-up
          const rt = routeTransRef.current;
          if (rt.active) {
            rt.progress += 0.035; // ~28 frames for half cycle
            if (rt.progress < 1) {
              // Phase 1: scale down + accelerate spin
              const s = Math.pow(1 - rt.progress, 1.5);
              sacredGroup.scale.setScalar(Math.max(0.001, s));
            } else if (rt.progress < 2) {
              // Phase 2: scale back up
              const s = Math.pow(rt.progress - 1, 1.5);
              sacredGroup.scale.setScalar(s);
            } else {
              rt.active = false;
              rt.progress = 0;
              sacredGroup.scale.setScalar(1);
            }
          }
        }

        // Animate the geometry itself
        if (sacredGeometry === "flower") animateFlowerOfLife(sacredGroup, elapsed);
        else if (sacredGeometry === "merkaba") animateMerkaba(sacredGroup, elapsed);
        else if (sacredGeometry === "fibonacci") animateFibonacciSpiral(sacredGroup, elapsed);
        else if (sacredGeometry === "metatron") animateMetatronsCube(sacredGroup, elapsed);

        // Mouse proximity reaction: extra spin boost when cursor is near center
        const dist = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y);
        const targetBoost = Math.max(0, 1 - dist / 0.6); // 1 at center, 0 at radius 0.6
        proximityBoost = THREE.MathUtils.lerp(proximityBoost, targetBoost, 0.04);
        sacredGroup.rotation.z += proximityBoost * 0.010; // gentle extra spin

        // Scroll depth parallax: geometry recedes as user scrolls down
        const targetZ = -scroll.y * 0.003;
        sacredGroup.position.z = THREE.MathUtils.lerp(sacredGroup.position.z, targetZ, 0.04);
      }

      // ── Ambient fill ──
      if (ambientGroup) animateAmbientFill(ambientGroup, elapsed);

      // ── Light pulsing (base intensity) ──
      cyanLight.intensity = 0.5 + Math.sin(elapsed * 0.8) * 0.15;
      purpleLight.intensity = 0.35 + Math.sin(elapsed * 0.6 + 1) * 0.1;
      goldLight.intensity = 0.3 + Math.sin(elapsed * 1.14) * 0.1;

      // ── Color temperature drift: teal → violet → teal over 90s ──
      // t = 0 → teal (#00d4ff), t = 1 → violet (#a855f7)
      const tempT = (Math.sin((elapsed / 90) * Math.PI * 2) + 1) * 0.5;
      cyanLight.color.setRGB(
        THREE.MathUtils.lerp(0.000, 0.659, tempT),
        THREE.MathUtils.lerp(0.831, 0.333, tempT),
        THREE.MathUtils.lerp(1.000, 0.969, tempT),
      );
      purpleLight.color.setRGB(
        THREE.MathUtils.lerp(0.659, 0.000, tempT),
        THREE.MathUtils.lerp(0.333, 0.831, tempT),
        THREE.MathUtils.lerp(0.969, 1.000, tempT),
      );

      // ── Camera parallax ──
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouse.x * 0.5, 0.02);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, mouse.y * 0.3, 0.02);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // === Cleanup ===
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isSubtle, sacredGeometry]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
