import { useCallback, useEffect, useRef } from "react";

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
