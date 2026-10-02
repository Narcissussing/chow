// Poids (g) d'une unité pour un aliment : "g" vaut 1, le reste vient de ses équivalences propres.
export function grammesParUnite({ gCafe, gSoupe, poidsPiece }, unite) {
  if (unite === "cafe") return Number(gCafe);
  if (unite === "soupe") return Number(gSoupe);
  if (unite === "piece") return Number(poidsPiece);
  // Liquides : 1 ml ≈ 1 g (eau, lait, jus ; l'huile pèse un peu moins, écart négligeable ici).
  if (unite === "l") return 1000;
  return 1;
}

// Aliment liquide : son unité enregistrée est le millilitre.
export const estLiquide = (unite) => ["ml", "l"].includes(String(unite || "").toLowerCase());

// Sélecteur toujours présent (au moins "g") : chaque ligne garde la même forme.
export function optionsUnite({ gCafe, gSoupe, poidsPiece, unitePiece, liquide }) {
  const options = [{ value: "g", label: "g" }];
  if (liquide) options.push({ value: "ml", label: "ml" }, { value: "l", label: "L" });
  if (gCafe) options.push({ value: "cafe", label: "tsp" });
  if (gSoupe) options.push({ value: "soupe", label: "tbs" });
  if (poidsPiece) options.push({ value: "piece", label: unitePiece || "pc" });
  return options;
}

// Le minimum (0.25 g) est un poids : converti dans l'unité affichée.
export function minimumPourUnite(ratio) {
  return String(Math.round((0.25 / ratio) * 10000) / 10000);
}

export function convertirAffichage(grammes, ratio) {
  return String(Math.round((grammes / ratio) * 100) / 100);
}

// "0.00" (NUMERIC en texte) est vrai en JS : seule une pièce de poids réel compte.
// Pièce = aliment suivi à l'unité, ou dont l'unité est une pièce (« gousse » pour l'ail, suivi au niveau du bocal).
// Un liquide n'est jamais une pièce : « 1 ml » ne vaut pas 100 g.
export function poidsPieceDe(trackingType, poidsUniteG, unitePiece) {
  const poids = parseFloat(poidsUniteG) || 0;
  if (estLiquide(unitePiece)) return 0;
  if (trackingType === "unite") return poids;
  return unitePiece && !["g", "gr"].includes(String(unitePiece).toLowerCase()) ? poids : 0;
}
