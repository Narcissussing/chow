import { grammesParUnite, optionsUnite, poidsPieceDe } from "./unites.js";

test("pièce : aliment compté à l'unité, ou dont l'unité est une pièce (ail en gousses, suivi au bocal)", () => {
  expect(poidsPieceDe("unite", "55.00", "pcs")).toBe(55);
  expect(poidsPieceDe("cl", "4.00", "gousse")).toBe(4);
  expect(poidsPieceDe("cl", "100.00", "g")).toBe(0);
  expect(poidsPieceDe("pack", "100.00", "g")).toBe(0);
  expect(poidsPieceDe("unite", "0.00", "g")).toBe(0);
  expect(optionsUnite({ gCafe: "", gSoupe: "", poidsPiece: poidsPieceDe("cl", "4.00", "gousse"), unitePiece: "gousse" }).map((o) => o.label)).toEqual(["g", "gousse"]);
});

test("liquides (unité ml) : ml et L proposés, jamais une pièce ; 1 L = 1000 g", () => {
  expect(poidsPieceDe("unite", "100.00", "ml")).toBe(0);
  const eau = { gCafe: "", gSoupe: "", poidsPiece: 0, unitePiece: "ml", liquide: true };
  expect(optionsUnite(eau).map((o) => o.label)).toEqual(["g", "ml", "L"]);
  expect(grammesParUnite(eau, "l")).toBe(1000);
  expect(grammesParUnite(eau, "ml")).toBe(1);
});
