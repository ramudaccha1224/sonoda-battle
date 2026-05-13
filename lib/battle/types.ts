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
export type StatusCondition =
  | "paralysis"  // まひ: 25% で行動失敗
  | "confusion" // こんらん: 33% で自分を攻撃
  | "sleep"     // ねむり: 1〜3 ターン行動不能
  | "drowsy";   // うとうと: 次のターンに ねむり に移行

/**
 * 技の追加効果。1 つの技に複数つけられる。
 *
 * - heal_self     : 使用者の HP を percent% 回復
 * - heal_both     : 双方の HP を percent% 回復（そのだ「いっしょにお昼寝」）
 * - stat_change   : 能力ランクを ±段階だけ変える
 * - recoil        : 与えたダメージの ratio を自分に反動として受ける
 * - multi_hit     : 同じ技を min〜max 回ヒットさせる（みむら「ひっかき乱舞」）
 * - body_press    : ダメージ計算で自分の防御を攻撃として使う（おぐり「ごろんごろん体当たり」）
 * - protect       : このターンの相手の攻撃を無効化する（おぐり「まるまりシールド」）
 * - inflict_status: 状態異常を chance% で付与
 * - flinch        : chance% で相手を「ひるみ」状態（このターン後攻なら動けない）
 * - cure_status   : 使用者の状態異常を全て治す
 * - random_extra  : ダメージ後にランダムな副次効果を発生させる
 */
export type MoveEffect =
  | { kind: "heal_self"; percent: number }
  | { kind: "heal_both"; percent: number }
  | {
      kind: "stat_change";
      target: "self" | "opponent";
      stat: StatName;
      stages: number;
      chance: number;
    }
  | { kind: "recoil"; ratio: number }
  | { kind: "multi_hit"; min: number; max: number }
  | { kind: "body_press" }
  | { kind: "protect" }
  | { kind: "inflict_status"; status: StatusCondition; chance: number }
  | { kind: "flinch"; chance: number }
  | { kind: "cure_status" }
  | { kind: "random_extra" };

export interface MoveDefinition {
  id: string;
  name: string;
  power: number;          // 技の威力 (0 = ダメージなし)
  category: MoveCategory; // 物理 / 特殊 / 変化
  accuracy: number;       // 0-100。alwaysHit=true なら無視。
  pp: number;             // 使用可能回数
  priority?: number;      // 0 が標準。1 以上で「先制技」
  alwaysHit?: boolean;    // 「必中」フラグ
  effects?: MoveEffect[]; // 追加効果（複数可）
  description: string;
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
  stages: StatStages;
  status: StatusCondition | null;
  /** 状態異常の残りターン (sleep/confusion/drowsy で使用) */
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
  /** いまどちらの順番か。ターン制バトル用。winner があれば null。 */
  currentTurnSlot: PlayerSlot | null;
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
  paralysis: "まひ",
  confusion: "こんらん",
  sleep: "ねむり",
  drowsy: "うとうと",
};
