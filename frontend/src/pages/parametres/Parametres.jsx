import { Link } from "react-router-dom";
import Page from "../../components/Page.jsx";
import { usePageData } from "../../hooks/usePageData.js";
import "./Parametres.css";

export default function Parametres() {
  const { etat, donnees } = usePageData("/aliments");
  return (
    <Page titre="Paramètres" etat={etat}>
      <main className="parametres">
        <h1>
          Paramètres <span className="parametres__admin">Admin</span>
        </h1>
        <nav className="parametres__liste">
          <Link to="/parametres/aliments" className="parametres__ligne">
            <span className="parametres__tuile" aria-hidden="true">🍎</span>
            <span className="parametres__titre">Aliments</span>
            <span className="parametres__compteur">{donnees?.aliments.length}</span>
            <span className="parametres__chevron" aria-hidden="true">›</span>
          </Link>
        </nav>
        <p className="parametres__note">Visible seulement par l’administrateur.</p>
      </main>
    </Page>
  );
}
