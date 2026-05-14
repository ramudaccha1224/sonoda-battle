"use client";

import { useFrame } from "@react-three/fiber";
import { animated, easings, useSpring } from "@react-spring/three";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type {
  ActionAnimType,
  AttackerMotion,
  BattlePhase,
} from "@/lib/battle/animations";
import type { LimbRefs } from "./MonsterMesh";

// ============================================================
// 既定値
// ============================================================
const DEFAULT_LEFT_PAW: [number, number, number] = [-0.45, 0.1, 0.35];
const DEFAULT_RIGHT_PAW: [number, number, number] = [0.45, 0.1, 0.35];
const DEFAULT_TAIL_POS: [number, number, number] = [0, 0.65, -0.85];
const DEFAULT_TAIL_ROT: [number, number, number] = [0.6, 0, 0];

/** その attackerMotion が「相手に向かって移動する」系か（true）「その場系」か（false）。 */
function motionMoves(motion: AttackerMotion | undefined): boolean {
  if (!motion) return true;
  switch (motion) {
    case "punch":
    case "lunge_bite":
    case "claw_swipe":
    case "knead":
    case "back_kick":
    case "tail_swing":
    case "high_jump_dive":
    case "dash_zigzag":
    case "roll_forward":
      return true;
    default:
      return false;
  }
}

