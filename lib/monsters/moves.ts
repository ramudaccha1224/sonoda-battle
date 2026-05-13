import type { MoveDefinition } from "../battle/types";

/**
 * 「おかえりそのだくん」シリーズ用の技定義（全 24 種）。
 *
 * 各キャラ 4 技。物理 / 特殊 / 変化 の 3 カテゴリ。
 * effects に複数の追加効果を載せられる（例: 攻撃ダメージ + 反動）。
 */
export const MOVES: Record<string, MoveDefinition> = {
  // ===== そのだ（オールラウンダー）=====
  zenryoku_nekopunch: {
    id: "zenryoku_nekopunch",
    name: "全力ねこパンチ",
    power: 40,
    category: "physical",
    accuracy: 100,
    pp: 30,
    alwaysHit: true,
    description: "まっすぐなパンチ。必ず命中する。",
  },
  issho_ohirune: {
    id: "issho_ohirune",
    name: "いっしょにお昼寝",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "heal_both", percent: 25 }],
    description: "自分と相手のHPを少し回復し、おだやかな空気にする。",
  },
  shippo_aisatsu: {
    id: "shippo_aisatsu",
    name: "しっぽでご挨拶",
    power: 60,
    category: "physical",
    accuracy: 100,
    pp: 20,
    effects: [{ kind: "inflict_status", status: "paralysis", chance: 20 }],
    description: "しっぽをパタパタ振って攻撃。たまに相手を「まひ」させる。",
  },
  okaeri_tackle: {
    id: "okaeri_tackle",
    name: "おかえりタックル",
    power: 90,
    category: "physical",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "recoil", ratio: 0.25 }],
    description: "全力でお出迎えする。自分も少しダメージを受ける。",
  },

  // ===== みむら（物理アタッカー）=====
  gabugabu_kamitsuki: {
    id: "gabugabu_kamitsuki",
    name: "がぶがぶ噛みつき",
    power: 65,
    category: "physical",
    accuracy: 100,
    pp: 20,
    description: "甘噛みのつもりが結構痛い。",
  },
  hikkaki_ranbu: {
    id: "hikkaki_ranbu",
    name: "ひっかき乱舞",
    power: 18,
    category: "physical",
    accuracy: 95,
    pp: 15,
    effects: [{ kind: "multi_hit", min: 2, max: 5 }],
    description: "爪を出して何度もひっかく。2〜5回連続でヒットする。",
  },
  fumifumi_press: {
    id: "fumifumi_press",
    name: "ふみふみプレス",
    power: 80,
    category: "physical",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "flinch", chance: 30 }],
    description: "全体重を乗せて足踏みする。相手をひるませることがある。",
  },
  honki_nekokick: {
    id: "honki_nekokick",
    name: "本気の猫キック",
    power: 120,
    category: "physical",
    accuracy: 70,
    pp: 5,
    description: "仰向けになって放つ強力な蹴り。当たれば大きい。",
  },

  // ===== くろべ（魔法アタッカー）=====
  omeme_beam: {
    id: "omeme_beam",
    name: "おめめビーム",
    power: 40,
    category: "special",
    accuracy: 100,
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
    effects: [{ kind: "stat_change", target: "opponent", stat: "defense", stages: -2, chance: 100 }],
    description: "相手の「ぼうぎょ」をガクッと下げる。",
  },
  yoru_no_shijima: {
    id: "yoru_no_shijima",
    name: "よるのしじま",
    power: 80,
    category: "special",
    accuracy: 95,
    pp: 10,
    description: "周囲を真っ暗にして精神的なダメージを与える。",
  },
  shadow_gorogoro: {
    id: "shadow_gorogoro",
    name: "シャドウ・ゴロゴロ",
    power: 100,
    category: "special",
    accuracy: 100,
    pp: 5,
    alwaysHit: true,
    description: "影に潜んで攻撃。相手の「回避率」を無視して当たる。",
  },

  // ===== あべ（スピード）=====
  shubaba_run: {
    id: "shubaba_run",
    name: "しゅばば走",
    power: 40,
    category: "physical",
    accuracy: 100,
    pp: 30,
    priority: 1,
    description: "相手より先に攻撃できる。電光石火の動き。",
  },
  nekojarashi_honro: {
    id: "nekojarashi_honro",
    name: "ねこじゃらし翻弄",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 15,
    // 「回避率UP」の代用として素早さを 2 段階上げる
    effects: [{ kind: "stat_change", target: "self", stat: "speed", stages: 2, chance: 100 }],
    description: "素早い動きで自分の「回避率」を上げる。",
  },
  kashakasha_attack: {
    id: "kashakasha_attack",
    name: "カシャカシャ・アタック",
    power: 60,
    category: "physical",
    accuracy: 100,
    pp: 20,
    description: "音の鳴るおもちゃのような速さで突撃する。",
  },
  shinkuu_tobitsuki: {
    id: "shinkuu_tobitsuki",
    name: "真空とびつき",
    power: 80,
    category: "physical",
    accuracy: 95,
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
    effects: [{ kind: "stat_change", target: "self", stat: "defense", stages: 2, chance: 100 }],
    description: "体を丸めて守りを固め、「ぼうぎょ」を大きく上げる。",
  },
  marumari_shield: {
    id: "marumari_shield",
    name: "まるまりシールド",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 10,
    priority: 2, // 守る系は最優先
    effects: [{ kind: "protect" }],
    description: "そのターンの相手の攻撃を防ぐ。",
  },
  gorogoro_taiatari: {
    id: "gorogoro_taiatari",
    name: "ごろんごろん体当たり",
    power: 50,
    category: "physical",
    accuracy: 100,
    pp: 15,
    effects: [{ kind: "body_press" }],
    description: "自分の「ぼうぎょ」が高いほどダメージが増える。",
  },
  oyatsu_jikan: {
    id: "oyatsu_jikan",
    name: "おやつのじかん",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "heal_self", percent: 50 }],
    description: "おやつを食べて自分の最大HPの半分を回復する。",
  },

  // ===== とだ（トリッキー＆回復）=====
  fushigi_kezukuroi: {
    id: "fushigi_kezukuroi",
    name: "ふしぎな毛づくろい",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 15,
    effects: [{ kind: "cure_status" }],
    description: "自分や味方の状態異常をきれいに治す。",
  },
  matatabi_mist: {
    id: "matatabi_mist",
    name: "またたびミスト",
    power: 0,
    category: "status",
    accuracy: 90,
    pp: 10,
    effects: [{ kind: "inflict_status", status: "confusion", chance: 100 }],
    description: "またたびの香りを振りまき、相手を「こんらん」させる。",
  },
  akubi_rensa: {
    id: "akubi_rensa",
    name: "あくびの連鎖",
    power: 0,
    category: "status",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "inflict_status", status: "drowsy", chance: 100 }],
    description: "大きなあくびをして、次のターンに相手を「ねむり」にする。",
  },
  bikkuribako_jump: {
    id: "bikkuribako_jump",
    name: "びっくり箱ジャンプ",
    power: 70,
    category: "physical",
    accuracy: 100,
    pp: 10,
    effects: [{ kind: "random_extra" }],
    description: "どこから来るか分からない動きで攻撃。追加効果がランダムで出る。",
  },
};

export function getMove(id: string): MoveDefinition {
  const m = MOVES[id];
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}
