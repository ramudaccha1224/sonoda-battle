"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// ============================================================
// 共通 helper
// ============================================================

interface BasicEffectProps {
  active: boolean;
  /** active=true になった時点を 0 秒として進行する。秒単位の発生時刻記録用 */
}

// ============================================================
// Beam: 攻撃者の頭から相手の中心まで真っ直ぐ伸びるビーム
// ============================================================
export function BeamEffect({
  from,
  to,
  color,
  active,
  duration = 1.4,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  active: boolean;
  duration?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = active ? performance.now() : null;
  }, [active]);

  useFrame(() => {
    if (!ref.current) return;
    if (!active || startRef.current === null) {
      ref.current.visible = false;
      return;
    }
    const t = (performance.now() - startRef.current) / 1000 / duration;
    if (t < 0 || t > 1) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;

    // from → to を結ぶ円柱として配置
    const fromV = new THREE.Vector3(...from);
    const toV = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(toV, fromV);
    const length = dir.length();
    const midpoint = new THREE.Vector3().addVectors(fromV, toV).multiplyScalar(0.5);
    ref.current.position.copy(midpoint);
    // 円柱は Y 軸方向に伸びる。dir に合わせて回転。
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    ref.current.quaternion.copy(quat);
    // 長さは伸びる演出: 最初の 30% で full length まで、その後収縮
    const lenT = t < 0.3 ? t / 0.3 : 1 - ((t - 0.3) / 0.7) * 0.2;
    ref.current.scale.set(1, length * lenT, 1);
    // 太さは脈動
    const pulse = 1 + Math.sin(t * Math.PI * 8) * 0.2;
    ref.current.scale.x = pulse;
    ref.current.scale.z = pulse;
  });

  return (
    <mesh ref={ref} visible={false}>
      <cylinderGeometry args={[0.12, 0.12, 1, 12, 1, true]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

// ============================================================
// Cloud: 攻撃者から相手へドリフトするもやもや雲
// ============================================================
export function CloudEffect({
  from,
  to,
  color,
  active,
  duration = 1.4,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  active: boolean;
  duration?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = active ? performance.now() : null;
  }, [active]);

  // 5 個の小球を雲のように配置
  const puffs = useMemo(
    () => [
      [0, 0, 0],
      [0.18, 0.05, 0],
      [-0.18, 0.05, 0],
      [0.08, -0.12, 0.05],
      [-0.08, -0.1, -0.05],
    ] as [number, number, number][],
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
    const fromV = new THREE.Vector3(...from);
    const toV = new THREE.Vector3(...to);
    groupRef.current.position.lerpVectors(fromV, toV, t);
    // 大きくなりながら薄くなる
    const scale = 0.6 + t * 1.0;
    groupRef.current.scale.setScalar(scale);
    const opacity = 1 - t * 0.5;
    groupRef.current.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m) {
        m.transparent = true;
        m.opacity = opacity;
      }
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      {puffs.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.25, 14, 14]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================
// RingPulse: 攻撃者から外に広がるリング
// ============================================================
export function RingPulseEffect({
  center,
  color,
  active,
  duration = 1.6,
}: {
  center: [number, number, number];
  color: string;
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
    meshRef.current.position.set(...center);
    const scale = 0.5 + t * 5;
    meshRef.current.scale.set(scale, scale, scale);
    const m = meshRef.current.material as THREE.MeshBasicMaterial;
    m.opacity = (1 - t) * 0.8;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.5, 0.55, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ============================================================
// ZBubble: 「Z」が頭上にぽわっと浮いて流れる（Html を使う）
// ============================================================
export function ZBubbleEffect({
  positions,
  active,
  duration = 1.6,
}: {
  /** 出現させたい位置 (1 つ or 2 つ。お昼寝・あくび用) */
  positions: [number, number, number][];
  active: boolean;
  duration?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = active ? performance.now() : null;
  }, [active]);

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
  });

  return (
    <group ref={groupRef} visible={false}>
      {positions.map((p, i) => (
        <Html
          key={i}
          position={[p[0], p[1] + 0.5, p[2]]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="text-2xl font-bold text-stadium-accent drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]">
            Z<sub className="text-base">z</sub>
            <sub className="text-xs">z</sub>
          </div>
        </Html>
      ))}
    </group>
  );
}

// ============================================================
// SnackIcon: 攻撃者の口元に絵が出る (おやつのじかん用)
// ============================================================
export function SnackIconEffect({
  position,
  active,
  duration = 1.6,
}: {
  position: [number, number, number];
  active: boolean;
  duration?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = active ? performance.now() : null;
  }, [active]);

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
  });

  return (
    <group ref={groupRef} visible={false}>
      <Html position={position} center style={{ pointerEvents: "none" }}>
        <div className="text-3xl drop-shadow">🍰</div>
      </Html>
    </group>
  );
}

// ============================================================
// SparklesBurst: 短時間きらきらが舞う (爪痕・キラキラ等)
// ============================================================
export function SparklesBurstEffect({
  center,
  color,
  active,
  duration = 1.4,
  count = 8,
}: {
  center: [number, number, number];
  color: string;
  active: boolean;
  duration?: number;
  count?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = active ? performance.now() : null;
  }, [active]);

  // 位置オフセットを決定論的に生成
  const offsets = useMemo(() => {
    const arr: [number, number, number][] = [];
    let seed = 4321;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 0.4 + rand() * 0.5;
      arr.push([
        Math.cos(angle) * radius,
        rand() * 1.2,
        Math.sin(angle) * radius,
      ]);
    }
    return arr;
  }, [count]);

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
    groupRef.current.rotation.y = t * 4;
    // それぞれの star を時間で開いて消す
    groupRef.current.children.forEach((child, i) => {
      const phase = (t + i * 0.07) % 1;
      const scale = 0.6 + phase * 0.5;
      child.scale.setScalar(scale);
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat) {
        mat.opacity = (1 - phase) * 0.95;
        mat.transparent = true;
      }
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      {offsets.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.5}
            transparent
            opacity={0.95}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
