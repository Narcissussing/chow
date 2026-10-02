import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const CLE = "chow-derniere-page";
const DELAI_REPRISE = 60 * 60 * 1000;
// Une seule reprise par chargement du document : un clic sur "Accueil" ensuite reste un vrai retour à l'accueil.
let repriseFaite = false;

export function reinitialiserReprisePourTests() {
  repriseFaite = false;
}

function lire() {
  try {
    return JSON.parse(localStorage.getItem(CLE));
  } catch {
    return null;
  }
}

// L'icône d'écran d'accueil iOS relance l'app sur "/" après une mise en veille : on rouvre la dernière page (moins d'1 h).
export function useReprisePage() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  // useEffect : React Router ignore un navigate() lancé avant la fin du premier rendu.
  useEffect(() => {
    if (repriseFaite) return;
    repriseFaite = true;
    const derniere = lire();
    if (pathname !== "/" || !derniere?.chemin || derniere.chemin === "/") return;
    if (Date.now() - derniere.quand > DELAI_REPRISE) return;
    navigate(derniere.chemin, { replace: true });
  }, [pathname, navigate]);

  // Après la reprise (même ordre d'effets) : sinon "/" écraserait la page à rouvrir.
  useEffect(() => {
    if (pathname === "/login") return;
    try {
      localStorage.setItem(CLE, JSON.stringify({ chemin: pathname + search, quand: Date.now() }));
    } catch {
      // Stockage indisponible (navigation privée) : pas de reprise, rien d'autre ne change.
    }
  }, [pathname, search]);
}
