/**
 * Smoke test: BattleEngine.resolveRound が確実に動くか。
 * 「両者が技を選んだ瞬間に 100% 何も起きない」というバグ調査用。
 */
import { BattleEngine } from "../lib/battle/BattleEngine";
import { MONSTERS } from "../lib/monsters/definitions";

const ids = Object.keys(MONSTERS) as (keyof typeof MONSTERS)[];
console.log("Monsters:", ids);

// そのだ vs みむら、最初の技で殴り合い
const engine = new BattleEngine({
  seed: 42,
  p1: { name: "Alice", partyIds: ["sonoda" as any, "mimura" as any] },
  p2: { name: "Bob",   partyIds: ["mimura" as any, "sonoda" as any] },
});

console.log("Initial snapshot phase: ok, time=", engine.snapshot().timeOfDay);

const snap0 = engine.snapshot();
const moveP1 = snap0.players.p1.party[0];
const moveP2 = snap0.players.p2.party[0];
const firstMoveOfP1 = Object.keys(moveP1.ppLeft)[0];
const firstMoveOfP2 = Object.keys(moveP2.ppLeft)[0];
console.log("P1 will use:", firstMoveOfP1, "  P2 will use:", firstMoveOfP2);

try {
  const result = engine.resolveRound(
    { type: "move", moveId: firstMoveOfP1 },
    { type: "move", moveId: firstMoveOfP2 },
  );
  console.log("✓ resolveRound succeeded");
  console.log("  actions:", result.actions.length);
  for (const a of result.actions) {
    console.log(`  - ${a.actor}:`, a.events.map((e) => e.kind).join(", "));
  }
  console.log("  hp after:",
    "p1=", result.snapshot.players.p1.party.map((m) => m.currentHp),
    "p2=", result.snapshot.players.p2.party.map((m) => m.currentHp),
  );
} catch (err) {
  console.error("✗ resolveRound THREW", err);
  process.exit(1);
}
