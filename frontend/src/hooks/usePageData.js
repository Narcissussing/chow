import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

// Lecture d'une page : un AbortController par montage (sûr sous StrictMode), aucune réponse obsolète gardée.
export function usePageData(chemin) {
  const [lecture, setLecture] = useState({ etat: "chargement", donnees: null, statut: null });

  useEffect(() => {
    const controleur = new AbortController();
    setLecture({ etat: "chargement", donnees: null, statut: null });
    api(chemin, { signal: controleur.signal })
      .then(({ statut, donnees }) => {
        if (statut >= 500 || donnees === null) setLecture({ etat: "erreur", donnees: null, statut });
        else setLecture({ etat: "pret", donnees, statut });
      })
      .catch((err) => {
        // Annulation : page quittée. Session : le rechargement Q3 est déjà prévu.
        if (err.type === "annulation" || err.type === "session") return;
        setLecture({ etat: "erreur", donnees: null, statut: null });
      });
    return () => controleur.abort();
  }, [chemin]);

  const majDonnees = useCallback((maj) => {
    setLecture((l) => ({ ...l, donnees: typeof maj === "function" ? maj(l.donnees) : maj }));
  }, []);

  return { ...lecture, majDonnees };
}
