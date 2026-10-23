import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Chargement from "./Chargement.jsx";
import ErreurPage from "./ErreurPage.jsx";

// admin : page des Paramètres, renvoyée vers l'accueil pour les autres comptes (le serveur refuse aussi).
export default function Protege({ admin = false, children }) {
  const { etat, utilisateur } = useAuth();
  const { pathname, search } = useLocation();

  if (etat === "inconnu") return <Chargement />;
  if (etat === "erreur") return <ErreurPage />;
  if (etat === "deconnecte") {
    return <Navigate to={"/login?retour=" + encodeURIComponent(pathname + search)} replace />;
  }
  if (admin && !utilisateur?.admin) return <Navigate to="/" replace />;
  return children;
}
