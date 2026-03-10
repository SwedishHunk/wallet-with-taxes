import { useRef, useEffect } from "react";
import * as THREE from "three";

type Props = { intensity?: "full" | "subtle" };

export default function CyberpunkScene({ intensity = "full" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSubtle = intensity === "subtle";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // === Renderer ===
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // === Scene & Camera ===
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    // === Lighting ===
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const cyanLight = new THREE.PointLight(0x00d4ff, 0.6, 15);
    cyanLight.position.set(-4, 3, 2);
    scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 0.4, 12);
    purpleLight.position.set(4, -2, 3);
    scene.add(purpleLight);

    const greenLight = new THREE.PointLight(0x00ff88, 0.3, 10);
    greenLight.position.set(0, -4, 4);
    scene.add(greenLight);

    // === Star field ===
    const starCount = isSubtle ? 1200 : 2500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 100;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0x88ccff,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // === Neon particles ===
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
        size: 0.12,
        color,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        depthWrite: false,
      });
      return new THREE.Points(geo, mat);
    }
    const cyanParticles = createParticles(isSubtle ? 25 : 60, 0x00d4ff);
    const purpleParticles = createParticles(isSubtle ? 15 : 35, 0xa855f7);
    scene.add(cyanParticles);
    scene.add(purpleParticles);

    // === Floating meshes ===
    type MeshConfig = {
      pos: [number, number, number];
      geo: THREE.BufferGeometry;
      color: number;
      scale: number;
      speed: number;
    };

    const meshConfigs: MeshConfig[] = isSubtle
      ? [
          { pos: [-4, 2, -4], geo: new THREE.IcosahedronGeometry(1, 4), color: 0x00d4ff, scale: 0.4, speed: 0.8 },
          { pos: [4, -1, -3], geo: new THREE.OctahedronGeometry(1, 2), color: 0xa855f7, scale: 0.25, speed: 0.6 },
        ]
      : [
          { pos: [-3.5, 1.5, -2], geo: new THREE.IcosahedronGeometry(1, 4), color: 0x00d4ff, scale: 0.8, speed: 1.2 },
          { pos: [3.5, -1, -1.5], geo: new THREE.TorusKnotGeometry(0.8, 0.3, 128, 32), color: 0xa855f7, scale: 0.5, speed: 0.8 },
          { pos: [2, 2.5, -3], geo: new THREE.OctahedronGeometry(1, 2), color: 0x00ff88, scale: 0.35, speed: 1.5 },
          { pos: [-2, -2, -2.5], geo: new THREE.IcosahedronGeometry(1, 4), color: 0x00d4ff, scale: 0.3, speed: 1 },
          { pos: [0, -3, -4], geo: new THREE.TorusGeometry(1, 0.4, 32, 64), color: 0xa855f7, scale: 0.45, speed: 0.6 },
        ];

    const meshes: THREE.Mesh[] = meshConfigs.map(({ pos, geo, color, scale, speed }) => {
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        metalness: 0.1,
        roughness: 0.2,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.scale.setScalar(scale);
      mesh.userData.speed = speed;
      mesh.userData.initialY = pos[1];
      scene.add(mesh);
      return mesh;
    });

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
      const delta = clock.getDelta();

      // Rotate stars slowly
      stars.rotation.y += 0.0003;
      stars.rotation.x += 0.0001;

      // Animate particles
      const cyanArr = cyanParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < cyanArr.length / 3; i++) {
        cyanArr[i * 3 + 1] += Math.sin(elapsed + i) * 0.001;
      }
      cyanParticles.geometry.attributes.position.needsUpdate = true;

      const purpleArr = purpleParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < purpleArr.length / 3; i++) {
        purpleArr[i * 3 + 1] += Math.cos(elapsed + i * 0.7) * 0.001;
      }
      purpleParticles.geometry.attributes.position.needsUpdate = true;

      // Rotate and float meshes
      meshes.forEach((m) => {
        const spd = m.userData.speed as number;
        m.rotation.x += 0.003 * spd;
        m.rotation.y += 0.005 * spd;
        m.position.y = (m.userData.initialY as number) + Math.sin(elapsed * spd) * 0.3;
      });

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
      container.removeChild(renderer.domElement);
    };
  }, [isSubtle]);

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
