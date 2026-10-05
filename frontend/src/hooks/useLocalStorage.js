import { useCallback, useState } from "react";

export function useLocalStorage(cle, lire) {
  const [valeur, setValeur] = useState(() => {
    try {
      return lire(localStorage.getItem(cle));
    } catch {
      return lire(null);
    }
  });

  const enregistrer = useCallback(
    (nouvelle) => {
      setValeur(nouvelle);
      try {
        localStorage.setItem(cle, String(nouvelle));
      } catch {
      }
    },
    [cle]
  );

  return [valeur, enregistrer];
}
