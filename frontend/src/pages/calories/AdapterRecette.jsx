import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { api } from "../../api.js";
import BoutonOutil from "../../components/BoutonOutil.jsx";
import CustomSelect from "../../components/CustomSelect.jsx";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { lancerVers, MARMITE, relancerClasse } from "../../utils/animation.js";
import { lireRecette, normaliser, noteIngredient, trouverAliment } from "../../utils/recetteCollee.js";
import { convertirAffichage, estLiquide, grammesParUnite, optionsUnite, poidsPieceDe } from "../../utils/unites.js";

const RACCOURCIS = [
  { facteur: 0.5, label: "½" },
  { facteur: 1, label: "1" },
  { facteur: 1.5, label: "1½" },
  { facteur: 2, label: "2" },
  { facteur: 3, label: "3" },
];
// Mêmes boutons icône que la Cuisine : plats (recettes.svg) et fraîcheur (glacon.svg).
const SELECTS_RECETTES = [
  { categorie: "plat", classe: "select-recette-icone", ariaLabel: "Adapter une recette de plat" },
  { categorie: "fraicheur", classe: "select-recette-icone select-recette-icone--fraicheur", ariaLabel: "Adapter une recette de fraîcheur" },
];
const CATEGORIES = ["Divers", "Épicerie", "Épices", "Féculents", "Fruits", "Laitiers", "Légumes", "Légumineuses", "Lipides", "Oeufs", "Poissons", "Sauces", "Viandes", "Boissons"];

