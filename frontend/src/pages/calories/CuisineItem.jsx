import { useRef, useState } from "react";
import CustomSelect from "../../components/CustomSelect.jsx";
import { useTriable } from "../../components/Triable.jsx";
import { useChangeNatif } from "../../hooks/useChangeNatif.js";
import { convertirAffichage, grammesParUnite, minimumPourUnite, optionsUnite, poidsPieceDe } from "../../utils/unites.js";

// Équivalences d'une entrée : mêmes valeurs que les data-* de calories.ejs.
export function equivalencesEntree(entree) {
  return {
    gCafe: entree.grammes_par_cuil_a_cafe ?? "",
    gSoupe: entree.grammes_par_cuil_a_soupe ?? "",
    poidsPiece: poidsPieceDe(entree.tracking_type, entree.poids_unite_g) || "",
    unitePiece: entree.unite_piece || "",
  };
}

export default function CuisineItem({ entree, onEnregistrerQuantite, onSupprimer, ref }) {
  const triable = useTriable(entree.id, ref);
  const champ = useRef(null);
  const equivalences = equivalencesEntree(entree);
  const [saisie, setSaisie] = useState(() => String(parseFloat(entree.quantite_g)));
  const [unite, setUnite] = useState("g");
  const [minimum, setMinimum] = useState("0.25");
  // La vraie donnée reste les grammes ; le champ peut afficher "0.5" c. à café pour 2.5 g.
  const grammes = useRef(Number(parseFloat(entree.quantite_g)));

  function changerUnite(nouvelle) {
    const ratio = grammesParUnite(equivalences, nouvelle);
    setUnite(nouvelle);
    setSaisie(convertirAffichage(grammes.current, ratio));
    setMinimum(minimumPourUnite(ratio));
  }

  // "change" natif : à la sortie du champ modifié, pas à chaque frappe ; toujours envoyé en grammes.
  useChangeNatif(champ, () => {
    const ratio = grammesParUnite(equivalences, unite);
    const valeur = Number(champ.current.value);
    if (!valeur || valeur <= 0 || !ratio) return;
    const nouvelle = valeur * ratio;
    onEnregistrerQuantite(nouvelle).then((reussi) => {
      if (reussi) grammes.current = nouvelle;
    });
  });

  const classes = ["journal-item", "carte-article"];
  if (entree.effets.entree) classes.push("entree");
  if (entree.effets.miseEnAvant) classes.push("mise-en-avant");
  if (entree.effets.disparait) classes.push("disparait");

  return (
    <div ref={triable.refNoeud} className={classes.join(" ") + triable.classe} style={triable.style}>
      {triable.poignee}
      <div className="journal-nom-groupe">
        <span className="journal-nom">
          {entree.emoji} {entree.nom}
        </span>
        <span className="journal-categorie">{entree.categorie}</span>
      </div>
      <div className="journal-valeurs">
        <div className="journal-quantite-groupe">
          <input ref={champ} type="number" className="journal-grammes-input" step="any" value={saisie} min={minimum} onChange={(e) => setSaisie(e.target.value)} />
          <CustomSelect className="journal-unite-select" value={unite} options={optionsUnite(equivalences)} onChange={changerUnite} />
        </div>
        <span className="journal-kcal">{Number(entree.calories_calc).toFixed(0)} kcal</span>
      </div>
      <form
        action="/calories/supprimer"
        method="post"
        className="form-supprimer-journal"
        onSubmit={(e) => {
          e.preventDefault();
          onSupprimer();
        }}
      >
        <input type="hidden" name="idEntree" value={entree.id} />
        <button type="submit" className="btn-supprimer-dash">Supprimer</button>
      </form>
    </div>
  );
}
