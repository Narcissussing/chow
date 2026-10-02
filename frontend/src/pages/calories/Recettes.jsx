import { useEffect, useState } from "react";
import { useLocalStorage } from "../../hooks/useLocalStorage.js";

export const CATEGORIES_RECETTE = [
  { valeur: "plat", label: "Plats" },
  { valeur: "fraicheur", label: "Fraîcheur" },
];

const ICONES_TRI = {
  nom: { asc: "/images/svg/tri-alpha-asc.svg", desc: "/images/svg/tri-alpha-desc.svg" },
  kcal: { asc: "/images/svg/calorie-asc.svg", desc: "/images/svg/calorie-desc.svg" },
};

// Même tri que trierGrilleRecettes : stable sur l'ordre courant, nom en minuscules ou kcal en nombre.
function trier(recettes, { critere, direction }) {
  return [...recettes].sort((a, b) => {
    if (critere === "nom") {
      const [na, nb] = [a.nom.toLowerCase(), b.nom.toLowerCase()];
      return direction === "asc" ? na.localeCompare(nb) : nb.localeCompare(na);
    }
    const [ka, kb] = [Number(a.kcal_total), Number(b.kcal_total)];
    return direction === "asc" ? ka - kb : kb - ka;
  });
}

// 3 premiers émojis d'ingrédients, repli sur l'icône de catégorie.
function IconeRecette({ recette }) {
  const emojis = recette.emoji_combo ?? (recette.emojis_ingredients || []).slice(0, 3).join("");
  return <span className="recette-emoji">{emojis || <span className={"icone-categorie-recette icone-categorie-recette--" + recette.categorie}></span>}</span>;
}

function GroupeRecettes({ categorie, recettes, onOuvrir, onNouvelle }) {
  const [tri, setTri] = useState({ critere: "nom", direction: "asc" });
  const [vue, setVue] = useLocalStorage("vueRecettes-" + categorie.valeur, (v) => (v === "liste" ? "liste" : "grille"));
  // Ordre affiché par clé de carte : une carte modifiée est recréée en fin de grille puis retriée, comme en EJS.
  const [ordre, setOrdre] = useState(() => trier(recettes, tri).map((r) => r.cle));

  const parCle = Object.fromEntries(recettes.map((r) => [r.cle, r]));
  const cles = recettes.map((r) => r.cle).join("|");
  useEffect(() => {
    setOrdre((actuel) => {
      const gardees = actuel.filter((c) => parCle[c]);
      const nouvelles = recettes.map((r) => r.cle).filter((c) => !actuel.includes(c));
      if (nouvelles.length === 0 && gardees.length === actuel.length) return actuel;
      return trier([...gardees, ...nouvelles].map((c) => parCle[c]), tri).map((r) => r.cle);
    });
  }, [cles]);

  function cliquerTri(critere) {
    const suivant = critere === tri.critere ? { critere, direction: tri.direction === "asc" ? "desc" : "asc" } : { critere, direction: "asc" };
    setTri(suivant);
    setOrdre((actuel) => trier(actuel.map((c) => parCle[c]).filter(Boolean), suivant).map((r) => r.cle));
  }

  return (
    <section className="recette-groupe" data-vue={vue}>
      <h3 className="recette-groupe-titre">
        <div className="recette-tri-icones">
          {[
            ["nom", "Trier par nom"],
            ["kcal", "Trier par calories"],
          ].map(([critere, titre]) => {
            const actif = critere === tri.critere;
            return (
              <button key={critere} type="button" className={"recette-tri-icone" + (actif ? " actif" : "")} title={titre} onClick={() => cliquerTri(critere)}>
                <img src={ICONES_TRI[critere][actif ? tri.direction : "asc"]} alt={titre} />
              </button>
            );
          })}
        </div>
        <span className="recette-groupe-nom">
          <span className={"icone-categorie-recette icone-categorie-recette--" + categorie.valeur}></span> {categorie.label}
        </span>
        <div className="recette-vue-icones">
          {/* data-vue choisit l'icône dans le CSS (.recette-vue-icone[data-vue="…"]::before). */}
          <button type="button" className={"recette-vue-icone" + (vue === "grille" ? " active" : "")} data-vue="grille" title="Vue grille" onClick={() => setVue("grille")}></button>
          <button type="button" className={"recette-vue-icone" + (vue === "liste" ? " active" : "")} data-vue="liste" title="Vue liste" onClick={() => setVue("liste")}></button>
        </div>
      </h3>
      <div className={"recette-grid" + (vue === "liste" ? " vue-liste" : "")}>
        {ordre
          .map((c) => parCle[c])
          .filter(Boolean)
          .map((recette) => (
            <div key={recette.cle} className={"recette-card" + (recette.sortant ? " disparait" : "")} onClick={() => onOuvrir(recette.id, recette.nb_ingredients, recette.kcal_total)}>
              <IconeRecette recette={recette} />
              <div className="recette-corps">
                <p className="recette-nom">{recette.nom}</p>
                <div className="recette-sub">
                  <span className="recette-ingr">{recette.nb_ingredients} ingr.</span>
                  <span className="recette-kcal">{recette.kcal_total} kcal</span>
                </div>
              </div>
            </div>
          ))}
        <div className="recette-card recette-new-card btn-nouvelle-recette" onClick={() => onNouvelle(categorie.valeur)}>
          <span className="recette-new-plus"></span>
          <span>Nouvelle recette</span>
        </div>
      </div>
    </section>
  );
}

export default function Recettes({ actif, recettes, onOuvrir, onNouvelle }) {
  return (
    <div className={"calories-tab-panel" + (actif ? " actif" : "")}>
      {CATEGORIES_RECETTE.map((categorie) => (
        <GroupeRecettes
          key={categorie.valeur}
          categorie={categorie}
          recettes={recettes.filter((r) => r.categorie === categorie.valeur)}
          onOuvrir={onOuvrir}
          onNouvelle={onNouvelle}
        />
      ))}
    </div>
  );
}
