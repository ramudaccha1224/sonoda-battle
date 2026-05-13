"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useSpring, animated, easings } from "@react-spring/three";
import { Stadium } from "./Stadium";
import { MonsterMesh } from "./MonsterMesh";
import { MagicProjectile } from "./MagicProjectile";
import { AuraEffect } from "./AuraEffect";
import { getMonsterDef } from "@/lib/monsters/definitions";
import type { BattleSnapshot, PlayerSlot } from "@/lib/battle/types";
import {
  effectColorFor,
  type ActionAnimType,
  type BattlePhase,
} from "@/lib/battle/animations";

interface Props {
  snapshot: BattleSnapshot;
  yourSlot: PlayerSlot;
  damagedSlot?: PlayerSlot | null;
  attackerSlot?: PlayerSlot | null;
  defenderSlot?: PlayerSlot | null;
  animationType?: ActionAnimType | null;
  phase?: BattlePhase;
}

// ホームポジション
const HOME_POSITIONS: Record<"yours" | "opp", [number, number, number]> = {
  yours: [-2, 0.4, 3],
  opp: [2, 0.4, -3],
};

// 物理攻撃のストライク位置: 相手の少し手前で停止する
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

/** アクション中の close-up カメラ位置と注視点 */
function closeUpFor(
  attacker: "yours" | "opp",
  animType: ActionAnimType,
): { pos: [number, number, number]; look: [number, number, number] } {
  const aHome = HOME_POSITIONS[attacker];
  const dHome = HOME_POSITIONS[attacker === "yours" ? "opp" : "yours"];

  // 注視点
  let look: [number, number, number];
  if (animType === "physical_attack" || animType === "magic_attack" || animType === "opponent_curse") {
    // ストライク地点 / 相手寄り
    const f = animType === "physical_attack" ? 0.7 : 0.55;
    look = [
      aHome[0] + (dHome[0] - aHome[0]) * f,
      1.2,
      aHome[2] + (dHome[2] - aHome[2]) * f,
    ];
  } else if (animType === "self_support") {
    // 攻撃者にカメラを寄せる
    look = [aHome[0], 1.2, aHome[2]];
  } else {
    // shared_aura: 真ん中
    look = [0, 1.2, 0];
  }

  // 方向: 攻撃方向に対して 90° 横（観客側 +Z）
  const dx = dHome[0] - aHome[0];
  const dz = dHome[2] - aHome[2];
  const len = Math.sqrt(dx * dx + dz * dz);
  let perpX = -dz / len;
  let perpZ = dx / len;
  if (perpZ < 0) {
    perpX = -perpX;
    perpZ = -perpZ;
  }
  const camDist = 4.0;
  return {
    pos: [look[0] + perpX * camDist, 2.4, look[2] + perpZ * camDist],
    look,
  };
}

/** モンスターの頭の上のおおよそのワールド座標を返す */
function headPosFor(tag: "yours" | "opp"): [number, number, number] {
  const h = HOME_POSITIONS[tag];
  return [h[0], h[1] + 2.0, h[2]];
}

