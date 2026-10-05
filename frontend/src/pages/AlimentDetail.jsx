import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Page from "../components/Page.jsx";
import { api } from "../api.js";
import { useChangeNatif } from "../hooks/useChangeNatif.js";
import { useMinuteurs } from "../hooks/useMinuteurs.js";
import { usePageData } from "../hooks/usePageData.js";

function Equivalences({ aliment }) {
  const champCafe = useRef(null);
  const champSoupe = useRef(null);
  const minuteur = useRef(null);
  const planifier = useMinuteurs();
  const [statutVisible, setStatutVisible] = useState(false);

  async function enregistrer() {
    let reponse;
    try {
      reponse = await api(`/aliments/${encodeURIComponent(aliment.id)}/equivalences`, {
        method: "POST",
        body: { grammesCafe: champCafe.current.value, grammesSoupe: champSoupe.current.value },
      });
    } catch {
      return;
    }
    if (reponse.donnees?.erreur) {
      alert(reponse.donnees.erreur);
      return;
    }
    setStatutVisible(true);
    clearTimeout(minuteur.current);
    minuteur.current = planifier(() => setStatutVisible(false), 2000);
  }

  useChangeNatif(champCafe, enregistrer);
  useChangeNatif(champSoupe, enregistrer);

  return (
    <details className="detail-equivalences" data-id={aliment.id}>
      <summary className="detail-equivalences__titre">Équivalences (poids d'une cuillère)</summary>
      <p className="detail-equivalences__aide">Laisse vide tant que tu ne l'as pas pesé toi-même — sans valeur, seuls les grammes restent proposés.</p>
      <div className="detail-equivalences__champs">
        <label>
          1 c. à café =
          <input ref={champCafe} type="number" id="equivGrammesCafe" min="0" step="0.1" placeholder="g" defaultValue={aliment.grammes_par_cuil_a_cafe ?? ""} />
          g
        </label>
        <label>
          1 c. à soupe =
          <input ref={champSoupe} type="number" id="equivGrammesSoupe" min="0" step="0.1" placeholder="g" defaultValue={aliment.grammes_par_cuil_a_soupe ?? ""} />
          g
        </label>
      </div>
      <p className={"detail-equivalences__statut" + (statutVisible ? "" : " hidden")} id="equivStatut">
        <span className="icone-reussi"></span> Enregistré
      </p>
    </details>
  );
}

function Detail({ aliment }) {
  return (
    <main>
      <div className="detail-section">
        <Link to="/aliments" className="btn-retour">← Retour aux aliments</Link>

        {aliment ? (
          <div className="detail-carte">
            <div className="detail-image">
              {aliment.image ? <img src={"/" + aliment.image} alt={aliment.nom} className="detail-image__photo" /> : aliment.emoji}
            </div>

            <div className="detail-infos">
              <p className="detail-categorie">{aliment.categorie}</p>
              <h1 className="detail-nom">{aliment.nom}</h1>

              {aliment.origine && <p className="detail-origine">Origine : {aliment.origine}</p>}
              {aliment.description && <p className="detail-description">{aliment.description}</p>}

              <div className="detail-macros">
                <div className="macro-card macro-calories">
                  <span className="macro-valeur">{aliment.calories}</span>
                  <span className="macro-label">kcal</span>
                </div>
                <div className="macro-card">
                  <span className="macro-valeur">{aliment.glucides}g</span>
                  <span className="macro-label">Glucides</span>
                </div>
                <div className="macro-card">
                  <span className="macro-valeur">{aliment.proteines}g</span>
                  <span className="macro-label">Protéines</span>
                </div>
                <div className="macro-card">
                  <span className="macro-valeur">{aliment.lipides}g</span>
                  <span className="macro-label">Lipides</span>
                </div>
              </div>

              <Equivalences aliment={aliment} />
            </div>
          </div>
        ) : (
          <p className="not-found">Aliment introuvable.</p>
        )}
      </div>
    </main>
  );
}

export default function AlimentDetail() {
  const { idAliment } = useParams();
  const { etat, donnees, statut } = usePageData(`/aliments/${encodeURIComponent(idAliment)}`);
  const aliment = statut === 404 ? null : donnees?.aliment;
  const titre = etat !== "pret" ? null : aliment ? aliment.nom : "Aliment introuvable";
  return (
    <Page titre={titre} etat={etat}>
      {donnees && <Detail aliment={aliment} />}
    </Page>
  );
}
