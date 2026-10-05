import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const CLE = "chow-derniere-page";
const DELAI_REPRISE = 60 * 60 * 1000;
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

export function useReprisePage() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (repriseFaite) return;
    repriseFaite = true;
    const derniere = lire();
    if (pathname !== "/" || !derniere?.chemin || derniere.chemin === "/") return;
    if (Date.now() - derniere.quand > DELAI_REPRISE) return;
    navigate(derniere.chemin, { replace: true });
  }, [pathname, navigate]);

  useEffect(() => {
    if (pathname === "/login") return;
    try {
      localStorage.setItem(CLE, JSON.stringify({ chemin: pathname + search, quand: Date.now() }));
    } catch {
    }
  }, [pathname, search]);
}
