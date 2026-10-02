// Poids (g) d'une unité pour un aliment : "g" vaut 1, le reste vient de ses équivalences propres.
export function grammesParUnite({ gCafe, gSoupe, poidsPiece }, unite) {
  if (unite === "cafe") return Number(gCafe);
  if (unite === "soupe") return Number(gSoupe);
  if (unite === "piece") return Number(poidsPiece);
  return 1;
}

// Sélecteur toujours présent (au moins "g") : chaque ligne garde la même forme.
export function optionsUnite({ gCafe, gSoupe, poidsPiece, unitePiece }) {
  const options = [{ value: "g", label: "g" }];
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
export function poidsPieceDe(trackingType, poidsUniteG) {
  return trackingType === "unite" ? parseFloat(poidsUniteG) || 0 : 0;
}
