"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Stadium } from "./Stadium";
import { MonsterMesh, type LimbRefs } from "./MonsterMesh";
import { MagicProjectile } from "./MagicProjectile";
import { AuraEffect } from "./AuraEffect";
import { AnimatedCat } from "./AnimatedCat";
import {
  BeamEffect,
  CloudEffect,
  RingPulseEffect,
  ZBubbleEffect,
  SnackIconEffect,
  SparklesBurstEffect,
} from "./EmitEffects";
import { PuffEffect, DizzyStarsEffect } from "./ImpactExtras";
import { getMonsterDef } from "@/lib/monsters/definitions";
import type { BattleSnapshot, PlayerSlot } from "@/lib/battle/types";
import {
  type ActionAnimType,
  type BattlePhase,
  type MoveAnimProfile,
} from "@/lib/battle/animations";

interface Props {
  snapshot: BattleSnapshot;
  yourSlot: PlayerSlot;
  damagedSlot?: PlayerSlot | null;
  attackerSlot?: PlayerSlot | null;
  defenderSlot?: PlayerSlot | null;
  animationType?: ActionAnimType | null;
  phase?: BattlePhase;
  /** 技ごとの固有アニメプロファイル */
  moveAnimProfile?: MoveAnimProfile | null;
  faintingInfo?: {
    slot: PlayerSlot;
    partyIndex: number;
    stage: "reaction" | "fading";
  } | null;
}

// ホームポジション
const HOME_POSITIONS: Record<"yours" | "opp", [number, number, number]> = {
  yours: [-2, 0.4, 3],
  opp: [2, 0.4, -3],
};

// 物理攻撃のストライク位置
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

