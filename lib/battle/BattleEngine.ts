import {
  emptyStages,
  STATUS_LABEL,
  type BattleEvent,
  type BattleSnapshot,
  type Command,
  type MonsterId,
  type MoveDefinition,
  type MoveEffect,
  type PlayerSlot,
  type PlayerState,
  type StatName,
  type StatusCondition,
  type TurnResult,
} from "./types";
import { Monster } from "../monsters/Monster";
import { createMonsterState } from "../monsters/definitions";
import { getMove } from "../monsters/moves";
import { calcDamage } from "./damage";

const OTHER: Record<PlayerSlot, PlayerSlot> = { p1: "p2", p2: "p1" };

const STAT_LABEL: Record<StatName, string> = {
  attack: "こうげき",
  defense: "ぼうぎょ",
  spAttack: "とくこう",
  spDefense: "とくぼう",
  speed: "すばやさ",
};

export interface NewBattleInput {
  p1: { name: string; partyIds: [MonsterId, MonsterId] };
  p2: { name: string; partyIds: [MonsterId, MonsterId] };
  seed?: number;
}

/**
 * 純粋なバトルエンジン（ターン制）。
 *
 * - 同時入力ではなく、片方ずつの完全交代制。
 * - 初回ターンは active モンスターの素早さで決まる（同値なら乱数）。
 * - executeAction 終了後、勝敗が決していなければ自動的にターンが相手に移る。
 *
 * 1 アクションの流れ:
 *   1. アクター（active モンスター）のターン開始時フラグをリセット
 *   2. 状態異常 / ひるみチェック → 行動可なら command を実行
 *   3. 追加効果適用
 *   4. ターン終了処理（drowsy → sleep 昇格 等）
 *   5. 瀕死チェック → 自動交代 → 勝敗判定
 *   6. ターンを相手に渡す
 */
export class BattleEngine {
  private players: Record<PlayerSlot, { state: PlayerState; mons: Monster[] }>;
  private turn = 0;
  private log: string[] = [];
  private winner: PlayerSlot | null = null;
  private rng: () => number;
  private currentTurnSlot: PlayerSlot;

  constructor(input: NewBattleInput) {
    this.rng = makeRng(input.seed ?? Date.now());
    this.players = {
      p1: this.makePlayer("p1", input.p1.name, input.p1.partyIds),
      p2: this.makePlayer("p2", input.p2.name, input.p2.partyIds),
    };
    // 初回ターン: 素早さの速い方
    const p1Speed = this.activeOf("p1").effective("speed");
    const p2Speed = this.activeOf("p2").effective("speed");
    if (p1Speed > p2Speed) this.currentTurnSlot = "p1";
    else if (p2Speed > p1Speed) this.currentTurnSlot = "p2";
    else this.currentTurnSlot = this.rng() < 0.5 ? "p1" : "p2";

    this.pushLog(`バトル開始！ ${input.p1.name} vs ${input.p2.name}`);
    this.pushLog(`${this.players[this.currentTurnSlot].state.name} のターン！`);
  }

  /** 現在のターン担当者 */
  get turnOf(): PlayerSlot {
    return this.currentTurnSlot;
  }

  private makePlayer(slot: PlayerSlot, name: string, ids: [MonsterId, MonsterId]) {
    const monStates = ids.map(createMonsterState);
    const mons = monStates.map((s) => new Monster(s));
    const state: PlayerState = { slot, name, party: monStates, activeIndex: 0 };
    return { state, mons };
  }

  snapshot(): BattleSnapshot {
    return {
      turn: this.turn,
      players: {
        p1: cloneState(this.players.p1.state),
        p2: cloneState(this.players.p2.state),
      },
      log: [...this.log],
      winner: this.winner,
      currentTurnSlot: this.winner ? null : this.currentTurnSlot,
    };
  }

  /**
   * 1 名のアクターのアクションを 1 件実行してターンを進める。
   *
   * 呼び出し側（Socket サーバー）は事前に slot === turnOf を検証すること。
   * バックエンドでも一応 slot 違いは弾く（不正コマンドの保険）。
   */
  executeAction(slot: PlayerSlot, cmd: Command): TurnResult {
    if (this.winner) return { snapshot: this.snapshot(), events: [] };
    if (slot !== this.currentTurnSlot) {
      // ターン違いのコマンドは無視。スナップショットだけ返す。
      return { snapshot: this.snapshot(), events: [] };
    }

    this.turn += 1;
    const events: BattleEvent[] = [];

    // ターン開始時のフラグをリセット
    this.activeOf(slot).resetTurnFlags();
    // 相手のフラグもリセット（ひるみは「次の相手の行動で消費」される設計）
    this.activeOf(OTHER[slot]).resetTurnFlags();

    if (!this.activeOf(slot).isFainted) {
      this.execute(slot, cmd, events);
    }

    // ターン終了時処理
    this.endOfTurn(events);

    // 瀕死チェック & 自動交代
    this.handleFaints(events);

    // ターン交代（勝者がいなければ）
    if (!this.winner) {
      this.currentTurnSlot = OTHER[this.currentTurnSlot];
      this.pushLog(`${this.players[this.currentTurnSlot].state.name} のターン！`);
    }

    return { snapshot: this.snapshot(), events };
  }

