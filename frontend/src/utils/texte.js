export function normaliserTexte(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
