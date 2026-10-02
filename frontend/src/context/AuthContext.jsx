import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

// "inconnu" tant que /api/session n'a pas répondu ; "erreur" si le serveur est injoignable.
export function AuthProvider({ children }) {
  const [etat, setEtat] = useState("inconnu");

  useEffect(() => {
    const controleur = new AbortController();
    api("/session", { signal: controleur.signal, ignorer401: true })
      // Seul 401 veut dire "pas connecté" ; un 502 (Express arrêté derrière Vite) est une panne.
      .then(({ statut }) => setEtat(statut === 200 ? "connecte" : statut === 401 ? "deconnecte" : "erreur"))
      .catch((err) => {
        if (err.type !== "annulation") setEtat("erreur");
      });
    return () => controleur.abort();
  }, []);

  const connecter = useCallback(async (email, password) => {
    const { statut } = await api("/login", { method: "POST", body: { email, password }, ignorer401: true });
    if (statut === 200) setEtat("connecte");
    return statut;
  }, []);

  return <AuthContext.Provider value={{ etat, connecter }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
