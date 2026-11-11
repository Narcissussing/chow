import { useLayoutEffect } from "react";

const ECART = 6;
const MARGE = 12;

// Partie de l'écran vraiment visible : sans le clavier du téléphone (visualViewport) ni l'en-tête collé en haut.
function zoneVisible() {
  const vv = window.visualViewport;
  const haut = vv?.offsetTop ?? 0;
  const bas = haut + (vv?.height ?? window.innerHeight);
  const entete = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  return { haut: Math.max(haut, entete), bas };
}

// Où ouvrir une liste accrochée à `rect` : dessous s'il y a la place, sinon du côté le plus grand ; hauteur réduite
// à la place disponible pour qu'elle tienne à l'écran et défile.
export function placeDansEcran(rect, hauteurVoulue) {
  const { haut, bas } = zoneVisible();
  const dessous = bas - rect.bottom - ECART - MARGE;
  const dessus = rect.top - haut - ECART - MARGE;
  const auDessus = dessous < hauteurVoulue && dessus > dessous;
  return { auDessus, hauteur: Math.max(0, Math.min(hauteurVoulue, auDessus ? dessus : dessous)) };
}

// Liste de suggestions en position absolue sous son champ (Courses, Stock, Calories) : ouverte au-dessus du champ quand
// le clavier ou le bas de l'écran la cacheraient, replacée quand le clavier bouge ou que la page défile.
export function useListeDansEcran(liste, visible, contenu) {
  useLayoutEffect(() => {
    const el = liste.current;
    if (!visible || !el) return;
    if (!el.dataset.hauteurVoulue) el.dataset.hauteurVoulue = parseFloat(getComputedStyle(el).maxHeight) || 220;
    const placer = (event) => {
      if (event?.target === el || !el.offsetParent) return;
      const besoin = Math.min(Number(el.dataset.hauteurVoulue), el.scrollHeight + 4);
      const { auDessus, hauteur } = placeDansEcran(el.offsetParent.getBoundingClientRect(), besoin);
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
