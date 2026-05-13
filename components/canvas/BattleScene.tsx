"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useSpring, animated, easings } from "@react-spring/three";
import { Stadium } from "./Stadium";
import { MonsterMesh } from "./MonsterMesh";
import { getMonsterDef } from "@/lib/monsters/definitions";
import type { BattleSnapshot, PlayerSlot } from "@/lib/battle/types";

interface Props {
  snapshot: BattleSnapshot;
  yourSlot: PlayerSlot;
  /** 直前のターンで誰がダメージを受けたか（揺れ・＞＜表情用） */
  damagedSlot?: PlayerSlot | null;
  /** いま攻撃モーション中の slot。null なら全員ホームポジション。 */
  attackerSlot?: PlayerSlot | null;
}

// ホームポジション
const HOME_POSITIONS: Record<"yours" | "opp", [number, number, number]> = {
  yours: [-2, 0.4, 3],   // 自分側: 手前 (Z+)
  opp: [2, 0.4, -3],     // 相手側: 奥 (Z-)
};

// 攻撃ストライク位置: 相手の少し手前で停止する
function attackPositionFor(
  attacker: "yours" | "opp",
): [number, number, number] {
  const defenderHome = HOME_POSITIONS[attacker === "yours" ? "opp" : "yours"];
  const attackerHome = HOME_POSITIONS[attacker];
  const lerp = 0.6;
  return [
    attackerHome[0] + (defenderHome[0] - attackerHome[0]) * lerp,
    defenderHome[1],
    attackerHome[2] + (defenderHome[2] - attackerHome[2]) * lerp,
  ];
}

// カメラ設定
const WIDE_CAM_POS: [number, number, number] = [0, 4.5, 10];
const WIDE_CAM_LOOK: [number, number, number] = [0, 1, 0];

/** 攻撃中の close-up カメラの位置と注視点を計算する */
function closeUpFor(attacker: "yours" | "opp"): {
  pos: [number, number, number];
  look: [number, number, number];
} {
  const aHome = HOME_POSITIONS[attacker];
  const dHome = HOME_POSITIONS[attacker === "yours" ? "opp" : "yours"];
  // ストライク地点 (70% 寄り)
  const strikeX = aHome[0] + (dHome[0] - aHome[0]) * 0.7;
  const strikeZ = aHome[2] + (dHome[2] - aHome[2]) * 0.7;
  // 攻撃方向ベクトルに垂直 (90° CCW)
  const dx = dHome[0] - aHome[0];
  const dz = dHome[2] - aHome[2];
  const len = Math.sqrt(dx * dx + dz * dz);
  let perpX = -dz / len;
  let perpZ = dx / len;
  // 観客側 (+Z) に来るように向きを反転
  if (perpZ < 0) {
    perpX = -perpX;
    perpZ = -perpZ;
  }
  const camDist = 4.0;
  return {
    pos: [strikeX + perpX * camDist, 2.4, strikeZ + perpZ * camDist],
    look: [strikeX, 1.2, strikeZ],
  };
}

export function BattleScene({ snapshot, yourSlot, damagedSlot, attackerSlot }: Props) {
  const opponentSlot: PlayerSlot = yourSlot === "p1" ? "p2" : "p1";

  const yourActive = snapshot.players[yourSlot].party[snapshot.players[yourSlot].activeIndex];
  const oppActive = snapshot.players[opponentSlot].party[snapshot.players[opponentSlot].activeIndex];

  const yourDef = getMonsterDef(yourActive.defId);
  const oppDef = getMonsterDef(oppActive.defId);

  // damaged フラッシュは local state で短時間トリガする
  const [flashYou, setFlashYou] = useState(false);
  const [flashOpp, setFlashOpp] = useState(false);
  useEffect(() => {
    if (damagedSlot === yourSlot) {
      setFlashYou(true);
      const t = setTimeout(() => setFlashYou(false), 800);
      return () => clearTimeout(t);
    }
    if (damagedSlot === opponentSlot) {
      setFlashOpp(true);
      const t = setTimeout(() => setFlashOpp(false), 800);
      return () => clearTimeout(t);
    }
  }, [damagedSlot, yourSlot, opponentSlot]);

  // 攻撃モーションの target: "yours" / "opp" / null
  const attackerTag: "yours" | "opp" | null =
    attackerSlot == null
      ? null
      : attackerSlot === yourSlot
      ? "yours"
      : "opp";

  return (
    <Canvas shadows className="!h-full !w-full">
      <PerspectiveCamera makeDefault fov={45} position={WIDE_CAM_POS} />
      <OrbitControls
        enabled={attackerTag == null}
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 1, 0]}
      />

      <CameraDirector attackerTag={attackerTag} />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 6, -3]} intensity={0.3} color="#9bb6ff" />

      <Stadium />

      {/* 自分側モンスター */}
      <AnimatedCat
        homePos={HOME_POSITIONS.yours}
        attackPos={attackPositionFor("yours")}
        active={attackerTag === "yours"}
      >
        <MonsterMesh
          def={yourDef}
          position={[0, 0, 0]}
          facing="back"
          fainted={yourActive.fainted}
          damaged={flashYou}
          label={`${yourActive.currentHp}/${yourDef.stats.hp} ${yourDef.name}`}
        />
      </AnimatedCat>

      {/* 相手側モンスター */}
      <AnimatedCat
        homePos={HOME_POSITIONS.opp}
        attackPos={attackPositionFor("opp")}
        active={attackerTag === "opp"}
      >
        <MonsterMesh
          def={oppDef}
          position={[0, 0, 0]}
          facing="front"
          fainted={oppActive.fainted}
          damaged={flashOpp}
          label={`${oppDef.name} ${oppActive.currentHp}/${oppDef.stats.hp}`}
        />
      </AnimatedCat>
    </Canvas>
  );
}

