// Petit canal sans React : api.js doit pouvoir afficher un toast hors de tout composant.
const abonnes = new Set();

export function afficherToast(message) {
  abonnes.forEach((ecouter) => ecouter(message));
}

export function effacerToast() {
  abonnes.forEach((ecouter) => ecouter(null));
}

export function abonnerToast(ecouter) {
  abonnes.add(ecouter);
  return () => abonnes.delete(ecouter);
}