// Entier sans décimale (300), sinon une seule (7.5) ; le facteur garde ses centièmes (× 0.75) sans zéros inutiles.
function arrondi(v) {
  const r = Math.round(Number(v) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
const texteFacteur = (f) => "× " + String(Math.round(f * 100) / 100);

const equivalences = (a) => ({
  gCafe: a?.grammes_par_cuil_a_cafe ?? "",
  gSoupe: a?.grammes_par_cuil_a_soupe ?? "",
  poidsPiece: poidsPieceDe(a?.tracking_type, a?.poids_unite_g, a?.unite) || "",
  unitePiece: a?.unite || "",
  liquide: estLiquide(a?.unite),
});

// Quantité lue → grammes pour cet aliment (cuillères : ses équivalences, sinon 5 / 15 g ; pièce : son poids, sinon inconnue).
function versGrammes(quantite, unite, eq, secours) {
  if (quantite === null || quantite === undefined) return null;
  if (unite === "cafe") return quantite * (Number(eq.gCafe) || 5);
  if (unite === "soupe") return quantite * (Number(eq.gSoupe) || 15);
  if (unite === "piece") return eq.poidsPiece ? quantite * Number(eq.poidsPiece) : secours ? quantite * secours : null;
  if (unite === "l") return quantite * 1000;
  return quantite;
}

// L'unité lue reste affichée si l'aliment la connaît, sinon tout est en grammes.
function uniteAffichee(unite, eq) {
  return optionsUnite(eq).some((o) => o.value === unite) ? unite : "g";
}

// Écran vide : un œuf, un sachet de farine et une plaquette de beurre grandissent puis rétrécissent ensemble,
// comme une recette qu'on adapte sans changer ses proportions.
function IngredientsEnsemble() {
  return (
    <svg className="adapter__vide" viewBox="0 0 220 140" aria-hidden="true">
      <g className="adapter__vide-ing">
        <ellipse className="trait" cx="56" cy="92" rx="14" ry="19" />
        <ellipse className="dose" cx="56" cy="96" rx="5.5" ry="5.5" />
      </g>
      <g className="adapter__vide-ing">
        <path className="trait" d="M94 112V72l6-8h20l6 8v40z" />
        <path className="trait fin" d="M94 72h32M102 86h16M102 94h16" />
      </g>
      <g className="adapter__vide-ing">
        <rect className="trait" x="146" y="88" width="40" height="24" rx="3" />
        <rect className="dose" x="152" y="94" width="28" height="6" rx="2" />
      </g>
    </svg>
  );
}

// Choix déjà faits (« vanille » → Gousse de Vanille), gardés sur ce téléphone et repris au prochain collage.
const CLE_MEMOIRE = "reglex-choix";
function lireMemoire() {
  try {
    return JSON.parse(localStorage.getItem(CLE_MEMOIRE)) || {};
  } catch {
    return {};
  }
}
function memoriser(nomLu, idAliment) {
  try {
    localStorage.setItem(CLE_MEMOIRE, JSON.stringify({ ...lireMemoire(), [normaliser(nomLu)]: String(idAliment) }));
  } catch {
    // Stockage indisponible : le choix vaut seulement pour ce collage.
  }
}

let compteurLignes = 0;
function resoudre(ligne, aliment) {
  const eq = equivalences(aliment);
  // Recette en ml pour tout (« 5 ml (1 c. à thé) ») : la cuillère pour un solide (son vrai poids), les ml pour un liquide.
  const lu = ligne.alternative && aliment && !eq.liquide && ["ml", "l"].includes(ligne.uniteLue) ? ligne.alternative : { quantite: ligne.quantiteLue, unite: ligne.uniteLue };
  const grammes = aliment ? versGrammes(lu.quantite, lu.unite, eq, ligne.poidsSecours) : null;
  const unite = aliment ? uniteAffichee(lu.unite, eq) : "g";
  const ratio = grammesParUnite(eq, unite) || 1;
  const note = noteIngredient(ligne.nomAffiche, aliment);
  return { ...ligne, alimentId: aliment ? String(aliment.id) : "", grammes, unite, note, saisie: grammes === null ? "" : convertirAffichage(grammes, ratio) };
}

function lignesDepuisTexte(texte, aliments) {
  return lireRecette(texte).map((lue) => {
    const trouve = trouverAliment(lue.nom, aliments, lireMemoire());
    const ligne = { cle: ++compteurLignes, nomLu: lue.nom, nomAffiche: lue.nomAffiche, quantiteLue: lue.quantite, uniteLue: lue.unite, approx: lue.approx, poidsSecours: lue.poidsSecours, alternative: lue.alternative, candidats: trouve.candidats.map((a) => String(a.id)) };
    return resoudre(ligne, trouve.aliment);
  });
}

// Onglet RègleX (règle de trois × multiplicateur) : une recette collée (ou enregistrée) recalculée selon ce qu'on a.
export default function AdapterRecette({ ref, actif, recettes, aliments, onAjoutee, onEnregistrerRecette, onAlimentCree, onNombre }) {
  const [source, setSource] = useState("coller");
  // Champ de collage replié par défaut : il s'ouvre au toucher de « Coller » et se replie une fois la recette lue.
  const [collerOuvert, setCollerOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [idRecette, setIdRecette] = useState("");
  const [categorieRecette, setCategorieRecette] = useState("");
  const [lignes, setLignes] = useState([]);
  const [facteur, setFacteurBrut] = useState(1);
  // Facteur changé par toi (pas remis à 1 par un chargement) : les chiffres « Pour toi » sautent.
  const [facteurTouche, setFacteurTouche] = useState(false);
  const setFacteur = (f) => {
    setFacteurTouche(true);
    setFacteurBrut(f);
  };
  const [edition, setEdition] = useState(null);
  const [saisie, setSaisie] = useState("");
  const [creation, setCreation] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  // Lignes posées une à une (recette chargée, collage) ; pas à chaque frappe dans le champ.
  const [arrivee, setArrivee] = useState(false);
  const [vidage, setVidage] = useState(false);
  const planifier = useMinuteurs();
  const demande = useRef(0);

  const parId = new Map(aliments.map((a) => [String(a.id), a]));
  const alimentsTries = [...aliments].sort((a, b) => a.nom.localeCompare(b.nom));
  const modifie = Math.abs(facteur - 1) > 0.001;
  const pretes = lignes.filter((l) => l.alimentId && l.grammes > 0);
  const aCompleter = lignes.length - pretes.length;
  // Nombre d'ingrédients sur la balance, pour le badge du titre.
  useEffect(() => onNombre?.(vidage ? 0 : lignes.length), [lignes.length, vidage]);
  const kcal = pretes.reduce((t, l) => t + ((Number(parId.get(l.alimentId)?.calories) || 0) * l.grammes) / 100, 0);

  function majLigne(cle, maj) {
    setLignes((liste) => liste.map((l) => (l.cle === cle ? { ...l, ...maj(l) } : l)));
  }

  function reinitialiser() {
    setFacteurBrut(1);
    setFacteurTouche(false);
    setEdition(null);
    setCreation(null);
  }

  // Repart de zéro : texte collé, lignes, facteur et recette choisie.
  function effacerTout(event) {
    if (vidage) return;
    relancerClasse(event?.currentTarget, "btn-x-rond--tourne");
    // Les lignes tombent de la balance l'une après l'autre, puis tout repart de zéro.
    if (lignes.length > 0) {
      setArrivee(false);
      setVidage(true);
      planifier(() => {
        setVidage(false);
        viderTout();
      }, 420 + Math.min(lignes.length - 1, 8) * 50);
      return;
    }
    viderTout();
  }

  function viderTout() {
    reinitialiser();
    setTexte("");
    setLignes([]);
    setIdRecette("");
    setCategorieRecette("");
    setSource("coller");
    setCollerOuvert(false);
  }

  function lireTexte(valeur) {
    // Un collage (gros ajout d'un coup) fait arriver les lignes ; une frappe non.
    setArrivee(valeur.length - texte.length > 15);
    setTexte(valeur);
    reinitialiser();
    setLignes(lignesDepuisTexte(valeur, aliments));
  }

  function changerSource(nouvelle) {
    if (nouvelle === "coller" && source === "coller") {
      setCollerOuvert((o) => !o);
      return;
    }
    setCollerOuvert(nouvelle === "coller");
    setCategorieRecette("");
    setSource(nouvelle);
    reinitialiser();
    setIdRecette("");
    setArrivee(true);
    setLignes(nouvelle === "coller" ? lignesDepuisTexte(texte, aliments) : []);
  }

  function choisirRecette(id, categorie) {
    setSource("recette");
    setCollerOuvert(false);
    setCategorieRecette(id ? categorie : "");
    setIdRecette(id);
    reinitialiser();
    setLignes([]);
    if (!id) return;
    // Une lecture plus récente (autre recette choisie entre-temps) l'emporte.
    const numero = ++demande.current;
    api("/recettes/" + id)
      .then(({ donnees }) => {
        if (numero !== demande.current) return;
        if (donnees?.erreur) {
          alert(donnees.erreur);
          return;
        }
        setArrivee(true);
        setLignes(donnees.ingredients.map((ing) => ligneResolue(ing.food_id, ing.nom, ing.quantite_g, ing.unite)));
      })
      .catch(() => {});
  }

  // Ligne déjà résolue (recette enregistrée, Cuisine) : grammes connus, unité gardée si l'aliment la connaît.
  function ligneResolue(foodId, nom, quantiteG, uniteEnregistree) {
    const eq = equivalences(parId.get(String(foodId)));
    const unite = uniteEnregistree && optionsUnite(eq).some((o) => o.value === uniteEnregistree) ? uniteEnregistree : "g";
    const grammes = parseFloat(quantiteG);
    return { cle: ++compteurLignes, nomLu: nom, quantiteLue: grammes, uniteLue: "g", approx: false, candidats: [], alimentId: String(foodId), grammes, unite, saisie: convertirAffichage(grammes, grammesParUnite(eq, unite) || 1) };
  }

  useImperativeHandle(ref, () => ({
    // Recette ouverte → RègleX.
    chargerRecette(id) {
      choisirRecette(String(id), recettes.find((r) => String(r.id) === String(id))?.categorie || "plat");
    },
    // Cuisine du jour → RègleX.
    chargerCuisine(entrees) {
      setSource("cuisine");
      setCollerOuvert(false);
      setIdRecette("");
      reinitialiser();
      setArrivee(true);
      setLignes(entrees.map((e) => ligneResolue(e.food_id, e.nom, e.quantite_g, e.unite)));
    },
  }));

  // Ligne inutile (ex. « sel » sans quantité) : retirée de cette adaptation seulement.
  function retirerLigne(cle) {
    setLignes((liste) => liste.filter((l) => l.cle !== cle));
    if (edition === cle) setEdition(null);
    if (creation?.cle === cle) setCreation(null);
  }

  function choisirAliment(cle, id) {
    const ligne = lignes.find((l) => l.cle === cle);
    if (ligne && id) memoriser(ligne.nomLu, id);
    majLigne(cle, (l) => resoudre(l, parId.get(id)));
  }



  function changerUnite(cle, unite) {
    majLigne(cle, (l) => {
      const ratio = grammesParUnite(equivalences(parId.get(l.alimentId)), unite) || 1;
      return { unite, saisie: l.grammes ? convertirAffichage(l.grammes, ratio) : l.saisie };
    });
  }

  function changerQuantite(cle, valeur) {
    majLigne(cle, (l) => {
      const ratio = grammesParUnite(equivalences(parId.get(l.alimentId)), l.unite) || 1;
      const nombre = Number(String(valeur).replace(",", "."));
      return { saisie: valeur, grammes: nombre > 0 ? nombre * ratio : null };
    });
  }

  function commencerSaisie(ligne) {
    setEdition(ligne.cle);
    const ratio = grammesParUnite(equivalences(parId.get(ligne.alimentId)), ligne.unite) || 1;
    setSaisie(arrondi((ligne.grammes * facteur) / ratio));
  }

  // « J'ai seulement 300 g » : le rapport avec la quantité de la recette s'applique à tout.
  function appliquerSaisie(ligne) {
    const ratio = grammesParUnite(equivalences(parId.get(ligne.alimentId)), ligne.unite) || 1;
    const valeur = Number(String(saisie).replace(",", ".")) * ratio;
    if (valeur > 0 && ligne.grammes > 0) setFacteur(Math.min(20, valeur / ligne.grammes));
    setEdition(null);
  }



  function ouvrirCreation(ligne) {
    const nom = ligne.nomLu.charAt(0).toUpperCase() + ligne.nomLu.slice(1);
    setCreation({ cle: ligne.cle, nom, categorie: "Divers", calories: "", proteines: "", glucides: "", lipides: "", erreur: "" });
  }

  function creerAliment(event) {
    event.preventDefault();
    const c = creation;
    api("/aliments", { method: "POST", body: { nom: c.nom, categorie: c.categorie, calories: c.calories, proteines: c.proteines, glucides: c.glucides, lipides: c.lipides } })
      .then(({ donnees }) => {
        if (donnees?.idExistant) {
          choisirAliment(c.cle, donnees.idExistant);
          setCreation(null);
          return;
        }
        if (donnees?.erreur) {
          setCreation({ ...c, erreur: donnees.erreur });
          return;
        }
        onAlimentCree(donnees.aliment);
        const ligne = lignes.find((l) => l.cle === c.cle);
        if (ligne) memoriser(ligne.nomLu, donnees.aliment.id);
        majLigne(c.cle, (l) => resoudre(l, donnees.aliment));
        setCreation(null);
      })
      .catch(() => setCreation({ ...c, erreur: "Connexion instable : réessaie dans un instant." }));
  }

  function ajouterALaCuisine(event) {
    if (envoi || pretes.length === 0 || aCompleter > 0) return;
    setEnvoi(true);
    const depart = event?.currentTarget?.getBoundingClientRect();
    const ingredients = pretes.map((l) => ({ food_id: l.alimentId, quantite_g: Math.round(l.grammes * facteur * 100) / 100, unite: l.unite }));
    api("/calories/ajouter-ingredients", { method: "POST", body: { ingredients } })
      .then(({ donnees }) => {
        if (donnees?.erreur) {
          alert(donnees.erreur);
          return;
        }
        lancerVers(pretes.map((l) => parId.get(l.alimentId)?.emoji || "🥕"), depart, MARMITE, "recoit");
        onAjoutee(donnees.items);
      })
      .catch((err) => {
        if (err.type !== "session") alert("Une erreur est survenue.");
      })
      .finally(() => setEnvoi(false));
  }

  // Recette collée → formulaire de recette habituel, prérempli avec les quantités de la recette d'origine.
  function enregistrerEnRecette() {
    onEnregistrerRecette(
      pretes.map((l) => {
        const a = parId.get(l.alimentId);
        return {
          food_id: a.id,
          nom: `${a.emoji || ""} ${a.nom}`.trim(),
          quantite_g: String(Math.round(l.grammes * 100) / 100),
          unite: l.unite,
          grammes_par_cuil_a_cafe: a.grammes_par_cuil_a_cafe,
          grammes_par_cuil_a_soupe: a.grammes_par_cuil_a_soupe,
          poids_unite_g: poidsPieceDe(a.tracking_type, a.poids_unite_g, a.unite) || "",
          unite_piece: a.unite,
          emoji: a.emoji,
        };
      })
    );
  }


  return (
    <div id="panneauAdapter" className={"calories-tab-panel" + (actif ? " actif" : "")}>
      <div className="adapter">
        <div className="adapter__sources" role="group" aria-label="Source de la recette">
          <button type="button" className={"btn-ajout-icone" + (source === "coller" && collerOuvert ? " actif" : "")} title="Coller une recette" aria-label="Coller une recette" onClick={() => changerSource("coller")}>
            Coller une recette
          </button>
          {SELECTS_RECETTES.map((sel) => {
            const options = recettes
              .filter((r) => r.categorie === sel.categorie && !r.sortant)
              .sort((a, b) => a.nom.localeCompare(b.nom))
              .map((r) => ({ value: String(r.id), label: r.nom }));
            return (
              <CustomSelect
                key={sel.categorie}
                className={sel.classe + (categorieRecette === sel.categorie && source === "recette" ? " actif" : "")}
                ariaLabel={sel.ariaLabel}
                disabled={options.length === 0}
                value={source === "recette" && categorieRecette === sel.categorie ? idRecette : ""}
                options={[{ value: "", label: "" }, ...options]}
                onChange={(id) => choisirRecette(id, sel.categorie)}
              />
            );
          })}
          <button type="button" id="adapterEffacer" className="btn-x-rond" title="Tout effacer" disabled={lignes.length === 0 && !texte} onClick={effacerTout}>
            Tout effacer
          </button>
        </div>

        {source === "coller" && collerOuvert && (
          <textarea
            id="adapterTexte"
            className="adapter__texte"
            rows={lignes.length ? 3 : 7}
            placeholder="Colle ici les ingrédients d'une recette"
            aria-label="Ingrédients de la recette"
            autoFocus
            value={texte}
            onChange={(e) => lireTexte(e.target.value)}
            onBlur={() => {
              if (lignes.length > 0) setCollerOuvert(false);
            }}
          />
        )}
        {lignes.length === 0 && source === "coller" && !collerOuvert && <IngredientsEnsemble />}

        {lignes.length > 0 && (
          <>
            <div className="adapter__raccourcis" role="group" aria-label="Multiplier la recette">
              {RACCOURCIS.map((r) => (
                <button key={r.facteur} type="button" className={"cat-pill" + (Math.abs(facteur - r.facteur) < 0.001 ? " actif" : "")} onClick={() => setFacteur(r.facteur)}>
                  {r.label}
                </button>
              ))}
              <span className={"adapter__facteur" + (modifie ? " modifie" : "")}>
                {modifie && (
                  <svg className={"adapter__sens" + (facteur > 1 ? " hausse" : "")} viewBox="0 0 12 12" role="img" aria-label={facteur > 1 ? "Recette agrandie" : "Recette réduite"}>
                    <path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" />
                  </svg>
                )}
                {texteFacteur(facteur)}
              </span>
            </div>

            <div className="adapter__entete" aria-hidden="true">
              <span>Recette</span>
              <span></span>
              <span className={modifie ? "modifie" : ""}>Pour toi</span>
            </div>

            <ul className={"adapter__liste" + (arrivee ? " adapter__liste--arrivee" : "") + (vidage ? " adapter__liste--vidage" : "")}>
              {lignes.map((ligne, rang) => {
                const aliment = parId.get(ligne.alimentId);
                const eq = equivalences(aliment);
                const ratio = grammesParUnite(eq, ligne.unite) || 1;
                const label = optionsUnite(eq).find((o) => o.value === ligne.unite)?.label || "g";
                const ordre = [...ligne.candidats, ...alimentsTries.map((a) => String(a.id)).filter((id) => !ligne.candidats.includes(id))].filter((id) => parId.has(id));
                return (
                  <li key={ligne.cle} className={"adapter__ligne" + (ligne.alimentId ? "" : " a-completer")} style={{ "--rang": Math.min(rang, 10) }}>
                    <div className="adapter__aliment">
                      <CustomSelect
                        className="adapter__choix"
                        ariaLabel={`Aliment pour « ${ligne.nomLu} »`}
                        value={ligne.alimentId}
                        options={[{ value: "", label: ligne.candidats.length ? `${ligne.nomLu} ?` : `${ligne.nomLu} : inconnu` }, ...ordre.map((id) => ({ value: id, label: `${parId.get(id).emoji || ""} ${parId.get(id).nom}`.trim() }))]}
                        onChange={(id) => choisirAliment(ligne.cle, id)}
                      />
                      {ligne.note && <span className="adapter__note">{ligne.note}</span>}
                      {!ligne.alimentId && (
                        <button type="button" className="adapter__creer" title={`Ajouter « ${ligne.nomLu} » aux aliments`} aria-label={`Ajouter « ${ligne.nomLu} » aux aliments`} onClick={() => ouvrirCreation(ligne)}>
                          +
                        </button>
                      )}
                    </div>
                    <span className={"adapter__base" + (modifie ? " grisee" : "")}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        aria-label={`Quantité de la recette pour « ${ligne.nomLu} »`}
                        value={ligne.saisie}
                        disabled={!ligne.alimentId}
                        onChange={(e) => changerQuantite(ligne.cle, e.target.value)}
                      />
                      {aliment ? <CustomSelect className="adapter__unite" value={ligne.unite} options={optionsUnite(eq)} onChange={(u) => changerUnite(ligne.cle, u)} /> : <span className="adapter__unite-vide">{label}</span>}
                    </span>
                    <span className="adapter__fleche" aria-hidden="true">→</span>
                    {edition === ligne.cle ? (
                      <span className="adapter__saisie">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          autoFocus
                          aria-label={`Quantité de ${ligne.nomLu} que j'ai`}
                          value={saisie}
                          onChange={(e) => setSaisie(e.target.value)}
                          onBlur={() => appliquerSaisie(ligne)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEdition(null);
                          }}
                        />
                        <span>{label}</span>
                      </span>
                    ) : (
                      <button type="button" className="adapter__qte" disabled={!(ligne.grammes > 0)} onClick={() => commencerSaisie(ligne)}>
                        {/* Clé = facteur : le chiffre est recréé, donc saute, à chaque ×½, ×2… */}
                        <span key={facteur} className={facteurTouche ? "adapter__qte-valeur saute" : "adapter__qte-valeur"}>
                          {ligne.grammes > 0 ? `${arrondi((ligne.grammes * facteur) / ratio)} ${label}` : "—"}
                        </span>
                      </button>
                    )}
                    <button type="button" className="btn-supprimer-dash adapter__retirer" title="Retirer" aria-label={`Retirer « ${ligne.nomLu} »`} onClick={() => retirerLigne(ligne.cle)}>
                      Retirer
                    </button>
                    {creation?.cle === ligne.cle && (
                      <form className="adapter__creation" onSubmit={creerAliment}>
                        <input type="text" aria-label="Nom" value={creation.nom} onChange={(e) => setCreation({ ...creation, nom: e.target.value })} required />
                        <CustomSelect className="adapter__categorie" ariaLabel="Catégorie" value={creation.categorie} options={CATEGORIES.map((c) => ({ value: c, label: c }))} onChange={(c) => setCreation({ ...creation, categorie: c })} />
                        <div className="adapter__valeurs">
                          {[
                            ["calories", "kcal"],
                            ["proteines", "Protéines"],
                            ["glucides", "Glucides"],
                            ["lipides", "Lipides"],
                          ].map(([cle, nom]) => (
                            <label key={cle}>
                              <span>{nom}</span>
                              <input type="number" inputMode="decimal" step="any" min="0" required={cle === "calories"} value={creation[cle]} onChange={(e) => setCreation({ ...creation, [cle]: e.target.value })} />
                            </label>
                          ))}
                        </div>
                        <p className="adapter__aide">Valeurs pour 100 g, celles de l'étiquette.</p>
                        {creation.erreur && <p className="adapter__erreur">{creation.erreur}</p>}
                        <div className="adapter__creation-actions">
                          <button type="button" className="cat-pill" onClick={() => setCreation(null)}>
                            Annuler
                          </button>
                          <button type="submit" className="cat-pill actif">
                            Ajouter
                          </button>
                        </div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="adapter__pied">
              <span className="adapter__kcal">
                <span key={facteur} className={facteurTouche ? "adapter__qte-valeur saute" : "adapter__qte-valeur"}>
                  {Math.round(kcal * facteur)} kcal
                </span>
                {modifie && <s>{Math.round(kcal)} kcal</s>}
              </span>
              {aCompleter > 0 && <span className="adapter__reste">{aCompleter} à compléter</span>}
              {source === "coller" && (
                <button type="button" className="adapter__enregistrer cat-pill" disabled={pretes.length === 0 || aCompleter > 0} onClick={enregistrerEnRecette}>
                  Enregistrer en recette
                </button>
              )}
              <BoutonOutil icone="cuisiner" disabled={envoi || pretes.length === 0 || aCompleter > 0} onClick={ajouterALaCuisine} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
