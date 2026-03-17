import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Float,
  MeshTransmissionMaterial,
  Environment,
  Sparkles,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  Vignette,
} from "@react-three/postprocessing";
import * as THREE from "three";

/* ─── Floating Glass Panel ─────────────────────────────────── */

function GlassPanel({
  position,
  rotation,
  scale,
  speed = 1,
  color = "#00d4ff",
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  speed?: number;
  color?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const initialY = position[1];

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed;
    ref.current.position.y = initialY + Math.sin(t * 0.6) * 0.15;
    ref.current.rotation.x = rotation[0] + Math.sin(t * 0.4) * 0.03;
    ref.current.rotation.y = rotation[1] + Math.cos(t * 0.3) * 0.04;
  });

  return (
    <Float speed={speed * 0.5} rotationIntensity={0.15} floatIntensity={0.3}>
      <mesh ref={ref} position={position} rotation={rotation} scale={scale}>
        <roundedBoxGeometry args={[1, 1, 0.02, 4, 0.02]} />
        <MeshTransmissionMaterial
          backside
          thickness={0.1}
          chromaticAberration={0.02}
          anisotropy={0.3}
          roughness={0.15}
          distortion={0.0}
          color={color}
          attenuationColor="#00d4ff"
          attenuationDistance={3}
          transmission={0.92}
          ior={1.5}
          toneMapped
        />
      </mesh>
    </Float>
  );
}

/* ─── Glowing Edge Ring ────────────────────────────────────── */

function GlowRing({
  radius = 2,
  speed = 0.3,
  color = "#00d4ff",
  opacity = 0.15,
}: {
  radius?: number;
  speed?: number;
  color?: string;
  opacity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.z = t * speed;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity + Math.sin(t * 1.2) * 0.05;
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.005, 16, 100]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─── Subtle Grid Floor ────────────────────────────────────── */

function GridFloor() {
  const gridTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(0, 212, 255, 0.08)";
    ctx.lineWidth = 1;

    const step = 32;
    for (let i = 0; i <= 512; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

  if (!gridTexture) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial
        map={gridTexture}
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─── Floating Particles (warm gold + cyan) ─────────────── */

function DualSparkles() {
  return (
    <>
      <Sparkles
        count={80}
        scale={[12, 8, 8]}
        size={1.5}
        speed={0.25}
        color="#00d4ff"
        opacity={0.5}
      />
      <Sparkles
        count={40}
        scale={[10, 6, 6]}
        size={2}
        speed={0.15}
        color="#ffd700"
        opacity={0.35}
      />
      <Sparkles
        count={30}
        scale={[14, 10, 10]}
        size={1}
        speed={0.35}
        color="#a855f7"
        opacity={0.3}
      />
    </>
  );
}

/* ─── Camera Parallax (mouse-following) ─────────────────── */

function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      mouse.current.x * 0.6,
      0.03,
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      mouse.current.y * 0.3 + 0.3,
      0.03,
    );
    camera.lookAt(0, 0, 0);
  });

  // Attach listener once
  useMemo(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}

/* ─── Main Scene ─────────────────────────────────────────── */

function FlamesScene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} color="#ffffff" />
      <pointLight position={[-4, 3, 3]} intensity={1.2} color="#00d4ff" distance={15} />
      <pointLight position={[4, -2, 4]} intensity={0.8} color="#a855f7" distance={12} />
      <pointLight position={[0, 4, 2]} intensity={0.6} color="#ffd700" distance={10} />
      <directionalLight position={[5, 5, 5]} intensity={0.25} color="#ffffff" />

      {/* Grid floor */}
      <GridFloor />

      {/* Floating glass panels — arranged like flames.blue's floating cards */}
      <GlassPanel
        position={[-3.2, 1.5, -2]}
        rotation={[0.1, 0.3, -0.05]}
        scale={[1.8, 1.2, 1]}
        speed={0.7}
        color="#00d4ff"
      />
      <GlassPanel
        position={[3.5, -0.5, -3]}
        rotation={[-0.05, -0.2, 0.1]}
        scale={[2.2, 1.4, 1]}
        speed={0.5}
        color="#a855f7"
      />
      <GlassPanel
        position={[-1.8, -1.8, -4]}
        rotation={[0.08, 0.15, 0.05]}
        scale={[1.6, 1.0, 1]}
        speed={0.9}
        color="#ffd700"
      />
      <GlassPanel
        position={[2.0, 2.0, -1.5]}
        rotation={[-0.12, -0.1, -0.08]}
        scale={[1.4, 0.9, 1]}
        speed={0.6}
        color="#00d4ff"
      />
      <GlassPanel
        position={[0.5, -2.5, -5]}
        rotation={[0.05, 0.25, 0.03]}
        scale={[2.0, 1.3, 1]}
        speed={0.4}
        color="#4fd1c5"
      />

      {/* Glow rings */}
      <GlowRing radius={2.5} speed={0.15} color="#00d4ff" opacity={0.12} />
      <GlowRing radius={4.0} speed={-0.08} color="#ffd700" opacity={0.08} />
      <GlowRing radius={1.5} speed={0.25} color="#a855f7" opacity={0.10} />

      {/* Sparkle particles */}
      <DualSparkles />

      {/* Camera parallax */}
      <CameraRig />

      {/* Environment for reflections */}
      <Environment preset="night" />

      {/* Post-processing: bloom + depth-of-field + vignette */}
      <EffectComposer multisampling={4}>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          radius={0.8}
        />
        <DepthOfField
          focusDistance={0}
          focalLength={0.05}
          bokehScale={3}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
      </EffectComposer>
    </>
  );
}

/* ─── Exported Wrapper ──────────────────────────────────── */

export default function FlamesHeroScene() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "linear-gradient(180deg, #000000 0%, #050318 40%, #0a0520 100%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.3, 6], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
        }}
        style={{ pointerEvents: "auto" }}
      >
        <FlamesScene />
      </Canvas>
    </div>
  );
}
