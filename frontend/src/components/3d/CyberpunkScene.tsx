import { useRef, useEffect } from "react";
import * as THREE from "three";
import { createFlowerOfLife, animateFlowerOfLife } from "./FlowerOfLife";
import { createMerkaba, animateMerkaba } from "./Merkaba";
import { createFibonacciSpiral, animateFibonacciSpiral } from "./FibonacciSpiral";

type Props = {
  intensity?: "full" | "subtle";
  sacredGeometry?: "flower" | "merkaba" | "fibonacci";
};

export default function CyberpunkScene({
  intensity = "full",
  sacredGeometry,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSubtle = intensity === "subtle";

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
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    // === Lighting — warm 432Hz palette with neon accents ===
    scene.add(new THREE.AmbientLight(0xfff8e7, 0.1)); // warm ambient

    const warmLight = new THREE.DirectionalLight(0xffd700, 0.2);
    warmLight.position.set(5, 5, 5);
    scene.add(warmLight);

    // Neon accent lights
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
      size: 0.06,
      color: 0xffe8a0,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
      depthWrite: false,
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
        size: 0.1,
        color,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true,
        depthWrite: false,
      });
      return new THREE.Points(geo, mat);
    }
    const goldParticles = createParticles(isSubtle ? 15 : 40, 0xffd700);
    const tealParticles = createParticles(isSubtle ? 10 : 25, 0x4fd1c5);
    scene.add(goldParticles);
    scene.add(tealParticles);

    // === Sacred Geometry ===
    let sacredGroup: THREE.Group | null = null;

    if (sacredGeometry === "flower") {
      sacredGroup = createFlowerOfLife(scene);
    } else if (sacredGeometry === "merkaba") {
      sacredGroup = createMerkaba(scene);
    } else if (sacredGeometry === "fibonacci") {
      sacredGroup = createFibonacciSpiral(scene);
    }

    // === Mouse tracking ===
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

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

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Stars slow rotation
      stars.rotation.y += 0.0002;
      stars.rotation.x += 0.0001;

      // Particle drift
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

      // Animate sacred geometry
      if (sacredGroup) {
        if (sacredGeometry === "flower") animateFlowerOfLife(sacredGroup, elapsed);
        else if (sacredGeometry === "merkaba") animateMerkaba(sacredGroup, elapsed);
        else if (sacredGeometry === "fibonacci") animateFibonacciSpiral(sacredGroup, elapsed);
      }

      // Neon light pulsing
      cyanLight.intensity = 0.5 + Math.sin(elapsed * 0.8) * 0.15;
      purpleLight.intensity = 0.35 + Math.sin(elapsed * 0.6 + 1) * 0.1;
      goldLight.intensity = 0.3 + Math.sin(elapsed * 1.14) * 0.1; // 432Hz harmonic

      // Camera parallax
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
