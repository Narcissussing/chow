import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useVerrouDefilement } from "../../hooks/useVerrouDefilement.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";
import { MiniCourbe } from "./graphiques.jsx";

// Ligne de « Les prix », dans la carte comme dans la liste complète.
export function LignePrix({ p, i = 0, euros, signe, onOuvrir }) {
  return (
    <li className="prix__entree" style={{ "--i": i }}>
      <button type="button" className="prix__ligne" onClick={() => onOuvrir(p.id)}>
        <span className="prix__tuile" aria-hidden="true">{p.emoji}</span>
        <span className="prix__nom"><b className="nom-defile">{p.nom}</b><span className="discret">{euros(p.depense)} dépensés</span></span>
        <MiniCourbe valeurs={p.courbe} hausse={p.variation} />
        <span className="prix__valeur">{euros(p.prix, 2)}{p.unite ? " / " + p.unite : ""}</span>
        <span className={"puce " + (p.variation > 0 ? "puce--hausse" : p.variation < 0 ? "puce--baisse" : "")}>{p.variation ? signe(p.variation) + " %" : "="}</span>
      </button>
    </li>
  );
}

// Tous les produits dans une feuille qui se ferme (✕, fond, Échap) : feuille en bas sur téléphone, panneau à droite sur ordinateur.
export default function ListeProduits({ produits, controles, euros, signe, ficheOuverte, onOuvrir, onFermer }) {
  const zone = useRef(null);
  const [ferme, fermer] = useFermetureAnimee(onFermer);
  // La fiche d'un produit s'ouvre par-dessus : c'est elle qui bloque alors le défilement.
  useVerrouDefilement(!ficheOuverte, zone);

  useEffect(() => {
    if (ficheOuverte) return;
    const echap = (e) => e.key === "Escape" && fermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [ficheOuverte, fermer]);

  return createPortal(
    <div className={"fiche-fond fiche-fond--liste" + (ferme ? " ferme" : "")} onClick={fermer}>
      <aside ref={zone} className={"fiche fiche--liste" + (ferme ? " ferme" : "")} role="dialog" aria-modal="true" aria-label="Tous les produits" onClick={(e) => e.stopPropagation()}>
        <span className="fiche__poignee" aria-hidden="true" />
        <header className="liste-produits__entete">
          <h2>Les prix <span className="discret">{produits.length}</span></h2>
          <button type="button" className="fiche__fermer" aria-label="Fermer" onClick={fermer}>✕</button>
        </header>
        <div className="prix__entete liste-produits__controles">{controles}</div>
        <ul className="prix__liste liste-produits__liste">
          {produits.map((p, i) => <LignePrix key={p.id} p={p} i={Math.min(i, 12)} euros={euros} signe={signe} onOuvrir={onOuvrir} />)}
        </ul>
        {produits.length === 0 && <p className="vide">Aucun produit pour cette recherche.</p>}
      </aside>
    </div>,
    document.body
  );
}
