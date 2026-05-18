import type { MoveDefinition } from "../battle/types";

/**
 * 「おかえりそのだくん」シリーズ用の技定義（全 24 種）。
 *
 * xlsx で手動調整されたバージョン。
 * - 物理 / 特殊 / 変化 の 3 カテゴリ
 * - effects に複数の追加効果を載せられる
 * - 特殊メカニクスは MoveDefinition のトップレベルフラグで指定:
 *   physicalCounter / instantKo / fixedDamage / timeConditionalPower / setTimeOfDay
 */
export const MOVES: Record<string, MoveDefinition> = {
  // ===== そのだ（オールラウンダー）=====
  zenryoku_nekopunch: {
    id: "zenryoku_nekopunch",
    name: "全力ねこパンチ",
    power: 30,
    category: "physical",
    accuracy: 90,
    pp: 30,
    description: "まっすぐなパンチ。",
  },
  issho_ohirune: {
    id: "issho_ohirune",
    name: "いっしょにお昼寝",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "heal_all_alive", percent: 40 }],
    description:
      "自分も相手も全員（死亡しているモンスターを除く）のHPを40％回復し、おだやかな空気にする。",
  },
  shippo_aisatsu: {
    id: "shippo_aisatsu",
    name: "しっぽでご挨拶",
    power: 20,
    category: "physical",
    accuracy: 90,
    pp: 20,
    effects: [{ kind: "multi_hit", min: 1, max: 3 }],
    description: "しっぽをパタパタ振って 1〜3 回ヒットする。",
  },
  okaeri_tackle: {
    id: "okaeri_tackle",
    name: "おかえりタックル",
    power: 90,
    category: "physical",
    accuracy: 90,
    pp: 10,
    effects: [{ kind: "recoil", ratio: 0.25 }],
    description: "全力でお出迎えする。自分も少しダメージを受ける。",
  },

  // ===== みむら（物理アタッカー）=====
  gabugabu_kamitsuki: {
    id: "gabugabu_kamitsuki",
    name: "がぶがぶ噛みつき",
    power: 40,
    category: "physical",
    accuracy: 100,
    pp: 20,
    description: "甘噛みのつもりが結構痛い。",
  },
  hikkaki_ranbu: {
    id: "hikkaki_ranbu",
    name: "ひっかき乱舞",
    power: 15,
    category: "physical",
    accuracy: 90,
    pp: 15,
    effects: [{ kind: "multi_hit", min: 2, max: 5 }],
    description: "爪を出して何度もひっかく。2〜5回連続でヒットする。",
  },
  fumifumi_press: {
    id: "fumifumi_press",
    name: "ふみふみプレス",
    power: 80,
    category: "physical",
    accuracy: 80,
    pp: 10,
    effects: [{ kind: "flinch", chance: 30 }],
    description: "全体重を乗せて足踏みする。相手をひるませることがある。",
  },
  honki_nekokick: {
    id: "honki_nekokick",
    name: "本気の猫キック",
    power: 100,
    category: "physical",
    accuracy: 70,
    pp: 5,
    description: "仰向けになって放つ強力な蹴り。当たれば大きい。",
  },

  // ===== くろべ（魔法アタッカー）=====
  omeme_beam: {
    id: "omeme_beam",
    name: "おめめビーム",
    power: 30,
    category: "special",
    accuracy: 85,
    pp: 30,
    description: "暗闇で光る目から不思議な光線を出す。",
  },
  kuroneko_majinai: {
    id: "kuroneko_majinai",
    name: "くろねこのまじない",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 15,
    physicalCounter: { hpCostPercent: 50, multiplier: 2 },
    description:
      "自分のHPの半分を消費して発動。同じラウンドで敵が物理攻撃を仕掛けてきた場合、自分はそのダメージを受けず、相手に跳ね返して 2 倍のダメージを与える。",
  },
  yoru_no_shijima: {
    id: "yoru_no_shijima",
    name: "よるのしじま",
    power: 0,
    category: "special",
    accuracy: 100,
    pp: 10,
    setTimeOfDay: "night",
    description: "あたりを真っ暗にして、時間帯を「夜」にする。",
  },
  shadow_gorogoro: {
    id: "shadow_gorogoro",
    name: "シャドウ・ゴロゴロ",
    power: 0,
    category: "special",
    accuracy: 100,
    pp: 5,
    timeConditionalPower: { day: 10, night: 100 },
    description:
      "影に潜んで攻撃。昼は威力 10 だが、夜は威力 100 に跳ね上がる。",
  },

  // ===== あべ（スピード）=====
  shubaba_run: {
    id: "shubaba_run",
    name: "しゅばば走",
    power: 25,
    category: "physical",
    accuracy: 100,
    pp: 30,
    description: "電光石火の動きで突進する。",
  },
  nekojarashi_honro: {
    id: "nekojarashi_honro",
    name: "ねこじゃらし翻弄",
    power: 0,
    category: "status",
    accuracy: 80,
    pp: 15,
    effects: [{ kind: "inflict_status", status: "confusion", chance: 100 }],
    description: "ふしぎな動きで相手を「こんらん」させる。",
  },
  kashakasha_attack: {
    id: "kashakasha_attack",
    name: "カシャカシャ・アタック",
    power: 30,
    category: "physical",
    accuracy: 50,
    pp: 20,
    description: "音の鳴るおもちゃのような速さで突撃する。命中はやや不安定。",
  },
  shinkuu_tobitsuki: {
    id: "shinkuu_tobitsuki",
    name: "真空とびつき",
    power: 80,
    category: "physical",
    accuracy: 80,
    pp: 10,
    description: "高い跳躍から相手に飛びかかる。",
  },

  // ===== おぐり（防御）=====
  koubako_zuwari: {
    id: "koubako_zuwari",
    name: "香箱座り",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 20,
    effects: [{ kind: "flat_stat_bonus", target: "self", stat: "defense", amount: 30 }],
    description: "体を丸めて守りを固め、防御を +30 する。",
  },
  marumari_shield: {
    id: "marumari_shield",
    name: "まるまりシールド",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 10,
    effects: [
      { kind: "flat_stat_bonus", target: "self", stat: "defense", amount: 10 },
      { kind: "heal_self", percent: 10 },
    ],
    description: "防御を +10 し、さらに自分の最大HPの10％を回復する。",
  },
  gorogoro_taiatari: {
    id: "gorogoro_taiatari",
    name: "ごろんごろん体当たり",
    power: 0,
    category: "physical",
    accuracy: 60,
    pp: 15,
    effects: [{ kind: "body_press" }],
    description: "その時点の防御値を、攻撃力として相手にぶつける。",
  },
  oyatsu_jikan: {
    id: "oyatsu_jikan",
    name: "おやつのじかん",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "heal_self", percent: 50 }],
    description: "おやつを食べて自分の最大HPの50％を回復する。",
  },

  // ===== とだ（トリッキー＆回復）=====
  fushigi_kezukuroi: {
    id: "fushigi_kezukuroi",
    name: "ふしぎな毛づくろい",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 15,
    effects: [
      { kind: "cure_status" },
      { kind: "heal_self", flat: 30 },
    ],
    description: "自分の状態異常を全て治し、さらに HP を 30 回復する。",
  },
  matatabi_mist: {
    id: "matatabi_mist",
    name: "またたびミスト",
    power: 20,
    category: "special",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "inflict_status", status: "confusion", chance: 100 }],
    description: "またたびの香りを振りまく。ダメージとともに必ず「こんらん」させる。",
  },
  akubi_rensa: {
    id: "akubi_rensa",
    name: "あくびの連鎖",
    power: 0,
    category: "status",
    accuracy: 25,
    pp: 10,
    instantKo: true,
    description: "大きなあくびで相手を引きずり込む。当たれば一撃で倒すが、命中はかなり低い。",
  },
  bikkuribako_jump: {
    id: "bikkuribako_jump",
    name: "びっくり箱ジャンプ",
    power: 0,
    category: "physical",
    accuracy: 100,
    pp: 10,
    fixedDamage: 30,
    description: "どこから来るか分からない動きで攻撃。固定 30 ダメージを与える。",
  },
};

export function getMove(id: string): MoveDefinition {
  const m = MOVES[id];
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}
