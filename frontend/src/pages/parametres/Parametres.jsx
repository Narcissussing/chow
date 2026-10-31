import { useState } from "react";
import { Link } from "react-router-dom";
import Page from "../../components/Page.jsx";
import { usePageData } from "../../hooks/usePageData.js";
import FeuilleJetes from "./FeuilleJetes.jsx";
import "./Parametres.css";

export default function Parametres() {
  const { etat, donnees } = usePageData("/aliments");
  const [jetesOuverts, setJetesOuverts] = useState(false);
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
          <button type="button" className="parametres__ligne" onClick={() => setJetesOuverts(true)}>
            <span className="parametres__tuile" aria-hidden="true">🍅</span>
            <span className="parametres__titre">Aliments jetés</span>
            <span className="parametres__chevron" aria-hidden="true">›</span>
          </button>
        </nav>
        {jetesOuverts && <FeuilleJetes onFermer={() => setJetesOuverts(false)} />}
        <p className="parametres__note">Visible seulement par l’administrateur.</p>
      </main>
    </Page>
  );
}
