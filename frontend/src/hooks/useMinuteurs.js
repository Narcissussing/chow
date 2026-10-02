import { useCallback, useEffect, useRef } from "react";

// setTimeout suivis et annulés au démontage : une sortie animée ne touche plus une page quittée.
export function useMinuteurs() {
  const actifs = useRef(new Set());

  useEffect(() => {
    const minuteurs = actifs.current;
    return () => {
      minuteurs.forEach(clearTimeout);
      minuteurs.clear();
    };
  }, []);

  return useCallback((fonction, delai) => {
    const id = setTimeout(() => {
      actifs.current.delete(id);
      fonction();
    }, delai);
    actifs.current.add(id);
    return id;
  }, []);
}