  // ============================================================
  // execute: 1 件のコマンドを実行
  // ============================================================
  private execute(slot: PlayerSlot, cmd: Command, events: BattleEvent[]) {
    if (cmd.type === "switch") {
      const target = this.players[slot].mons[cmd.toIndex];
      if (!target || target.isFainted || cmd.toIndex === this.players[slot].state.activeIndex) {
        this.pushLog(`${this.players[slot].state.name} の交代は失敗した！`);
        return;
      }
      // 場を離れるモンスターの能力段階・状態異常をリセット
      const leaving = this.activeOf(slot);
      leaving.state.stages = emptyStages();
      leaving.state.status = null;
      leaving.state.statusTurns = 0;
      this.players[slot].state.activeIndex = cmd.toIndex;
      events.push({ kind: "switch", actor: slot, toIndex: cmd.toIndex });
      this.pushLog(`${this.players[slot].state.name} は ${target.name} に交代した！`);
      return;
    }

    // ----- move コマンド -----
    const attacker = this.activeOf(slot);
    const defender = this.activeOf(OTHER[slot]);
    const move = getMove(cmd.moveId);

    if (attacker.ppOf(move.id) <= 0) {
      this.pushLog(`${attacker.name} は ${move.name} を使おうとしたが PP がない！`);
      return;
    }

    // 行動前: ひるみチェック
    if (attacker.flinchedThisTurn) {
      this.pushLog(`${attacker.name} はひるんで動けない！`);
      return;
    }

    // 行動前: 状態異常チェック
    if (!this.canActWithStatus(attacker)) return;

    attacker.consumePp(move.id);

    // protect のチェック: 攻撃技を相手が守っているなら無効化
    const isOffensive = move.power > 0;
    if (isOffensive && defender.protectedThisTurn) {
      this.pushLog(`${attacker.name} の ${move.name}！ しかし ${defender.name} は守りを固めていた！`);
      events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
      return;
    }

    // ===== 攻撃技 =====
    let totalDamageDealt = 0;
    let anyHit = false;

    if (move.power > 0) {
      const multiHit = move.effects?.find((e) => e.kind === "multi_hit") as
        | Extract<MoveEffect, { kind: "multi_hit" }>
        | undefined;
      const useDefenseAsAttack = !!move.effects?.find((e) => e.kind === "body_press");

      const hitCount = multiHit
        ? randInt(this.rng, multiHit.min, multiHit.max)
        : 1;

      for (let i = 0; i < hitCount; i++) {
        if (defender.isFainted) break;
        const result = calcDamage(attacker, defender, move, this.rng, { useDefenseAsAttack });
        if (result.missed) {
          if (i === 0) {
            this.pushLog(`${attacker.name} の ${move.name}！ しかし外れた…`);
            events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
            return;
          }
          break; // 連続技の途中で外れたら終了
        }
        defender.takeDamage(result.damage);
        totalDamageDealt += result.damage;
        anyHit = true;
        events.push({
          kind: "move",
          actor: slot,
          moveId: move.id,
          damage: result.damage,
          missed: false,
          critical: result.critical,
        });
        if (hitCount === 1) {
          this.pushLog(
            `${attacker.name} の ${move.name}！ ${defender.name} に ${result.damage} のダメージ${result.critical ? "（急所！）" : ""}`,
          );
        }
      }

      if (multiHit && anyHit) {
        const hits = events.filter((e) => e.kind === "move" && !e.missed && e.actor === slot).length;
        this.pushLog(`${attacker.name} の ${move.name}！ ${hits} 回ヒット、合計 ${totalDamageDealt} ダメージ！`);
      }
    } else {
      // 変化技は宣言ログだけ
      this.pushLog(`${attacker.name} の ${move.name}！`);
      events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: false, critical: false });
      anyHit = true;
    }

    // ===== 追加効果 =====
    if (!move.effects) return;
    for (const eff of move.effects) {
      // multi_hit / body_press はダメージ計算側で消費済みなのでここではスキップ
      if (eff.kind === "multi_hit" || eff.kind === "body_press") continue;

      // 攻撃技で 1 回も当たらなかったら追加効果はスキップ
      if (move.power > 0 && !anyHit) continue;

      this.applyEffect(slot, attacker, defender, move, eff, totalDamageDealt, events);
      if (this.winner) return;
    }
  }

  // ============================================================
  // applyEffect: 1 つの effect を実行
  // ============================================================
  private applyEffect(
    slot: PlayerSlot,
    attacker: Monster,
    defender: Monster,
    move: MoveDefinition,
    effect: MoveEffect,
    damageDealt: number,
    events: BattleEvent[],
  ) {
    switch (effect.kind) {
      case "heal_self": {
        const amount = Math.floor((attacker.maxHp * effect.percent) / 100);
        const healed = attacker.heal(amount);
        if (healed > 0) {
          this.pushLog(`${attacker.name} は HP を ${healed} 回復した！`);
          events.push({ kind: "heal", actor: slot, amount: healed });
        } else {
          this.pushLog(`${attacker.name} の HP は満タンだ！`);
        }
        return;
      }

      case "heal_both": {
        const aAmt = Math.floor((attacker.maxHp * effect.percent) / 100);
        const dAmt = Math.floor((defender.maxHp * effect.percent) / 100);
        const a = attacker.heal(aAmt);
        const d = defender.heal(dAmt);
        if (a > 0) events.push({ kind: "heal", actor: slot, amount: a });
        if (d > 0) events.push({ kind: "heal", actor: OTHER[slot], amount: d });
        this.pushLog(`おだやかな空気が流れる。${attacker.name} は ${a}、${defender.name} は ${d} 回復した！`);
        return;
      }

      case "stat_change": {
        if (this.rng() * 100 > effect.chance) return;
        const targetSlot = effect.target === "self" ? slot : OTHER[slot];
        const targetMon = this.activeOf(targetSlot);
        if (targetMon.isFainted) return;
        const delta = targetMon.changeStage(effect.stat, effect.stages);
        if (delta === 0) {
          this.pushLog(
            `${targetMon.name} の ${STAT_LABEL[effect.stat]} は${
              effect.stages > 0 ? "もう上がらない" : "もう下がらない"
            }！`,
          );
          return;
        }
        const sign = delta > 0 ? "上がった" : "下がった";
        const intensity = Math.abs(delta) >= 2 ? "ぐーんと" : "";
        this.pushLog(`${targetMon.name} の ${STAT_LABEL[effect.stat]} が${intensity}${sign}！`);
        events.push({ kind: "stat_change", actor: slot, target: targetSlot, stat: effect.stat, stages: delta });
        return;
      }

      case "recoil": {
        if (damageDealt <= 0) return;
        const back = Math.max(1, Math.floor(damageDealt * effect.ratio));
        attacker.takeDamage(back);
        this.pushLog(`${attacker.name} は反動で ${back} のダメージを受けた！`);
        return;
      }

      case "protect": {
        attacker.protectedThisTurn = true;
        this.pushLog(`${attacker.name} は守りを固めた！`);
        return;
      }

      case "inflict_status": {
        if (this.rng() * 100 > effect.chance) return;
        if (defender.isFainted) return;
        this.applyStatusTo(slot, defender, effect.status, events);
        return;
      }

      case "flinch": {
        if (this.rng() * 100 > effect.chance) return;
        // ひるみは「相手がまだこのターンに行動していない場合のみ有効」
        defender.flinchedThisTurn = true;
        return;
      }

      case "cure_status": {
        if (attacker.cureStatus()) {
          this.pushLog(`${attacker.name} は状態異常をきれいに治した！`);
          events.push({ kind: "status_cleared", actor: slot });
        } else {
          this.pushLog(`${attacker.name} には特に効果がなかった！`);
        }
        return;
      }

      case "random_extra": {
        // 50% で何かが起きる
        if (this.rng() < 0.5) return;
        const r = this.rng();
        if (r < 0.25) {
          // 自分のこうげき +1
          const d = attacker.changeStage("attack", 1);
          if (d !== 0) {
            this.pushLog(`不思議な力！ ${attacker.name} のこうげきが上がった！`);
            events.push({ kind: "stat_change", actor: slot, target: slot, stat: "attack", stages: d });
          }
        } else if (r < 0.5) {
          // 自分のすばやさ +1
          const d = attacker.changeStage("speed", 1);
          if (d !== 0) {
            this.pushLog(`不思議な力！ ${attacker.name} のすばやさが上がった！`);
            events.push({ kind: "stat_change", actor: slot, target: slot, stat: "speed", stages: d });
          }
        } else if (r < 0.75) {
          // 相手のぼうぎょ -1
          const d = defender.changeStage("defense", -1);
          if (d !== 0) {
            this.pushLog(`不思議な力！ ${defender.name} のぼうぎょが下がった！`);
            events.push({ kind: "stat_change", actor: slot, target: OTHER[slot], stat: "defense", stages: d });
          }
        } else {
          // 相手をこんらん
          this.applyStatusTo(slot, defender, "confusion", events);
        }
        return;
      }
    }
  }

  // ============================================================
  // 状態異常まわり
  // ============================================================

  /** 行動前の状態異常チェック。行動可能なら true、不可なら false。 */
  private canActWithStatus(mon: Monster): boolean {
    const slot = this.slotOf(mon)!;
    switch (mon.state.status) {
      case "sleep": {
        if (mon.state.statusTurns > 0) {
          mon.state.statusTurns -= 1;
          this.pushLog(`${mon.name} はぐっすり眠っている…`);
          return false;
        }
        // 起きる
        mon.state.status = null;
        this.pushLog(`${mon.name} は目を覚ました！`);
        return true;
      }
      case "paralysis": {
        if (this.rng() < 0.25) {
          this.pushLog(`${mon.name} はからだがしびれて動けない！`);
          return false;
        }
        return true;
      }
      case "confusion": {
        // 終了判定
        if (mon.state.statusTurns <= 0) {
          mon.state.status = null;
          this.pushLog(`${mon.name} の こんらん がとけた！`);
          return true;
        }
        mon.state.statusTurns -= 1;
        if (this.rng() < 1 / 3) {
          // 自分に体当たり（固定 40 物理）
          const selfHit = Math.max(1, Math.floor((mon.effective("attack") / mon.effective("defense")) * 8 + 2));
          mon.takeDamage(selfHit);
          this.pushLog(`${mon.name} はこんらんしている！ 自分に ${selfHit} のダメージ！`);
          // event は move 扱いで投げる（victim 用フラッシュには使わない）
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }

  private applyStatusTo(
    actorSlot: PlayerSlot,
    target: Monster,
    status: StatusCondition,
    events: BattleEvent[],
  ) {
    // 既に同じ状態異常 or 上位の異常 (sleep) があるなら入らない
    if (target.state.status && target.state.status !== "drowsy") {
      this.pushLog(`${target.name} には既に状態異常がある…`);
      return;
    }
    const turns =
      status === "sleep" ? randInt(this.rng, 2, 4) :
      status === "confusion" ? randInt(this.rng, 1, 4) :
      status === "drowsy" ? 1 :
      0; // paralysis は無期限
    target.applyStatus(status, turns);
    this.pushLog(`${target.name} は ${STATUS_LABEL[status]} 状態になった！`);
    events.push({ kind: "status_applied", actor: actorSlot, target: this.slotOf(target)!, status });
  }

  // ============================================================
  // ターン終了処理
  // ============================================================
  private endOfTurn(events: BattleEvent[]) {
    for (const slot of ["p1", "p2"] as PlayerSlot[]) {
      const mon = this.activeOf(slot);
      if (mon.isFainted) continue;
      // drowsy → sleep への昇格
      if (mon.state.status === "drowsy") {
        mon.state.status = "sleep";
        mon.state.statusTurns = randInt(this.rng, 2, 3);
        this.pushLog(`${mon.name} は眠ってしまった！`);
        events.push({ kind: "status_applied", actor: slot, target: slot, status: "sleep" });
      }
    }
  }

  // ============================================================
  // 瀕死処理
  // ============================================================
  private handleFaints(events: BattleEvent[]) {
    for (const slot of ["p1", "p2"] as PlayerSlot[]) {
      const active = this.activeOf(slot);
      if (active.isFainted) {
        events.push({ kind: "faint", actor: slot });
        this.pushLog(`${this.players[slot].state.name} の ${active.name} は倒れた！`);
        const next = this.players[slot].mons.findIndex((m) => !m.isFainted);
        if (next === -1) {
          this.winner = OTHER[slot];
          events.push({ kind: "win", winner: this.winner });
          this.pushLog(`${this.players[this.winner].state.name} の勝利！`);
        } else {
          this.players[slot].state.activeIndex = next;
          this.pushLog(`${this.players[slot].state.name} は ${this.activeOf(slot).name} を繰り出した！`);
        }
      }
    }
  }

  // ============================================================
  private activeOf(slot: PlayerSlot): Monster {
    return this.players[slot].mons[this.players[slot].state.activeIndex];
  }

  private slotOf(mon: Monster): PlayerSlot | null {
    if (this.activeOf("p1") === mon) return "p1";
    if (this.activeOf("p2") === mon) return "p2";
    return null;
  }

  private pushLog(msg: string) {
    this.log.push(msg);
  }
}

function cloneState(p: PlayerState): PlayerState {
  return {
    slot: p.slot,
    name: p.name,
    activeIndex: p.activeIndex,
    party: p.party.map((m) => ({
      defId: m.defId,
      currentHp: m.currentHp,
      ppLeft: { ...m.ppLeft },
      fainted: m.fainted,
      stages: { ...m.stages },
      status: m.status,
      statusTurns: m.statusTurns,
    })),
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** mulberry32 — シード付き擬似乱数。リプレイ可能性のため。 */
function makeRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