export function BattleScene({
  snapshot,
  yourSlot,
  damagedSlot,
  attackerSlot,
  defenderSlot,
  animationType,
  phase = "idle",
}: Props) {
  const opponentSlot: PlayerSlot = yourSlot === "p1" ? "p2" : "p1";

  const yourActive = snapshot.players[yourSlot].party[snapshot.players[yourSlot].activeIndex];
  const oppActive = snapshot.players[opponentSlot].party[snapshot.players[opponentSlot].activeIndex];

  const yourDef = getMonsterDef(yourActive.defId);
  const oppDef = getMonsterDef(oppActive.defId);

  // damaged フラッシュ
  const [flashYou, setFlashYou] = useState(false);
  const [flashOpp, setFlashOpp] = useState(false);
  useEffect(() => {
    if (damagedSlot === yourSlot) {
      setFlashYou(true);
      const t = setTimeout(() => setFlashYou(false), 1100);
      return () => clearTimeout(t);
    }
    if (damagedSlot === opponentSlot) {
      setFlashOpp(true);
      const t = setTimeout(() => setFlashOpp(false), 1100);
      return () => clearTimeout(t);
    }
  }, [damagedSlot, yourSlot, opponentSlot]);

  const attackerTag: "yours" | "opp" | null =
    attackerSlot == null ? null : attackerSlot === yourSlot ? "yours" : "opp";
  const defenderTag: "yours" | "opp" | null =
    defenderSlot == null ? null : defenderSlot === yourSlot ? "yours" : "opp";

  // 魔法弾 / 相手呪い のエフェクト用
  const isProjectilePhase =
    phase === "impact" &&
    (animationType === "magic_attack" || animationType === "opponent_curse") &&
    attackerTag !== null &&
    defenderTag !== null;

  const projectileColor = effectColorFor(animationType ?? "physical_attack");
  const projectileFrom = attackerTag ? headPosFor(attackerTag) : [0, 0, 0];
  const projectileTo = defenderTag
    ? [HOME_POSITIONS[defenderTag][0], 1.5, HOME_POSITIONS[defenderTag][2]]
    : [0, 0, 0];

  // オーラ (自分強化 / 双方系)
  const isSelfAuraPhase =
    phase === "impact" &&
    (animationType === "self_support" || animationType === "shared_aura") &&
    attackerTag !== null;
  const isSharedAuraPhase = phase === "impact" && animationType === "shared_aura";

  const auraColor = effectColorFor(animationType ?? "self_support");

  return (
    <Canvas shadows className="!h-full !w-full">
      <PerspectiveCamera makeDefault fov={45} position={WIDE_CAM_POS} />
      <OrbitControls
        enabled={phase === "idle"}
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 1, 0]}
      />

      <CameraDirector
        attackerTag={attackerTag}
        animationType={animationType}
        phase={phase}
      />

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
        isAttacker={attackerTag === "yours"}
        animationType={animationType}
        phase={phase}
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
        isAttacker={attackerTag === "opp"}
        animationType={animationType}
        phase={phase}
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

      {/* 魔法弾 (魔法攻撃 / 相手呪い時のみ) */}
      <MagicProjectile
        from={projectileFrom as [number, number, number]}
        to={projectileTo as [number, number, number]}
        duration={1.2}
        color={projectileColor}
        active={isProjectilePhase}
      />

      {/* 自分頭上のオーラ (自分強化系) */}
      {attackerTag && (
        <AuraEffect
          position={headPosFor(attackerTag)}
          color={auraColor}
          active={isSelfAuraPhase}
        />
      )}
      {/* 双方系の場合は防御側にも */}
      {defenderTag && isSharedAuraPhase && (
        <AuraEffect
          position={headPosFor(defenderTag)}
          color={auraColor}
          active={true}
        />
      )}
    </Canvas>
  );
}

/**
 * カメラを「引き」と「攻撃中クローズアップ」の間で滑らかに動かす。
 * 物理: ストライク地点 / 魔法: 相手寄り / 自分強化: 攻撃者 / 双方系: 中央。
 */
function CameraDirector({
  attackerTag,
  animationType,
  phase,
}: {
  attackerTag: "yours" | "opp" | null;
  animationType: ActionAnimType | null | undefined;
  phase: BattlePhase;
}) {
  const { camera } = useThree();
  const targetPosRef = useRef(new THREE.Vector3(...WIDE_CAM_POS));
  const targetLookRef = useRef(new THREE.Vector3(...WIDE_CAM_LOOK));
  const currentLookRef = useRef(new THREE.Vector3(...WIDE_CAM_LOOK));

  useEffect(() => {
    // reaction の中盤以降は引きに戻し始める
    const goingWide =
      attackerTag == null || animationType == null || phase === "idle";
    if (goingWide) {
      targetPosRef.current.set(...WIDE_CAM_POS);
      targetLookRef.current.set(...WIDE_CAM_LOOK);
    } else {
      const { pos, look } = closeUpFor(attackerTag, animationType);
      targetPosRef.current.set(...pos);
      targetLookRef.current.set(...look);
    }
  }, [attackerTag, animationType, phase]);

  useFrame((_, delta) => {
    const close = attackerTag != null && phase !== "idle";
    const speed = close ? 2.5 : 1.6;
    const k = Math.min(1, delta * speed);
    camera.position.lerp(targetPosRef.current, k);
    currentLookRef.current.lerp(targetLookRef.current, k);
    camera.lookAt(currentLookRef.current);
  });

  return null;
}

/**
 * モンスターの位置 + スケールアニメ。
 * animationType + phase の組み合わせで挙動を分岐する。
 *
 * - physical_attack:
 *     approach=ジャンプ接近, impact=着弾ぐっと潰れ, reaction=帰宅
 * - magic_attack / opponent_curse:
 *     approach=その場でふにゃふにゃ上下, impact=構え, reaction=ホームに戻る
 * - self_support / shared_aura:
 *     approach=ふんわり構え, impact=オーラ発動中じっとして輝く, reaction=戻る
 */
