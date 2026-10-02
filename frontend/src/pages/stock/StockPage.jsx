import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import BoutonEffacer from "../../components/BoutonEffacer.jsx";
import CustomSelect from "../../components/CustomSelect.jsx";
import Page from "../../components/Page.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { useLocalStorage } from "../../hooks/useLocalStorage.js";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { usePageData } from "../../hooks/usePageData.js";
import { afficherToast } from "../../toast.js";
import { correspondFiltres, suggestionsARacheter, trierStock } from "../../utils/stock.js";
import StockSuggestions from "./StockSuggestions.jsx";
import BadgeCompteur from "../../components/BadgeCompteur.jsx";
import { normaliserTexte } from "../../utils/texte.js";
import StockItem, { boutonCoursesVisible } from "./StockItem.jsx";

const FILTRES = [
  { emplacement: "tous", texte: "Tous" },
  { emplacement: "fg", texte: "🧊 Frigo" },
  { emplacement: "fz", texte: "❄️ Congélateur" },
  { emplacement: "st", texte: "📦 Réserve" },
  { type: "cl", texte: "🫙 Niveau" },
  { type: "autre", texte: "🔢 Pièces" },
  { type: "bas", texte: "🔻 Bas" },
];

const OPTIONS_TRI = [
  { value: "alpha", label: "Nom" },
  { value: "ancien", label: "Ancien" },
  { value: "recent", label: "Récent" },
  { value: "quantite-asc", label: "Quantité ↗" },
  { value: "quantite-desc", label: "Quantité ↘" },
];

// Quantité toujours en texte, comme data-valeur-actuelle : "1" et 1 doivent se comparer égaux.
function preparer(ligne) {
  return { ...ligne, quantite: String(ligne.quantite), dejaEnCourses: ligne.deja_en_courses === true, effets: {} };
}