/** 毎フレーム最初に手足や頭をニュートラルに戻す（モーション間の干渉を防ぐ）。 */
function resetLimbs(limbs: LimbRefs | null) {
  if (!limbs) return;
  if (limbs.leftPaw.current) {
    limbs.leftPaw.current.position.set(...DEFAULT_LEFT_PAW);
    limbs.leftPaw.current.rotation.set(0, 0, 0);
  }
  if (limbs.rightPaw.current) {
    limbs.rightPaw.current.position.set(...DEFAULT_RIGHT_PAW);
    limbs.rightPaw.current.rotation.set(0, 0, 0);
  }
  if (limbs.tail.current) {
    limbs.tail.current.position.set(...DEFAULT_TAIL_POS);
    limbs.tail.current.rotation.set(...DEFAULT_TAIL_ROT);
  }
  if (limbs.head.current) {
    limbs.head.current.rotation.set(0, 0, 0);
  }
  if (limbs.body.current) {
    limbs.body.current.rotation.set(0, 0, 0);
    limbs.body.current.scale.set(1, 1, 1);
  }
  // 目の発光を消す
  for (const eye of [limbs.leftEye.current, limbs.rightEye.current]) {
    if (eye) {
      const mat = eye.material as THREE.MeshStandardMaterial;
      if (mat?.emissive) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  }
}

interface Props {
  homePos: [number, number, number];
  attackPos: [number, number, number];
  isAttacker: boolean;
  animationType?: ActionAnimType | null;
  attackerMotion?: AttackerMotion;
  phase: BattlePhase;
  /** MonsterMesh が onLimbRefs で書き込む先。BattleScene 側で作って共有する。 */
  limbsRef: React.MutableRefObject<LimbRefs | null>;
  children: React.ReactNode;
}

/**
 * モンスターを「ホーム ⇔ 攻撃ストライク位置」の間で滑らかに動かしつつ、
 * 技ごとに固有の手足・頭・しっぽアニメーションを実行するラッパー。
 *
 * - approach / impact フェーズ中、move 系 motion は前進、stationary 系はその場
 * - 毎フレーム resetLimbs() で部位をニュートラルに戻し、その上に各 motion を上書き
 */
export function AnimatedCat({
  homePos,
  attackPos,
  isAttacker,
  attackerMotion,
  phase,
  limbsRef,
  children,
}: Props) {
  const ref = useRef<THREE.Group>(null);
  const moveProgressRef = useRef(0);
  const moveTargetRef = useRef(0);
  const phaseStartRef = useRef(performance.now());

  // 攻撃側でない、または「移動系でない」motion の場合は移動しない
  const willMove = isAttacker && motionMoves(attackerMotion);

  // squash & stretch (汎用)
  const [styles, api] = useSpring(() => ({
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    config: { tension: 220, friction: 14 },
  }));

  // 移動目標の更新
  useEffect(() => {
    if (willMove && (phase === "approach" || phase === "impact")) {
      moveTargetRef.current = 1;
    } else {
      moveTargetRef.current = 0;
    }
  }, [willMove, phase]);

  // phase 切替時の処理
  useEffect(() => {
    phaseStartRef.current = performance.now();
    // 部位をニュートラルにリセット (motion をクリアした遷移直後)
    resetLimbs(limbsRef.current);

    // 攻撃側 + motion ごとのスケールキーフレーム
    if (!isAttacker) {
      api.start({ scaleX: 1, scaleY: 1, scaleZ: 1 });
      return;
    }

    const m = attackerMotion;
    if (phase === "approach") {
      // 共通: しゃがみ込み → 飛び出し
      if (m === "loaf" || m === "ball_curl") {
        // すぐに丸まり姿勢へ
        api.start({ scaleX: 1.15, scaleY: 0.55, scaleZ: 1.15 });
      } else if (m === "spring_pop") {
        // ぺしゃっと潰れる
        api.start({ scaleX: 1.4, scaleY: 0.45, scaleZ: 1.4 });
      } else if (m === "snack_eat" || m === "grooming" || m === "still" || m === "eye_glow") {
        // その場系: 軽く構え
        api.start({ scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 });
      } else if (m === "spin_dance") {
        api.start({ scaleX: 0.95, scaleY: 1.05, scaleZ: 0.95 });
      } else if (m === "big_yawn" || m === "blow_breath") {
        // 構え (深呼吸風)
        api.start({ scaleX: 1.08, scaleY: 1.1, scaleZ: 1.08 });
      } else if (m === "shadow_blink") {
        // フェードアウト前のためそのまま
        api.start({ scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 });
      } else {
        // 移動系: アンティシペーション
        api.start({ scaleX: 1.15, scaleY: 0.8, scaleZ: 1.15 });
        const t1 = setTimeout(() => {
          api.start({ scaleX: 0.9, scaleY: 1.18, scaleZ: 0.9 });
        }, 200);
        return () => clearTimeout(t1);
      }
    } else if (phase === "impact") {
      // 各 motion の impact ポーズ
      if (m === "punch" || m === "lunge_bite" || m === "high_jump_dive") {
        // 着地ぐっと潰れ
        api.start({
          scaleX: 1.25,
          scaleY: 0.75,
          scaleZ: 1.25,
          config: { tension: 320, friction: 10 },
        });
        const t1 = setTimeout(() => {
          api.start({
            scaleX: 0.97,
            scaleY: 1.05,
            scaleZ: 0.97,
            config: { tension: 180, friction: 14 },
          });
        }, 350);
        return () => clearTimeout(t1);
      } else if (m === "spring_pop") {
        // びよーんと縦伸び
        api.start({
          scaleX: 0.7,
          scaleY: 1.5,
          scaleZ: 0.7,
          config: { tension: 380, friction: 8 },
        });
      } else if (m === "loaf") {
        api.start({ scaleX: 1.15, scaleY: 0.55, scaleZ: 1.15 });
      } else if (m === "ball_curl") {
        api.start({ scaleX: 0.9, scaleY: 0.7, scaleZ: 0.9 });
      } else if (m === "back_kick") {
        // 仰向け
        api.start({ scaleX: 1.2, scaleY: 0.7, scaleZ: 1.05 });
      } else {
        api.start({ scaleX: 1, scaleY: 1, scaleZ: 1 });
      }
    } else if (phase === "reaction" || phase === "idle" || phase === "faint") {
      api.start({
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        config: { tension: 160, friction: 18 },
      });
    }
  }, [phase, isAttacker, attackerMotion, api, limbsRef]);

  useFrame((state, delta) => {
    if (!ref.current) return;

    // ===== 1. 進行度の更新 (移動系) =====
    const target = moveTargetRef.current;
    const current = moveProgressRef.current;
    const diff = target - current;
    if (Math.abs(diff) > 0.001) {
      const duration = target > current ? 0.7 : 0.5;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), delta / duration);
      moveProgressRef.current = current + step;
    }
    const tProg = moveProgressRef.current;
    const eased = easings.easeOutCubic(tProg);

    // ===== 2. ベース位置の計算 =====
    let posX = homePos[0] + (attackPos[0] - homePos[0]) * eased;
    let posY = homePos[1] + (attackPos[1] - homePos[1]) * eased;
    let posZ = homePos[2] + (attackPos[2] - homePos[2]) * eased;

    // 移動系のジャンプ弧
    if (isAttacker && motionMoves(attackerMotion)) {
      const jumpMul =
        attackerMotion === "high_jump_dive" ? 1.2 :
        attackerMotion === "roll_forward" ? 0.0 :
        0.55;
      posY += jumpMul * 4 * eased * (1 - eased);
    }

    // ===== 3. 部位を初期化（motion 適用前の毎フレームクリーンナップ） =====
    resetLimbs(limbsRef.current);

    // ===== 4. motion 固有の動き =====
    const phaseSec = (performance.now() - phaseStartRef.current) / 1000;
    if (isAttacker && attackerMotion) {
      const t = state.clock.elapsedTime;
      applyAttackerMotion({
        motion: attackerMotion,
        phase,
        phaseSec,
        clockT: t,
        limbs: limbsRef.current,
        groupRef: ref,
        homePos,
        attackPos,
        positionOut: { x: posX, y: posY, z: posZ },
      });
      // 位置を motion から再取得
      posX = positionOutBuffer.x;
      posY = positionOutBuffer.y;
      posZ = positionOutBuffer.z;
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

// motion 関数が結果の x/y/z を書き込むバッファ (毎フレーム同じ object を使い回す)
const positionOutBuffer = { x: 0, y: 0, z: 0 };

interface MotionCtx {
  motion: AttackerMotion;
  phase: BattlePhase;
  phaseSec: number;
  clockT: number;
  limbs: LimbRefs | null;
  groupRef: React.RefObject<THREE.Group | null>;
  homePos: [number, number, number];
  attackPos: [number, number, number];
  /** 直前の位置計算結果（必要なら motion でオーバーライド） */
  positionOut: { x: number; y: number; z: number };
}

/**
 * 各 attackerMotion ごとの「impact / approach 中の追加動作」。
 * 1 フレーム分だけ実行される。状態は phaseSec で時間ベース。
 */
function applyAttackerMotion(ctx: MotionCtx) {
  // 位置を一旦コピー
  positionOutBuffer.x = ctx.positionOut.x;
  positionOutBuffer.y = ctx.positionOut.y;
  positionOutBuffer.z = ctx.positionOut.z;

  if (ctx.phase !== "approach" && ctx.phase !== "impact") return;

  const L = ctx.limbs;
  const g = ctx.groupRef.current;
  const ts = ctx.phaseSec;

  switch (ctx.motion) {
    // ==================== 物理近接系 ====================
    case "punch": {
      // 右パンチ: 構え (引く) → 突き出す → 戻る
      if (ctx.phase === "impact" && L?.rightPaw.current) {
        const z =
          ts < 0.15 ? lerp(0.35, 0.15, ts / 0.15) :
          ts < 0.30 ? lerp(0.15, 0.85, (ts - 0.15) / 0.15) :
          ts < 0.55 ? lerp(0.85, 0.35, (ts - 0.30) / 0.25) :
          0.35;
        L.rightPaw.current.position.z = z;
        // 拳に押されるよう体は少し前に
        if (L.body.current && ts < 0.30) {
          L.body.current.rotation.x = -0.08 * Math.min(1, ts / 0.2);
        }
      }
      break;
    }

    case "lunge_bite": {
      // 体ごと前のめり (頭を突き出す感じ) + 頭をやや下に向ける
      if (ctx.phase === "impact") {
        const lean = ts < 0.4 ? Math.min(0.35, ts * 0.9) : Math.max(0, 0.35 - (ts - 0.4) * 0.8);
        if (L?.body.current) L.body.current.rotation.x = -lean;
        if (L?.head.current) L.head.current.rotation.x = lean * 0.6;
      }
      break;
    }

    case "claw_swipe": {
      // 右手で 3 回スワイプ
      if (ctx.phase === "impact" && L?.rightPaw.current) {
        const swipeCycle = ts % 0.25; // 0.25 秒ごとに 1 ふり
        const swipe = Math.sin((swipeCycle / 0.25) * Math.PI);
        L.rightPaw.current.position.z = 0.35 + swipe * 0.35;
        L.rightPaw.current.position.y = 0.1 + swipe * 0.3;
      }
      break;
    }

    case "knead": {
      // 左右の前足を交互に ふみふみ
      if (ctx.phase === "impact" && L) {
        const phaseLeft = (ts * 4) % 1;
        const phaseRight = (ts * 4 + 0.5) % 1;
        const upLeft = Math.sin(phaseLeft * Math.PI) * 0.25;
        const upRight = Math.sin(phaseRight * Math.PI) * 0.25;
        if (L.leftPaw.current) L.leftPaw.current.position.y = 0.1 + upLeft;
        if (L.rightPaw.current) L.rightPaw.current.position.y = 0.1 + upRight;
      }
      break;
    }

    case "back_kick": {
      // 仰向けに転がる → 後ろ蹴り (両足を高く上げる)
      if (ctx.phase === "impact" && g) {
        // 体全体を仰向けに (X軸 -90° 回転をなめらかに)
        const rot = ts < 0.3 ? -Math.PI / 2 * (ts / 0.3) : -Math.PI / 2;
        g.rotation.x = rot;
        // 蹴り: 両足を上に
        if (L?.rightPaw.current && L?.leftPaw.current && ts >= 0.3) {
          const kick = Math.sin(Math.min(1, (ts - 0.3) / 0.3) * Math.PI);
          L.rightPaw.current.position.y = 0.1 + kick * 0.7;
          L.leftPaw.current.position.y = 0.1 + kick * 0.7;
        }
      }
      break;
    }

    case "tail_swing": {
      // しっぽを大きく振る + 体ごとくるっと回転
      if (ctx.phase === "impact" && L) {
        if (L.tail.current) {
          L.tail.current.rotation.y = Math.sin(ts * 8) * 1.2;
          L.tail.current.rotation.x = 0.6 + Math.cos(ts * 8) * 0.4;
        }
        if (g) {
          g.rotation.y = (g.rotation.y || 0); // 既に facing で π or 0
          // 追加で半回転を与える
          const extra = ts < 0.5 ? Math.PI * (ts / 0.5) : Math.PI;
          // 元の rotation を保ちながら追加（=facing 用回転 + extra）
          // facing 自体はネスト構造上、ref の外側でかかっているので、ここでは差分のみ与える
          g.rotation.y = extra;
        }
      } else if (g) {
        g.rotation.y = 0;
      }
      break;
    }

    case "high_jump_dive": {
      // 共通の jumpMul=1.2 で高ジャンプは適用済み。
      // impact 中、空中で一瞬静止 → 急降下 (Y を少し下げる)
      if (ctx.phase === "impact") {
        positionOutBuffer.y -= 0.2 * Math.min(1, ts / 0.3);
      }
      break;
    }

    case "dash_zigzag": {
      // 移動中に X 方向にジグザグ
      if (ctx.phase === "approach" || ctx.phase === "impact") {
        const dx = ctx.attackPos[0] - ctx.homePos[0];
        const dz = ctx.attackPos[2] - ctx.homePos[2];
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0.001) {
          // 進行方向に垂直なベクトル
          const perpX = -dz / len;
          const perpZ = dx / len;
          const zig = Math.sin(ts * 14) * 0.45;
          positionOutBuffer.x += perpX * zig;
          positionOutBuffer.z += perpZ * zig;
        }
      }
      break;
    }

    case "roll_forward": {
      // 体ごと X 軸でぐるぐる回転しながら前進
      if (g) {
        if (ctx.phase === "approach") {
          g.rotation.x = ts * Math.PI * 2;
        } else if (ctx.phase === "impact") {
          g.rotation.x = ts * Math.PI;
        } else {
          g.rotation.x = 0;
        }
      }
      break;
    }

    // ==================== その場系 ====================
    case "spin_dance": {
      // その場でくるくる回り続ける
      if (g) {
        g.rotation.y = (ts * 4) % (Math.PI * 2);
      }
      break;
    }

    case "loaf": {
      // 香箱: スケールは useSpring で適用済み。
      // 追加で体を少し前に倒す (お辞儀風)
      if (L?.body.current) {
        L.body.current.rotation.x = -0.15;
      }
      break;
    }

    case "ball_curl": {
      // 丸まり: 全体的にゆっくり回転
      if (g) {
        g.rotation.x = Math.sin(ts * 2) * 0.4;
        g.rotation.z = Math.cos(ts * 1.5) * 0.2;
      }
      break;
    }

    case "snack_eat": {
      // 右手を口元へ
      if (L?.rightPaw.current) {
        const lift = Math.min(1, ts / 0.6);
        L.rightPaw.current.position.set(0.18, 0.1 + lift * 1.2, 0.55);
      }
      // 頭を少し前傾
      if (L?.head.current) {
        L.head.current.rotation.x = 0.15 * Math.min(1, ts / 0.5);
      }
      break;
    }

    case "grooming": {
      // 右手を頭の前で往復させる (毛づくろい)
      if (L?.rightPaw.current) {
        const lick = Math.sin(ts * 7);
        L.rightPaw.current.position.set(0.15 + lick * 0.1, 1.2, 0.6);
      }
      // 頭を軽く前後
      if (L?.head.current) {
        L.head.current.rotation.x = Math.sin(ts * 4) * 0.12;
      }
      break;
    }

    case "blow_breath": {
      // 大きく息を吸って (頭を上に) → 吹きかける (頭を下に前傾)
      if (L?.head.current) {
        if (ts < 0.4) {
          L.head.current.rotation.x = -0.25 * (ts / 0.4);
        } else {
          L.head.current.rotation.x = -0.25 + Math.min(1, (ts - 0.4) / 0.3) * 0.45;
        }
      }
      // 体もそれにつれて前傾
      if (L?.body.current && ts > 0.4) {
        L.body.current.rotation.x = -Math.min(0.15, (ts - 0.4) * 0.4);
      }
      break;
    }

    case "big_yawn": {
      // 頭を大きく上に反らせる
      if (L?.head.current) {
        const open = Math.sin(Math.min(1, ts / 0.8) * Math.PI);
        L.head.current.rotation.x = -open * 0.7;
        L.head.current.scale.set(1 + open * 0.1, 1 + open * 0.15, 1 + open * 0.1);
      }
      break;
    }

    case "spring_pop": {
      // useSpring 側で scaleY が大きく動く。ここでは小さな揺れを加える
      if (g) {
        g.rotation.z = Math.sin(ts * 30) * 0.05 * Math.exp(-ts * 2);
      }
      break;
    }

    case "eye_glow": {
      // 両目を光らせる (emissive を上げる)
      const intensity = Math.min(3, ts * 4);
      for (const eye of [L?.leftEye.current, L?.rightEye.current]) {
        if (eye) {
          const mat = eye.material as THREE.MeshStandardMaterial;
          if (mat?.emissive) {
            mat.emissive.setHex(0x9bb6ff);
            mat.emissiveIntensity = intensity;
          }
        }
      }
      break;
    }

    case "shadow_blink": {
      // 0〜0.3 秒で home から消える、0.3〜0.4 で attackPos に瞬間移動、0.4〜0.7 で出現
      // 透明度は MonsterMesh の fadeOut を使わず、material.opacity を直接触る
      const fadeT =
        ts < 0.3 ? 1 - ts / 0.3 :
        ts < 0.4 ? 0 :
        ts < 0.7 ? (ts - 0.4) / 0.3 :
        1;
      if (g) {
        g.traverse((obj) => {
          const mat = (obj as THREE.Mesh).material as THREE.Material | undefined;
          if (mat && "opacity" in mat) {
            mat.transparent = fadeT < 1;
            mat.opacity = fadeT;
          }
        });
      }
      // 0.4 秒以降は attackPos に瞬間移動
      if (ts >= 0.3) {
        positionOutBuffer.x = ctx.attackPos[0];
        positionOutBuffer.y = ctx.attackPos[1];
        positionOutBuffer.z = ctx.attackPos[2];
      }
      break;
    }

    case "still": {
      // 何もしない
      break;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
