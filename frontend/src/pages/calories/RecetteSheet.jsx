import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { api } from "../../api.js";
import { arrayMove } from "@dnd-kit/sortable";
import BoutonEffacer from "../../components/BoutonEffacer.jsx";
import { ListeTriable } from "../../components/Triable.jsx";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { grammesParUnite, optionsUnite, poidsPieceDe } from "../../utils/unites.js";
import { normaliserTexte } from "../../utils/texte.js";
import IngredientLigne, { changerUniteLigne } from "./IngredientLigne.jsx";

const CATEGORIES = [
  { valeur: "plat", label: "Plat" },
  { valeur: "fraicheur", label: "Fraîcheur" },
];

// Ligne d'ingrédient : "0.00" de poids_unite_g normalisé ici une fois pour toutes ; unité enregistrée reprise si l'aliment la connaît.
function nouvelleLigne(foodId, nom, quantiteG, gCafe, gSoupe, poidsPiece, unitePiece, emoji, unite = "g") {
  const poids = Number(poidsPiece) || 0;
  const saisie = quantiteG === "" || quantiteG === undefined || quantiteG === null ? "" : String(quantiteG);
  const ligne = {
    foodId: String(foodId),
    nom,
    emoji: emoji || "",
    gCafe: gCafe || "",
    gSoupe: gSoupe || "",
    poidsPiece: poids || "",
    unitePiece: unitePiece || "",
    saisie,
    unite: "g",
    minimum: "0.25",
    grammes: Number(saisie) || 0,
    sortant: false,
  };
  return unite && unite !== "g" && grammesParUnite(ligne, unite) > 0 ? changerUniteLigne(ligne, unite) : ligne;
}

// Lecture : quantité dans l'unité enregistrée ("2 tbs"), grammes par défaut.
function texteQuantite(ing) {
  const ligne = nouvelleLigne(ing.food_id, "", parseFloat(ing.quantite_g), ing.grammes_par_cuil_a_cafe, ing.grammes_par_cuil_a_soupe, ing.tracking_type === "unite" ? ing.poids_unite_g : null, ing.unite_piece, "", ing.unite);
  const option = optionsUnite(ligne).find((o) => o.value === ligne.unite);
  return `${ligne.saisie} ${option ? option.label : "g"}`;
}

const FORMULAIRE_VIDE = { id: "", nom: "", etapes: "", categorie: "plat", lignes: [], supprimerVisible: false };