function Stock({ donnees }) {
  const planifier = useMinuteurs();
  const champRecherche = useRef(null);
  const champAjout = useRef(null);
  const zoneAjout = useRef(null);
  const boutonAjout = useRef(null);
  const cartes = useRef({});
  const verrousAjout = useRef(new Set());

  const [items, setItems] = useState(() => trierStock(donnees.stock.map(preparer), "alpha"));
  const [aRacheter, setARacheter] = useState(() => suggestionsARacheter(donnees.suggestions || []));
  const [emplacement, setEmplacement] = useState("tous");
  const [type, setType] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [critere, setCritere] = useState("alpha");
  const [vue, setVue] = useLocalStorage("vueStock", (v) => (v === "liste" ? "liste" : "grille"));
  const [ajout, setAjout] = useState({ ouvert: false, texte: "", entreeAjout: false, entreeRecherche: false });
  // Éditions en cours par id ; "ouvertId" = la seule carte ouverte (itemOuvertActuellement).
  const [editions, setEditions] = useState({});
  const [ouvertId, setOuvertId] = useState(null);
  const [aAmenerEnVue, setAAmenerEnVue] = useState(null);

  const termes = normaliserTexte(recherche.toLowerCase().trim());
  const filtres = { emplacement, type, termes };
  const visibles = items.filter((i) => correspondFiltres(i, filtres)).length;
  // Filtre ou recherche en cours : le compteur montre ce qui est affiché, en ambre.
  const filtreActif = emplacement !== "tous" || type !== "tous" || termes !== "";

  function majItem(id, maj) {
    setItems((liste) => liste.map((i) => (i.id === id ? maj(i) : i)));
  }
  function majEffets(id, effets) {
    majItem(id, (i) => ({ ...i, effets: { ...i.effets, ...effets } }));
  }

  // Défilement + halo après le rendu, quand la carte existe réellement dans la page.
  useEffect(() => {
    if (aAmenerEnVue === null) return;
    cartes.current[aAmenerEnVue]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    majEffets(aAmenerEnVue, { miseEnAvant: true });
    const id = aAmenerEnVue;
    planifier(() => majEffets(id, { miseEnAvant: false }), 1500);
    setAAmenerEnVue(null);
  }, [aAmenerEnVue, planifier]);

  // ---------- Édition ----------

  function fermerEtSauvegarder(id, valeurForcee) {
    const item = items.find((i) => i.id === id);
    const edition = editions[id];
    if (!item || !edition) return;
    const nouvelle = valeurForcee ?? edition.valeur;
    const actuelle = item.quantite;

    if (!nouvelle || nouvelle === actuelle) {
      setEditions(({ [id]: _, ...reste }) => reste);
      majEffets(id, { fondu: true });
      return;
    }

    // Le champ reste affiché jusqu'à la réponse, comme dans stock.js.
    setEditions((e) => ({ ...e, [id]: { valeur: nouvelle, enAttente: true } }));
    api("/stock/modifier", { method: "POST", body: { idStock: String(id), nouvelleQuantite: nouvelle } })
      .then(({ donnees: reponse }) => {
        setEditions(({ [id]: _, ...reste }) => reste);
        if (reponse?.erreur) {
          alert(reponse.erreur);
          majEffets(id, { fondu: true });
          return;
        }
        majItem(id, (i) => ({ ...i, quantite: String(reponse.quantite), effets: { ...i.effets, fondu: true, majFlash: true } }));
        planifier(() => majEffets(id, { majFlash: false }), 600);
      })
      .catch(() => {
        // Échec réseau : la carte reste en édition, comme aujourd'hui (§3.2).
      });
  }

  function fermerItemOuvert() {
    if (ouvertId === null) return;
    fermerEtSauvegarder(ouvertId);
    setOuvertId(null);
  }

  function ouvrir(item) {
    setEditions((e) => ({ ...e, [item.id]: { valeur: item.quantite, enAttente: false } }));
    majEffets(item.id, { coursesVisible: boutonCoursesVisible(item), coursesSortant: false, coursesEnvoi: false });
    setOuvertId(item.id);
  }

  function surClicCarte(item, event) {
    if (event.target.closest(".form-supprimer-stock")) return;
    if (event.target.closest(".stock-quantite-edit, .stock-cl-edit, .custom-select")) return;
    if (!editions[item.id]) {
      fermerItemOuvert();
      ouvrir(item);
    } else {
      fermerEtSauvegarder(item.id);
      setOuvertId(null);
    }
  }

  // Clic hors de toute carte : referme (et sauvegarde) la carte ouverte.
  const fermerSiExterieur = useRef(null);
  fermerSiExterieur.current = (event) => {
    if (ouvertId === null) return;
    const dansUneCarte = event.composedPath().some((el) => el.classList && el.classList.contains("stock-item"));
    if (!dansUneCarte) fermerItemOuvert();
  };
  useEffect(() => {
    const ecouter = (event) => fermerSiExterieur.current(event);
    document.addEventListener("click", ecouter);
    return () => document.removeEventListener("click", ecouter);
  }, []);

  function soustraire(item, valeur) {
    fermerEtSauvegarder(item.id, String(Number(item.quantite) - valeur));
  }

  function ajouterAuxCourses(item) {
    majEffets(item.id, { coursesEnvoi: true });
    api("/courses/ajouter", { method: "POST", body: { idAliment: item.food_id } })
      .then(({ donnees: reponse }) => {
        if (reponse?.erreur) {
          alert(reponse.erreur);
          majEffets(item.id, { coursesEnvoi: false });
          return;
        }
        majItem(item.id, (i) => ({ ...i, dejaEnCourses: true, effets: { ...i.effets, coursesSortant: true } }));
        planifier(() => majEffets(item.id, { coursesVisible: false }), 200);
      })
      .catch(() => {});
  }

  // Suggestion envoyée aux Courses : grisée tout de suite, retirée de l'encart, et la carte du Stock ne la repropose plus.
  function ajouterSuggestion(suggestion) {
    const marquer = (envoye) => setARacheter((liste) => liste.map((s) => (s.food_id === suggestion.food_id ? { ...s, envoye } : s)));
    marquer(true);
    api("/courses/ajouter", { method: "POST", body: { idAliment: suggestion.food_id } })
      .then(({ donnees: reponse }) => {
        if (reponse?.erreur) {
          alert(reponse.erreur);
          marquer(false);
          return;
        }
        setItems((liste) => liste.map((i) => (i.food_id === suggestion.food_id ? { ...i, dejaEnCourses: true } : i)));
        planifier(() => setARacheter((liste) => liste.filter((s) => s.food_id !== suggestion.food_id)), 300);
      })
      .catch(() => marquer(false));
  }

  function supprimer(item) {
    api("/stock/supprimer", { method: "POST", body: { idStock: String(item.id) } })
      .then(({ donnees: reponse }) => {
        if (reponse?.erreur) {
          alert(reponse.erreur);
          return;
        }
        majEffets(item.id, { disparait: true });
        planifier(() => setItems((liste) => liste.filter((i) => i.id !== item.id)), 300);
      })
      .catch(() => {});
  }

  // ---------- Ajout ----------

  function ouvrirAjout() {
    setAjout({ ouvert: true, texte: recherche, entreeAjout: true, entreeRecherche: false });
  }

  function fermerAjout() {
    setAjout((a) => (a.ouvert ? { ouvert: false, texte: "", entreeAjout: a.entreeAjout, entreeRecherche: true } : a));
  }

  useEffect(() => {
    if (!ajout.ouvert) return;
    champAjout.current?.focus();
    champAjout.current?.select();
  }, [ajout.ouvert]);

  useClicExterieur([zoneAjout, boutonAjout], fermerAjout, ajout.ouvert);

  const termesAjout = normaliserTexte(ajout.texte.toLowerCase());
  const suggestions = donnees.aliments.map((a) => ({ ...a, visible: normaliserTexte(`${a.emoji} ${a.nom}`.toLowerCase()).includes(termesAjout) }));
  const nbSuggestions = suggestions.filter((s) => s.visible).length;

  function mettreEnAvant(id) {
    if (emplacement !== "tous" || type !== "tous") {
      setEmplacement("tous");
      setType("tous");
    }
    setRecherche("");
    setAAmenerEnVue(id);
  }

  function choisirSuggestion(aliment) {
    fermerAjout();
    // Doublon repéré par le nom, comme trouverStockItemParNom.
    const existant = items.find((i) => i.nom.toLowerCase() === aliment.nom.toLowerCase());
    if (existant) {
      afficherToast("Déjà dans le stock.");
      mettreEnAvant(existant.id);
      return;
    }
    if (verrousAjout.current.has(aliment.id)) return;
    verrousAjout.current.add(aliment.id);

    api("/stock/ajouter", { method: "POST", body: { idAliment: aliment.id, quantiteAliment: aliment.tracking_type === "cl" ? "plein" : 1 } })
      .then(({ donnees: reponse }) => {
        if (reponse?.erreur) {
          alert(reponse.erreur);
          return;
        }
        // deja_en_courses n'est pas renvoyé par le serveur : "false" par défaut (§3.2).
        const nouvel = { ...preparer({ ...reponse.item, deja_en_courses: false }), effets: { entree: true } };
        setItems((liste) => trierStock([...liste, nouvel], critere));
        if (correspondFiltres(nouvel, filtres)) setAAmenerEnVue(nouvel.id);
      })
      .catch((err) => {
        if (err.type === "reseau") afficherToast("Connexion instable : réessaie dans un instant.");
      })
      .finally(() => verrousAjout.current.delete(aliment.id));
  }

  return (
    <main>
      <div className="page-header titre-page">
        <h1>Stock</h1>
        <BadgeCompteur
          icone="stock"
          nombre={filtreActif ? visibles : items.length}
          filtre={filtreActif}
          label={filtreActif ? `${visibles} articles dans ce filtre` : `${items.length} articles en stock`}
        />
      </div>

      <StockSuggestions suggestions={aRacheter} onAjouter={ajouterSuggestion} />

      <div className="filters">
        <div className="filters__inner">
          <div className="filter-buttons">
            {FILTRES.map((f) => {
              const actif = f.emplacement !== undefined ? type === "tous" && emplacement === f.emplacement : type === f.type;
              return (
                <button
                  key={f.texte}
                  type="button"
                  className={"filter-btn" + (f.type === "bas" ? " filter-btn--bas" : "") + (actif ? " active" : "")}
                  onClick={() => {
                    if (f.emplacement !== undefined) {
                      setEmplacement(f.emplacement);
                      setType("tous");
                    } else {
                      setType(f.type);
                      setEmplacement("tous");
                    }
                  }}
                >
                  {f.texte}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="stock-section">
        <div className={"ajout-backdrop" + (ajout.ouvert ? " ouvert" : "")} id="ajoutBackdropStock" onClick={fermerAjout}></div>

        <div className="search-ajout-row">
          <button
            ref={boutonAjout}
            type="button"
            id="btnToggleAjout"
            className={"btn-ajout-icone" + (ajout.ouvert ? " actif" : "")}
            title="Ajouter un aliment"
            onClick={() => (ajout.ouvert ? fermerAjout() : ouvrirAjout())}
          >
            Ajouter un aliment
          </button>
          <div className={"search-wrapper" + (ajout.entreeRecherche ? " entree" : "")} id="rechercheStockWrapper" hidden={ajout.ouvert}>
            <input
              ref={champRecherche}
              type="text"
              id="searchInput"
              placeholder="Rechercher dans le stock..."
              autoComplete="off"
              className={termes !== "" && visibles === 0 ? "recherche-invalide" : undefined}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <BoutonEffacer cible="searchInput" valeur={recherche} onEffacer={() => setRecherche("")} champ={champRecherche} />
          </div>
          <div id="autocomplete" ref={zoneAjout} className={ajout.entreeAjout ? "entree" : undefined} hidden={!ajout.ouvert}>
            <div className="champ-recherche-wrapper">
              <input
                ref={champAjout}
                type="text"
                id="rechercheAliment"
                placeholder="Rechercher un aliment..."
                autoComplete="off"
                className={termesAjout !== "" && nbSuggestions === 0 ? "recherche-invalide" : undefined}
                value={ajout.texte}
                onChange={(e) => setAjout((a) => ({ ...a, texte: e.target.value }))}
              />
              <BoutonEffacer cible="rechercheAliment" valeur={ajout.texte} onEffacer={() => setAjout((a) => ({ ...a, texte: "" }))} champ={champAjout} />
            </div>
            <ul id="listeAliments" hidden={termesAjout === ""}>
              {suggestions.map((s) => (
                <li key={s.id} hidden={!s.visible} onClick={() => choisirSuggestion(s)}>
                  {s.emoji} {s.nom}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="search-sort-wrapper">
          <div className="sort-wrapper">
            <label htmlFor="sortSelect">Trier par :</label>
            <CustomSelect
              id="sortSelect"
              value={critere}
              options={OPTIONS_TRI}
              onChange={(valeur) => {
                setCritere(valeur);
                setItems((liste) => trierStock(liste, valeur));
              }}
            />
          </div>

          <div className="vue-toggle">
            <button type="button" id="btnVueGrille" data-vue="grille" className={"filter-btn" + (vue !== "liste" ? " active" : "")} title="Vue grille" onClick={() => setVue("grille")}>
              ▦ Grille
            </button>
            <button type="button" id="btnVueListe" data-vue="liste" className={"filter-btn" + (vue === "liste" ? " active" : "")} title="Vue liste" onClick={() => setVue("liste")}>
              ☰ Liste
            </button>
          </div>
        </div>

        <div id="listeStock" className={vue === "liste" ? "vue-liste" : undefined}>
          {items.map((item) => (
            <StockItem
              key={item.id}
              ref={(el) => {
                if (el) cartes.current[item.id] = el;
                else delete cartes.current[item.id];
              }}
              item={item}
              visible={correspondFiltres(item, filtres)}
              edition={editions[item.id]}
              setValeurEdition={(valeur) => setEditions((e) => ({ ...e, [item.id]: { ...e[item.id], valeur } }))}
              onCarteClic={(event) => surClicCarte(item, event)}
              onSoustraire={(valeur) => soustraire(item, valeur)}
              onAjouterCourses={() => ajouterAuxCourses(item)}
              onSupprimer={() => supprimer(item)}
              onFinEntree={() => majEffets(item.id, { entree: false })}
            />
          ))}
        </div>

        <p className={"no-results" + (visibles > 0 ? " hidden" : "")} id="noResultsStock">Aucun article ne correspond à ce filtre.</p>
      </div>
    </main>
  );
}

export default function StockPage() {
  const { etat, donnees } = usePageData("/stock");
  return (
    <Page titre="Stock" etat={etat}>
      {donnees && <Stock donnees={donnees} />}
    </Page>
  );
}
