import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Page from "../../components/Page.jsx";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { usePageData } from "../../hooks/usePageData.js";
import Cuisine from "./cuisine/Cuisine.jsx";
import Recettes from "./recettes/Recettes.jsx";
import BadgeCompteur from "../../components/BadgeCompteur.jsx";
import AdapterRecette from "./reglex/AdapterRecette.jsx";
import RecetteSheet from "./recettes/RecetteSheet.jsx";
import "./CaloriesPage.css";

let compteurCles = 0;
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
  const badge = useRef(null);
  const avantDeplacement = useRef(null);
  const compacteActuelle = useRef(false);
  const [bascule, setBascule] = useState(false);
  const [entrees, setEntrees] = useState(() => donnees.journal.map((e) => ({ ...e, effets: {} })));
  const [recettes, setRecettes] = useState(() => donnees.recettes.map(avecCle));
  const [aliments, setAliments] = useState(donnees.aliments);
  const [selects, setSelects] = useState(() => {
    const etat = (categorie) => {
      const aucune = !donnees.recettes.some((r) => r.categorie === categorie);
      return { desactive: aucune, texteVide: aucune };
    };
    return { plat: etat("plat"), fraicheur: etat("fraicheur") };
  });

  const alimentsTries = [...aliments].sort((a, b) => a.nom.localeCompare(b.nom));

  useEffect(() => {
    function appliquerCompacte(valeur) {
      if (compacteActuelle.current === valeur) return;
      compacteActuelle.current = valeur;
      avantDeplacement.current = badge.current?.getBoundingClientRect() ?? null;
      setBascule(false);
      setCompacte(valeur);
    }
    function majCompacte() {
      if (!window.matchMedia?.("(max-width: 768px)").matches) {
        appliquerCompacte(false);
        return;
      }
      const hauteurHeader = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 57;
      appliquerCompacte(sentinelle.current ? sentinelle.current.getBoundingClientRect().top <= hauteurHeader : false);
    }
    majCompacte();
    window.addEventListener("scroll", majCompacte, { passive: true });
    window.addEventListener("resize", majCompacte);
    return () => {
      window.removeEventListener("scroll", majCompacte);
      window.removeEventListener("resize", majCompacte);
    };
  }, []);

  useLayoutEffect(() => {
    const avant = avantDeplacement.current;
    avantDeplacement.current = null;
    const element = badge.current;
    if (!avant || !element || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const apres = element.getBoundingClientRect();
    if (!apres.width) return;
    element.style.transition = "none";
    element.style.transform = `translate(${avant.left - apres.left}px, ${avant.top - apres.top}px) scale(${avant.width / apres.width}, ${avant.height / apres.height})`;
    void element.offsetWidth;
    element.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
    element.style.transform = "";
  }, [compacte]);

  function changerOnglet(suivant) {
    if ((suivant === "adapter") !== (onglet === "adapter")) setBascule(true);
    setOnglet(suivant);
  }

  const nbCuisine = entrees.filter((e) => !e.effets.disparait).length;
  const badgeTitre =
    onglet === "adapter" ? (
      <BadgeCompteur key="regle" ref={badge} icone="regle" nombre={nbRegleX} label="Ingrédients dans RègleX" className={bascule ? "bascule" : ""} />
    ) : (
      <BadgeCompteur key="cuisine" ref={badge} icone="cuisine" nombre={nbCuisine} label="Aliments dans la Cuisine du jour" className={bascule ? "bascule" : ""} />
    );

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
            {!compacte && badgeTitre}
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
            {compacte && badgeTitre}
          </div>

          <div className="calories-tabs">
            <button type="button" className={"calories-tab-btn" + (onglet === "journal" ? " actif" : "")} onClick={() => changerOnglet("journal")}>
              Cuisine
            </button>
            <button type="button" className={"calories-tab-btn" + (onglet === "recettes" ? " actif" : "")} onClick={() => changerOnglet("recettes")}>
              Recettes
            </button>
            <button type="button" id="ongletAdapter" className={"calories-tab-btn" + (onglet === "adapter" ? " actif" : "")} onClick={() => changerOnglet("adapter")}>
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
              changerOnglet("adapter");
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
              changerOnglet("journal");
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
          changerOnglet("adapter");
          regleX.current.chargerRecette(id);
        }}
        onAjouteeCuisine={(items) => {
          setEntrees(items.map((item, i) => ({ ...item, effets: { entree: true, rang: Math.min(i, 10) + 5 } })));
          changerOnglet("journal");
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
