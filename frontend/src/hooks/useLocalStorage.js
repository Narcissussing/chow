import { useCallback, useState } from "react";

// Mêmes clés et valeurs texte que les scripts EJS ; stockage indisponible = valeur par défaut.
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
        // Quota dépassé ou stockage bloqué : la préférence ne survivra pas au rechargement.
      }
    },
    [cle]
  );

  return [valeur, enregistrer];
}
