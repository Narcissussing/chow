import { useState } from "react";
import { OPTIONS_CL } from "../../utils/stock.js";
import "./StockSuggestions.css";

const PREMIERS = 5;

function texteNiveau(s) {
  if (s.quantite === null || s.quantite === undefined) return "épuisé";
  if (s.tracking_type === "cl") return OPTIONS_CL.find((o) => o.value === s.quantite)?.label.toLowerCase() ?? s.quantite;
  return Number(s.quantite) === 0 ? "épuisé" : `${s.quantite} restant${Number(s.quantite) > 1 ? "s" : ""}`;
}

export function BoutonRacheter({ suggestions, ouvert, onBasculer }) {
  if (suggestions.length === 0) return null;
  return (
    <button type="button" className={"btn-racheter" + (ouvert ? " actif" : "")} title="À racheter" aria-label="À racheter" aria-expanded={ouvert} aria-controls="stockSuggestions" onClick={onBasculer}>
      <span className="btn-racheter__icone" aria-hidden="true"></span>
    </button>
  );
}

export default function StockSuggestions({ suggestions, onAjouter }) {
  const [tout, setTout] = useState(false);
  if (suggestions.length === 0) return null;
  const visibles = tout ? suggestions : suggestions.slice(0, PREMIERS);
  return (
    <div className="stock-suggestions-zone">
      <section id="stockSuggestions" className="stock-suggestions" aria-label="À racheter">
        <ul className="stock-suggestions__liste">
          {visibles.map((s) => (
            <li key={s.food_id} className={"stock-suggestions__ligne" + (s.envoye ? " envoye" : "")} data-food={s.food_id}>
              <span className="stock-suggestions__nom">
                {s.emoji} {s.nom}
              </span>
              <span className="stock-suggestions__niveau">{texteNiveau(s)}</span>
              <span className="stock-suggestions__frequence">{s.achats_30j > 0 ? `${s.achats_30j}× ce mois` : `acheté ${s.achats_total}×`}</span>
              <button type="button" className="btn-ajout-icone" title="Ajouter aux courses" aria-label={`Ajouter « ${s.nom} » aux courses`} disabled={s.envoye} onClick={() => onAjouter(s)}>
                Ajouter aux courses
              </button>
            </li>
          ))}
        </ul>
        {suggestions.length > PREMIERS && (
          <button type="button" className="stock-suggestions__plus" onClick={() => setTout((t) => !t)}>
            {tout ? "Moins" : `${suggestions.length - PREMIERS} de plus`}
          </button>
        )}
      </section>
    </div>
  );
}
