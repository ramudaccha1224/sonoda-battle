import type { MoveDefinition, TimeOfDay } from "./types";
import type { Monster } from "../monsters/Monster";

export interface DamageResult {
  damage: number;
  missed: boolean;
  critical: boolean;
}

export interface CalcOptions {
  /** body_press 系: ダメージ = 自分の防御値 (フォーミュラを通さず直値) */
  bodyPress?: boolean;
  /** 現在の時間帯。night だと全技の命中率が 10pt 下がる。 */
  timeOfDay?: TimeOfDay;
  /** move.power をこの値で上書き（timeConditionalPower 用） */
  powerOverride?: number;
}

/**
 * ダメージ計算。
 *
 * 通常: ポケモン公式式の簡略版
 *   base = ((2 * 50 / 5 + 2) * power * A/D) / 50 + 2
 *
 * 特殊ケース:
 *   move.fixedDamage が指定されていれば、当たれば常にその値（防御無視）
 *   options.bodyPress = true なら、ダメージ = attacker.effective("defense") × 0.85〜1.0
 *
 * 命中判定:
 *   - 夜は base accuracy から 10pt 引いて判定
 *   - move.fixedDamage 等の特殊技も同様に命中判定する
 */
export function calcDamage(
  attacker: Monster,
  defender: Monster,
  move: MoveDefinition,
  rng: () => number = Math.random,
  options: CalcOptions = {},
): DamageResult {
  // 命中判定 — 夜なら -10pt
  const nightPenalty = options.timeOfDay === "night" ? 10 : 0;
  const effectiveAccuracy = Math.max(0, move.accuracy - nightPenalty);
  if (rng() * 100 > effectiveAccuracy) {
    return { damage: 0, missed: true, critical: false };
  }

  // === 固定ダメージ技 ===
  if (move.fixedDamage != null) {
    return { damage: move.fixedDamage, missed: false, critical: false };
  }

  // === body_press: 防御値そのものをダメージとして投げる ===
  if (options.bodyPress) {
    const def = attacker.effective("defense");
    const random = 0.85 + rng() * 0.15;
    const damage = Math.max(1, Math.floor(def * random));
    return { damage, missed: false, critical: false };
  }

  // === 通常フォーミュラ ===
  const power = options.powerOverride ?? move.power;
  if (power <= 0) return { damage: 0, missed: false, critical: false };

  const a =
    move.category === "physical"
      ? attacker.effective("attack")
      : attacker.effective("spAttack");
  const d =
    move.category === "physical"
      ? defender.effective("defense")
      : defender.effective("spDefense");

  const level = 50;
  const base = ((2 * level) / 5 + 2) * power * (a / d) / 50 + 2;

  const critical = rng() < 1 / 16;
  const critMult = critical ? 1.5 : 1.0;
  const random = 0.85 + rng() * 0.15;

  const damage = Math.max(1, Math.floor(base * critMult * random));
  return { damage, missed: false, critical };
}

/**
 * 行動順を決定 (ラウンド制内での move 同士の比較用)。
 * - 先に技の priority を比較（高い方が先）
 * - 同 priority なら 実効 speed の高い方
 * - 同 speed は rng で決める
 */
export function compareTurnOrder(
  a: { monster: Monster; priority: number },
  b: { monster: Monster; priority: number },
  rng: () => number = Math.random,
): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const sa = a.monster.effective("speed");
  const sb = b.monster.effective("speed");
  if (sa !== sb) return sb - sa;
  return rng() < 0.5 ? -1 : 1;
}