function closeUpFor(
  attacker: "yours" | "opp",
  animType: ActionAnimType,
  phase: BattlePhase,
): { pos: [number, number, number]; look: [number, number, number] } {
  const aHome = HOME_POSITIONS[attacker];
  const dHome = HOME_POSITIONS[attacker === "yours" ? "opp" : "yours"];
  const isDamagingType =
    animType === "physical_attack" ||
    animType === "magic_attack" ||
    animType === "opponent_curse";

  if (
    isDamagingType &&
    (phase === "impact" || phase === "reaction" || phase === "faint")
  ) {
    const fx = aHome[0] - dHome[0];
    const fz = aHome[2] - dHome[2];
    const flen = Math.sqrt(fx * fx + fz * fz);
    const camDist = 4.2;
    return {
      pos: [
        dHome[0] + (fx / flen) * camDist,
        2.2,
        dHome[2] + (fz / flen) * camDist,
      ],
      look: [dHome[0], 1.4, dHome[2]],
    };
  }

  let look: [number, number, number];
  if (isDamagingType) {
    const f = animType === "physical_attack" ? 0.7 : 0.55;
    look = [
      aHome[0] + (dHome[0] - aHome[0]) * f,
      1.2,
      aHome[2] + (dHome[2] - aHome[2]) * f,
    ];
  } else if (animType === "self_support") {
    look = [aHome[0], 1.2, aHome[2]];
  } else {
    look = [0, 1.2, 0];
  }

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

/** モンスターの頭の上のおおよそのワールド座標 */
function headPosFor(tag: "yours" | "opp"): [number, number, number] {
  const h = HOME_POSITIONS[tag];
  return [h[0], h[1] + 2.0, h[2]];
}
/** モンスターの中央 (胴体) */
function bodyPosFor(tag: "yours" | "opp"): [number, number, number] {
  const h = HOME_POSITIONS[tag];
  return [h[0], h[1] + 1.0, h[2]];
}

export function BattleScene({
  snapshot,
  yourSlot,
  damagedSlot,
  attackerSlot,
  defenderSlot,
  animationType,
  phase = "idle",
  moveAnimProfile,
  faintingInfo,
}: Props) {
  const opponentSlot: PlayerSlot = yourSlot === "p1" ? "p2" : "p1";

  // ひんし演出: 倒れていく方を表示する
  const yourDisplayIndex =
    faintingInfo?.slot === yourSlot
      ? faintingInfo.partyIndex
      : snapshot.players[yourSlot].activeIndex;
  const oppDisplayIndex =
    faintingInfo?.slot === opponentSlot
      ? faintingInfo.partyIndex
      : snapshot.players[opponentSlot].activeIndex;

  const yourActive = snapshot.players[yourSlot].party[yourDisplayIndex];
  const oppActive = snapshot.players[opponentSlot].party[oppDisplayIndex];

  const yourDef = getMonsterDef(yourActive.defId);
  const oppDef = getMonsterDef(oppActive.defId);

  const yourFaintOverride = faintingInfo?.slot === yourSlot ? faintingInfo : null;
  const oppFaintOverride = faintingInfo?.slot === opponentSlot ? faintingInfo : null;
  const yourEffectiveFainted = yourFaintOverride
    ? yourFaintOverride.stage === "fading"
    : yourActive.fainted;
  const oppEffectiveFainted = oppFaintOverride
    ? oppFaintOverride.stage === "fading"
    : oppActive.fainted;
  const yourFadeOut = yourFaintOverride?.stage === "fading";
  const oppFadeOut = oppFaintOverride?.stage === "fading";

  // damaged フラッシュは damagedSlot を直接反映
  const flashYou = damagedSlot === yourSlot;
  const flashOpp = damagedSlot === opponentSlot;

  const attackerTag: "yours" | "opp" | null =
    attackerSlot == null ? null : attackerSlot === yourSlot ? "yours" : "opp";
  const defenderTag: "yours" | "opp" | null =
    defenderSlot == null ? null : defenderSlot === yourSlot ? "yours" : "opp";

  // 手足 ref を AnimatedCat と MonsterMesh で共有
  const yourLimbsRef = useRef<LimbRefs | null>(null);
  const oppLimbsRef = useRef<LimbRefs | null>(null);

  // ===== 各エフェクトの active 判定 =====
  // emit は impact フェーズ中、moveAnimProfile.emit に応じて発動
  const emit = moveAnimProfile?.emit;
  const isImpact = phase === "impact" && attackerTag !== null;

  const emitFrom = attackerTag ? headPosFor(attackerTag) : ([0, 0, 0] as [number, number, number]);
  const emitTo = defenderTag ? bodyPosFor(defenderTag) : ([0, 0, 0] as [number, number, number]);

  const isProjectile = isImpact && emit?.kind === "projectile_sphere";
  const isBeam = isImpact && emit?.kind === "beam";
  const isCloud = isImpact && emit?.kind === "cloud";
  const isRingPulse = isImpact && emit?.kind === "ring_pulse";
  const isSparklesEmit = isImpact && emit?.kind === "sparkles";
  const isZBubble = isImpact && emit?.kind === "z_bubble";
  const isSnackIcon = isImpact && emit?.kind === "snack_icon";

  // impact extra は damagedSlot 反映と同タイミング
  const impactExtra = moveAnimProfile?.impactExtra;
  const isPuff = !!damagedSlot && impactExtra === "puff";
  const isDizzy = !!damagedSlot && impactExtra === "dizzy_stars";

  // ZBubble のターゲット位置
  // - お昼寝 (issho_ohirune): 双方の上
  // - あくびの連鎖 (akubi_rensa): 相手の上
  // 判定は moveAnimProfile から見て、emit=z_bubble & impactExtra なしなら「双方」
  // emit=z_bubble & 攻撃者motion=big_yawn なら「相手の上」
  const zPositions: [number, number, number][] = (() => {
    if (!isZBubble) return [];
    if (moveAnimProfile?.attackerMotion === "big_yawn" && defenderTag) {
      return [headPosFor(defenderTag)];
    }
    // それ以外 (お昼寝など): 双方の上
    const positions: [number, number, number][] = [];
    if (attackerTag) positions.push(headPosFor(attackerTag));
    if (defenderTag) positions.push(headPosFor(defenderTag));
    return positions;
  })();

  // 自分強化系のオーラ (旧仕様継承)
  const isAuraSelf = isImpact &&
    (animationType === "self_support" || animationType === "shared_aura") &&
    attackerTag !== null && !emit;
  const isAuraBoth = isImpact && animationType === "shared_aura";

  return (
    <Canvas shadows className="!h-full !w-full">
      <color attach="background" args={["#b3e0ff"]} />
      <fog attach="fog" args={["#b3e0ff", 25, 60]} />

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

      <ambientLight intensity={0.85} color="#fff5d8" />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.5}
        color="#fff5d8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 6, -3]} intensity={0.35} color="#bcd5ff" />

      <Stadium />

      {/* ===== 自分側 ===== */}
      <AnimatedCat
        homePos={HOME_POSITIONS.yours}
        attackPos={attackPositionFor("yours")}
        isAttacker={attackerTag === "yours"}
        animationType={animationType}
        attackerMotion={attackerTag === "yours" ? moveAnimProfile?.attackerMotion : undefined}
        phase={phase}
        limbsRef={yourLimbsRef}
      >
        <MonsterMesh
          def={yourDef}
          position={[0, 0, 0]}
          facing="back"
          fainted={yourEffectiveFainted}
          fadeOut={yourFadeOut}
          damaged={flashYou}
          impactExtra={defenderTag === "yours" ? impactExtra : undefined}
          onLimbRefs={(refs) => {
            yourLimbsRef.current = refs;
          }}
          label={`${yourActive.currentHp}/${yourDef.stats.hp} ${yourDef.name}`}
        />
      </AnimatedCat>

      {/* ===== 相手側 ===== */}
      <AnimatedCat
        homePos={HOME_POSITIONS.opp}
        attackPos={attackPositionFor("opp")}
        isAttacker={attackerTag === "opp"}
        animationType={animationType}
        attackerMotion={attackerTag === "opp" ? moveAnimProfile?.attackerMotion : undefined}
        phase={phase}
        limbsRef={oppLimbsRef}
      >
        <MonsterMesh
          def={oppDef}
          position={[0, 0, 0]}
          facing="front"
          fainted={oppEffectiveFainted}
          fadeOut={oppFadeOut}
          damaged={flashOpp}
          impactExtra={defenderTag === "opp" ? impactExtra : undefined}
          onLimbRefs={(refs) => {
            oppLimbsRef.current = refs;
          }}
          label={`${oppDef.name} ${oppActive.currentHp}/${oppDef.stats.hp}`}
        />
      </AnimatedCat>

      {/* ===== Emit エフェクト ===== */}
      <MagicProjectile
        from={emitFrom}
        to={emitTo}
        duration={1.2}
        color={emit?.kind === "projectile_sphere" ? emit.color : "#ffffff"}
        active={isProjectile}
      />
      <BeamEffect
        from={emitFrom}
        to={emitTo}
        color={emit?.kind === "beam" ? emit.color : "#ffffff"}
        active={isBeam}
      />
      <CloudEffect
        from={emitFrom}
        to={emitTo}
        color={emit?.kind === "cloud" ? emit.color : "#ffffff"}
        active={isCloud}
      />
      <RingPulseEffect
        center={attackerTag ? bodyPosFor(attackerTag) : [0, 0, 0]}
        color={emit?.kind === "ring_pulse" ? emit.color : "#ffffff"}
        active={isRingPulse}
      />
      <SparklesBurstEffect
        center={attackerTag ? bodyPosFor(attackerTag) : [0, 0, 0]}
        color={emit?.kind === "sparkles" ? emit.color : "#ffffff"}
        active={isSparklesEmit}
      />
      <ZBubbleEffect positions={zPositions} active={isZBubble} />
      <SnackIconEffect
        position={attackerTag ? [headPosFor(attackerTag)[0], headPosFor(attackerTag)[1] - 0.4, headPosFor(attackerTag)[2]] : [0, 0, 0]}
        active={isSnackIcon}
      />

      {/* 旧仕様: emit が無い自分強化 / 双方系の AuraEffect（バフ・回復で emit を持たない技用にフォールバック） */}
      {attackerTag && isAuraSelf && (
        <AuraEffect
          position={headPosFor(attackerTag)}
          color="#ffd966"
          active={true}
        />
      )}
      {defenderTag && isAuraBoth && (
        <AuraEffect
          position={headPosFor(defenderTag)}
          color="#f6c0c8"
          active={true}
        />
      )}

      {/* ===== Impact Extra (被弾側に重ねる) ===== */}
      <PuffEffect
        position={defenderTag ? bodyPosFor(defenderTag) : [0, 0, 0]}
        active={isPuff}
      />
      <DizzyStarsEffect
        center={defenderTag ? headPosFor(defenderTag) : [0, 0, 0]}
        active={isDizzy}
      />
    </Canvas>
  );
}

/**
 * カメラを「引き」と「攻撃中クローズアップ」の間で滑らかに動かす。
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
    const goingWide =
      attackerTag == null || animationType == null || phase === "idle";
    if (goingWide) {
      targetPosRef.current.set(...WIDE_CAM_POS);
      targetLookRef.current.set(...WIDE_CAM_LOOK);
    } else {
      const { pos, look } = closeUpFor(attackerTag, animationType, phase);
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
