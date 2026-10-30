import { useLayoutEffect, useRef } from "react";

const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Cartes qui glissent vers leur nouvelle place (technique FLIP) quand `declencheur` change : tri, filtre, vue.
// Les positions sont relevées à chaque rendu ; une carte qui réapparaît arrive en fondu, celle qu'un filtre retire
// laisse un double qui s'efface à son ancienne place.
export function useCartesQuiGlissent(cartes, declencheur) {
  const positions = useRef(new Map());
  const dernier = useRef(declencheur);
  useLayoutEffect(() => {
    const animer = dernier.current !== declencheur && !mouvementReduit();
    dernier.current = declencheur;
    let rang = 0;
    for (const [id, el] of Object.entries(cartes.current)) {
      if (!el || el.classList.contains("hidden")) {
        const partie = positions.current.get(id);
        positions.current.delete(id);
        if (animer && el && partie) effacerDouble(el, partie);
        continue;
      }
      const r = el.getBoundingClientRect();
      const ici = { x: r.left + window.scrollX, y: r.top + window.scrollY, largeur: r.width, hauteur: r.height };
      const avant = positions.current.get(id);
      positions.current.set(id, ici);
      if (!animer || !el.animate) continue;
      if (!avant) {
        el.animate([{ opacity: 0, transform: "scale(0.9)" }, { opacity: 1, transform: "none" }], {
          duration: 320, delay: Math.min(rang++, 12) * 25, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards",
        });
        continue;
      }
      const dx = avant.x - ici.x, dy = avant.y - ici.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    }
  });
}

function effacerDouble(el, position) {
  const double = el.cloneNode(true);
  double.classList.remove("hidden");
  Object.assign(double.style, {
    position: "absolute", left: position.x + "px", top: position.y + "px", width: position.largeur + "px",
    height: position.hauteur + "px", margin: "0", pointerEvents: "none", zIndex: "5",
  });
  double.setAttribute("aria-hidden", "true");
  document.body.appendChild(double);
  if (!double.animate) return double.remove();
  double.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.85)" }], { duration: 260, easing: "ease-in", fill: "forwards" })
    .finished.then(() => double.remove(), () => double.remove());
}
