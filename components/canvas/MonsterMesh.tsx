"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { MonsterDefinition } from "@/lib/battle/types";

interface Props {
  def: MonsterDefinition;
  position: [number, number, number];
  /** "back" = カメラに背中を見せる (自分側) / "front" = カメラに顔を見せる (相手側) */
  facing: "front" | "back";
  fainted?: boolean;
  /** 被弾中: 揺れ + ＞＜ 表情を表示する */
  damaged?: boolean;
  label?: string;
}

/**
 * 「おかえりそのだくん」シリーズ風の、ねこのぬいぐるみメッシュ。
 *
 * 形状: 丸い体 + 大きな頭 + 三角の耳 + しっぽ + 目鼻ほっぺ
 *
 * 各キャラの差分は MonsterDefinition.displayColor / patches / earColors のみ。
 * 将来 GLTF に差し替えるなら、def.modelUrl があれば
 *   useGLTF(def.modelUrl) で読み込む、という分岐をここに足すだけで良い。
 *   バトルロジック (BattleEngine) はこのファイルを一切知らない。
 *
 * 規約: モデルは「無回転で +Z 方向（カメラ側）を向く」設計。
 *   - 自分側 (facing="back"): rotation Y = π で背中をカメラに向ける
 *   - 相手側 (facing="front"): rotation Y = 0 で顔をカメラに向ける
 *
 * damaged=true のとき:
 *   - 目を ＞＜ に差し替え（4 本の角棒で表現）
 *   - position.x を短時間 sin で揺らす（揺れエフェクト）
 */
