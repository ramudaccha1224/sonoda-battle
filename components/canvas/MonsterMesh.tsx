"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { MonsterDefinition } from "@/lib/battle/types";
import type { ImpactExtra } from "@/lib/battle/animations";

/**
 * 外から制御できる手足・しっぽ・頭・目への ref 集。
 * AnimatedCat 側がここに書き込んで個別アニメ（パンチ・しっぽ振り・あくび等）を実行する。
 */
export interface LimbRefs {
  body: React.RefObject<THREE.Group | null>;
  head: React.RefObject<THREE.Group | null>;
  leftPaw: React.RefObject<THREE.Mesh | null>;
  rightPaw: React.RefObject<THREE.Mesh | null>;
  tail: React.RefObject<THREE.Mesh | null>;
  leftEye: React.RefObject<THREE.Mesh | null>;
  rightEye: React.RefObject<THREE.Mesh | null>;
}

interface Props {
  def: MonsterDefinition;
  position: [number, number, number];
  /** "back" = カメラに背中を見せる (自分側) / "front" = カメラに顔を見せる (相手側) */
  facing: "front" | "back";
  fainted?: boolean;
  /** 被弾中: 揺れ + ＞＜ 表情を表示する */
  damaged?: boolean;
  /** ひんし時のフェードアウト演出。true になると 1.4 秒かけて不透明度 1→0 */
  fadeOut?: boolean;
  /** ヒット時の追加演出 (被弾側のメッシュ本体に作用するもの: 強い揺れ / ぺしゃっと潰れる) */
  impactExtra?: ImpactExtra;
  /** 部位 ref をマウント時に親へ渡すコールバック (AnimatedCat 用) */
  onLimbRefs?: (refs: LimbRefs) => void;
  label?: string;
}

/**
 * 「おかえりそのだくん」シリーズ風の、ねこのぬいぐるみメッシュ。
 *
 * 形状: 丸い体 + 大きな頭 + 三角の耳 + しっぽ + 目鼻ほっぺ
 *
 * グループ構造:
 *   group (root, 外位置)
 *   └ bodyGroup (体・手足・しっぽ・頭グループ・色斑)
 *       ├ 手足 (ref) / しっぽ (ref)
 *       └ headGroup (位置 [0,1.5,0.05], 独立に回転可)
 *           └ 顔のパーツ (目 ref / 鼻 / 口 / ほっぺ / 耳)
 *
 * onLimbRefs で渡される ref を AnimatedCat が掴むと、
 * 「パンチで右手だけ突き出す」「あくびで頭だけ仰け反らせる」等の局所アニメが可能。
 */
