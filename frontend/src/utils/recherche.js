import { normaliserTexte } from "./texte.js";

// Recherche commune (Courses, Stock, Calories) : chaque mot tapé doit se retrouver dans le nom, dans n'importe quel
// ordre, une faute de frappe tolérée sur les mots de 4 lettres et plus. Les noms qui commencent par le texte passent
// d'abord, puis ce que le foyer utilise le plus (popularite : tickets, Courses, Stock, repas), puis l'ordre alphabétique.

const preparer = (texte) => normaliserTexte(String(texte ?? "").toLowerCase()).trim();
const motsDe = (texte) => texte.split(/[^a-z0-9]+/).filter(Boolean);

// Une seule lettre de différence (ajoutée, retirée ou changée) entre deux mots.
function uneFaute(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let fautes = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++fautes > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return fautes + (a.length - i) + (b.length - j) <= 1;
}

// Le mot tapé est le début d'un mot du nom, à une faute près (« morcaux » → « morceaux »).
const debutAUneFaute = (mot, motsNom) =>
  mot.length >= 4 && motsNom.some((m) => [mot.length - 1, mot.length, mot.length + 1].some((n) => n > 0 && uneFaute(mot, m.slice(0, n))));

// Rang d'un nom pour le texte tapé : 0 commence par le texte, 1 chaque mot commence un mot du nom, 2 chaque mot est
// dans le nom, 3 avec une faute ; null sinon.
export function rangRecherche(nom, texte) {
  const recherche = preparer(texte);
  if (!recherche) return 0;
  const nomPrepare = preparer(nom);
  if (nomPrepare.startsWith(recherche)) return 0;
  const mots = motsDe(recherche);
  if (!mots.length) return nomPrepare.includes(recherche) ? 2 : null;
  const motsNom = motsDe(nomPrepare);
  if (mots.every((m) => motsNom.some((n) => n.startsWith(m)))) return 1;
  if (mots.every((m) => nomPrepare.includes(m))) return 2;
  if (mots.every((m) => nomPrepare.includes(m) || debutAUneFaute(m, motsNom))) return 3;
  return null;
}

export const correspondRecherche = (nom, texte) => rangRecherche(nom, texte) !== null;

// Liste classée : les éléments trouvés d'abord (au plus `limite`, visible: true), puis les autres (visible: false),
// pour que les listes gardent tous leurs éléments et n'affichent que les trouvés.
export function classerRecherche(elements, texte, { limite = Infinity } = {}) {
  const classes = elements.map((element, ordre) => ({ element, ordre, rang: rangRecherche(element.nom, texte) }));
  const trouves = classes
    .filter((c) => c.rang !== null)
    .sort(
      (a, b) =>
        a.rang - b.rang ||
        (Number(b.element.popularite) || 0) - (Number(a.element.popularite) || 0) ||
        String(a.element.nom).localeCompare(String(b.element.nom), "fr") ||
        a.ordre - b.ordre
    );
  const visibles = new Set(trouves.slice(0, limite).map((c) => c.element));
  return [...trouves.map((c) => c.element), ...classes.filter((c) => c.rang === null).map((c) => c.element)].map((element) => ({
    ...element,
    visible: visibles.has(element),
  }));
}
