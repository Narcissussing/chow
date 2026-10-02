import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { arrayMove } from "@dnd-kit/sortable";
import BoutonEffacer from "../../components/BoutonEffacer.jsx";
import BoutonOutil from "../../components/BoutonOutil.jsx";
import CustomSelect from "../../components/CustomSelect.jsx";
import { ListeTriable } from "../../components/Triable.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { afficherToast } from "../../toast.js";
import { BALANCE, lancerDansLaMarmite, lancerVers, relancerClasse } from "../../utils/animation.js";
import { normaliserTexte } from "../../utils/texte.js";
import CuisineItem, { equivalencesEntree } from "./CuisineItem.jsx";
import CuisineVide from "./CuisineVide.jsx";

const SELECTS = [
  { categorie: "plat", id: "selectRecettePlat", ariaLabel: "Remplacer la cuisine du jour par une recette", vide: "Aucune recette de plat", titre: "Aucune recette de plat pour le moment" },
  { categorie: "fraicheur", id: "selectRecetteFraicheur", ariaLabel: "Remplacer la cuisine du jour par une recette de fraîcheur", vide: "Aucune recette de fraîcheur", titre: "Aucune recette de fraîcheur pour le moment" },
];

const preparer = (ligne, effets = {}) => ({ ...ligne, effets });

// Visible à partir de 3 aliments distincts, si aucune recette n'a exactement la même combinaison.
function boutonRecetteVisible(entrees, recettes) {
  const ids = [...new Set(entrees.filter((e) => !e.effets.disparait).map((e) => String(e.food_id)))];
  if (ids.length < 3) return false;
  const tries = [...ids].sort();
  return !recettes.some((r) => {
    const autres = [...(r.food_ids || [])].map(String).sort();
    return autres.length === tries.length && autres.every((id, i) => id === tries[i]);
  });
}

