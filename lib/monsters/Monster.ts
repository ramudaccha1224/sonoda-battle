import {
  STAGE_MAX,
  STAGE_MIN,
  stageMultiplier,
  type BaseStats,
  type MonsterDefinition,
  type MonsterState,
  type MoveDefinition,
  type StatName,
  type StatusCondition,
} from "../battle/types";
import { getMonsterDef } from "./definitions";
import { getMove } from "./moves";

/**
 * 抽象 Monster クラス。
 *
 * - 「定義 (定数)」と「状態 (可変)」を一つの interface で扱う薄いラッパー。
 * - 描画レイヤー (Three.js) は MonsterDefinition.displayColor / modelUrl を見るだけ。
 * - 将来 GLTF 切り替えやアニメ追加を行う際は、ここの抽象に乗せれば BattleEngine 側は無変更で済む。
 *
 * 状態異常 (status) と「このターン中だけ有効なフラグ」(protected/flinched) も保持する。
 */
export class Monster {
  readonly def: MonsterDefinition;
  state: MonsterState;
  /** このターン中に「まるまりシールド」で守りに入っているか */
  protectedThisTurn = false;
  /** このターン中に「ひるみ」を受けているか */
  flinchedThisTurn = false;
  /**
   * このラウンド中、相手の物理攻撃を反射するスタンスを取っているか。
   * くろねこのまじない使用時にセット。1 回反射すると消費。ラウンド終了でもクリア。
   */
  pendingPhysicalCounter: { multiplier: number } | null = null;

  constructor(state: MonsterState) {
    this.state = state;
    this.def = getMonsterDef(state.defId);
  }

  get id() { return this.def.id; }
  get name() { return this.def.name; }
  get color() { return this.def.displayColor; }
  get maxHp() { return this.def.stats.hp; }
  get stats(): BaseStats { return this.def.stats; }
  get isFainted() { return this.state.fainted || this.state.currentHp <= 0; }
  get status(): StatusCondition | null { return this.state.status; }

  /**
   * 能力段階 + フラットボーナスを加味した実効ステータス。
   * effective = floor((base + flatBonus) × stageMultiplier(stage))。
   * HP は対象外。
   */
  effective(stat: StatName): number {
    const base = this.stats[stat];
    const stage = this.state.stages[stat];
    const bonus = this.state.statBonus[stat];
    return Math.max(1, Math.floor((base + bonus) * stageMultiplier(stage)));
  }

  /** フラット加算ボーナスを変化させる。実際に変化した量を返す。 */
  changeFlatStat(stat: StatName, delta: number): number {
    const before = this.state.statBonus[stat];
    this.state.statBonus[stat] = before + delta;
    return delta;
  }

  /** この個体が覚えている技 */
  get moves(): MoveDefinition[] {
    return this.def.moveIds.map(getMove);
  }

  ppOf(moveId: string): number {
    return this.state.ppLeft[moveId] ?? 0;
  }

  consumePp(moveId: string): void {
    if ((this.state.ppLeft[moveId] ?? 0) > 0) this.state.ppLeft[moveId] -= 1;
  }

  takeDamage(amount: number): void {
    this.state.currentHp = Math.max(0, this.state.currentHp - amount);
    if (this.state.currentHp === 0) this.state.fainted = true;
  }

  heal(amount: number): number {
    const before = this.state.currentHp;
    this.state.currentHp = Math.min(this.maxHp, this.state.currentHp + amount);
    return this.state.currentHp - before;
  }

  /** 段階を ±方向に増減する。実際に変化した量を返す（端で詰まったら 0）。 */
  changeStage(stat: StatName, delta: number): number {
    const before = this.state.stages[stat];
    const next = Math.max(STAGE_MIN, Math.min(STAGE_MAX, before + delta));
    this.state.stages[stat] = next;
    return next - before;
  }

  /** 状態異常を適用。既に何か状態があれば失敗（false）。 */
  applyStatus(status: StatusCondition, turns: number): boolean {
    if (this.state.status) return false;
    this.state.status = status;
    this.state.statusTurns = turns;
    return true;
  }

  /** 状態異常を解除する。何か治ったら true。 */
  cureStatus(): boolean {
    if (!this.state.status) return false;
    this.state.status = null;
    this.state.statusTurns = 0;
    return true;
  }

  /** ラウンド開始時のフラグをリセット */
  resetTurnFlags(): void {
    this.protectedThisTurn = false;
    this.flinchedThisTurn = false;
    this.pendingPhysicalCounter = null;
  }
}
