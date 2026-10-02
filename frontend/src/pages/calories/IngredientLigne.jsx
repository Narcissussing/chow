import CustomSelect from "../../components/CustomSelect.jsx";
import { convertirAffichage, grammesParUnite, minimumPourUnite, optionsUnite } from "../../utils/unites.js";
import { BoutonsReordre } from "./CuisineItem.jsx";

// Comme le Journal/Cuisine : la vraie donnée reste les grammes, l'unité n'est qu'une façon de la saisir.
export function changerSaisieLigne(ligne, saisie) {
  return { ...ligne, saisie, grammes: Number(saisie) * grammesParUnite(ligne, ligne.unite) };
}

export function changerUniteLigne(ligne, unite) {
  const ratio = grammesParUnite(ligne, unite);
  if (!ratio) return { ...ligne, unite };
  return { ...ligne, unite, saisie: convertirAffichage(ligne.grammes, ratio), minimum: minimumPourUnite(ratio) };
}

export default function IngredientLigne({ ligne, premier, dernier, onMonter, onDescendre, onChanger, onRetirer, refLigne, refQuantite }) {
  // "entree" n'est jamais retirée ici, comme dans calories.js (§3.2-12).
  return (
    <div ref={refLigne} className={"ligne-ingredient-recette entree" + (ligne.sortant ? " disparait" : "")}>
      <BoutonsReordre premier={premier} dernier={dernier} onMonter={onMonter} onDescendre={onDescendre} />
      <span className="ingredient-nom-recette">{ligne.nom}</span>
      <input
        ref={refQuantite}
        type="number"
        className="ingredient-quantite-recette"
        step="any"
        min={ligne.minimum}
        placeholder="g"
        value={ligne.saisie}
        onChange={(e) => onChanger(changerSaisieLigne(ligne, e.target.value))}
      />
      <CustomSelect className="ingredient-unite-recette" value={ligne.unite} options={optionsUnite(ligne)} onChange={(unite) => onChanger(changerUniteLigne(ligne, unite))} />
      <button type="button" className="btn-supprimer-dash ingredient-x-recette" title="Retirer" onClick={onRetirer}></button>
    </div>
  );
}
