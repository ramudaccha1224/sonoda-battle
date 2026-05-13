"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** 発射元 (攻撃者の頭付近 など) */
  from: [number, number, number];
  /** 着弾先 (被弾者の中心) */
  to: [number, number, number];
  /** 発射と着弾までの所要時間 (秒) */
  duration: number;
  /** 球体の色 */
  color: string;
  /** 軌道に放物線をかけるか (魔法弾はちょっと弧を描く) */
  arc?: boolean;
  /** active=true でアニメ開始。false の間は非表示。 */
  active: boolean;
  /** 終端で呼ばれる任意コールバック */
  onArrive?: () => void;
}

/**
 * 魔法弾。攻撃者の口元から放たれて相手にぶつかる小さな光る球。
 * `active` が true になった瞬間からタイマーを開始し、`duration` 秒で `to` に到達する。
 */
export function MagicProjectile({
  from,
  to,
  duration,
  color,
  arc = true,
  active,
  onArrive,
}: Props) {
  const ref = useRef<THREE.Mesh>(null);
  const startRef = useRef<number | null>(null);
  const arrivedRef = useRef(false);

  useEffect(() => {
    if (active) {
      startRef.current = performance.now();
      arrivedRef.current = false;
    } else {
      startRef.current = null;
    }
  }, [active]);

  useFrame(() => {
    if (!ref.current) return;
    if (!active || startRef.current === null) {
      ref.current.visible = false;
      return;
    }
    const t = (performance.now() - startRef.current) / 1000 / duration;
    if (t >= 1) {
      ref.current.visible = false;
      if (!arrivedRef.current) {
        arrivedRef.current = true;
        onArrive?.();
      }
      return;
    }
    ref.current.visible = true;
    // 線形補間 + 放物線の up-arc
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    let y = from[1] + (to[1] - from[1]) * t;
    if (arc) {
      // 中央で頂点を上げる
      y += 1.2 * 4 * t * (1 - t);
    }
    ref.current.position.set(x, y, z);
    // ふわっと脈打つ拡縮
    const pulse = 1 + 0.15 * Math.sin(t * Math.PI * 6);
    ref.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.22, 18, 18]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.8}
        roughness={1}
        metalness={0}
        toneMapped={false}
      />
    </mesh>
  );
}
