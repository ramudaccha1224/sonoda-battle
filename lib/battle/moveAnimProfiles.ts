import type { MoveAnimProfile } from "./animations";

/**
 * 24 わざ × 固有アニメ プロファイル。
 *
 * BattleScene の AnimatedCat / EmitEffectLayer / ImpactExtraLayer がこの値を読んで、
 * 攻撃モーション・発射エフェクト・被弾側の追加演出 を切り替える。
 *
 * 新しい技を追加するときはここに 1 行足す。
 */
export const MOVE_ANIM_PROFILES: Record<string, MoveAnimProfile> = {
  // ============ そのだ ============
  zenryoku_nekopunch: {
    attackerMotion: "punch",
    impactExtra: "shake_strong",
  },
  issho_ohirune: {
    attackerMotion: "still", // 横たわる
    emit: { kind: "z_bubble" },
  },
  shippo_aisatsu: {
    attackerMotion: "tail_swing",
  },
  okaeri_tackle: {
    attackerMotion: "high_jump_dive",
    impactExtra: "stretch_flat",
  },

  // ============ みむら ============
  gabugabu_kamitsuki: {
    attackerMotion: "lunge_bite",
    impactExtra: "puff",
  },
  hikkaki_ranbu: {
    attackerMotion: "claw_swipe",
    emit: { kind: "sparkles", color: "#ffffff" },
  },
  fumifumi_press: {
    attackerMotion: "knead",
    impactExtra: "stretch_flat",
  },
  honki_nekokick: {
    attackerMotion: "back_kick",
    impactExtra: "shake_strong",
  },

  // ============ くろべ ============
  omeme_beam: {
    attackerMotion: "eye_glow",
    emit: { kind: "beam", color: "#9bb6ff" },
  },
  kuroneko_majinai: {
    attackerMotion: "spin_dance",
    emit: { kind: "cloud", color: "#a855f7" },
  },
  yoru_no_shijima: {
    attackerMotion: "still", // 静かに息を吐く
    emit: { kind: "ring_pulse", color: "#1f1d4a" },
  },
  shadow_gorogoro: {
    attackerMotion: "shadow_blink",
    emit: { kind: "projectile_sphere", color: "#15151c" },
    impactExtra: "shake_strong",
  },

  // ============ あべ ============
  shubaba_run: {
    attackerMotion: "dash_zigzag",
    impactExtra: "puff",
  },
  nekojarashi_honro: {
    attackerMotion: "spin_dance",
    emit: { kind: "cloud", color: "#7fcf5c" },
    impactExtra: "dizzy_stars",
  },
  kashakasha_attack: {
    attackerMotion: "claw_swipe",
    impactExtra: "puff",
  },
  shinkuu_tobitsuki: {
    attackerMotion: "high_jump_dive",
    impactExtra: "shake_strong",
  },

  // ============ おぐり ============
  koubako_zuwari: {
    attackerMotion: "loaf",
    emit: { kind: "sparkles", color: "#ffd966" },
  },
  marumari_shield: {
    attackerMotion: "ball_curl",
    emit: { kind: "ring_pulse", color: "#ffd966" },
  },
  gorogoro_taiatari: {
    attackerMotion: "roll_forward",
    impactExtra: "stretch_flat",
  },
  oyatsu_jikan: {
    attackerMotion: "snack_eat",
    emit: { kind: "snack_icon" },
  },

  // ============ とだ ============
  fushigi_kezukuroi: {
    attackerMotion: "grooming",
    emit: { kind: "sparkles", color: "#ffd966" },
  },
  matatabi_mist: {
    attackerMotion: "blow_breath",
    emit: { kind: "cloud", color: "#7fcf5c" },
    impactExtra: "dizzy_stars",
  },
  akubi_rensa: {
    attackerMotion: "big_yawn",
    emit: { kind: "z_bubble" },
  },
  bikkuribako_jump: {
    attackerMotion: "spring_pop",
    emit: { kind: "sparkles", color: "#ff8ad8" },
    impactExtra: "puff",
  },
};

export function getMoveAnimProfile(moveId: string): MoveAnimProfile {
  return MOVE_ANIM_PROFILES[moveId] ?? { attackerMotion: "still" };
}
