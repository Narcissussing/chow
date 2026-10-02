import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BoutonEffacer from "../components/BoutonEffacer.jsx";
import CustomSelect from "../components/CustomSelect.jsx";
import Page from "../components/Page.jsx";
import { usePageData } from "../hooks/usePageData.js";
import { normaliserTexte } from "../utils/texte.js";

const OPTIONS_TRI = [
  { value: "nom-asc", label: "Nom ↗" },
  { value: "nom-desc", label: "Nom ↘" },
  { value: "calories-asc", label: "Calories ↗" },
  { value: "calories-desc", label: "Calories ↘" },
  { value: "proteines-asc", label: "Protéines ↗" },
  { value: "proteines-desc", label: "Protéines ↘" },
];

// Même tri qu'aliments.js : stable sur l'ordre affiché, nom en minuscules, nombres via Number().
function trier(aliments, critere) {
  const [cle, direction] = critere.split("-");
  return [...aliments].sort((a, b) => {
    if (cle === "nom") {
      const [na, nb] = [a.nom.toLowerCase(), b.nom.toLowerCase()];
      return direction === "asc" ? na.localeCompare(nb) : nb.localeCompare(na);
    }
    const [va, vb] = [Number(a[cle]), Number(b[cle])];
    return direction === "asc" ? va - vb : vb - va;
  });
}

function GrilleAliments({ aliments }) {
  const champ = useRef(null);
  const [categorieActive, setCategorieActive] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [critere, setCritere] = useState("nom-asc");
  const [ordre, setOrdre] = useState(() => trier(aliments, "nom-asc"));

  const categories = useMemo(() => [...new Set(aliments.map((a) => a.categorie))].sort(), [aliments]);
  const termes = normaliserTexte(recherche.toLowerCase().trim());
  const estVisible = (a) =>
    (categorieActive === "tous" || a.categorie === categorieActive) && normaliserTexte(a.nom.toLowerCase()).includes(termes);
  const visibles = ordre.filter(estVisible).length;

  return (
    <main>
      <section className="hero">
        <div className="hero__text">
          <h1>Mieux manger <span>commence ici.</span></h1>
          <p>{aliments.length} aliments, leurs calories, et zéro excuse pour dire "je savais pas".</p>
        </div>
        <div className="hero__badge">
          <span>{aliments.length}</span>
          <small>Aliments</small>
        </div>
      </section>

      <div className="filters">
        <div className="filters__inner">
          <div className="filter-buttons">
            {["tous", ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                className={"filter-btn" + (cat === categorieActive ? " active" : "")}
                data-categorie={cat}
                onClick={() => setCategorieActive(cat)}
              >
                {cat === "tous" ? "Tous" : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="grid-section">
        <div className="search-sort-wrapper">
          <div className="search-wrapper">
            <input
              ref={champ}
              type="text"
              id="searchInput"
              placeholder="Rechercher un aliment..."
              autoComplete="off"
              className={termes !== "" && visibles === 0 ? "recherche-invalide" : undefined}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <BoutonEffacer cible="searchInput" valeur={recherche} onEffacer={() => setRecherche("")} champ={champ} />
          </div>
          <div className="sort-wrapper">
            <label htmlFor="sortSelect">Trier par :</label>
            <CustomSelect
              id="sortSelect"
              value={critere}
              options={OPTIONS_TRI}
              onChange={(valeur) => {
                setCritere(valeur);
                setOrdre((o) => trier(o, valeur));
              }}
            />
          </div>
        </div>

        <div className="food-grid" id="foodGrid">
          {ordre.map((aliment) => (
            <Link key={aliment.id} to={`/aliments/${aliment.id}`} className={"food-card" + (estVisible(aliment) ? "" : " hidden")}>
              <div className="food-card__img-placeholder">{aliment.emoji}</div>
              <div className="food-card__body">
                <p className="food-card__name">{aliment.nom}</p>
                <p className="food-card__category">{aliment.categorie}</p>
              </div>
            </Link>
          ))}
        </div>

        <p className={"no-results" + (visibles > 0 ? " hidden" : "")} id="noResults">Aucun aliment ne correspond à ta recherche.</p>
      </section>
    </main>
  );
}

export default function Aliments() {
  const { etat, donnees } = usePageData("/aliments");
  return (
    <Page titre="Aliments" etat={etat}>
      {donnees && <GrilleAliments aliments={donnees.aliments} />}
    </Page>
  );
}
