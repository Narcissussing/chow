import { useEffect, useRef } from "react";

// Événement "change" natif (à la sortie d'un champ modifié) ; onChange de React, lui, part à chaque frappe.
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
