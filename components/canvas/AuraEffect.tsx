"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

interface Props {
  /** オーラを出す位置（モンスターの頭上などのワールド座標） */
  position: [number, number, number];
  color: string;
  active: boolean;
}

/**
 * モンスターの頭上に出る "きらきら" オーラ。
 * 4 つの小さな球がリング状にゆっくり回り、明滅する。
 * 変化技（バフ・回復・状態異常付与）の演出に使う。
 */
export function AuraEffect({ position, color, active }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (!active) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = t * 1.2;
    // 全体をふわふわ上下に動かす
    groupRef.current.position.y = position[1] + Math.sin(t * 2) * 0.08;
  });

  // リング状に 4 個の小球
  const RADIUS = 0.45;
  const N = 4;
  const stars: [number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    stars.push([Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS]);
  }

  return (
    <group ref={groupRef} position={position}>
      {stars.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.5}
            roughness={1}
            metalness={0}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* 中央に少しだけ大きめのコア */}
      <mesh>
        <sphereGeometry args={[0.12, 14, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.5}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}