export default function Cuisine({ actif, entrees, setEntrees, aliments, recettes, selects, onEnregistrerRecette, onEnvoyerRegleX }) {
  const planifier = useMinuteurs();
  const champ = useRef(null);
  const zone = useRef(null);
  const elements = useRef({});
  const verrous = useRef(new Set());
  const [texte, setTexte] = useState("");
  const [listeVisible, setListeVisible] = useState(false);
  const [valeursSelects, setValeursSelects] = useState({ plat: "", fraicheur: "" });
  const [aAmenerEnVue, setAAmenerEnVue] = useState(null);

  useClicExterieur([zone], () => setListeVisible(false));

  function majEffets(id, effets) {
    setEntrees((liste) => liste.map((e) => (e.id === id ? { ...e, effets: { ...e.effets, ...effets } } : e)));
  }

  useEffect(() => {
    if (aAmenerEnVue === null) return;
    const id = aAmenerEnVue;
    elements.current[id]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    majEffets(id, { miseEnAvant: true });
    planifier(() => majEffets(id, { miseEnAvant: false }), 1500);
    setAAmenerEnVue(null);
  }, [aAmenerEnVue, planifier]);

  const termes = normaliserTexte(texte.toLowerCase());
  const suggestions = aliments.map((a) => ({ ...a, visible: normaliserTexte(`${a.emoji} ${a.nom}`.toLowerCase()).includes(termes) }));
  const nbSuggestions = suggestions.filter((s) => s.visible).length;

  // ---------- Ajout direct (100 g), doublon mis en avant ----------

  function choisir(aliment, ligne) {
    setTexte("");
    setListeVisible(false);
    const existante = entrees.find((e) => String(e.food_id) === String(aliment.id));
    if (existante) {
      afficherToast("Déjà en cuisine aujourd'hui.");
      setAAmenerEnVue(existante.id);
      return;
    }
    if (verrous.current.has(aliment.id)) return;
    verrous.current.add(aliment.id);
    lancerDansLaMarmite(aliment.emoji, ligne);
    api("/calories/ajouter", { method: "POST", body: { idAliment: aliment.id, quantiteG: 100 } })
      .then(({ donnees }) => {
        if (donnees?.erreur) {
          alert(donnees.erreur);
          return;
        }
        // "entree" n'a pas de règle CSS sur une ligne de Cuisine : posée comme en EJS, jamais retirée.
        setEntrees((liste) => [...liste, preparer(donnees.item, { entree: true })]);
      })
      .catch((err) => {
        if (err.type === "reseau") afficherToast("Connexion instable : réessaie dans un instant.");
      })
      .finally(() => verrous.current.delete(aliment.id));
  }

  // ---------- Quantité, ordre, retrait ----------

  async function enregistrerQuantite(entree, grammes, unite) {
    let reponse;
    try {
      reponse = (await api("/calories/modifier", { method: "POST", body: { idEntree: String(entree.id), nouvelleQuantite: grammes, unite } })).donnees;
    } catch {
      return false;
    }
    if (reponse?.erreur) {
      alert(reponse.erreur);
      return false;
    }
    setEntrees((liste) =>
      liste.map((e) =>
        e.id === entree.id
          ? { ...e, quantite_g: grammes, unite, calories_calc: reponse.item.calories_calc, glucides_calc: reponse.item.glucides_calc, proteines_calc: reponse.item.proteines_calc, lipides_calc: reponse.item.lipides_calc }
          : e
      )
    );
    return true;
  }

  // Changer d'unité ne change pas les grammes : seule l'unité est enregistrée, pour être reprise.
  function changerUnite(entree, unite) {
    setEntrees((liste) => liste.map((e) => (e.id === entree.id ? { ...e, unite } : e)));
    api("/calories/modifier", { method: "POST", body: { idEntree: String(entree.id), nouvelleQuantite: parseFloat(entree.quantite_g), unite } }).catch(() => {});
  }

  function deplacer(depuis, vers) {
    const suivantes = arrayMove(entrees, depuis, vers);
    setEntrees(suivantes);
    // Optimiste : pas de retour arrière si le serveur refuse (§3.2-10).
    api("/calories/reordonner", { method: "POST", body: { ids: suivantes.map((e) => e.id) } })
      .then(({ donnees }) => {
        if (donnees?.erreur) alert(donnees.erreur);
      })
      .catch(() => {});
  }

  // Coché tout de suite ; revient en arrière si le serveur refuse ou si le réseau tombe.
  function basculerAjoute(entree) {
    const ajoute = !entree.ajoute;
    const appliquer = (valeur) => setEntrees((liste) => liste.map((e) => (e.id === entree.id ? { ...e, ajoute: valeur } : e)));
    appliquer(ajoute);
    // Petit saut et étincelles quand l'ingrédient part dans le plat.
    if (ajoute) {
      majEffets(entree.id, { saut: false });
      planifier(() => majEffets(entree.id, { saut: true }), 0);
      planifier(() => majEffets(entree.id, { saut: false }), 700);
    }
    api("/calories/ajoute", { method: "POST", body: { idEntree: String(entree.id), ajoute } })
      .then(({ donnees }) => {
        if (donnees?.erreur) appliquer(!ajoute);
      })
      .catch(() => appliquer(!ajoute));
  }

  function supprimer(entree) {
    api("/calories/supprimer", { method: "POST", body: { idEntree: String(entree.id) } })
      .then(({ donnees }) => {
        if (donnees?.erreur) {
          alert(donnees.erreur);
          return;
        }
        // Totaux mis à jour tout de suite (lignes "disparait" ignorées), ligne retirée après l'animation.
        majEffets(entree.id, { disparait: true });
        planifier(() => setEntrees((liste) => liste.filter((e) => e.id !== entree.id)), 300);
      })
      .catch(() => {});
  }

  function toutEffacer(event) {
    if (!confirm("Vider la cuisine d'aujourd'hui ?")) return;
    relancerClasse(event?.currentTarget, "btn-x-rond--tourne");
    api("/calories/vider", { method: "POST" })
      .then(({ donnees }) => {
        if (donnees?.erreur) {
          alert(donnees.erreur);
          return;
        }
        // Tout tombe de la planche, l'un après l'autre.
        const n = entrees.length;
        setEntrees((liste) => liste.map((e, i) => ({ ...e, effets: { ...e.effets, disparait: true, chute: true, rang: Math.min(i, 8) } })));
        planifier(() => setEntrees([]), 420 + Math.min(n - 1, 8) * 50);
      })
      .catch(() => {});
  }

  // ---------- Recette appliquée : remplace la Cuisine du jour, sans confirmation (§3.2-11) ----------

  function appliquerRecette(categorie, idRecette) {
    setValeursSelects((v) => ({ ...v, [categorie]: idRecette }));
    if (!idRecette) return;
    api("/calories/ajouter-recette", { method: "POST", body: { idRecette } })
      .then(({ donnees }) => {
        if (donnees?.erreur) {
          alert(donnees.erreur);
          return;
        }
        setEntrees(donnees.items.map((item, i) => preparer(item, { entree: true, rang: Math.min(i, 10) })));
        setValeursSelects((v) => ({ ...v, [categorie]: "" }));
      })
      .catch((err) => {
        if (err.type === "session") return;
        console.error(err);
        alert("Une erreur est survenue.");
      });
  }

  const actives = entrees.filter((e) => !e.effets.disparait);

  return (
    <div className={"calories-tab-panel" + (actif ? " actif" : "")}>
      <div className="journal-actions-row">
        <div id="autocompleteCalories" ref={zone}>
          <div className="champ-recherche-wrapper">
            <input
              ref={champ}
              type="text"
              id="rechercheAlimentCalories"
              placeholder="Rechercher un aliment..."
              autoComplete="off"
              className={termes !== "" && nbSuggestions === 0 ? "recherche-invalide" : undefined}
              value={texte}
              onChange={(e) => {
                setTexte(e.target.value);
                setListeVisible(normaliserTexte(e.target.value.toLowerCase()) !== "");
              }}
            />
            <BoutonEffacer
              cible="rechercheAlimentCalories"
              valeur={texte}
              onEffacer={() => {
                setTexte("");
                setListeVisible(false);
              }}
              champ={champ}
            />
          </div>
          <ul id="listeAlimentsCalories" hidden={!listeVisible}>
            {suggestions.map((s) => (
              <li key={s.id} hidden={!s.visible} onClick={(e) => choisir(s, e.currentTarget)}>
                {s.emoji} {s.nom}
              </li>
            ))}
          </ul>
        </div>

        {SELECTS.map((s) => {
          const etat = selects[s.categorie];
          const options = recettes
            .filter((r) => r.categorie === s.categorie && !r.sortant)
            .sort((a, b) => a.nom.localeCompare(b.nom))
            .map((r) => ({ value: String(r.id), label: r.nom }));
          return (
            <CustomSelect
              key={s.id}
              id={s.id}
              ariaLabel={s.ariaLabel}
              disabled={etat.desactive}
              title={etat.desactive ? s.titre : undefined}
              value={valeursSelects[s.categorie]}
              options={[{ value: "", label: etat.texteVide ? s.vide : "" }, ...options]}
              onChange={(valeur) => appliquerRecette(s.categorie, valeur)}
            />
          );
        })}

        {actives.length > 0 && <BoutonOutil
            icone="regle"
            onClick={(e) => {
              lancerVers(actives.map((a) => a.emoji), e.currentTarget, BALANCE, "recoit");
              onEnvoyerRegleX(actives);
            }}
          />}
        <button type="button" id="btnToutEffacer" className="btn-x-rond" title="Tout effacer" onClick={toutEffacer}>
          Tout effacer
        </button>
      </div>

      <button
        type="button"
        id="btnEnregistrerRecette"
        className={"btn-enregistrer-recette" + (boutonRecetteVisible(entrees, recettes) ? "" : " hidden")}
        onClick={() =>
          onEnregistrerRecette(
            entrees.map((e) => {
              const eq = equivalencesEntree(e);
              return {
                food_id: e.food_id,
                nom: `${e.emoji} ${e.nom}`,
                // Toujours en grammes, quelle que soit l'unité affichée dans la ligne.
                quantite_g: String(parseFloat(e.quantite_g)),
                unite: e.unite || "g",
                grammes_par_cuil_a_cafe: eq.gCafe,
                grammes_par_cuil_a_soupe: eq.gSoupe,
                poids_unite_g: eq.poidsPiece,
                unite_piece: eq.unitePiece,
                emoji: e.emoji,
              };
            })
          )
        }
      ></button>

      <div id="listeJournal">
        <ListeTriable ids={entrees.map((e) => e.id)} onDeplacer={deplacer}>
          {entrees.map((entree) => (
            <CuisineItem
              key={entree.id}
              ref={(el) => {
                if (el) elements.current[entree.id] = el;
                else delete elements.current[entree.id];
              }}
              entree={entree}
              onEnregistrerQuantite={(grammes, unite) => enregistrerQuantite(entree, grammes, unite)}
              onChangerUnite={(unite) => changerUnite(entree, unite)}
              onSupprimer={() => supprimer(entree)}
              onBasculerAjoute={() => basculerAjoute(entree)}
            />
          ))}
        </ListeTriable>
      </div>

      {actives.length === 0 && <CuisineVide />}
      <p className={"no-results" + (actives.length > 0 ? " hidden" : "")} id="noResultsJournal">Rien d'ajouté aujourd'hui.</p>
    </div>
  );
}
