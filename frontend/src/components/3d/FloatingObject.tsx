import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

type FloatingObjectProps = {
  position?: [number, number, number];
  geometry?: "icosahedron" | "torus" | "octahedron" | "torusKnot" | "dodecahedron";
  color?: string;
  emissiveIntensity?: number;
  scale?: number;
  speed?: number;
  distort?: number;
  floatIntensity?: number;
  rotationSpeed?: number;
  variant?: "neon" | "distort";
};

export default function FloatingObject({
  position = [0, 0, 0],
  geometry = "icosahedron",
  color = "#00d4ff",
  emissiveIntensity = 0.4,
  scale = 1,
  speed = 1,
  distort = 0.3,
  floatIntensity = 1,
  rotationSpeed = 0.3,
  variant = "neon",
}: FloatingObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * rotationSpeed * 0.5;
      meshRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  const geometryNode = useMemo(() => {
    switch (geometry) {
      case "torus":
        return <torusGeometry args={[1, 0.4, 32, 64]} />;
      case "octahedron":
        return <octahedronGeometry args={[1, 2]} />;
      case "torusKnot":
        return <torusKnotGeometry args={[0.8, 0.3, 128, 32]} />;
      case "dodecahedron":
        return <dodecahedronGeometry args={[1, 0]} />;
      case "icosahedron":
      default:
        return <icosahedronGeometry args={[1, 4]} />;
    }
  }, [geometry]);

  return (
    <Float
      speed={speed}
      rotationIntensity={0.4}
      floatIntensity={floatIntensity}
      floatingRange={[-0.1, 0.1]}
    >
      <mesh ref={meshRef} position={position} scale={scale}>
        {geometryNode}
        {variant === "distort" ? (
          <MeshDistortMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            metalness={0.1}
            roughness={0.2}
            distort={distort}
            speed={speed * 2}
            transparent
            opacity={0.7}
          />
        ) : (
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            metalness={0.1}
            roughness={0.2}
            transparent
            opacity={0.85}
          />
        )}
      </mesh>
    </Float>
  );
}
