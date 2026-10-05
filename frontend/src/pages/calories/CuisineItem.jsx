import { useEffect, useRef, useState } from "react";
import CustomSelect from "../../components/CustomSelect.jsx";
import { useTriable } from "../../components/Triable.jsx";
import { useChangeNatif } from "../../hooks/useChangeNatif.js";
import { relancerClasse } from "../../utils/animation.js";
import { convertirAffichage, estLiquide, grammesParUnite, minimumPourUnite, optionsUnite, poidsPieceDe } from "../../utils/unites.js";

export function equivalencesEntree(entree) {
  return {
    gCafe: entree.grammes_par_cuil_a_cafe ?? "",
    gSoupe: entree.grammes_par_cuil_a_soupe ?? "",
    poidsPiece: poidsPieceDe(entree.tracking_type, entree.poids_unite_g, entree.unite_piece) || "",
    unitePiece: entree.unite_piece || "",
    liquide: estLiquide(entree.unite_piece),
  };
}

function uniteDepart(entree, equivalences) {
  return entree.unite && entree.unite !== "g" && grammesParUnite(equivalences, entree.unite) > 0 ? entree.unite : "g";
}

const DELAI_DOUBLE_TAP = 350;
const ZONES_PROPRES = "input, select, button, .custom-select, .poignee-glisser, form";

export default function CuisineItem({ entree, onEnregistrerQuantite, onChangerUnite, onSupprimer, onBasculerAjoute, ref }) {
  const dernierTap = useRef(0);
  const triable = useTriable(entree.id, ref);
  const champ = useRef(null);
  const equivalences = equivalencesEntree(entree);
  const [unite, setUnite] = useState(() => uniteDepart(entree, equivalences));
  const [saisie, setSaisie] = useState(() => convertirAffichage(parseFloat(entree.quantite_g), grammesParUnite(equivalences, unite)));
  const [minimum, setMinimum] = useState(() => minimumPourUnite(grammesParUnite(equivalences, unite)));
  const grammes = useRef(Number(parseFloat(entree.quantite_g)));
  const kcal = useRef(null);
  const [arrivee, setArrivee] = useState(!!entree.effets.entree);
  const kcalPrecedentes = useRef(entree.calories_calc);
  useEffect(() => {
    if (kcalPrecedentes.current !== entree.calories_calc) relancerClasse(kcal.current, "kcal-saut");
    kcalPrecedentes.current = entree.calories_calc;
  }, [entree.calories_calc]);

  function changerUnite(nouvelle) {
    const ratio = grammesParUnite(equivalences, nouvelle);
    setUnite(nouvelle);
    setSaisie(convertirAffichage(grammes.current, ratio));
    setMinimum(minimumPourUnite(ratio));
    onChangerUnite(nouvelle);
  }

  useChangeNatif(champ, () => {
    const ratio = grammesParUnite(equivalences, unite);
    const valeur = Number(champ.current.value);
    if (!valeur || valeur <= 0 || !ratio) return;
    const nouvelle = valeur * ratio;
    onEnregistrerQuantite(nouvelle, unite).then((reussi) => {
      if (reussi) grammes.current = nouvelle;
    });
  });

  const classes = ["journal-item", "carte-article"];
  if (arrivee) classes.push("arrivee");
  if (entree.effets.miseEnAvant) classes.push("mise-en-avant");
  if (entree.effets.disparait) classes.push(entree.effets.chute ? "disparait chute" : "disparait");
  if (entree.effets.saut) classes.push("saut");
  if (entree.ajoute) classes.push("ajoute");

  function surTap(event) {
    if (event.target.closest(ZONES_PROPRES)) return;
    const maintenant = Date.now();
    if (maintenant - dernierTap.current < DELAI_DOUBLE_TAP) {
      dernierTap.current = 0;
      onBasculerAjoute();
    } else {
      dernierTap.current = maintenant;
    }
  }

  return (
    <div ref={triable.refNoeud} className={classes.join(" ") + triable.classe} style={entree.effets.rang ? { ...triable.style, "--rang": entree.effets.rang } : triable.style} onClick={surTap} onAnimationEnd={(e) => e.animationName === "cuisineTombe" && setArrivee(false)}>
      {triable.poignee}
      <div className="journal-nom-groupe">
        <span className="journal-nom">
          {entree.ajoute && <span className="journal-coche" aria-label="Ajouté au plat">✓ </span>}
          {entree.emoji} {entree.nom}
        </span>
        <span className="journal-categorie">{entree.categorie}</span>
      </div>
      <div className="journal-valeurs">
        <div className="journal-quantite-groupe">
          <input ref={champ} type="number" className="journal-grammes-input" step="any" value={saisie} min={minimum} onChange={(e) => setSaisie(e.target.value)} />
          <CustomSelect className="journal-unite-select" value={unite} options={optionsUnite(equivalences)} onChange={changerUnite} />
        </div>
        <span ref={kcal} className="journal-kcal">{Number(entree.calories_calc).toFixed(0)} kcal</span>
      </div>
      <form
        className="form-supprimer-journal"
        onSubmit={(e) => {
          e.preventDefault();
          onSupprimer();
        }}
      >
        <button type="submit" className="btn-supprimer-dash">Supprimer</button>
      </form>
    </div>
  );
}
