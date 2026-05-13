import type { MoveDefinition } from "./types";
import type { Monster } from "../monsters/Monster";

export interface DamageResult {
  damage: number;
  missed: boolean;
  critical: boolean;
}

export interface CalcOptions {
  /** body_press 系: 攻撃側で「攻撃」の代わりに「防御」を使う */
  useDefenseAsAttack?: boolean;
}

/**
 * ダメージ計算。ポケモン公式の式を簡略化したもの。
 *  base = ((2 * 50 / 5 + 2) * power * A/D) / 50 + 2
 *  - A: 物理なら attacker.attack（または defense, body_press 時）、特殊なら attacker.spAttack（能力段階反映）
 *  - D: 物理なら defender.defense、特殊なら defender.spDefense（能力段階反映）
 *  - 急所 (1/16) → 1.5倍
 *  - 乱数 0.85〜1.0
 *
 * move.alwaysHit = true なら命中判定をスキップする。
 * power = 0 の技（変化技）は呼ばれない想定だが、安全のため 0 ダメージを返す。
 */
export function calcDamage(
  attacker: Monster,
  defender: Monster,
  move: MoveDefinition,
  rng: () => number = Math.random,
  options: CalcOptions = {},
): DamageResult {
  if (move.power <= 0) return { damage: 0, missed: false, critical: false };

  // 命中判定（必中技はスキップ）
  if (!move.alwaysHit && rng() * 100 > move.accuracy) {
    return { damage: 0, missed: true, critical: false };
  }

  let a: number;
  if (options.useDefenseAsAttack) {
    a = attacker.effective("defense");
  } else if (move.category === "physical") {
    a = attacker.effective("attack");
  } else {
    a = attacker.effective("spAttack");
  }
  const d =
    move.category === "physical"
      ? defender.effective("defense")
      : defender.effective("spDefense");

  const level = 50;
  const base = ((2 * level) / 5 + 2) * move.power * (a / d) / 50 + 2;

  const critical = rng() < 1 / 16;
  const critMult = critical ? 1.5 : 1.0;
  const random = 0.85 + rng() * 0.15;

  const damage = Math.max(1, Math.floor(base * critMult * random));
  return { damage, missed: false, critical };
}

/**
 * 行動順を決定。
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
