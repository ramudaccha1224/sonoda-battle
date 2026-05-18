/**
 * バトル全体で共有する純粋な型定義。
 * 描画 (Three.js) や通信 (Socket.io) には依存しない。
 */

export type MonsterId =
  | "sonoda"
  | "mimura"
  | "kurobe"
  | "abe"
  | "oguri"
  | "toda";

export type MoveCategory = "physical" | "special" | "status";

export type StatName =
  | "attack"
  | "defense"
  | "spAttack"
  | "spDefense"
  | "speed";

/** 状態異常。null = なし。 */
export type StatusCondition = "confusion"; // 50% で自分を攻撃、2〜3 ラウンド

/** 時間帯 */
export type TimeOfDay = "day" | "night";

/**
 * 技の追加効果。1 つの技に複数つけられる。
 *
 * - heal_self           : 使用者の HP を percent% (or 固定値) 回復
 * - heal_all_alive      : 場と控え合わせて死亡していない全モンスターの HP を percent% 回復
 * - stat_change         : 能力ランクを ±段階だけ変える（倍率制）
 * - flat_stat_bonus     : 能力値そのものに amount を加算（おぐりの「防御+30」等）
 * - recoil              : 与えたダメージの ratio を自分に反動として受ける
 * - multi_hit           : 同じ技を min〜max 回ヒットさせる
 * - body_press          : ダメージ = 自分の防御値（フォーミュラを使わず、その時点の防御をそのまま投げつける）
 * - protect             : このラウンドの相手の攻撃を無効化する
 * - inflict_status      : 状態異常を chance% で付与
 * - flinch              : chance% で相手を「ひるみ」状態（同ラウンドで後攻なら動けない）
 * - cure_status         : 使用者の状態異常を全て治す
 */
export type MoveEffect =
  | { kind: "heal_self"; percent?: number; flat?: number }
  | { kind: "heal_all_alive"; percent: number }
  | {
      kind: "stat_change";
      target: "self" | "opponent";
      stat: StatName;
      stages: number;
      chance: number;
    }
  | {
      kind: "flat_stat_bonus";
      target: "self" | "opponent";
      stat: StatName;
      amount: number;
    }
  | { kind: "recoil"; ratio: number }
  | { kind: "multi_hit"; min: number; max: number }
  | { kind: "body_press" }
  | { kind: "protect" }
  | { kind: "inflict_status"; status: StatusCondition; chance: number }
  | { kind: "flinch"; chance: number }
  | { kind: "cure_status" };

export interface MoveDefinition {
  id: string;
  name: string;
  power: number;          // 技の威力 (0 = フォーミュラ計算なし。fixedDamage / body_press などが代替)
  category: MoveCategory; // 物理 / 特殊 / 変化
  accuracy: number;       // 0-100
  pp: number;             // 使用可能回数
  priority?: number;      // ラウンド内の行動順で素早さより優先される
  effects?: MoveEffect[]; // 追加効果（複数可）
  description: string;