/**
 * カメラを「引き」と「攻撃中クローズアップ」の間で滑らかに動かす。
 * OrbitControls はバトル外では有効、攻撃中は無効化して干渉を避ける。
 */
function CameraDirector({ attackerTag }: { attackerTag: "yours" | "opp" | null }) {
  const { camera } = useThree();
  const targetPosRef = useRef(new THREE.Vector3(...WIDE_CAM_POS));
  const targetLookRef = useRef(new THREE.Vector3(...WIDE_CAM_LOOK));
  const currentLookRef = useRef(new THREE.Vector3(...WIDE_CAM_LOOK));

  useEffect(() => {
    if (attackerTag == null) {
      targetPosRef.current.set(...WIDE_CAM_POS);
      targetLookRef.current.set(...WIDE_CAM_LOOK);
    } else {
      const { pos, look } = closeUpFor(attackerTag);
      targetPosRef.current.set(...pos);
      targetLookRef.current.set(...look);
    }
  }, [attackerTag]);

  useFrame((_, delta) => {
    // 速度: アップ時は速め、引き時はゆっくり戻す
    const speed = attackerTag != null ? 3.5 : 2.0;
    const k = Math.min(1, delta * speed);
    camera.position.lerp(targetPosRef.current, k);
    currentLookRef.current.lerp(targetLookRef.current, k);
    camera.lookAt(currentLookRef.current);
  });

  return null;
}

/**
 * モンスターを「ホーム」と「攻撃ストライク位置」の間で滑らかに移動させ、
 * 同時に squash & stretch スケールアニメをかけるラッパー。
 *
 * - 移動: 放物線（ジャンプ感）を加味して位置を補間
 * - スケール: react-spring で anticipation → flight → impact → recover を切り替え
 */
function AnimatedCat({
  homePos,
  attackPos,
  active,
  children,
}: {
  homePos: [number, number, number];
  attackPos: [number, number, number];
  active: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const targetRef = useRef(0);

  // 移動の進行度に応じて呼び出される (フレームごと)
  useEffect(() => {
    targetRef.current = active ? 1 : 0;
  }, [active]);

  // squash & stretch スケール
  const [styles, api] = useSpring(() => ({
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    config: { tension: 220, friction: 14 },
  }));

  // active 変化時にシーケンスを発火
  useEffect(() => {
    if (active) {
      // 0ms: しゃがみ込み (anticipation)
      api.start({ scaleX: 1.15, scaleY: 0.8, scaleZ: 1.15 });
      // 130ms: ジャンプ伸び (in flight, 縦に伸びる)
      const t1 = setTimeout(() => {
        api.start({ scaleX: 0.9, scaleY: 1.18, scaleZ: 0.9 });
      }, 130);
      // 700ms: 着弾 (相手にぶつかってつぶれる)
      const t2 = setTimeout(() => {
        api.start({
          scaleX: 1.22,
          scaleY: 0.78,
          scaleZ: 1.22,
          config: { tension: 320, friction: 10 },
        });
      }, 700);
      // 920ms: リバウンド
      const t3 = setTimeout(() => {
        api.start({
          scaleX: 0.95,
          scaleY: 1.08,
          scaleZ: 0.95,
          config: { tension: 200, friction: 14 },
        });
      }, 920);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      // 帰宅 → 通常スケールに緩やかに戻る
      api.start({
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        config: { tension: 160, friction: 18 },
      });
    }
  }, [active, api]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = targetRef.current;
    const current = progressRef.current;
    const diff = target - current;
    if (Math.abs(diff) > 0.001) {
      const duration = target > current ? 0.7 : 0.5;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), delta / duration);
      progressRef.current = current + step;
    }
    const t = progressRef.current;
    const eased = easings.easeOutCubic(t);

    // 放物線でジャンプ感: 0 → ピーク → 0
    const jumpHeight = 0.55 * 4 * eased * (1 - eased);

    ref.current.position.x = homePos[0] + (attackPos[0] - homePos[0]) * eased;
    ref.current.position.y = homePos[1] + (attackPos[1] - homePos[1]) * eased + jumpHeight;
    ref.current.position.z = homePos[2] + (attackPos[2] - homePos[2]) * eased;
  });

  return (
    <group ref={ref}>
      <animated.group
        scale-x={styles.scaleX}
        scale-y={styles.scaleY}
        scale-z={styles.scaleZ}
      >
        {children}
      </animated.group>
    </group>
  );
}