export function MonsterMesh({
  def,
  position,
  facing,
  fainted,
  damaged,
  fadeOut,
  impactExtra,
  onLimbRefs,
  label,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const leftPawRef = useRef<THREE.Mesh>(null);
  const rightPawRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);

  // マウント時に親に ref を渡す
  useEffect(() => {
    if (!onLimbRefs) return;
    onLimbRefs({
      body: bodyGroupRef,
      head: headGroupRef,
      leftPaw: leftPawRef,
      rightPaw: rightPawRef,
      tail: tailRef,
      leftEye: leftEyeRef,
      rightEye: rightEyeRef,
    });
  }, [onLimbRefs]);

  // 揺れ開始時刻
  const shakeStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (damaged) {
      shakeStartRef.current = performance.now();
    } else {
      shakeStartRef.current = null;
    }
  }, [damaged]);

  // フェードアウト (ひんし演出) 開始時刻
  const fadeStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (fadeOut) {
      fadeStartRef.current = performance.now();
    } else {
      fadeStartRef.current = null;
    }
  }, [fadeOut]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // 縦のアイドルバウンス + 倒れ込み
    let baseY = position[1];
    let rotZ = 0;
    if (fainted) {
      baseY = position[1] - 0.5;
      rotZ = Math.PI / 2;
    } else {
      baseY = position[1] + Math.sin(t * 2) * 0.06;
    }

    // 揺れ（被弾）。impactExtra='shake_strong' で振幅を強める
    let shakeX = 0;
    const shakeAmp = impactExtra === "shake_strong" ? 0.32 : 0.18;
    if (shakeStartRef.current !== null) {
      const elapsed = (performance.now() - shakeStartRef.current) / 1000;
      if (elapsed < 0.7) {
        const decay = Math.exp(-elapsed * 4);
        shakeX = Math.sin(elapsed * 30) * shakeAmp * decay;
      }
    }

    groupRef.current.position.x = position[0] + shakeX;
    groupRef.current.position.y = baseY;
    groupRef.current.position.z = position[2];
    groupRef.current.rotation.z = rotZ;

    // ぺしゃっとつぶれる (stretch_flat)
    if (impactExtra === "stretch_flat" && shakeStartRef.current !== null) {
      const elapsed = (performance.now() - shakeStartRef.current) / 1000;
      const win = 0.45;
      if (elapsed < win) {
        const k = 1 - elapsed / win;
        const sy = 1 - 0.55 * k;
        const sxz = 1 + 0.35 * k;
        groupRef.current.scale.set(sxz, sy, sxz);
      } else {
        groupRef.current.scale.set(1, 1, 1);
      }
    } else {
      groupRef.current.scale.set(1, 1, 1);
    }

    // フェードアウト
    let opacity = 1;
    if (fadeStartRef.current !== null) {
      const elapsed = (performance.now() - fadeStartRef.current) / 1000;
      opacity = Math.max(0, 1 - elapsed / 1.4);
    }
    groupRef.current.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && "opacity" in mat) {
        mat.transparent = opacity < 1;
        mat.opacity = opacity;
        mat.depthWrite = opacity > 0.5;
      }
    });
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
      {/* ===== 体グループ (拡縮・全体回転は AnimatedCat 側が触る) ===== */}
      <group ref={bodyGroupRef}>
        {/* 体（やや潰れた球） */}
        <mesh castShadow position={[0, 0.55, 0]} scale={[1.0, 0.85, 1.0]}>
          <sphereGeometry args={[0.85, 32, 24]} />
          <meshStandardMaterial color={body} roughness={1} metalness={0} />
        </mesh>

        {/* お腹 */}
        <mesh position={[0, 0.45, 0.55]} scale={[0.6, 0.55, 0.35]}>
          <sphereGeometry args={[0.85, 24, 18]} />
          <meshStandardMaterial color={belly} roughness={1} metalness={0} />
        </mesh>

        {/* しっぽ */}
        <mesh
          ref={tailRef}
          castShadow
          position={[0, 0.65, -0.85]}
          rotation={[0.6, 0, 0]}
        >
          <capsuleGeometry args={[0.13, 0.7, 8, 16]} />
          <meshStandardMaterial color={body} roughness={1} metalness={0} />
        </mesh>

        {/* 手足 */}
        <mesh ref={rightPawRef} castShadow position={[0.45, 0.1, 0.35]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color={body} roughness={1} metalness={0} />
        </mesh>
        <mesh ref={leftPawRef} castShadow position={[-0.45, 0.1, 0.35]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color={body} roughness={1} metalness={0} />
        </mesh>

        {/* ===== 頭グループ (位置 [0,1.5,0.05] - 顔のパーツは全部この中) ===== */}
        <group ref={headGroupRef} position={[0, 1.5, 0.05]}>
          {/* 頭の球 */}
          <mesh castShadow>
            <sphereGeometry args={[0.72, 32, 24]} />
            <meshStandardMaterial color={body} roughness={1} metalness={0} />
          </mesh>

          {/* 耳（外側） */}
          <mesh castShadow position={[-0.42, 0.55, 0]} rotation={[0, 0, -0.22]}>
            <coneGeometry args={[0.26, 0.55, 18]} />
            <meshStandardMaterial
              color={def.earColors?.left ?? body}
              roughness={1}
              metalness={0}
            />
          </mesh>
          <mesh castShadow position={[0.42, 0.55, 0]} rotation={[0, 0, 0.22]}>
            <coneGeometry args={[0.26, 0.55, 18]} />
            <meshStandardMaterial
              color={def.earColors?.right ?? body}
              roughness={1}
              metalness={0}
            />
          </mesh>
          {/* 耳（内側ピンク） */}
          <mesh position={[-0.42, 0.5, 0.08]} rotation={[0, 0, -0.22]}>
            <coneGeometry args={[0.16, 0.4, 18]} />
            <meshStandardMaterial color={innerEar} roughness={1} metalness={0} />
          </mesh>
          <mesh position={[0.42, 0.5, 0.08]} rotation={[0, 0, 0.22]}>
            <coneGeometry args={[0.16, 0.4, 18]} />
            <meshStandardMaterial color={innerEar} roughness={1} metalness={0} />
          </mesh>

          {/* 顔: 通常 or ＞＜ */}
          {damaged ? (
            // ＞＜ 表情。位置はヘッドグループの原点基準にオフセット。
            <PainEyes />
          ) : (
            <>
              {/* 目 (refを持って外から light glow を制御可能) */}
              <mesh ref={rightEyeRef} position={[0.24, 0.02, 0.61]}>
                <sphereGeometry args={[0.085, 14, 14]} />
                <meshStandardMaterial color="#0d0d0d" />
              </mesh>
              <mesh ref={leftEyeRef} position={[-0.24, 0.02, 0.61]}>
                <sphereGeometry args={[0.085, 14, 14]} />
                <meshStandardMaterial color="#0d0d0d" />
              </mesh>
              {/* ハイライト */}
              <mesh position={[0.26, 0.05, 0.69]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[-0.22, 0.05, 0.69]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </>
          )}

          {/* 鼻 */}
          <mesh position={[0, -0.12, 0.69]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color={nose} />
          </mesh>
          {/* 口 (M字風 2 個) */}
          <mesh position={[-0.05, -0.23, 0.67]} rotation={[0, 0, 0.6]}>
            <torusGeometry args={[0.06, 0.012, 8, 12, Math.PI]} />
            <meshStandardMaterial color="#3a2222" />
          </mesh>
          <mesh position={[0.05, -0.23, 0.67]} rotation={[0, 0, -0.6]}>
            <torusGeometry args={[0.06, 0.012, 8, 12, Math.PI]} />
            <meshStandardMaterial color="#3a2222" />
          </mesh>
          {/* ほっぺ */}
          <mesh position={[0.4, -0.18, 0.53]}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial color={blush} transparent opacity={0.7} />
          </mesh>
          <mesh position={[-0.4, -0.18, 0.53]}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial color={blush} transparent opacity={0.7} />
          </mesh>
        </group>

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
      </group>

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
 * ヘッドグループ内部に置く（position はヘッド原点基準）。
 */
function PainEyes() {
  const len = 0.13;
  const thick = 0.025;
  const ang = 0.46;
  const cz = 0.61;
  const cyL = 0.02, cxL = -0.24;
  const cyR = 0.02, cxR = +0.24;
  const yOffset = 0.03;
  const eyeColor = "#0d0d0d";

  return (
    <group>
      <mesh position={[cxL, cyL + yOffset, cz]} rotation={[0, 0, -ang]}>
        <boxGeometry args={[len, thick, thick]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      <mesh position={[cxL, cyL - yOffset, cz]} rotation={[0, 0, +ang]}>
        <boxGeometry args={[len, thick, thick]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      <mesh position={[cxR, cyR + yOffset, cz]} rotation={[0, 0, +ang]}>
        <boxGeometry args={[len, thick, thick]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
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