function AnimatedCat({
  homePos,
  attackPos,
  isAttacker,
  animationType,
  phase,
  children,
}: {
  homePos: [number, number, number];
  attackPos: [number, number, number];
  isAttacker: boolean;
  animationType?: ActionAnimType | null;
  phase: BattlePhase;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);

  // 物理移動の進行度 0..1
  const moveProgressRef = useRef(0);
  const moveTargetRef = useRef(0);
  // 内部時計（魔法バウンス用、phase 切り替え時にリセット）
  const phaseStartRef = useRef(performance.now());

  // スケール (react-spring)
  const [styles, api] = useSpring(() => ({
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    config: { tension: 220, friction: 14 },
  }));

  // phase が変わったタイミングを記録 + スケールを切り替え
  useEffect(() => {
    phaseStartRef.current = performance.now();
    if (!isAttacker) {
      // 自分が攻撃者でないなら通常スケール
      api.start({ scaleX: 1, scaleY: 1, scaleZ: 1 });
      return;
    }
    const type = animationType;
    if (phase === "approach") {
      // しゃがみ込み
      if (type === "physical_attack") {
        api.start({ scaleX: 1.15, scaleY: 0.85, scaleZ: 1.15 });
        const t1 = setTimeout(() => {
          api.start({ scaleX: 0.92, scaleY: 1.15, scaleZ: 0.92 });
        }, 200);
        return () => clearTimeout(t1);
      } else if (type === "magic_attack" || type === "opponent_curse") {
        api.start({ scaleX: 1.05, scaleY: 0.95, scaleZ: 1.05 }); // 構え
      } else {
        api.start({ scaleX: 1.05, scaleY: 0.95, scaleZ: 1.05 }); // 落ち着いた構え
      }
    } else if (phase === "impact") {
      if (type === "physical_attack") {
        // 着弾 (ぐっと潰れる)
        api.start({
          scaleX: 1.3,
          scaleY: 0.7,
          scaleZ: 1.3,
          config: { tension: 320, friction: 10 },
        });
        const t1 = setTimeout(() => {
          api.start({
            scaleX: 0.97,
            scaleY: 1.05,
            scaleZ: 0.97,
            config: { tension: 180, friction: 14 },
          });
        }, 400);
        return () => clearTimeout(t1);
      } else if (type === "magic_attack" || type === "opponent_curse") {
        // 魔法を放つ瞬間: 大きく伸び上がる
        api.start({
          scaleX: 0.9,
          scaleY: 1.25,
          scaleZ: 0.9,
          config: { tension: 240, friction: 12 },
        });
        const t1 = setTimeout(() => {
          api.start({ scaleX: 1, scaleY: 1, scaleZ: 1 });
        }, 600);
        return () => clearTimeout(t1);
      } else {
        // 自分強化系: わずかに大きくなって光る
        api.start({
          scaleX: 1.08,
          scaleY: 1.08,
          scaleZ: 1.08,
          config: { tension: 160, friction: 18 },
        });
      }
    } else if (phase === "reaction" || phase === "idle") {
      // 戻る
      api.start({
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        config: { tension: 160, friction: 18 },
      });
    }
  }, [phase, isAttacker, animationType, api]);

  // 物理攻撃の場合だけ位置を移動させる目標値
  useEffect(() => {
    const physical = animationType === "physical_attack" && isAttacker;
    // 物理: approach/impact 中は攻撃位置、それ以外はホーム
    if (physical && (phase === "approach" || phase === "impact")) {
      moveTargetRef.current = 1;
    } else {
      moveTargetRef.current = 0;
    }
  }, [animationType, phase, isAttacker]);

  useFrame((_, delta) => {
    if (!ref.current) return;

    // ----- 物理移動 -----
    const target = moveTargetRef.current;
    const current = moveProgressRef.current;
    const diff = target - current;
    if (Math.abs(diff) > 0.001) {
      const duration = target > current ? 1.4 : 1.4; // 1.5s と揃える
      const step = Math.sign(diff) * Math.min(Math.abs(diff), delta / duration);
      moveProgressRef.current = current + step;
    }
    const tMove = moveProgressRef.current;
    const eased = easings.easeInOutCubic(tMove);

    // 放物線でジャンプ感（物理の時だけ）
    const isJumping = animationType === "physical_attack" && isAttacker;
    const jumpHeight = isJumping ? 0.7 * 4 * eased * (1 - eased) : 0;

    let posX = homePos[0] + (attackPos[0] - homePos[0]) * eased;
    let posY = homePos[1] + (attackPos[1] - homePos[1]) * eased + jumpHeight;
    let posZ = homePos[2] + (attackPos[2] - homePos[2]) * eased;

    // ----- 魔法 approach: その場でふにゃふにゃ上下バウンス -----
    if (
      isAttacker &&
      (animationType === "magic_attack" || animationType === "opponent_curse") &&
      phase === "approach"
    ) {
      const elapsed = (performance.now() - phaseStartRef.current) / 1000;
      posY += Math.abs(Math.sin(elapsed * 4)) * 0.5; // 0〜0.5 のジャンプを繰り返す
    }

    // ----- 自分強化 approach/impact: ふんわり浮く -----
    if (
      isAttacker &&
      (animationType === "self_support" || animationType === "shared_aura") &&
      (phase === "approach" || phase === "impact")
    ) {
      const elapsed = (performance.now() - phaseStartRef.current) / 1000;
      posY += Math.sin(elapsed * 2) * 0.15;
    }

    ref.current.position.set(posX, posY, posZ);
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