  // === 特殊効果フラグ ===
  /** 固定ダメージ (defense/attack を見ず、当たれば常にこの値) */
  fixedDamage?: number;
  /** 命中すれば即死させる */
  instantKo?: boolean;
  /** 時間帯で威力が変わる（move.power は無視される） */
  timeConditionalPower?: { day: number; night: number };
  /** 時間帯をセットする変化技 */
  setTimeOfDay?: TimeOfDay;
  /**
   * 物理反射スタンス。使用時に最大 HP の hpCostPercent% を消費し、
   * このラウンドで相手が物理攻撃を仕掛けてきた場合
   * - 自分はそのダメージを受けない
   * - 相手に multiplier 倍のダメージを与える
   */
  physicalCounter?: { hpCostPercent: number; multiplier: number };
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

/**
 * モンスターの「設計図」。
 * 見た目（color）は描画ヒントだが、将来 modelUrl に差し替えできる。
 */
/**
 * 3D メッシュ上に重ねる「色斑」。三毛猫などの複数色キャラに使う。
 * position はモンスター group のローカル座標（足元 = y=0, 顔 = +Z 方向）。
 * scale は球体の半径。squash で球を扁平にして、体の表面に貼り付いた斑のように見せられる。
 */
export interface ColorPatch {
  color: string;
  position: [number, number, number];
  scale: number;
  squash?: [number, number, number];
}

/**
 * 2D 円形アイコン用の模様。
 * 円は viewBox 0 0 64 64 / cx=32 cy=32 r=30 のクリップ内に描画される。
 * spots: 楕円（縦縞・横縞・斑）。rotation で傾けて八割れの斜め線も表現できる。
 * paths: 任意の SVG パス（より複雑な形が必要なときに使う）。
 */
export interface IconSpot {
  color: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation?: number; // 度
}

export interface IconPath {
  color: string;
  d: string;
}

export interface IconPattern {
  spots?: IconSpot[];
  paths?: IconPath[];
}

export interface MonsterDefinition {
  id: MonsterId;
  name: string;
  displayColor: string;   // 円形アイコンのベース色 / 3D メッシュの基本色
  modelUrl?: string;      // 将来 GLTF に置き換える時に使う
  /** 3D モデルに重ねる追加の色斑（任意）。空なら単色キャラ。 */
  patches?: ColorPatch[];
  /** 左右の耳の色を上書きしたいとき（任意）。指定がなければ displayColor を使う。 */
  earColors?: { left?: string; right?: string };
  /** 2D 円形アイコンに乗せる模様（任意）。 */
  iconPattern?: IconPattern;
  // --- バトル用の内部データ（UI には表示しない） ---
  role: string;           // 「オールラウンダー」など。内部保持のみ。
  tagline: string;        // 1 行紹介。内部保持のみ。
  stats: BaseStats;
  moveIds: string[];      // 覚えている技 (最大4つ程度)
  // --- キャラクター紹介データ（モーダルで表示する） ---
  birthday: string;
  favoriteFood: string;
  description: string;
}

/** 戦闘中のステータス段階。0 が標準で ±3 を上限にする。 */
export interface StatStages {
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

/**
 * 戦闘中のモンスターの可変状態。
 * MonsterDefinition は不変、MonsterState はターン毎に変わる。
 */
export interface MonsterState {
  defId: MonsterId;
  currentHp: number;
  ppLeft: Record<string, number>;
  fainted: boolean;
  /** 倍率制の能力段階（±3） */
  stages: StatStages;
  /** フラット加算の能力値ボーナス（おぐりの「防御+30」用） */
  statBonus: StatStages;
  status: StatusCondition | null;
  /** 状態異常の残りラウンド数 (confusion) */
  statusTurns: number;
}

export type PlayerSlot = "p1" | "p2";

export interface PlayerState {
  slot: PlayerSlot;
  name: string;
  party: MonsterState[];   // 2体
  activeIndex: number;     // 場に出ているモンスターの index
}

/** プレイヤーが1ターンに送るコマンド */
export type Command =
  | { type: "move"; moveId: string }
  | { type: "switch"; toIndex: number };

export interface BattleSnapshot {
  turn: number;
  players: Record<PlayerSlot, PlayerState>;
  log: string[];
  winner: PlayerSlot | null;
  /** 現在の時間帯 */
  timeOfDay: TimeOfDay;
}

/** 1 アクション分の結果（プレイヤー1人の1行動） */
export interface ActionResult {
  actor: PlayerSlot;
  events: BattleEvent[];
  /** この行動が終了した時点のスナップショット */
  snapshotAfter: BattleSnapshot;
}

/** 1 ラウンド分の結果（両プレイヤーの行動を速度順に解決した結果） */
export interface RoundResult {
  /** 速度順に並んだアクション群。早い方が actions[0]。
   *  途中でひんしが起きた場合、それ以降は実行されないので actions は 1 件のこともある。 */
  actions: ActionResult[];
  /** ラウンド全体終了後の最終スナップショット */
  snapshot: BattleSnapshot;
}

/** ターン進行の結果として返す差分情報 */
export interface TurnResult {
  snapshot: BattleSnapshot;
  events: BattleEvent[];
}

export type BattleEvent =
  | { kind: "move"; actor: PlayerSlot; moveId: string; damage: number; missed: boolean; critical: boolean }
  | { kind: "heal"; actor: PlayerSlot; amount: number }
  | { kind: "stat_change"; actor: PlayerSlot; target: PlayerSlot; stat: StatName; stages: number }
  | { kind: "status_applied"; actor: PlayerSlot; target: PlayerSlot; status: StatusCondition }
  | { kind: "status_cleared"; actor: PlayerSlot }
  | { kind: "switch"; actor: PlayerSlot; toIndex: number }
  | { kind: "faint"; actor: PlayerSlot }
  | { kind: "win"; winner: PlayerSlot };

export const STAGE_MIN = -3;
export const STAGE_MAX = 3;

/** 能力段階を「倍率」に変換。±3 で最大 ×2.5 / ÷2.5 程度。 */
export function stageMultiplier(stage: number): number {
  const s = Math.max(STAGE_MIN, Math.min(STAGE_MAX, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export function emptyStages(): StatStages {
  return { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
}

export const STATUS_LABEL: Record<StatusCondition, string> = {
  confusion: "こんらん",
};
