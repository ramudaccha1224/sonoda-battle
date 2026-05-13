"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * ポケモンスタジアム風の円形土俵。
 * - 中央のリングは光るマーキング
 * - 周辺に観客席風の段差
 */
export function Stadium() {
  const ringTexture = useMemo(() => null, []);

  return (
    <group>
      {/* メインの土俵 */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[8, 8, 0.4, 64]} />
        <meshStandardMaterial color="#3a4358" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* リングのライン */}
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.4, 7.7, 64]} />
        <meshBasicMaterial color="#5fa8ff" side={THREE.DoubleSide} />
      </mesh>

      {/* 中央のラインで P1/P2 を分ける */}
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 0.15]} />
        <meshBasicMaterial color="#5fa8ff" />
      </mesh>

      {/* 観客席的な外側のリング */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[12, 12, 0.6, 64]} />
        <meshStandardMaterial color="#1c2230" roughness={1} />
      </mesh>

      {/* 床（無限平面）— 影を受ける */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.4, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0b1020" roughness={1} />
      </mesh>
    </group>
  );
}
