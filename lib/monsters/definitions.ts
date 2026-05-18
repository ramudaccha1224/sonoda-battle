import {
  emptyStages,
  type MonsterDefinition,
  type MonsterId,
  type MonsterState,
} from "../battle/types";
import { getMove } from "./moves";

/**
 * 6 体のキャラクター定義。
 *
 * role / tagline / stats / moveIds はバトル用の内部データで、UI には表示しない。
 * モーダルでは name / displayColor / birthday / favoriteFood / description のみを使う。
 *
 * displayColor は暫定描画用。modelUrl を埋めれば将来 GLTF に差し替え可能。
 */
export const MONSTERS: Record<MonsterId, MonsterDefinition> = {
  sonoda: {
    id: "sonoda",
    name: "そのだ",
    displayColor: "#f5f5f5",
    role: "オールラウンダー",
    tagline: "全体的にバランスが良く、癖がない。攻守どちらにも対応できる万能型。",
    stats: { hp: 100, attack: 80, defense: 80, spAttack: 80, spDefense: 80, speed: 80 },
    moveIds: ["zenryoku_nekopunch", "issho_ohirune", "shippo_aisatsu", "okaeri_tackle"],
    birthday: "2月23日",
    favoriteFood: "マーマレードジャム",
    description:
      "頑張っている人の前にだけ現れる、園田駅付近在住の白いネコ。昼はお昼寝をして、夜に頑張る人の「頑張らない時間」を作るために「おかえり」を言いにきてくれます。",
  },
  mimura: {
    id: "mimura",
    name: "みむら",
    // 白ベースの頭頂に 黒（左）+ 茶（右）の八割れ模様。
    displayColor: "#f0ece5",
    earColors: {
      left: "#1a1a1a",  // 左耳: 黒
      right: "#7a4a26", // 右耳: 茶
    },
    patches: [
      // 頭の上 左側の黒い帽子状斑
      { color: "#1a1a1a", position: [-0.3, 1.98, 0.15], scale: 0.36, squash: [1.3, 0.55, 1.3] },
      // 頭の上 右側の茶色の帽子状斑
      { color: "#7a4a26", position: [0.3, 1.98, 0.15], scale: 0.36, squash: [1.3, 0.55, 1.3] },
    ],
    iconPattern: {
      // 円形アイコン: 左半分の頭頂を黒、右半分を茶。八割れの「八」を 2 個の楕円で表現する。
      spots: [
        { color: "#1a1a1a", cx: 22, cy: 14, rx: 13, ry: 12 },
        { color: "#7a4a26", cx: 42, cy: 14, rx: 13, ry: 12 },
      ],
    },
    role: "物理アタッカー",
    tagline: "攻撃力が高く、一撃が重い。物理技を叩きつけて押し切る前衛タイプ。",
    stats: { hp: 100, attack: 120, defense: 60, spAttack: 50, spDefense: 70, speed: 70 },
    moveIds: ["gabugabu_kamitsuki", "hikkaki_ranbu", "fumifumi_press", "honki_nekokick"],
    birthday: "11月22日",
    favoriteFood: "パンの耳",
    description:
      "真面目で無口、加えて少し不思議ちゃん。パン作りが趣味ですが、よくパン耳泥棒をして怒られています。本人は全く更生する気がありません。",
  },
  kurobe: {
    id: "kurobe",
    name: "くろべ",
    displayColor: "#1f2024",
    role: "まほうアタッカー",
    tagline: "特殊攻撃が得意。ミステリアスな力で相手を翻弄する。",
    stats: { hp: 80, attack: 60, defense: 60, spAttack: 130, spDefense: 90, speed: 90 },
    moveIds: ["omeme_beam", "kuroneko_majinai", "yoru_no_shijima", "shadow_gorogoro"],
    birthday: "4月15日",
    favoriteFood: "黒ゴマプリン",
    description:
      "頭が良くてとにかく優しい博愛者。お人好しすぎて、よく変な壺などを買わされそうになります。頭の毛（？）が寝癖なのかおしゃれパーマなのかは誰も知りません。",
  },
  abe: {
    id: "abe",
    name: "あべ",
    // グレーベースの頭に黒の縦縞 (3本)
    displayColor: "#aaa9a3",
    patches: [
      // 頭頂の縦縞 (左)
      { color: "#1a1a1a", position: [-0.32, 1.95, 0.1], scale: 0.13, squash: [0.5, 1.6, 1.0] },
      // 頭頂の縦縞 (中央)
      { color: "#1a1a1a", position: [0, 2.05, 0.2], scale: 0.14, squash: [0.5, 1.8, 1.0] },
      // 頭頂の縦縞 (右)
      { color: "#1a1a1a", position: [0.32, 1.95, 0.1], scale: 0.13, squash: [0.5, 1.6, 1.0] },
    ],
    iconPattern: {
      spots: [
        { color: "#1a1a1a", cx: 22, cy: 14, rx: 1.7, ry: 10 },
        { color: "#1a1a1a", cx: 32, cy: 12, rx: 1.7, ry: 11 },
        { color: "#1a1a1a", cx: 42, cy: 14, rx: 1.7, ry: 10 },
      ],
    },
    role: "スピード",
    tagline: "素早さが非常に高く、先制攻撃が得意。耐久は薄め。",
    stats: { hp: 80, attack: 85, defense: 60, spAttack: 60, spDefense: 60, speed: 130 },
    moveIds: ["shubaba_run", "nekojarashi_honro", "kashakasha_attack", "shinkuu_tobitsuki"],
    birthday: "12月25日",
    favoriteFood: "きつねうどん",
    description:
      "常識人でしっかり者。マイペースで自由奔放な他のメンバーにツッコミを入れたり、面倒を見たりするお母さんのようなポジションです。",
  },
  oguri: {
    id: "oguri",
    name: "おぐり",
    // クリーム色ベースのトラ柄。頭にダーク・オレンジの縦縞、背中に黒豆。
    displayColor: "#ecd4a8",
    patches: [
      // 頭頂のトラ縞 (左)
      { color: "#c47a40", position: [-0.32, 1.95, 0.1], scale: 0.13, squash: [0.5, 1.6, 1.0] },
      // 頭頂のトラ縞 (中央)
      { color: "#c47a40", position: [0, 2.05, 0.2], scale: 0.14, squash: [0.5, 1.8, 1.0] },
      // 頭頂のトラ縞 (右)
      { color: "#c47a40", position: [0.32, 1.95, 0.1], scale: 0.13, squash: [0.5, 1.6, 1.0] },
      // 背中の黒豆 (左)
      { color: "#1a1a1a", position: [-0.25, 0.95, -0.55], scale: 0.13, squash: [1.0, 0.8, 0.8] },
      // 背中の黒豆 (右)
      { color: "#1a1a1a", position: [0.2, 0.75, -0.5], scale: 0.11, squash: [1.0, 0.8, 0.8] },
    ],
    iconPattern: {
      spots: [
        { color: "#c47a40", cx: 22, cy: 14, rx: 1.7, ry: 10 },
        { color: "#c47a40", cx: 32, cy: 12, rx: 1.7, ry: 11 },
        { color: "#c47a40", cx: 42, cy: 14, rx: 1.7, ry: 10 },
      ],
    },
    role: "防御",
    tagline: "打たれ強い。相手の攻撃を耐えて守るのが得意。",
    stats: { hp: 120, attack: 60, defense: 120, spAttack: 60, spDefense: 110, speed: 40 },
    moveIds: ["koubako_zuwari", "marumari_shield", "gorogoro_taiatari", "oyatsu_jikan"],
    birthday: "9月29日",
    favoriteFood: "モンブラン",
    description:
      "ブラウンのネコ。恥ずかしがり屋で気弱な性格。最年少で小柄なため、弟のように扱われて世話を焼かれがち。",
  },
  toda: {
    id: "toda",
    name: "とだ",
    displayColor: "#d6c19a",
    role: "トリッキー＆回復",
    tagline: "状態異常やトリッキーな動き、味方のサポートに長ける。",
    stats: { hp: 95, attack: 70, defense: 85, spAttack: 100, spDefense: 95, speed: 75 },
    moveIds: ["fushigi_kezukuroi", "matatabi_mist", "akubi_rensa", "bikkuribako_jump"],
    birthday: "8月5日",
    favoriteFood: "クリームソーダ",
    description:
      "明るさだけが取り柄のバカ正直者。声が大きくてどんちゃん騒ぎが大好きです。アクティブな性格で、趣味は登山とロッククライミング。",
  },
};

export const MONSTER_IDS: MonsterId[] = Object.keys(MONSTERS) as MonsterId[];

export function getMonsterDef(id: MonsterId): MonsterDefinition {
  return MONSTERS[id];
}

/** 定義から戦闘用の初期 state を生成 */
export function createMonsterState(id: MonsterId): MonsterState {
  const def = getMonsterDef(id);
  const ppLeft: Record<string, number> = {};
  for (const mid of def.moveIds) ppLeft[mid] = getMove(mid).pp;
  return {
    defId: id,
    currentHp: def.stats.hp,
    ppLeft,
    fainted: false,
    stages: emptyStages(),
    statBonus: emptyStages(),
    status: null,
    statusTurns: 0,
  };
}
