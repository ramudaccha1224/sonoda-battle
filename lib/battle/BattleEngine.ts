import {
  emptyStages,
  STATUS_LABEL,
  type ActionResult,
  type BattleEvent,
  type BattleSnapshot,
  type Command,
  type MonsterId,
  type MoveDefinition,
  type MoveEffect,
  type PlayerSlot,
  type PlayerState,
  type RoundResult,
  type StatName,
  type StatusCondition,
  type TimeOfDay,
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
 * 純粋なバトルエンジン（ラウンド制）。
 *
 * 1 ラウンドの流れ:
 *   1. 両プレイヤーから 1 つずつコマンドを受け取る
 *   2. 行動順を決定（switch → 技 priority → 素早さ → 乱数）
 *   3. 速い方を先に実行、その結果をスナップショットに記録
 *   4. もしどちらかのモンスターがひんしになっていたら、そのラウンドは終了
 *      （遅い方の行動はキャンセル）。自動交代して次のラウンドへ
 *   5. 両方とも生存していたら遅い方も実行
 *   6. 最後にラウンド終了処理（drowsy→sleep 等）
 *
 * 結果は ActionResult の配列を持つ RoundResult として返す。
 * クライアントはこれをアニメ用にひとつずつ順番に再生する。
 */
export class BattleEngine {
  private players: Record<PlayerSlot, { state: PlayerState; mons: Monster[] }>;
  private turn = 0;
  private log: string[] = [];
  private winner: PlayerSlot | null = null;
  private rng: () => number;
  /** バトル開始時は昼。よるのしじまで「夜」になり、戻る手段はない。 */
  private timeOfDay: TimeOfDay = "day";

  constructor(input: NewBattleInput) {
    this.rng = makeRng(input.seed ?? Date.now());
    this.players = {
      p1: this.makePlayer("p1", input.p1.name, input.p1.partyIds),
      p2: this.makePlayer("p2", input.p2.name, input.p2.partyIds),
    };
    this.pushLog(`バトル開始！ ${input.p1.name} vs ${input.p2.name}`);
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
      timeOfDay: this.timeOfDay,
    };
  }

  /**
   * 1 ラウンド分の処理。両プレイヤーのコマンドを 1 件ずつ受け取り、
   * 速度順に解決して RoundResult を返す。
   *
   * ひんしが起きた時点でラウンドは打ち切り（残った行動はキャンセル）、
   * 自動交代だけ行う。次ラウンドは UI 側で改めてコマンド入力させる。
   */
  resolveRound(cmdP1: Command, cmdP2: Command): RoundResult {
    if (this.winner) {
      return { actions: [], snapshot: this.snapshot() };
    }

    this.turn += 1;

    // ターン開始時フラグのリセット
    this.activeOf("p1").resetTurnFlags();
    this.activeOf("p2").resetTurnFlags();

    // 行動順を決定: switch > priority > 素早さ > 乱数
    const order = this.orderActions(cmdP1, cmdP2);

    const actions: ActionResult[] = [];

    for (const { slot, cmd } of order) {
      if (this.winner) break;
      // すでにこのラウンドでひんしになっている可能性
      if (this.activeOf(slot).isFainted) break;

      const actionEvents: BattleEvent[] = [];
      this.execute(slot, cmd, actionEvents);

      // この行動でひんしが発生したか
      const anyFainted = this.resolveFaintsAfterAction(actionEvents);

      actions.push({
        actor: slot,
        events: actionEvents,
        snapshotAfter: this.snapshot(),
      });

      if (anyFainted) {
        // ラウンド終了 (遅い方の行動はキャンセル)
        break;
      }
    }

    // ラウンド終了処理 (drowsy → sleep など) — 誰もひんしになっていない場合のみ
    if (!this.winner && actions.length === order.length) {
      const endEvents: BattleEvent[] = [];
      this.endOfTurn(endEvents);
      if (endEvents.length > 0 && actions.length > 0) {
        actions[actions.length - 1].events.push(...endEvents);
        actions[actions.length - 1].snapshotAfter = this.snapshot();
      }
    }

    return { actions, snapshot: this.snapshot() };
  }

  /**
   * 行動の実行順を返す。
   * - switch コマンドは無条件で先（双方 switch なら速い方が先）
   * - 移動と move の混在: switch が先
   * - move 同士は priority (高いほど先) → 素早さ (高いほど先) → 乱数
   */
  private orderActions(cmdP1: Command, cmdP2: Command): { slot: PlayerSlot; cmd: Command }[] {
    const entries: { slot: PlayerSlot; cmd: Command }[] = [
      { slot: "p1", cmd: cmdP1 },
      { slot: "p2", cmd: cmdP2 },
    ];

    entries.sort((a, b) => {
      const aSwitch = a.cmd.type === "switch";
      const bSwitch = b.cmd.type === "switch";
      if (aSwitch !== bSwitch) return aSwitch ? -1 : 1;

      // 両方 move
      let aPrio = 0, bPrio = 0;
      if (a.cmd.type === "move") aPrio = getMove(a.cmd.moveId).priority ?? 0;
      if (b.cmd.type === "move") bPrio = getMove(b.cmd.moveId).priority ?? 0;
      if (aPrio !== bPrio) return bPrio - aPrio;

      const aSpd = this.activeOf(a.slot).effective("speed");
      const bSpd = this.activeOf(b.slot).effective("speed");
      if (aSpd !== bSpd) return bSpd - aSpd;

      return this.rng() < 0.5 ? -1 : 1;
    });

    return entries;
  }

  /**
   * 1 行動分の事後処理: ひんしを検出してログ・イベントを発行、自動交代する。
   * いずれかが倒れていれば true を返す（ラウンド打ち切りのシグナル）。
   */
  private resolveFaintsAfterAction(events: BattleEvent[]): boolean {
    let anyFainted = false;
    for (const slot of ["p1", "p2"] as PlayerSlot[]) {
      const m = this.activeOf(slot);
      if (m.isFainted) {
        events.push({ kind: "faint", actor: slot });
        this.pushLog(`${this.players[slot].state.name} の ${m.name} は倒れた！`);
        const next = this.players[slot].mons.findIndex((mm) => !mm.isFainted);
        if (next === -1) {
          this.winner = OTHER[slot];
          events.push({ kind: "win", winner: this.winner });
          this.pushLog(`${this.players[this.winner].state.name} の勝利！`);
        } else {
          this.players[slot].state.activeIndex = next;
          this.pushLog(
            `${this.players[slot].state.name} は ${this.activeOf(slot).name} を繰り出した！`,
          );
        }
        anyFainted = true;
      }
    }
    return anyFainted;
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
      // 場を離れるモンスターの能力段階・フラットボーナス・状態異常をリセット
      const leaving = this.activeOf(slot);
      leaving.state.stages = emptyStages();
      leaving.state.statBonus = emptyStages();
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

    // ===== 特殊技: 時間帯セット =====
    if (move.setTimeOfDay) {
      this.timeOfDay = move.setTimeOfDay;
      this.pushLog(
        `${attacker.name} の ${move.name}！ あたりは${move.setTimeOfDay === "night" ? "夜" : "昼"}になった！`,
      );
      events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: false, critical: false });
      // 追加効果も一応動かす
      this.applyExtraEffects(slot, attacker, defender, move, 0, true, events);
      return;
    }

    // ===== 特殊技: 物理反射スタンス (くろねこのまじない) =====
    if (move.physicalCounter) {
      const cost = Math.max(1, Math.floor((attacker.maxHp * move.physicalCounter.hpCostPercent) / 100));
      attacker.takeDamage(cost);
      attacker.pendingPhysicalCounter = { multiplier: move.physicalCounter.multiplier };
      this.pushLog(`${attacker.name} の ${move.name}！ HP を ${cost} 消費して物理攻撃を待ち構えた！`);
      events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: false, critical: false });
      this.applyExtraEffects(slot, attacker, defender, move, 0, true, events);
      return;
    }

    // protect のチェック: 攻撃技を相手が守っているなら無効化
    const isOffensive =
      move.power > 0 || !!move.fixedDamage || !!move.instantKo || !!move.timeConditionalPower;
    if (isOffensive && defender.protectedThisTurn) {
      this.pushLog(`${attacker.name} の ${move.name}！ しかし ${defender.name} は守りを固めていた！`);
      events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
      return;
    }

    // ===== 即死技 =====
    if (move.instantKo) {
      const result = calcDamage(attacker, defender, move, this.rng, { timeOfDay: this.timeOfDay });
      if (result.missed) {
        this.pushLog(`${attacker.name} の ${move.name}！ しかし外れた…`);
        events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
        return;
      }
      const before = defender.state.currentHp;
      defender.takeDamage(before);
      this.pushLog(`${attacker.name} の ${move.name}！ ${defender.name} は一撃で倒れた！`);
      events.push({
        kind: "move",
        actor: slot,
        moveId: move.id,
        damage: before,
        missed: false,
        critical: false,
      });
      return;
    }

    // ===== 固定ダメージ技 =====
    if (move.fixedDamage != null) {
      const result = calcDamage(attacker, defender, move, this.rng, { timeOfDay: this.timeOfDay });
      if (result.missed) {
        this.pushLog(`${attacker.name} の ${move.name}！ しかし外れた…`);
        events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
        return;
      }
      // 物理反射スタンス対応
      if (defender.pendingPhysicalCounter && move.category === "physical") {
        const mult = defender.pendingPhysicalCounter.multiplier;
        defender.pendingPhysicalCounter = null;
        const reflectedDamage = Math.floor(result.damage * mult);
        attacker.takeDamage(reflectedDamage);
        this.pushLog(
          `${defender.name} のまじないが発動！ ${attacker.name} に ${reflectedDamage} のダメージを跳ね返した！`,
        );
        events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
        return;
      }
      defender.takeDamage(result.damage);
      this.pushLog(`${attacker.name} の ${move.name}！ ${defender.name} に ${result.damage} のダメージ`);
      events.push({
        kind: "move",
        actor: slot,
        moveId: move.id,
        damage: result.damage,
        missed: false,
        critical: false,
      });
      this.applyExtraEffects(slot, attacker, defender, move, result.damage, true, events);
      return;
    }

    // ===== 通常攻撃 / 変化技 =====
    let totalDamageDealt = 0;
    let anyHit = false;

    if (
      move.power > 0 ||
      move.timeConditionalPower != null ||
      move.effects?.some((e) => e.kind === "body_press")
    ) {
      // 攻撃技
      const multiHit = move.effects?.find((e) => e.kind === "multi_hit") as
        | Extract<MoveEffect, { kind: "multi_hit" }>
        | undefined;
      const isBodyPress = !!move.effects?.find((e) => e.kind === "body_press");

      // 時間帯条件の威力
      const powerOverride =
        move.timeConditionalPower != null
          ? move.timeConditionalPower[this.timeOfDay === "night" ? "night" : "day"]
          : undefined;

      const hitCount = multiHit ? randInt(this.rng, multiHit.min, multiHit.max) : 1;

      for (let i = 0; i < hitCount; i++) {
        if (defender.isFainted) break;
        const result = calcDamage(attacker, defender, move, this.rng, {
          bodyPress: isBodyPress,
          timeOfDay: this.timeOfDay,
          powerOverride,
        });
        if (result.missed) {
          if (i === 0) {
            this.pushLog(`${attacker.name} の ${move.name}！ しかし外れた…`);
            events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
            return;
          }
          break;
        }
        // 物理反射スタンス対応
        if (defender.pendingPhysicalCounter && move.category === "physical") {
          const mult = defender.pendingPhysicalCounter.multiplier;
          defender.pendingPhysicalCounter = null;
          const reflectedDamage = Math.floor(result.damage * mult);
          attacker.takeDamage(reflectedDamage);
          this.pushLog(
            `${defender.name} のまじないが発動！ ${attacker.name} に ${reflectedDamage} のダメージを跳ね返した！`,
          );
          events.push({ kind: "move", actor: slot, moveId: move.id, damage: 0, missed: true, critical: false });
          return;
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
      // 変化技: 命中判定だけ通す
      const ok =
        this.rng() * 100 <= Math.max(0, move.accuracy - (this.timeOfDay === "night" ? 10 : 0));
      this.pushLog(`${attacker.name} の ${move.name}！${ok ? "" : " しかし外れた…"}`);
      events.push({
        kind: "move",
        actor: slot,
        moveId: move.id,
        damage: 0,
        missed: !ok,
        critical: false,
      });
      if (!ok) return;
      anyHit = true;
    }

    this.applyExtraEffects(slot, attacker, defender, move, totalDamageDealt, anyHit, events);
  }

  /** move.effects を一括適用するヘルパ */
  private applyExtraEffects(
    slot: PlayerSlot,
    attacker: Monster,
    defender: Monster,
    move: MoveDefinition,
    totalDamageDealt: number,
    anyHit: boolean,
    events: BattleEvent[],
  ) {
    if (!move.effects) return;
    for (const eff of move.effects) {
      if (eff.kind === "multi_hit" || eff.kind === "body_press") continue;
      if (!anyHit) continue;
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
        const amount =
          effect.flat != null
            ? effect.flat
            : Math.floor((attacker.maxHp * (effect.percent ?? 0)) / 100);
        const healed = attacker.heal(amount);
        if (healed > 0) {
          this.pushLog(`${attacker.name} は HP を ${healed} 回復した！`);
          events.push({ kind: "heal", actor: slot, amount: healed });
        } else {
          this.pushLog(`${attacker.name} の HP は満タンだ！`);
        }
        return;
      }

      case "heal_all_alive": {
        // 両チームのすべての生存モンスターを percent% 回復
        let totalHealed = 0;
        for (const s of ["p1", "p2"] as PlayerSlot[]) {
          for (const m of this.players[s].mons) {
            if (m.isFainted) continue;
            const amt = Math.floor((m.maxHp * effect.percent) / 100);
            const h = m.heal(amt);
            if (h > 0) {
              totalHealed += h;
              events.push({ kind: "heal", actor: s, amount: h });
            }
          }
        }
        this.pushLog(`おだやかな空気が流れる。全員のHPが合計 ${totalHealed} 回復した！`);
        return;
      }

      case "flat_stat_bonus": {
        const targetSlot = effect.target === "self" ? slot : OTHER[slot];
        const targetMon = this.activeOf(targetSlot);
        if (targetMon.isFainted) return;
        targetMon.changeFlatStat(effect.stat, effect.amount);
        const sign = effect.amount >= 0 ? "+" : "";
        this.pushLog(
          `${targetMon.name} の ${STAT_LABEL[effect.stat]} が ${sign}${effect.amount} された！`,
        );
        events.push({
          kind: "stat_change",
          actor: slot,
          target: targetSlot,
          stat: effect.stat,
          stages: 0,
        });
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

    }
  }

  // ============================================================
  // 状態異常まわり
  // ============================================================

  /**
   * 行動前の状態異常チェック。
   * 現状サポートする状態異常は confusion のみ:
   *   - 50% の確率で自分を攻撃して行動不能
   *   - 残りラウンド数 2〜3
   */
  private canActWithStatus(mon: Monster): boolean {
    if (mon.state.status === "confusion") {
      // ラウンドカウンタ消化
      if (mon.state.statusTurns <= 0) {
        mon.state.status = null;
        this.pushLog(`${mon.name} の こんらん がとけた！`);
        return true;
      }
      this.pushLog(`${mon.name} は混乱している。`);
      mon.state.statusTurns -= 1;
      if (this.rng() < 0.5) {
        // 自分に体当たり (簡易: 固定値 8 + ATK 比例)
        const selfHit = Math.max(
          1,
          Math.floor((mon.effective("attack") / Math.max(1, mon.effective("defense"))) * 8 + 2),
        );
        mon.takeDamage(selfHit);
        this.pushLog(`${mon.name} はわけがわからず自分を攻撃した！ ${selfHit} のダメージ！`);
        return false;
      }
      return true;
    }
    return true;
  }

  private applyStatusTo(
    actorSlot: PlayerSlot,
    target: Monster,
    status: StatusCondition,
    events: BattleEvent[],
  ) {
    if (target.state.status) {
      this.pushLog(`${target.name} には既に状態異常がある…`);
      return;
    }
    // confusion: 2〜3 ラウンド
    const turns = status === "confusion" ? randInt(this.rng, 2, 3) : 0;
    target.applyStatus(status, turns);
    this.pushLog(`${target.name} は ${STATUS_LABEL[status]} 状態になった！`);
    events.push({ kind: "status_applied", actor: actorSlot, target: this.slotOf(target)!, status });
  }

  // ============================================================
  // ラウンド終了処理 (現状は何もしない。将来のフィールド効果や毒等のため残しておく)
  // ============================================================
  private endOfTurn(_events: BattleEvent[]) {
    // no-op
  }

  // 旧 handleFaints は resolveFaintsAfterAction に統合済み

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
      statBonus: { ...m.statBonus },
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