export default function RecetteSheet({ ref, aliments, onEnregistree, onSupprimee }) {
  const planifier = useMinuteurs();
  const sheet = useRef(null);
  const liste = useRef(null);
  const champNom = useRef(null);
  const champRecherche = useRef(null);
  const boutonToggle = useRef(null);
  const zoneRecherche = useRef(null);
  const elementsLignes = useRef({});
  const quantites = useRef({});
  const lectureDemandee = useRef(0);
  const focusApres = useRef(null);

  const [ouvert, setOuvert] = useState(false);
  // Au chargement de la page, le formulaire est visible et la lecture cachée (état du template).
  const [mode, setMode] = useState("formulaire");
  const [lecture, setLecture] = useState({ nom: "", meta: "", ingredients: [], etapes: null });
  const [recetteChargee, setRecetteChargee] = useState(null);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const formulaireActuel = useRef(formulaire);
  formulaireActuel.current = formulaire;
  const [recherche, setRecherche] = useState({ ouverte: false, pret: false, texte: "", listeVisible: false });
  // État posé explicitement, comme majEtatIngredients (rien n'est calculé au chargement de la page).
  const [videCache, setVideCache] = useState(false);
  const [enregistrerDesactive, setEnregistrerDesactive] = useState(false);
  const [texteEnregistrer, setTexteEnregistrer] = useState("Enregistrer");


  function majEtatIngredients(nombre) {
    setVideCache(nombre > 0);
    setEnregistrerDesactive(nombre < 2);
  }

  useEffect(() => {
    if (focusApres.current === null) return;
    quantites.current[focusApres.current]?.focus();
    focusApres.current = null;
  });

  function afficher() {
    // Jamais rouvert en bas : .sheet garde sa position de défilement d'une ouverture à l'autre.
    if (sheet.current) sheet.current.scrollTop = 0;
    setOuvert(true);
  }

  function fermerRecherche(nombreLignes) {
    setRecherche({ ouverte: false, pret: false, texte: "", listeVisible: false });
    majEtatIngredients(nombreLignes);
  }

  function fermer() {
    setOuvert(false);
    fermerRecherche(formulaire.lignes.length);
  }

  // Remise à zéro (reinitialiserSheet), puis remplissage éventuel.
  function preparerFormulaire(valeurs) {
    setTexteEnregistrer("Enregistrer");
    if (liste.current) liste.current.scrollTop = 0;
    const lignes = valeurs.lignes || [];
    setFormulaire({ ...FORMULAIRE_VIDE, ...valeurs, lignes });
    setRecherche({ ouverte: false, pret: false, texte: "", listeVisible: false });
    majEtatIngredients(lignes.length);
  }

  // Doublons ignorés comme dans ajouterLigneIngredient (on garde la première occurrence).
  function sansDoublons(lignes) {
    return lignes.filter((l, i) => lignes.findIndex((m) => m.foodId === l.foodId) === i);
  }

  useImperativeHandle(ref, () => ({
    // "Nouvelle recette" (catégorie de la section) ou "Enregistrer comme recette" (ingrédients de la Cuisine).
    ouvrirCreation({ categorie, ingredients = [] }) {
      setRecetteChargee(null);
      setMode("formulaire");
      const lignes = sansDoublons(ingredients.map((ing) => nouvelleLigne(ing.food_id, ing.nom, ing.quantite_g, ing.grammes_par_cuil_a_cafe, ing.grammes_par_cuil_a_soupe, ing.poids_unite_g, ing.unite_piece, ing.emoji, ing.unite)));
      preparerFormulaire({ categorie: categorie || "plat", lignes });
      afficher();
      setTimeout(() => champNom.current?.focus(), 0);
    },
    ouvrirLecture(idRecette, nbIngredients, kcalTotal) {
      const numero = ++lectureDemandee.current;
      api("/recettes/" + idRecette)
        .then(({ donnees }) => {
          // Une lecture plus récente (autre carte touchée entre-temps) l'emporte.
          if (numero !== lectureDemandee.current) return;
          if (donnees?.erreur) {
            alert(donnees.erreur);
            return;
          }
          setRecetteChargee(donnees);
          const etapes = (donnees.recette.etapes || "").split("\n").map((e) => e.trim()).filter(Boolean);
          setLecture({
            nom: donnees.recette.nom,
            meta: nbIngredients != null && kcalTotal != null ? `${nbIngredients} ingrédient${nbIngredients > 1 ? "s" : ""} · ${kcalTotal} kcal` : "",
            ingredients: donnees.ingredients,
            etapes,
          });
          setMode("lecture");
          afficher();
        })
        .catch(() => {});
    },
  }));

  function ouvrirEdition() {
    if (!recetteChargee) return;
    const { recette, ingredients } = recetteChargee;
    setMode("formulaire");
    const lignes = sansDoublons(
      ingredients.map((ing) => nouvelleLigne(ing.food_id, `${ing.emoji} ${ing.nom}`, parseFloat(ing.quantite_g), ing.grammes_par_cuil_a_cafe, ing.grammes_par_cuil_a_soupe, ing.tracking_type === "unite" ? ing.poids_unite_g : null, ing.unite_piece, ing.emoji, ing.unite))
    );
    preparerFormulaire({ id: String(recette.id), nom: recette.nom, etapes: recette.etapes || "", categorie: recette.categorie, lignes, supprimerVisible: true });
    afficher();
  }

  // ---------- Lignes d'ingrédients ----------

  function majLigne(foodId, ligne) {
    setFormulaire((f) => ({ ...f, lignes: f.lignes.map((l) => (l.foodId === foodId ? ligne : l)) }));
  }

  function deplacer(depuis, vers) {
    setFormulaire((f) => ({ ...f, lignes: arrayMove(f.lignes, depuis, vers) }));
  }

  function retirer(foodId) {
    setFormulaire((f) => ({ ...f, lignes: f.lignes.map((l) => (l.foodId === foodId ? { ...l, sortant: true } : l)) }));
    planifier(() => {
      const lignes = formulaireActuel.current.lignes.filter((l) => l.foodId !== foodId);
      setFormulaire((f) => ({ ...f, lignes: f.lignes.filter((l) => l.foodId !== foodId) }));
      majEtatIngredients(lignes.length);
    }, 300);
  }

  function ajouterDepuisRecherche(aliment) {
    const poids = poidsPieceDe(aliment.tracking_type, aliment.poids_unite_g);
    const ligne = nouvelleLigne(aliment.id, `${aliment.emoji} ${aliment.nom}`, "", aliment.grammes_par_cuil_a_cafe ?? "", aliment.grammes_par_cuil_a_soupe ?? "", poids || "", aliment.unite || "", aliment.emoji);
    const existante = formulaire.lignes.find((l) => l.foodId === ligne.foodId);
    const lignes = existante ? formulaire.lignes : [...formulaire.lignes, ligne];
    if (!existante) setFormulaire((f) => ({ ...f, lignes }));
    fermerRecherche(lignes.length);
    // Focus sur la quantité de la dernière ligne (déjà présente ou tout juste ajoutée).
    focusApres.current = lignes[lignes.length - 1]?.foodId ?? null;
  }

  // ---------- Recherche d'ingrédient repliable ----------

  function basculerRecherche() {
    if (!recherche.ouverte) {
      setRecherche((r) => ({ ...r, ouverte: true }));
      // Le champ prend la place du message "vide" le temps de la recherche.
      setVideCache(true);
      liste.current?.scrollTo?.({ top: liste.current.scrollHeight, behavior: "smooth" });
      champRecherche.current?.focus();
    } else {
      setRecherche((r) => ({ ...r, ouverte: false, pret: false }));
      majEtatIngredients(formulaire.lignes.length);
    }
  }

  const surClicDocument = useRef(null);
  surClicDocument.current = (event) => {
    if (recherche.ouverte && !event.target.closest("#autocompleteIngredient") && event.target !== boutonToggle.current) {
      fermerRecherche(formulaire.lignes.length);
    }
  };
  useEffect(() => {
    const ecouter = (event) => surClicDocument.current(event);
    document.addEventListener("click", ecouter);
    return () => document.removeEventListener("click", ecouter);
  }, []);

  const termes = normaliserTexte(recherche.texte.toLowerCase());
  const suggestions = aliments.map((a) => ({ ...a, visible: normaliserTexte(`${a.emoji} ${a.nom}`.toLowerCase()).includes(termes) }));
  const nbSuggestions = suggestions.filter((s) => s.visible).length;

  // ---------- Enregistrement et suppression ----------

  async function enregistrer(event) {
    event.preventDefault();
    // Un clic répété pendant l'envoi créerait sinon plusieurs recettes.
    if (enregistrerDesactive) return;
    const texteInitial = texteEnregistrer;
    setEnregistrerDesactive(true);
    setTexteEnregistrer("Enregistrement...");
    const restaurer = () => {
      setEnregistrerDesactive(false);
      setTexteEnregistrer(texteInitial);
    };

    const nom = formulaire.nom.trim();
    const etapes = formulaire.etapes.trim();
    const ingredients = [];
    const emojis = [];
    formulaire.lignes.forEach((ligne) => {
      if (!ligne.foodId || !ligne.saisie) return;
      // Quantité toujours en grammes ; l'unité affichée est enregistrée à côté pour être reprise.
      ingredients.push({ food_id: ligne.foodId, quantite_g: Number(ligne.saisie) * grammesParUnite(ligne, ligne.unite), unite: ligne.unite });
      if (ligne.emoji) emojis.push(ligne.emoji);
    });

    if (!nom || ingredients.length === 0) {
      alert("Ajoute un nom et au moins un ingrédient valide.");
      restaurer();
      return;
    }

    const idRecette = formulaire.id;
    let reponse;
    try {
      reponse = (await api(idRecette ? `/recettes/${idRecette}/modifier` : "/recettes/creer", {
        method: "POST",
        body: { nom, categorie: formulaire.categorie, etapes, ingredients },
      })).donnees;
    } catch (err) {
      if (err.type === "session") return;
      alert("Erreur réseau, réessaie.");
      restaurer();
      return;
    }
    if (reponse?.erreur) {
      alert(reponse.erreur);
      restaurer();
      return;
    }

    onEnregistree(
      {
        id: idRecette ? Number(idRecette) : reponse.recette.id,
        nom,
        categorie: formulaire.categorie,
        etapes,
        nb_ingredients: reponse.recette.nb_ingredients,
        kcal_total: reponse.recette.kcal_total,
        food_ids: ingredients.map((i) => i.food_id),
        emoji_combo: emojis.slice(0, 3).join(""),
      },
      idRecette ? Number(idRecette) : null
    );
    setTexteEnregistrer(texteInitial);
    fermer();
  }

  function supprimer() {
    if (!confirm("Supprimer cette recette ?")) return;
    const idRecette = Number(formulaire.id);
    api(`/recettes/${idRecette}/supprimer`, { method: "POST" })
      .then(({ donnees }) => {
        if (donnees?.erreur) {
          alert(donnees.erreur);
          return;
        }
        onSupprimee(idRecette);
        fermer();
      })
      .catch(() => {});
  }

  const lignes = formulaire.lignes;

  return (
    <>
      <div className={"sheet-backdrop" + (ouvert ? " ouvert" : "")} id="sheetBackdrop" onClick={fermer}></div>
      <div className={"sheet" + (ouvert ? " ouvert" : "")} id="sheet" ref={sheet}>
        <div className="sheet-handle"></div>
        <div id="recetteLecture" className={"recette-lecture" + (mode !== "lecture" ? " hidden" : "")}>
          <div className="detail-header">
            <div className="recette-lecture-titre">
              <h2 id="recetteLectureNom" className="recette-lecture-nom">{lecture.nom}</h2>
              <p id="recetteLectureMeta" className="recette-lecture-meta">{lecture.meta}</p>
            </div>
            <div className="detail-header-actions">
              <button type="button" id="btnModifierRecette" className="btn-modifier-recette" title="Modifier" aria-label="Modifier la recette" onClick={ouvrirEdition}></button>
              <button type="button" className="sheet-close-btn" data-sheet-close title="Fermer" onClick={fermer}>✕</button>
            </div>
          </div>
          <h3>Ingrédients</h3>
          <ul id="recetteLectureIngredients" className="recette-lecture-ingredients">
            {lecture.ingredients.map((ing) => (
              <li key={ing.food_id}>
                <span className="recette-lecture-ing-emoji">{ing.emoji || ""}</span>
                <span className="recette-lecture-ing-nom">{ing.nom}</span>
                <span className="recette-lecture-ing-qte">{texteQuantite(ing)}</span>
              </li>
            ))}
          </ul>
          <h3>Étapes</h3>
          <ol id="recetteLectureEtapes" className={"recette-lecture-etapes" + (lecture.etapes && lecture.etapes.length === 0 ? " hidden" : "")}>
            {(lecture.etapes || []).map((etape, i) => (
              <li key={i}>{etape}</li>
            ))}
          </ol>
          <p id="recetteLectureEtapesVides" className={"recette-lecture-vide" + (lecture.etapes && lecture.etapes.length > 0 ? " hidden" : "")}>
            Aucune étape ajoutée — juste les ingrédients, cette fois.
          </p>
        </div>

        <form id="formRecette" className={mode !== "formulaire" ? "hidden" : undefined} onSubmit={enregistrer}>
          <input type="hidden" id="recetteId" value={formulaire.id} />

          <div className="detail-header">
            <input
              ref={champNom}
              type="text"
              id="recetteNom"
              className="detail-nom-edit"
              placeholder="Nom de la recette"
              required
              value={formulaire.nom}
              onChange={(e) => setFormulaire((f) => ({ ...f, nom: e.target.value }))}
              onKeyDown={(e) => {
                // En édition, Entrée ne doit rien enregistrer tout seul.
                if (e.key === "Enter" && formulaire.id) e.preventDefault();
              }}
            />
            <div className="detail-header-actions">
              <button type="button" id="sheetCloseBtn" className="sheet-close-btn" title="Fermer" onClick={fermer}>✕</button>
            </div>
          </div>

          <div className="detail-tag-row">
            <div className="detail-tag-select" id="recetteCategoriePicker">
              {CATEGORIES.map((c) => (
                <button key={c.valeur} type="button" className={"cat-pill" + (formulaire.categorie === c.valeur ? " actif" : "")} onClick={() => setFormulaire((f) => ({ ...f, categorie: c.valeur }))}>
                  <span className={"icone-categorie-recette icone-categorie-recette--" + c.valeur}></span> {c.label}
                </button>
              ))}
            </div>
            <button ref={boutonToggle} type="button" id="btnToggleAjoutIngredient" className={"btn-ajout-icone" + (recherche.ouverte ? " actif" : "")} title="Ajouter un ingrédient" onClick={basculerRecherche}>
              Ajouter un ingrédient
            </button>
          </div>

          <div id="listeIngredientsRecette" ref={liste} className={recherche.pret ? "recherche-ouverte" : undefined}>
            <ListeTriable ids={lignes.map((l) => l.foodId)} onDeplacer={deplacer}>
              {lignes.map((ligne) => (
                <IngredientLigne
                  key={ligne.foodId}
                  ligne={ligne}
                  onChanger={(maj) => majLigne(ligne.foodId, maj)}
                  onRetirer={() => retirer(ligne.foodId)}
                  refLigne={(el) => {
                    if (el) elementsLignes.current[ligne.foodId] = el;
                    else delete elementsLignes.current[ligne.foodId];
                  }}
                  refQuantite={(el) => {
                    if (el) quantites.current[ligne.foodId] = el;
                    else delete quantites.current[ligne.foodId];
                  }}
                />
              ))}
            </ListeTriable>
            <div
              id="autocompleteIngredient"
              ref={zoneRecherche}
              className={(recherche.ouverte ? "" : "replie") + (recherche.pret ? " pret" : "") || undefined}
              onTransitionEnd={(e) => {
                if (e.target === e.currentTarget && e.propertyName === "max-height" && recherche.ouverte) setRecherche((r) => ({ ...r, pret: true }));
              }}
            >
              <div className="champ-recherche-wrapper">
                <input
                  ref={champRecherche}
                  type="text"
                  id="rechercheIngredient"
                  placeholder="Rechercher un aliment à ajouter..."
                  autoComplete="off"
                  className={termes !== "" && nbSuggestions === 0 ? "recherche-invalide" : undefined}
                  value={recherche.texte}
                  onChange={(e) => setRecherche((r) => ({ ...r, texte: e.target.value, listeVisible: normaliserTexte(e.target.value.toLowerCase()) !== "" }))}
                />
                <BoutonEffacer cible="rechercheIngredient" valeur={recherche.texte} onEffacer={() => setRecherche((r) => ({ ...r, texte: "", listeVisible: false }))} champ={champRecherche} />
              </div>
              <ul id="listeIngredientsRecherche" hidden={!recherche.listeVisible}>
                {suggestions.map((a) => (
                  <li key={a.id} hidden={!a.visible} onClick={() => ajouterDepuisRecherche(a)}>
                    {a.emoji} {a.nom}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className={"ingredients-vide" + (videCache ? " hidden" : "")} id="ingredientsVide">Aucun ingrédient pour l'instant — touche "+" pour en ajouter.</p>

          <label htmlFor="recetteEtapes" className="recette-etapes-label">Étapes</label>
          <textarea id="recetteEtapes" className="recette-etapes-input" rows="5" placeholder="Une étape par ligne" value={formulaire.etapes} onChange={(e) => setFormulaire((f) => ({ ...f, etapes: e.target.value }))}></textarea>

          <button type="submit" id="btnEnregistrerSheet" disabled={enregistrerDesactive}>{texteEnregistrer}</button>

          {/* Séparé du ✕ pour ne jamais supprimer par un tap malheureux ; masqué pour une nouvelle recette. */}
          <button type="button" id="btnSupprimerRecetteSheet" className={"btn-supprimer-pleine-largeur" + (formulaire.supprimerVisible ? "" : " hidden")} onClick={supprimer}>
            Supprimer
          </button>
        </form>
      </div>
    </>
  );
}
