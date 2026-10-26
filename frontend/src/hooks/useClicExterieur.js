import { useEffect, useRef } from "react";

export function useClicExterieur(refs, auClic, actif = true) {
  const rappel = useRef(auClic);
  rappel.current = auClic;

  useEffect(() => {
    if (!actif) return;
    // Le clic qui vient d'ouvrir l'élément peut encore remonter jusqu'au document : on l'ignore.
    const depuis = performance.now();
    function surClic(event) {
      if (event.timeStamp && event.timeStamp < depuis) return;
      // Élément retiré par ce même clic (ex. un menu qui se ferme) : ce n'est pas un clic à l'extérieur.
      if (!event.target.isConnected) return;
      const dedans = refs.some((ref) => ref.current && ref.current.contains(event.target));
      if (!dedans) rappel.current(event);
    }
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, [actif, refs]);
}
