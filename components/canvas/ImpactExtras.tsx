"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// ============================================================
// Puff: 被弾点でぽふっと一瞬広がる煙
// ============================================================
export function PuffEffect({
  position,
  active,
  duration = 0.7,
}: {
  position: [number, number, number];
  active: boolean;
  duration?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = active ? performance.now() : null;
  }, [active]);

  useFrame(() => {
    if (!meshRef.current) return;
    if (!active || startRef.current === null) {
      meshRef.current.visible = false;
      return;
    }
    const t = (performance.now() - startRef.current) / 1000 / duration;
    if (t < 0 || t > 1) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    meshRef.current.position.set(...position);
    const scale = 0.6 + t * 1.4;
    meshRef.current.scale.setScalar(scale);
    const m = meshRef.current.material as THREE.MeshStandardMaterial;
    m.opacity = (1 - t) * 0.7;
    m.transparent = true;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[0.35, 14, 14]} />
      <meshStandardMaterial
        color="#f4ead5"
        transparent
        opacity={0.7}
        roughness={1}
      />
    </mesh>
  );
}

// ============================================================
// DizzyStars: 被弾側の頭の上を星がぐるぐる回る
// ============================================================
export function DizzyStarsEffect({
  center,
  active,
  duration = 1.4,
}: {
  /** 被弾側の頭の上のおおよその位置 */
  center: [number, number, number];
  active: boolean;
  duration?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = active ? performance.now() : null;
  }, [active]);

  const stars = useMemo(
    () => [
      { angleOffset: 0, color: "#ffd966" },
      { angleOffset: Math.PI * 2 / 3, color: "#ff8aff" },
      { angleOffset: (Math.PI * 4) / 3, color: "#9bdcff" },
    ],
    [],
  );

  useFrame(() => {
    if (!groupRef.current) return;
    if (!active || startRef.current === null) {
      groupRef.current.visible = false;
      return;
    }
    const t = (performance.now() - startRef.current) / 1000 / duration;
    if (t < 0 || t > 1) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    groupRef.current.position.set(...center);
    const rot = t * 4 * Math.PI;
    groupRef.current.children.forEach((child, i) => {
      const angle = stars[i].angleOffset + rot;
      const radius = 0.5;
      child.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      child.rotation.z = -rot * 1.5;
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - t) * 0.95;
      mat.transparent = true;
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      {stars.map((s, i) => (
        <mesh key={i}>
          {/* 簡略な星: 小さい平たい円錐を 2 つ重ねる代わりにテトラ */}
          <tetrahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial
            color={s.color}
            emissive={s.color}
            emissiveIntensity={1.4}
            toneMapped={false}
            transparent
            opacity={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}
