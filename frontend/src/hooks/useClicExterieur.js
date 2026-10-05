import { useEffect, useRef } from "react";

export function useClicExterieur(refs, auClic, actif = true) {
  const rappel = useRef(auClic);
  rappel.current = auClic;

  useEffect(() => {
    if (!actif) return;
    function surClic(event) {
      const dedans = refs.some((ref) => ref.current && ref.current.contains(event.target));
      if (!dedans) rappel.current(event);
    }
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, [actif, refs]);
}
