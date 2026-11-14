import { useLayoutEffect, useRef } from "react";

const ECART = 6;
const MARGE = 12;
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

// Liste de suggestions en position absolue sous son champ (Courses, Stock, Calories) : toujours dessous, collée au champ.
// Quand le clavier ou le bas de l'écran la couperaient, la page remonte juste assez (jamais au point de cacher le champ
// sous les barres du haut) ; ce qui manque encore se gagne en faisant défiler la liste.
export function useListeDansEcran(liste, visible, contenu) {
  // Marge sous la page posée à l'ouverture, rendue quand la liste se ferme.
  const ouverture = useRef({ margeAvant: null });
  useLayoutEffect(() => {
    if (!visible) return;
    const etat = ouverture.current;
    return () => {
      if (etat.margeAvant !== null) document.body.style.paddingBottom = etat.margeAvant;
      ouverture.current = { margeAvant: null };
    };
  }, [visible]);

  useLayoutEffect(() => {
    const el = liste.current;
    if (!visible || !el) return;
    if (!el.dataset.hauteurVoulue) el.dataset.hauteurVoulue = parseFloat(getComputedStyle(el).maxHeight) || 220;
    const etat = ouverture.current;
    let doigtSurListe = false;
    const placer = (event) => {
      // Clavier ouvert, l'iPhone déplace l'écran pendant le glissé : redimensionner la liste à ce moment-là arrête
      // son défilement. Elle est replacée quand le doigt se lève.
      if (doigtSurListe || event?.target === el || !el.offsetParent) return;
      const ancre = el.offsetParent;
      const rect = ancre.getBoundingClientRect();
      const besoin = Math.min(Number(el.dataset.hauteurVoulue), el.scrollHeight + 4);
      const { haut, bas } = zoneVisible(ancre);
      const dessous = bas - rect.bottom - ECART - MARGE;
      // Pas de remontée pendant un défilement : elle relancerait le défilement en boucle.
      const manque = Math.min(besoin - dessous, rect.top - haut - ECART);
      if (event?.type !== "scroll" && manque > 2) {
        if (etat.margeAvant === null) {
          // De la place sous la page pour pouvoir remonter le champ même en bas de liste.
          etat.margeAvant = document.body.style.paddingBottom;
          document.body.style.paddingBottom = `${window.innerHeight}px`;
        }
        window.scrollBy({ top: manque, behavior: mouvementReduit() ? "auto" : "smooth" });
      }
      const hauteur = `${Math.max(0, Math.round(Math.min(besoin, dessous)))}px`;
      if (el.style.maxHeight !== hauteur) el.style.maxHeight = hauteur;
    };
    const poser = () => { doigtSurListe = true; };
    const lever = () => { doigtSurListe = false; placer(); };
    placer();
    el.addEventListener("touchstart", poser, { passive: true });
    el.addEventListener("touchend", lever);
    el.addEventListener("touchcancel", lever);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", placer);
    vv?.addEventListener("scroll", placer);
    window.addEventListener("resize", placer);
    window.addEventListener("scroll", placer, true);
    return () => {
      el.removeEventListener("touchstart", poser);
      el.removeEventListener("touchend", lever);
      el.removeEventListener("touchcancel", lever);
      vv?.removeEventListener("resize", placer);
      vv?.removeEventListener("scroll", placer);
      window.removeEventListener("resize", placer);
      window.removeEventListener("scroll", placer, true);
    };
  }, [liste, visible, contenu]);
}
