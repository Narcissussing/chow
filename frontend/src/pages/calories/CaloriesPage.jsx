import { useEffect, useRef, useState } from "react";
import Page from "../../components/Page.jsx";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { usePageData } from "../../hooks/usePageData.js";
import Cuisine from "./Cuisine.jsx";
import Recettes from "./Recettes.jsx";
import BadgeCompteur from "../../components/BadgeCompteur.jsx";
import AdapterRecette from "./AdapterRecette.jsx";
import RecetteSheet from "./RecetteSheet.jsx";

let compteurCles = 0;
// Clé de carte : une recette modifiée reçoit une nouvelle clé, sa carte est recréée en fin de grille (comme en EJS).
const avecCle = (recette) => ({ ...recette, cle: `${recette.id}-${++compteurCles}` });

function Calories({ donnees }) {
  const planifier = useMinuteurs();
  const sentinelle = useRef(null);
  const totaux = useRef(null);
  const sheet = useRef(null);
  const regleX = useRef(null);
  const [onglet, setOnglet] = useState("journal");
  const [nbRegleX, setNbRegleX] = useState(0);
  const [compacte, setCompacte] = useState(false);
  const [entrees, setEntrees] = useState(() => donnees.journal.map((e) => ({ ...e, effets: {} })));
  const [recettes, setRecettes] = useState(() => donnees.recettes.map(avecCle));
  // État (et non donnees) : un aliment créé depuis RègleX doit apparaître partout tout de suite.
  const [aliments, setAliments] = useState(donnees.aliments);
  // Un sélecteur vide au chargement reste actif dès sa première recette, même si on la supprime ensuite.
  const [selects, setSelects] = useState(() => {
    const etat = (categorie) => {
      const aucune = !donnees.recettes.some((r) => r.categorie === categorie);
      return { desactive: aucune, texteVide: aucune };
    };
    return { plat: etat("plat"), fraicheur: etat("fraicheur") };
  });

  const alimentsTries = [...aliments].sort((a, b) => a.nom.localeCompare(b.nom));

  // Sur mobile, le résumé complet se réduit aux calories une fois collé sous le header.
  useEffect(() => {
    function majCompacte() {
      if (!window.matchMedia?.("(max-width: 768px)").matches) {
        setCompacte(false);
        return;
      }
      const hauteurHeader = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 57;
      setCompacte(sentinelle.current ? sentinelle.current.getBoundingClientRect().top <= hauteurHeader : false);
    }
    majCompacte();
    window.addEventListener("scroll", majCompacte, { passive: true });
    window.addEventListener("resize", majCompacte);
    return () => {
      window.removeEventListener("scroll", majCompacte);
      window.removeEventListener("resize", majCompacte);
    };
  }, []);

  // Totaux depuis les entrées encore présentes (les lignes "disparait" ne comptent plus).
  const somme = (cle) => entrees.filter((e) => !e.effets.disparait).reduce((total, e) => total + Number(e[cle]), 0);

  function recetteEnregistree(recette, ancienId) {
    setRecettes((liste) => [...liste.filter((r) => r.id !== ancienId), { ...avecCle(recette), nouvelle: true }]);
    setSelects((s) => (s[recette.categorie].desactive ? { ...s, [recette.categorie]: { desactive: false, texteVide: false } } : s));
  }

  function recetteSupprimee(id) {
    setRecettes((liste) => liste.map((r) => (r.id === id ? { ...r, sortant: true } : r)));
    planifier(() => setRecettes((liste) => liste.filter((r) => r.id !== id)), 300);
  }

  return (
    <>
      <main>
        <div className="journal-section">
          <div className="titre-page">
            <h1>Calories</h1>
            {/* Balance et ingrédients de RègleX sur son onglet, marmite et aliments de la Cuisine ailleurs ; clé = icône pour rejouer l'entrée au changement. */}
            {onglet === "adapter" ? (
              <BadgeCompteur key="regle" icone="regle" nombre={nbRegleX} label="Ingrédients dans RègleX" />
            ) : (
              <BadgeCompteur key="cuisine" icone="cuisine" nombre={entrees.filter((e) => !e.effets.disparait).length} label="Aliments dans la Cuisine du jour" />
            )}
          </div>

          <div className="journal-totaux-sentinel" aria-hidden="true" ref={sentinelle}></div>
          <div className={"journal-totaux" + (compacte ? " compacte" : "")} ref={totaux}>
            <div className="macro-card macro-calories">
              <span className="macro-valeur" id="totalKcal">{somme("calories_calc").toFixed(0)}</span>
              <span className="macro-label">kcal</span>
            </div>
            <div className="macro-card">
              <span className="macro-valeur" id="totalGlucides">{somme("glucides_calc").toFixed(1)}g</span>
              <span className="macro-label">Glucides</span>
            </div>
            <div className="macro-card">
              <span className="macro-valeur" id="totalProteines">{somme("proteines_calc").toFixed(1)}g</span>
              <span className="macro-label">Protéines</span>
            </div>
            <div className="macro-card">
              <span className="macro-valeur" id="totalLipides">{somme("lipides_calc").toFixed(1)}g</span>
              <span className="macro-label">Lipides</span>
            </div>
          </div>

          <div className="calories-tabs">
            <button type="button" className={"calories-tab-btn" + (onglet === "journal" ? " actif" : "")} onClick={() => setOnglet("journal")}>
              Cuisine
            </button>
            <button type="button" className={"calories-tab-btn" + (onglet === "recettes" ? " actif" : "")} onClick={() => setOnglet("recettes")}>
              Recettes
            </button>
            <button type="button" id="ongletAdapter" className={"calories-tab-btn" + (onglet === "adapter" ? " actif" : "")} onClick={() => setOnglet("adapter")}>
              RègleX
            </button>
          </div>

          <Cuisine
            actif={onglet === "journal"}
            entrees={entrees}
            setEntrees={setEntrees}
            aliments={aliments}
            recettes={recettes}
            selects={selects}
            onEnregistrerRecette={(ingredients) => sheet.current.ouvrirCreation({ ingredients })}
            onEnvoyerRegleX={(entreesDuJour) => {
              setOnglet("adapter");
              regleX.current.chargerCuisine(entreesDuJour);
            }}
          />

          <Recettes
            actif={onglet === "recettes"}
            recettes={recettes}
            onOuvrir={(id, nb, kcal) => sheet.current.ouvrirLecture(id, nb, kcal)}
            onNouvelle={(categorie) => sheet.current.ouvrirCreation({ categorie })}
          />

          <AdapterRecette
            ref={regleX}
            actif={onglet === "adapter"}
            recettes={recettes}
            aliments={aliments}
            onEnregistrerRecette={(ingredients) => sheet.current.ouvrirCreation({ ingredients })}
            onAlimentCree={(aliment) => setAliments((liste) => [...liste, aliment])}
            onNombre={setNbRegleX}
            onAjoutee={(items) => {
              setEntrees(items.map((item, i) => ({ ...item, effets: { entree: true, rang: Math.min(i, 10) + 5 } })));
              setOnglet("journal");
            }}
          />
        </div>
      </main>

      <RecetteSheet
        ref={sheet}
        aliments={alimentsTries}
        onEnregistree={recetteEnregistree}
        onSupprimee={recetteSupprimee}
        onEnvoyerRegleX={(id) => {
          setOnglet("adapter");
          regleX.current.chargerRecette(id);
        }}
        onAjouteeCuisine={(items) => {
          setEntrees(items.map((item, i) => ({ ...item, effets: { entree: true, rang: Math.min(i, 10) + 5 } })));
          setOnglet("journal");
        }}
      />
    </>
  );
}

export default function CaloriesPage() {
  const { etat, donnees } = usePageData("/calories");
  return (
    <Page titre="Calories" etat={etat}>
      {donnees && <Calories donnees={donnees} />}
    </Page>
  );
}