export function MonsterMesh({ def, position, facing, fainted, damaged, label }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  // 揺れ開始時刻
  const shakeStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (damaged) {
      shakeStartRef.current = performance.now();
    } else {
      shakeStartRef.current = null;
    }
  }, [damaged]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // 縦のアイドルバウンス（ふんわり呼吸）
    let baseY = position[1];
    let rotZ = 0;
    if (fainted) {
      baseY = position[1] - 0.5;
      rotZ = Math.PI / 2;
    } else {
      baseY = position[1] + Math.sin(t * 2) * 0.06;
    }

    // 揺れ（被弾）: 横方向に減衰振動
    let shakeX = 0;
    if (shakeStartRef.current !== null) {
      const elapsed = (performance.now() - shakeStartRef.current) / 1000;
      if (elapsed < 0.7) {
        const decay = Math.exp(-elapsed * 4);
        shakeX = Math.sin(elapsed * 30) * 0.18 * decay;
      }
    }

    groupRef.current.position.x = position[0] + shakeX;
    groupRef.current.position.y = baseY;
    groupRef.current.position.z = position[2];
    groupRef.current.rotation.z = rotZ;
  });

  const body = def.displayColor;
  const belly = useMemo(() => lighten(body, 0.18), [body]);
  const innerEar = "#f4b5b5";
  const nose = "#e07b96";
  const blush = "#f6c0c8";

  return (
    <group
      ref={groupRef}
      rotation={[0, facing === "back" ? Math.PI : 0, 0]}
    >
      {/* ===== 体（やや潰れた球） ===== */}
      <mesh castShadow position={[0, 0.55, 0]} scale={[1.0, 0.85, 1.0]}>
        <sphereGeometry args={[0.85, 32, 24]} />
        <meshStandardMaterial color={body} roughness={1} metalness={0} metalness={0} />
      </mesh>

      {/* お腹（少し前に出してツートーンに見せる） */}
      <mesh position={[0, 0.45, 0.55]} scale={[0.6, 0.55, 0.35]}>
        <sphereGeometry args={[0.85, 24, 18]} />
        <meshStandardMaterial color={belly} roughness={1} metalness={0} />
      </mesh>

      {/* ===== 頭（大きめの球） ===== */}
      <mesh castShadow position={[0, 1.5, 0.05]}>
        <sphereGeometry args={[0.72, 32, 24]} />
        <meshStandardMaterial color={body} roughness={1} metalness={0} />
      </mesh>

      {/* ===== 耳（外側） ===== */}
      <mesh castShadow position={[-0.42, 2.05, 0.05]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.26, 0.55, 18]} />
        <meshStandardMaterial color={def.earColors?.left ?? body} roughness={1} metalness={0} />
      </mesh>
      <mesh castShadow position={[0.42, 2.05, 0.05]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.26, 0.55, 18]} />
        <meshStandardMaterial color={def.earColors?.right ?? body} roughness={1} metalness={0} />
      </mesh>
      {/* 耳（内側ピンク） */}
      <mesh position={[-0.42, 2.0, 0.13]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.16, 0.4, 18]} />
        <meshStandardMaterial color={innerEar} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0.42, 2.0, 0.13]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.16, 0.4, 18]} />
        <meshStandardMaterial color={innerEar} roughness={1} metalness={0} />
      </mesh>

      {/* ===== しっぽ ===== */}
      <mesh castShadow position={[0, 0.65, -0.85]} rotation={[0.6, 0, 0]}>
        <capsuleGeometry args={[0.13, 0.7, 8, 16]} />
        <meshStandardMaterial color={body} roughness={1} metalness={0} />
      </mesh>

      {/* ===== 顔のパーツ (+Z 側) ===== */}
      {damaged ? (
        // 被弾中: ＞＜ 表情
        <PainEyes />
      ) : (
        <>
          {/* 通常時: 黒い目 + ハイライト */}
          <mesh position={[0.24, 1.52, 0.66]}>
            <sphereGeometry args={[0.085, 14, 14]} />
            <meshStandardMaterial color="#0d0d0d" />
          </mesh>
          <mesh position={[-0.24, 1.52, 0.66]}>
            <sphereGeometry args={[0.085, 14, 14]} />
            <meshStandardMaterial color="#0d0d0d" />
          </mesh>
          <mesh position={[0.26, 1.55, 0.74]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.22, 1.55, 0.74]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </>
      )}

      {/* 鼻 */}
      <mesh position={[0, 1.38, 0.74]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color={nose} />
      </mesh>
      {/* 口 (M 字風) */}
      <mesh position={[-0.05, 1.27, 0.72]} rotation={[0, 0, 0.6]}>
        <torusGeometry args={[0.06, 0.012, 8, 12, Math.PI]} />
        <meshStandardMaterial color="#3a2222" />
      </mesh>
      <mesh position={[0.05, 1.27, 0.72]} rotation={[0, 0, -0.6]}>
        <torusGeometry args={[0.06, 0.012, 8, 12, Math.PI]} />
        <meshStandardMaterial color="#3a2222" />
      </mesh>
      {/* ほっぺ */}
      <mesh position={[0.4, 1.32, 0.58]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={blush} transparent opacity={0.7} />
      </mesh>
      <mesh position={[-0.4, 1.32, 0.58]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={blush} transparent opacity={0.7} />
      </mesh>

      {/* ===== 手足 ===== */}
      <mesh castShadow position={[0.45, 0.1, 0.35]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={body} roughness={1} metalness={0} />
      </mesh>
      <mesh castShadow position={[-0.45, 0.1, 0.35]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={body} roughness={1} metalness={0} />
      </mesh>

      {/* ===== 色斑（三毛などの多色キャラ用） ===== */}
      {def.patches?.map((p, i) => (
        <mesh
          key={`patch-${i}`}
          position={p.position}
          scale={p.squash ?? [1, 1, 1]}
          castShadow
        >
          <sphereGeometry args={[p.scale, 16, 16]} />
          <meshStandardMaterial color={p.color} roughness={1} metalness={0} />
        </mesh>
      ))}

      {label && (
        <Html position={[0, 2.6, 0]} center style={{ pointerEvents: "none" }}>
          <div className="rounded bg-black/70 px-2 py-0.5 text-xs text-white whitespace-nowrap">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * ＞＜ 表情。
 * 4 本の角棒で、左目 ">"・右目 "<" を作る。
 * 目の中心 (cx, cy, cz) は元の丸目と同じ位置に置き、apex は内側（鼻側）を向ける。
 */
function PainEyes() {
  // 棒のサイズ
  const len = 0.13;
  const thick = 0.025;
  const ang = 0.46; // ≈ atan2(H, 2W) for H=0.06, 2W=0.12
  // 目の半幅 W, 半高 H, ストローク中心の y オフセット
  const cz = 0.66;
  const cyL = 1.52, cxL = -0.24; // 左目
  const cyR = 1.52, cxR = +0.24; // 右目
  const yOffset = 0.03;
  const eyeColor = "#0d0d0d";

  return (
    <group>
      {/* 左目 ">" 上ストローク: 右下がり (\\) → rotation -ang */}
      <mesh position={[cxL, cyL + yOffset, cz]} rotation={[0, 0, -ang]}>
        <boxGeometry args={[len, thick, thick]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      {/* 左目 ">" 下ストローク: 右上がり (/) → rotation +ang */}
      <mesh position={[cxL, cyL - yOffset, cz]} rotation={[0, 0, +ang]}>
        <boxGeometry args={[len, thick, thick]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      {/* 右目 "<" 上ストローク: 右上がり (/) → rotation +ang */}
      <mesh position={[cxR, cyR + yOffset, cz]} rotation={[0, 0, +ang]}>
        <boxGeometry args={[len, thick, thick]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      {/* 右目 "<" 下ストローク: 右下がり (\\) → rotation -ang */}
      <mesh position={[cxR, cyR - yOffset, cz]} rotation={[0, 0, -ang]}>
        <boxGeometry args={[len, thick, thick]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
    </group>
  );
}

/** 16進カラーを HSL に変換して明度を上げる（白側にミックス） */
function lighten(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.l = Math.min(1, hsl.l + amount);
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}
