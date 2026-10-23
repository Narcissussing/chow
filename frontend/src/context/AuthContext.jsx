import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [etat, setEtat] = useState("inconnu");
  const [utilisateur, setUtilisateur] = useState(null);

  useEffect(() => {
    const controleur = new AbortController();
    api("/session", { signal: controleur.signal, ignorer401: true })
      .then(({ statut, donnees }) => {
        setUtilisateur(donnees?.utilisateur ?? null);
        setEtat(statut === 200 ? "connecte" : statut === 401 ? "deconnecte" : "erreur");
      })
      .catch((err) => {
        if (err.type !== "annulation") setEtat("erreur");
      });
    return () => controleur.abort();
  }, []);

  const connecter = useCallback(async (email, password) => {
    const { statut, donnees } = await api("/login", { method: "POST", body: { email, password }, ignorer401: true });
    if (statut === 200) {
      setUtilisateur(donnees?.utilisateur ?? null);
      setEtat("connecte");
    }
    return statut;
  }, []);

  return <AuthContext.Provider value={{ etat, utilisateur, connecter }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
