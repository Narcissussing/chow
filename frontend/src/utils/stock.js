import { normaliserTexte } from "./texte.js";

// Niveaux d'un aliment suivi en "cl" : valeur stockée en base, texte affiché.
export const OPTIONS_CL = [
  { value: "plein", label: "Plein" },
  { value: "à moitié", label: "À moitié" },
  { value: "presque vide", label: "Presque vide" },
  { value: "vide", label: "Vide" },
];

const RANG_NIVEAU_CL = { vide: 0, "presque vide": 1, "à moitié": 2, plein: 3 };

export function classeNiveauCL(valeur) {
  if (valeur === "plein") return "niveau-plein";
  if (valeur === "à moitié") return "niveau-moitie";
  if (valeur === "presque vide") return "niveau-presque-vide";
  return "niveau-vide";
}

// "Bas" : les 2 niveaux les plus bas pour "cl", moins de 2 restants sinon.
export function estQuantiteBasse(valeur, trackingType) {
  if (trackingType === "cl") return valeur === "presque vide" || valeur === "vide";
  return Number(valeur) < 2;
}

export function texteEmplacement(emplacement) {
  return emplacement === "fg" ? "Frigo" : emplacement === "fz" ? "Congélateur" : "Réserve";
}

export function texteJours(jours) {
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "il y a 1 jour";
  return `il y a ${jours} jours`;
}

function valeurQuantitePourTri(item) {
  if (item.tracking_type === "cl") return RANG_NIVEAU_CL[item.quantite] ?? 0;
  return Number(item.quantite) || 0;
}

// Même tri que trierStock (stock.js) : stable sur l'ordre courant, nom en minuscules.
export function trierStock(items, critere) {
  return [...items].sort((a, b) => {
    const nomA = a.nom.toLowerCase();
    const nomB = b.nom.toLowerCase();
    if (critere === "alpha") return nomA.localeCompare(nomB);
    if (critere === "quantite-asc" || critere === "quantite-desc") {
      const qa = valeurQuantitePourTri(a);
      const qb = valeurQuantitePourTri(b);
      if (qa !== qb) return critere === "quantite-asc" ? qa - qb : qb - qa;
      return nomA.localeCompare(nomB);
    }
    const ja = Number(a.jours_depuis);
    const jb = Number(b.jours_depuis);
    return critere === "ancien" ? jb - ja : ja - jb;
  });
}

// Filtre unique emplacement OU type (un seul bouton actif), plus la recherche sans accents.
export function correspondFiltres(item, { emplacement, type, termes }) {
  const okEmplacement = emplacement === "tous" || item.emplacement === emplacement;
  const okType = type === "tous" || (type === "cl" ? item.tracking_type === "cl" : item.tracking_type !== "cl");
  return okEmplacement && okType && normaliserTexte(item.nom.toLowerCase()).includes(termes);
}
