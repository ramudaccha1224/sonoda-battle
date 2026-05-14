"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * バトルステージ。
 * 明るい草原に土俵（土色のサークル）が置かれているイメージ。
 *
 *   ┌────── 草原（草色の広大な床） ──────┐
 *   │                                       │
 *   │       (草の小束 ✿ ✿ ✿)               │
 *   │                                       │
 *   │      ╭───── 外周（濃い緑） ─────╮     │
 *   │      │   ╭── 土俵（土色） ───╮ │     │
 *   │      │   │  [中央ライン]     │ │     │
 *   │      │   ╰───────────────────╯ │     │
 *   │      ╰────────────────────────╯     │
 *   │                                       │
 *   └───────────────────────────────────────┘
 */
export function Stadium() {
  // 草の小束を擬似乱数で配置（決定論なので毎回同じ位置）
  const grassTufts = useMemo(() => {
    const tufts: { pos: [number, number, number]; rot: number; scale: number }[] = [];
    let seed = 12345;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 70; i++) {
      // 土俵の外側 (radius 12〜30) にぱらぱら
      const angle = rand() * Math.PI * 2;
      const dist = 12 + rand() * 18;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      tufts.push({
        pos: [x, -0.4, z],
        rot: rand() * Math.PI * 2,
        scale: 0.6 + rand() * 0.7,
      });
    }
    return tufts;
  }, []);

  return (
    <group>
      {/* メインの土俵（土色） */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[8, 8, 0.4, 64]} />
        <meshStandardMaterial color="#c8a778" roughness={1} metalness={0} />
      </mesh>

      {/* リングのライン（白） */}
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.4, 7.7, 64]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>

      {/* 中央のライン */}
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 0.15]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* 外周の濃い緑リング（土俵の縁取り） */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <cylinderGeometry args={[12, 12, 0.6, 64]} />
        <meshStandardMaterial color="#4d883f" roughness={1} metalness={0} />
      </mesh>

      {/* 草原（広大な明るい緑の床） */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.4, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#82c25c" roughness={1} metalness={0} />
      </mesh>

      {/* 草の小束（装飾） */}
      {grassTufts.map((t, i) => (
        <group key={i} position={t.pos} rotation={[0, t.rot, 0]} scale={t.scale}>
          {/* 3 本の細い緑の円錐 */}
          <mesh position={[0, 0.18, 0]} castShadow>
            <coneGeometry args={[0.08, 0.4, 6]} />
            <meshStandardMaterial color="#4f9d3f" roughness={1} metalness={0} />
          </mesh>
          <mesh
            position={[0.09, 0.15, 0.05]}
            rotation={[0, 0, 0.25]}
            castShadow
          >
            <coneGeometry args={[0.06, 0.32, 6]} />
            <meshStandardMaterial color="#5dab4a" roughness={1} metalness={0} />
          </mesh>
          <mesh
            position={[-0.08, 0.16, 0.04]}
            rotation={[0, 0, -0.2]}
            castShadow
          >
            <coneGeometry args={[0.07, 0.36, 6]} />
            <meshStandardMaterial color="#4f9d3f" roughness={1} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
