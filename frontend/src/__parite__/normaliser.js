import { readFileSync } from "node:fs";
import { join } from "node:path";

// Forme canonique d'un fragment HTML : ce qui compte pour le rendu (balises, classes, attributs, textes).
// Ignorés : ordre des attributs/classes, indentation, commentaires, et les data-* que le CSS ne lit pas.
const DOSSIER_CSS = join(__dirname, "../../../public/css");

// Lu dans les feuilles de style elles-mêmes : un data-* utilisé par un sélecteur ne peut plus être oublié.
export const DATA_CONSERVES = new Set(
  ["style.css", "etats.css"].flatMap((fichier) =>
    [...readFileSync(join(DOSSIER_CSS, fichier), "utf8").matchAll(/\[(data-[a-z-]+)/g)].map((m) => m[1])
  )
);

function attributs(element) {
  return [...element.attributes]
    .filter((a) => !a.name.startsWith("data-") || DATA_CONSERVES.has(a.name))
    .map((a) => {
      if (a.name === "class") return `class="${a.value.split(/\s+/).filter(Boolean).sort().join(" ")}"`;
      return `${a.name}="${a.value}"`;
    })
    // value="" sur un champ vide (ajouté par React pour un champ contrôlé) = aucune valeur.
    // style="" laissé par un ancien style inline vidé (visibility des flèches) = aucun style.
    .filter((a) => a !== 'class=""' && a !== 'value=""' && a !== 'style=""')
    .sort();
}

export function lignesCanoniques(noeud, profondeur = 0, lignes = []) {
  const retrait = "  ".repeat(profondeur);
  if (noeud.nodeType === 3) {
    const texte = noeud.textContent.replace(/\s+/g, " ").trim();
    if (texte) lignes.push(retrait + JSON.stringify(texte));
    return lignes;
  }
  if (noeud.nodeType !== 1) return lignes;
  // Les <script> des vues EJS n'existent plus dans React.
  if (noeud.tagName === "SCRIPT") return lignes;
  // Écart voulu (§2.4) : flèches ↑/↓ de l'EJS remplacées par la poignée de glisser.
  if (noeud.classList.contains("reorder-controls") || noeud.classList.contains("poignee-glisser")) return lignes;
  // Écart voulu : emojis de l'accueil remplacés par des icônes SVG.
  if (noeud.classList.contains("home-link-emoji") || noeud.classList.contains("home-link-icone")) return lignes;
  // Écart voulu : bandeaux Stock/Courses/Calories remplacés par un titre compact (Aliments reste comparé).
  if (noeud.matches(".page-header, #heroCourses, .titre-page, .page-header__description, .journal-section > h1")) return lignes;
  // Écart voulu : interrupteur « Au magasin » remplacé par le bouton icône (le magasin devient caddie).
  if (noeud.id === "toggleMagasin") return lignes;
  // Écart voulu : troisième onglet Calories (Adapter une recette).
  if (noeud.id === "ongletAdapter" || noeud.id === "panneauAdapter") return lignes;
  // Écart voulu : icône de cuisson « Ajouter à la Cuisine » dans l'en-tête d'une recette ouverte.
  if (noeud.classList.contains("btn-outil")) return lignes;
  // Écart voulu : animation de la Cuisine vide et badges de total (Stock, Calories).
  if (noeud.matches?.(".cuisine-vide, .badge-compteur")) return lignes;
  // Écart voulu : encart « À racheter » et filtre « Bas » du Stock.
  if (noeud.matches?.(".stock-suggestions, .filter-btn--bas")) return lignes;
  // Écart voulu : unités ajoutées dans les sélecteurs de quantité (gousse pour l'ail, ml / L pour les liquides).
  if (noeud.tagName === "OPTION" && noeud.value !== "g" && noeud.parentElement?.matches(".journal-unite-select, .ingredient-unite-recette")) return lignes;
  lignes.push(`${retrait}<${noeud.tagName.toLowerCase()}${attributs(noeud).map((a) => " " + a).join("")}>`);
  // Textes adjacents fusionnés : EJS et React découpent différemment "{n} aliments…".
  let tampon = "";
  const viderTampon = () => {
    const texte = tampon.replace(/\s+/g, " ").trim();
    if (texte) lignes.push("  ".repeat(profondeur + 1) + JSON.stringify(texte));
    tampon = "";
  };
  for (const enfant of noeud.childNodes) {
    if (enfant.nodeType === 3) tampon += enfant.textContent;
    else if (enfant.nodeType === 1) {
      viderTampon();
      lignesCanoniques(enfant, profondeur + 1, lignes);
    }
  }
  viderTampon();
  return lignes;
}

export function canoniser(html) {
  const modele = document.createElement("template");
  modele.innerHTML = html;
  return lignesCanoniques(modele.content.firstElementChild);
}

// Première différence avec un peu de contexte, lisible dans la sortie Jest.
export function premiereDifference(attendu, obtenu) {
  const n = Math.max(attendu.length, obtenu.length);
  for (let i = 0; i < n; i++) {
    if (attendu[i] !== obtenu[i]) {
      const debut = Math.max(0, i - 3);
      return [
        `ligne ${i + 1}`,
        "EJS   : " + attendu.slice(debut, i + 3).join("\n        "),
        "React : " + obtenu.slice(debut, i + 3).join("\n        "),
      ].join("\n");
    }
  }
  return null;
}
