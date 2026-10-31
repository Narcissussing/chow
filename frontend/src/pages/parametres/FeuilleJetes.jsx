import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api.js";
import BoutonFermer from "../../components/BoutonFermer.jsx";
import CustomSelect from "../../components/CustomSelect.jsx";
import { useVerrouDefilement } from "../../hooks/useVerrouDefilement.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";
import { useGlisserPourFermer } from "../../hooks/useGlisserPourFermer.js";
import { NombreAnime } from "../stats/animations.js";
import "../stats/FeuilleTickets.css";
import "../stats/FeuillePlan.css";
import "./FeuilleJetes.css";

const euros = (n) => (n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const nombre = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR");
const quantite = (n, unite) => (unite === "kg" ? `${nombre(n)} kg` : nombre(n));
// Unité du ticket : au kilo, ou ce que vaut « 1 » tel qu'acheté (sachet de 125 g, boîte de 12), avec son prix payé.
function uniteTicket(l) {
  const prix = l.prixUnite ? (l.prixUnite).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : null;
  if (l.unite === "kg") return prix ? `${prix} / kg` : "au kilo";
  const quoi = l.format ? (/[a-z]/.test(l.format) ? `1 = ${l.format}` : `1 = lot de ${l.format}`) : "1 = 1 acheté";
  return prix ? `${quoi} · ${prix}` : quoi;
}
// Au poids, un quart de kilo à la fois ; sinon un par un.
const pas = (unite) => (unite === "kg" ? 0.25 : 1);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const decalerMois = (m, n) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const titreMois = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

// Aliments jetés sur un mois : quantité par aliment, ce que ça a coûté, et ce qu'il vaudrait mieux acheter en moins.
export default function FeuilleJetes({ onFermer }) {
  const zone = useRef(null);
  const [ferme, fermer] = useFermetureAnimee(onFermer);
  const [mois, setMois] = useState(moisCourant);
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(false);
  useVerrouDefilement(true, zone);
  useGlisserPourFermer(zone, fermer, true);

  const charger = (m) => api("/jetes?mois=" + m).then(({ statut, donnees }) => (statut === 200 ? setDonnees(donnees) : setErreur(true))).catch(() => setErreur(true));
  useEffect(() => { charger(mois); }, [mois]);
  useEffect(() => {
    const echap = (e) => e.key === "Escape" && fermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [fermer]);

  // La quantité change tout de suite à l'écran, puis le mois est relu (montants et total viennent du serveur).
  function changer(ligne, valeur) {
    const q = Math.max(0, Math.round(valeur * 100) / 100);
    setDonnees((d) => ({ ...d, lignes: d.lignes.map((l) => (l.id === ligne.id ? { ...l, quantite: q } : l)) }));
    api("/jetes", { method: "POST", body: { article: ligne.id, mois, quantite: q, unite: ligne.unite } }).then(() => charger(mois)).catch(() => setErreur(true));
  }

  function ajouter(id) {
    const a = donnees.autres.find((x) => x.id === id);
    if (!a) return;
    setDonnees((d) => ({ ...d, lignes: [...d.lignes, { id: a.id, nom: a.nom, emoji: null, unite: a.unite, quantite: 0, montant: 0, nouveau: true }], autres: d.autres.filter((x) => x.id !== id) }));
  }

  const ajustes = donnees ? donnees.lignes.filter((l) => l.quantite > 0 && l.habitudeMois) : [];

  return createPortal(
    <div className={"fiche-fond fiche-fond--liste" + (ferme ? " ferme" : "")} onClick={fermer}>
      <aside ref={zone} className={"fiche fiche--liste tickets jetes" + (ferme ? " ferme" : "")} role="dialog" aria-modal="true" aria-label="Aliments jetés" onClick={(e) => e.stopPropagation()}>
        <span className="fiche__poignee poignee-feuille" aria-hidden="true" />
        <header className="tickets__entete" data-entete-feuille>
          <span className="jetes__icone" aria-hidden="true" />
          <span className="tickets__titre"><h2>Aliments jetés</h2><span className="discret">Pour ajuster les Courses</span></span>
          <BoutonFermer onClick={fermer} />
        </header>
        <div className="tickets__defile">
          <div className="jetes__entete">
            <div className="tickets__periode">
              <button type="button" aria-label="Mois précédent" onClick={() => setMois((m) => decalerMois(m, -1))}>‹</button>
              <span>{titreMois(mois)}</span>
              <button type="button" aria-label="Mois suivant" style={{ visibility: mois < moisCourant() ? "visible" : "hidden" }} onClick={() => setMois((m) => decalerMois(m, 1))}>›</button>
            </div>
            {donnees && <b className="jetes__total"><NombreAnime valeur={donnees.total} format={euros} /> jetés</b>}
          </div>
          {erreur && !donnees && <p className="vide">Indisponible pour le moment.</p>}
          {donnees && (
            <ul className="tickets__liste" key={mois}>
              {donnees.lignes.map((l, i) => (
                <li key={l.id} className={"tickets__ligne jetes__ligne" + (l.quantite ? "" : " vide")} style={{ "--i": i }}>
                  <span className="tickets__tuile" aria-hidden="true">{l.emoji || "🍽️"}</span>
                  <span className="tickets__nom"><b className="nom-defile">{l.nom}</b><span className="discret nom-defile">{uniteTicket(l)}{l.quantite ? " · " + euros(l.montant) + " perdus" : ""}</span></span>
                  <span className="plan__quantite">
                    <button type="button" aria-label={"Un peu moins de " + l.nom} disabled={!l.quantite} onClick={() => changer(l, l.quantite - pas(l.unite))}>−</button>
                    <span key={l.quantite}>{quantite(l.quantite, l.unite)}</span>
                    <button type="button" aria-label={"Un peu plus de " + l.nom} onClick={() => changer(l, l.quantite + pas(l.unite))}>+</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {donnees?.autres.length > 0 && (
            <CustomSelect id="ajouterJete" className="jetes__ajouter" value="" ariaLabel="Ajouter un aliment"
              options={[{ value: "", label: "+ Ajouter un aliment" }, ...donnees.autres.map((a) => ({ value: a.id, label: a.nom }))]} onChange={ajouter} />
          )}
          {ajustes.length > 0 && (
            <section className="jetes__ajustes">
              <h3>Courses ajustées</h3>
              {ajustes.map((l) => (
                <p key={l.id}>{l.nom} : {quantite(Math.max(0, l.habitudeMois - l.quantite), l.unite)} par mois au lieu de {quantite(l.habitudeMois, l.unite)}</p>
              ))}
            </section>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
