import { useCallback, useEffect, useRef, useState } from "react";

// Fermeture en deux temps : `ferme` passe à vrai (la classe « ferme » joue la sortie), puis onFermer est appelé.
export function useFermetureAnimee(onFermer, duree = 220) {
  const [ferme, setFerme] = useState(false);
  const minuteur = useRef(null);
  const rappel = useRef(onFermer);
  rappel.current = onFermer;
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const fermer = useCallback(() => {
    if (minuteur.current) return;
    const reduit = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFerme(true);
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      setFerme(false);
      rappel.current();
    }, reduit ? 0 : duree);
  }, [duree]);

  return [ferme, fermer];
}
