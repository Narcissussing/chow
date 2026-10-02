import { useCallback, useLayoutEffect, useRef } from "react";

// Technique FLIP (animerEchange) : mesurer avant, laisser React réordonner, puis glisser depuis l'ancienne place.
export function useFlip(elements, dependance) {
  const positionsAvant = useRef(null);

  const capturer = useCallback(
    (ids) => {
      positionsAvant.current = ids.map((id) => [id, elements.current[id]?.getBoundingClientRect()]);
    },
    [elements]
  );

  useLayoutEffect(() => {
    const avant = positionsAvant.current;
    positionsAvant.current = null;
    if (!avant) return;
    avant.forEach(([id, rect]) => {
      const el = elements.current[id];
      if (!el || !rect) return;
      const deltaY = rect.top - el.getBoundingClientRect().top;
      if (!deltaY) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
        el.style.transform = "";
      });
      el.addEventListener("transitionend", function nettoyer() {
        el.style.transition = "";
        el.removeEventListener("transitionend", nettoyer);
      });
    });
  }, [dependance, elements]);

  return capturer;
}
