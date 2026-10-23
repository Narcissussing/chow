import { useEffect, useLayoutEffect, useRef, useState } from "react";

const mouvementReduit = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Blocs qui glissent d'une place à l'autre (technique FLIP) : à chaque rendu, chaque élément [data-flip] est mesuré ;
// s'il a bougé, il part de son ancienne position et glisse vers la nouvelle. Un bloc nouveau apparaît en fondu.
export function useBlocsAnimes(conteneur) {
  const positions = useRef(new Map());
  const premierRendu = useRef(true);
  useLayoutEffect(() => {
    const racine = conteneur.current;
    if (!racine) return;
    const vus = new Set();
    [...racine.querySelectorAll("[data-flip]")].forEach((el, rang) => {
      const cle = el.dataset.flip;
      vus.add(cle);
      const r = el.getBoundingClientRect();
      const ici = { x: r.left + window.scrollX, y: r.top + window.scrollY };
      const avant = positions.current.get(cle);
      positions.current.set(cle, ici);
      if (!el.animate || mouvementReduit()) return;
      if (!avant) {
        el.animate(
          [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
          { duration: 380, delay: premierRendu.current ? rang * 55 : 0, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
        );
        return;
      }
      const dx = avant.x - ici.x, dy = avant.y - ici.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    });
    for (const cle of positions.current.keys()) if (!vus.has(cle)) positions.current.delete(cle);
    premierRendu.current = false;
  });
}

// Nombre qui défile jusqu'à sa nouvelle valeur (≈ 500 ms).
export function useNombreAnime(valeur) {
  const [affiche, setAffiche] = useState(valeur);
  const actuel = useRef(valeur);
  actuel.current = affiche;
  useEffect(() => {
    const depart = actuel.current;
    if (typeof valeur !== "number" || typeof depart !== "number" || depart === valeur || mouvementReduit()) {
      setAffiche(valeur);
      return;
    }
    let image;
    const debut = performance.now();
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / 500);
      setAffiche(depart + (valeur - depart) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [valeur]);
  return affiche;
}

export function NombreAnime({ valeur, format }) {
  const affiche = useNombreAnime(valeur);
  return format(affiche);
}
