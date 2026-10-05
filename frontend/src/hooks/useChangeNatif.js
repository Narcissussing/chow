import { useEffect, useRef } from "react";

export function useChangeNatif(ref, auChangement) {
  const rappel = useRef(auChangement);
  rappel.current = auChangement;

  useEffect(() => {
    const champ = ref.current;
    if (!champ) return;
    const ecouter = (event) => rappel.current(event);
    champ.addEventListener("change", ecouter);
    return () => champ.removeEventListener("change", ecouter);
  }, [ref]);
}
