/**
 * 技に対する演出（アニメーション）の分類。
 *
 * 何を 3D シーンで描くか決めるためのメタ情報。
 * バトルロジック (BattleEngine) には影響しない、描画レイヤー向けの分類。
 */

import type { MoveDefinition } from "./types";

/** 各アクション (1 ターン分の演出) の進行フェーズ */
export type BattlePhase = "approach" | "impact" | "reaction" | "idle";

export type ActionAnimType =
  /** 物理攻撃: 攻撃者が相手に跳ねかかる */
  | "physical_attack"
  /** 魔法攻撃: 攻撃者はその場で踊って、魔法弾が飛んで命中する */
  | "magic_attack"
  /** 自分強化系: その場で構え + 自分の頭上にオーラ。回復 / バフ / 守り / 状態回復 */
  | "self_support"
  /** 相手弱体系: その場で術を放つ + 相手にダークオーラ。デバフ / 状態異常付与 */
  | "opponent_curse"
  /** 双方系: ふんわりとした空気 + 双方が揺らぐ（お昼寝など） */
  | "shared_aura";

/**
 * 1 つの技がどんなアニメ分類に該当するかを判定する。
 * 技定義の power / category / effects から自動分類するので、
 * 個別技に手動でメタ情報を持たせる必要はない。
 */
export function classifyMoveAnim(move: MoveDefinition): ActionAnimType {
  // ダメージのある技は物理 / 魔法で分ける
  if (move.power > 0) {
    return move.category === "physical" ? "physical_attack" : "magic_attack";
  }
  // power=0 の変化技: 効果から推測
  const eff = move.effects?.[0];
  if (!eff) return "self_support";

  switch (eff.kind) {
    case "heal_self":
    case "cure_status":
    case "protect":
      return "self_support";
    case "heal_both":
      return "shared_aura";
    case "stat_change":
      return eff.target === "self" ? "self_support" : "opponent_curse";
    case "inflict_status":
      return "opponent_curse";
    default:
      return "self_support";
  }
}

/**
 * 技分類ごとの「魔法エフェクト色」。
 * MagicProjectile / AuraEffect で使う。
 */
export function effectColorFor(type: ActionAnimType): string {
  switch (type) {
    case "physical_attack":
      return "#fff2a8"; // 衝撃のフラッシュ用（実際の物理では未使用）
    case "magic_attack":
      return "#9bb6ff"; // 明るい青
    case "self_support":
      return "#ffd966"; // やわらかい黄
    case "opponent_curse":
      return "#a855f7"; // 紫
    case "shared_aura":
      return "#f6c0c8"; // ほっぺのピンク
  }
}
