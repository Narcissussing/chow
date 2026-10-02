// Retire les accents (NFD + diacritiques) pour que "e" trouve aussi "Café".
export function normaliserTexte(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
