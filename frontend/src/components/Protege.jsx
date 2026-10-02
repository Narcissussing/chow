import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Chargement from "./Chargement.jsx";
import ErreurPage from "./ErreurPage.jsx";

// Masque seulement l'écran : la vraie protection reste requireAuth côté Express.
export default function Protege({ children }) {
  const { etat } = useAuth();
  const { pathname, search } = useLocation();

  if (etat === "inconnu") return <Chargement />;
  if (etat === "erreur") return <ErreurPage />;
  if (etat === "deconnecte") {
    return <Navigate to={"/login?retour=" + encodeURIComponent(pathname + search)} replace />;
  }
  return children;
}
