export function grammesParUnite({ gCafe, gSoupe, poidsPiece }, unite) {
  if (unite === "cafe") return Number(gCafe);
  if (unite === "soupe") return Number(gSoupe);
  if (unite === "piece") return Number(poidsPiece);
  if (unite === "l") return 1000;
  return 1;
}

export const estLiquide = (unite) => ["ml", "l"].includes(String(unite || "").toLowerCase());

export function optionsUnite({ gCafe, gSoupe, poidsPiece, unitePiece, liquide }) {
  const options = [{ value: "g", label: "g" }];
  if (liquide) options.push({ value: "ml", label: "ml" }, { value: "l", label: "L" });
  if (gCafe) options.push({ value: "cafe", label: "tsp" });
  if (gSoupe) options.push({ value: "soupe", label: "tbs" });
  if (poidsPiece) options.push({ value: "piece", label: unitePiece || "pc" });
  return options;
}

export function minimumPourUnite(ratio) {
  return String(Math.round((0.25 / ratio) * 10000) / 10000);
}

export function convertirAffichage(grammes, ratio) {
  return String(Math.round((grammes / ratio) * 100) / 100);
}

export function poidsPieceDe(trackingType, poidsUniteG, unitePiece) {
  const poids = parseFloat(poidsUniteG) || 0;
  if (estLiquide(unitePiece)) return 0;
  if (trackingType === "unite") return poids;
  return unitePiece && !["g", "gr"].includes(String(unitePiece).toLowerCase()) ? poids : 0;
}
