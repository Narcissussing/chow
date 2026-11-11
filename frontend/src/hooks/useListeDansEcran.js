import { useLayoutEffect, useRef } from "react";

const ECART = 6;
const MARGE = 12;
// Hauteur d'environ 3 lignes : en dessous, la liste est trop écrasée pour servir.
const HAUTEUR_UTILE = 120;
// Barres qui restent collées en haut de l'écran et cacheraient la liste.
const BARRES_COLLEES = ".header, .courses-controls-row, .filters, .journal-totaux";

// Partie de l'écran vraiment visible : sans le clavier du téléphone (visualViewport) ni les barres collées en haut
// (sauf celle qui contient le champ lui-même).
function zoneVisible(ancre) {
  const vv = window.visualViewport;
  const hautEcran = vv?.offsetTop ?? 0;
  const bas = hautEcran + (vv?.height ?? window.innerHeight);
  let haut = hautEcran;
  for (const barre of document.querySelectorAll(BARRES_COLLEES)) {
    if (ancre && barre.contains(ancre)) continue;
    const position = getComputedStyle(barre).position;
    if (position !== "sticky" && position !== "fixed") continue;
    const r = barre.getBoundingClientRect();
    if (r.height && r.top <= haut + 2 && r.bottom > haut) haut = r.bottom;
  }
  return { haut, bas };
}

// Où ouvrir une liste accrochée à `rect` : dessous s'il y a la place, sinon du côté le plus grand ; hauteur réduite
// à la place disponible pour qu'elle tienne à l'écran et défile.
export function placeDansEcran(rect, hauteurVoulue, ancre = null) {
  const { haut, bas } = zoneVisible(ancre);
  const dessous = bas - rect.bottom - ECART - MARGE;
  const dessus = rect.top - haut - ECART - MARGE;
  const auDessus = dessous < hauteurVoulue && dessus > dessous;
  return { auDessus, hauteur: Math.max(0, Math.min(hauteurVoulue, auDessus ? dessus : dessous)), haut };
}

const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Liste de suggestions en position absolue sous son champ (Courses, Stock, Calories) : ouverte au-dessus du champ quand
// le clavier ou le bas de l'écran la cacheraient, replacée quand le clavier bouge ou que la page défile. Si aucun côté
// n'a la place de 3 lignes, la page remonte une fois pour coller le champ sous les barres du haut, et la liste s'ouvre
// dessous, jusqu'au clavier.
export function useListeDansEcran(liste, visible, contenu) {
  // Remontée et marge sous la page : une fois par ouverture, rendues quand la liste se ferme (pas à chaque lettre).
  const ouverture = useRef({ remontee: false, margeAvant: null });
  useLayoutEffect(() => {
    if (!visible) return;
    const etat = ouverture.current;
    return () => {
      if (etat.margeAvant !== null) document.body.style.paddingBottom = etat.margeAvant;
      ouverture.current = { remontee: false, margeAvant: null };
    };
  }, [visible]);

  useLayoutEffect(() => {
    const el = liste.current;
    if (!visible || !el) return;
    if (!el.dataset.hauteurVoulue) el.dataset.hauteurVoulue = parseFloat(getComputedStyle(el).maxHeight) || 220;
    const etat = ouverture.current;
    const placer = (event) => {
      if (event?.target === el || !el.offsetParent) return;
      const ancre = el.offsetParent;
      const rect = ancre.getBoundingClientRect();
      const besoin = Math.min(Number(el.dataset.hauteurVoulue), el.scrollHeight + 4);
      const { auDessus, hauteur, haut } = placeDansEcran(rect, besoin, ancre);
      if (!etat.remontee && hauteur < Math.min(besoin, HAUTEUR_UTILE) && rect.top - haut > MARGE) {
        etat.remontee = true;
        // De la place sous la page pour pouvoir remonter le champ même en bas de liste.
        etat.margeAvant = document.body.style.paddingBottom;
        document.body.style.paddingBottom = `${window.innerHeight}px`;
        window.scrollBy({ top: rect.top - haut - ECART, behavior: mouvementReduit() ? "auto" : "smooth" });
      }
      el.style.maxHeight = `${hauteur}px`;
      el.style.top = auDessus ? "auto" : "";
      el.style.bottom = auDessus ? `calc(100% + ${ECART}px)` : "";
      el.classList.toggle("liste-au-dessus", auDessus);
    };
    placer();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", placer);
    vv?.addEventListener("scroll", placer);
    window.addEventListener("resize", placer);
    window.addEventListener("scroll", placer, true);
    return () => {
      vv?.removeEventListener("resize", placer);
      vv?.removeEventListener("scroll", placer);
      window.removeEventListener("resize", placer);
      window.removeEventListener("scroll", placer, true);
    };
  }, [liste, visible, contenu]);
}
