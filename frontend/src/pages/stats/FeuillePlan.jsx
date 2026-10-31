import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api.js";
import BoutonFermer from "../../components/BoutonFermer.jsx";
import { useVerrouDefilement } from "../../hooks/useVerrouDefilement.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";
import { useGlisserPourFermer } from "../../hooks/useGlisserPourFermer.js";
import { NombreAnime } from "./animations.js";
import "./FeuillePlan.css";

const SECTIONS = [
  { id: "arreter", titre: "À arrêter", classe: "niveau--1" },
  { id: "desserts", titre: "Desserts", classe: "niveau--2" },
  { id: "moins-cher", titre: "Moins cher", classe: "niveau--3" },
  { id: "jete", titre: "Jeté", classe: "plan__section--jete" },
  { id: "choix", titre: "Mes choix", classe: "plan__section--choix" },
];
// Semaine, mois, année : le même plan, ramené à la période choisie.
const ECHELLES = [
  { valeur: "semaine", texte: "Semaine", facteur: 12 / 52, unite: "par semaine" },
  { valeur: "mois", texte: "Mois", facteur: 1, unite: "par mois" },
  { valeur: "annee", texte: "Année", facteur: 12, unite: "par an" },
];

const nombre = (n) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
const quantite = (n, unite) => (unite === "kg" ? `${nombre(n)} kg` : nombre(n));
const pas = (unite) => (unite === "kg" ? 0.5 : 1);

function economie(a, choix) {
  if (!choix) return 0;
  if (choix.decision === "arreter") return a.depenseMois;
  if (choix.decision === "moins") return Math.max(0, a.quantiteMois - choix.quantiteVisee) * a.prixUnite;
  if (choix.decision === "changer") return a.changerMois;
  return 0;
}

function LignePlan({ a, i, echelle, euros, onChoisir }) {
  const choix = a.choix;
  const decision = choix?.decision ?? "garder";
  const options = a.section === "moins-cher" || (a.section === "choix" && choix?.preference)
    ? [["garder", "Garder"], ["changer", "Changer"]]
    : [["garder", "Garder"], ["moins", "Moins"], ["arreter", "Arrêter"]];
  const gain = economie(a, choix) * echelle.facteur;
  const visee = choix?.quantiteVisee ?? Math.max(0, Math.round((a.quantiteMois - (a.jete ?? pas(a.unite))) / pas(a.unite)) * pas(a.unite));
  const habitude = a.section === "choix" && choix?.preference
    ? choix.preference
    : a.section === "moins-cher" && a.alternative
      ? `${euros(a.alternative.prix, 2)} / ${a.alternative.unite === "piece" ? "pièce" : a.alternative.unite} chez ${a.alternative.enseigne}`
      : `${quantite(a.quantiteMois, a.unite)} / mois · ${euros(a.depenseMois, 2)}${a.jete ? ` · ${quantite(a.jete, a.unite)} jeté` : ""}`;
  return (
    <li className={"plan__ligne" + (decision !== "garder" ? " choisi" : "")} style={{ "--i": i }}>
      <div className="plan__article">
        <span className="tickets__tuile" aria-hidden="true">{a.emoji || "🍽️"}</span>
        <span className="tickets__nom"><b className="nom-defile">{a.nom}</b><span className="discret nom-defile">{habitude}</span></span>
        <span className="tickets__valeur">
          <b className={gain > 0 ? "plan__gain" : "discret"}>{gain > 0 ? "−" + euros(gain, 2) : "—"}</b>
          <span className="discret">{echelle.unite}</span>
        </span>
      </div>
      <div className="plan__choix">
        <div className="segmente" role="group" aria-label={"Choix pour " + a.nom}>
          {options.map(([v, t]) => (
            <button key={v} type="button" className={decision === v ? "actif" : undefined} aria-pressed={decision === v}
              onClick={() => onChoisir(a, v === "garder" && !choix?.preference ? null : v, v === "moins" ? visee : null)}>{t}</button>
          ))}
        </div>
        {decision === "moins" && (
          <div className="plan__quantite">
            <button type="button" aria-label="Un de moins" disabled={visee <= 0} onClick={() => onChoisir(a, "moins", Math.max(0, visee - pas(a.unite)))}>−</button>
            <span>{quantite(visee, a.unite)} / mois</span>
            <button type="button" aria-label="Un de plus" onClick={() => onChoisir(a, "moins", visee + pas(a.unite))}>+</button>
          </div>
        )}
      </div>
    </li>
  );
}

// Mon plan : pour chaque article proposé, garder, en acheter moins, arrêter ou changer ; le total gagné en haut.
export default function FeuillePlan({ euros, onFermer }) {
  const zone = useRef(null);
  const [ferme, fermer] = useFermetureAnimee(onFermer);
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [echelle, setEchelle] = useState(ECHELLES[1]);
  useVerrouDefilement(true, zone);
  useGlisserPourFermer(zone, fermer, true);

  const charger = () => api("/plan").then(({ statut, donnees }) => (statut === 200 ? setDonnees(donnees) : setErreur(true))).catch(() => setErreur(true));
  useEffect(() => { charger(); }, []);
  useEffect(() => {
    const echap = (e) => e.key === "Escape" && fermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [fermer]);

  // Le choix s'affiche tout de suite, puis le plan est relu pour que le total vienne du serveur.
  function choisir(a, decision, quantiteVisee) {
    setDonnees((d) => ({
      ...d,
      articles: d.articles.map((x) => (x.id === a.id ? { ...x, choix: decision ? { ...x.choix, decision, quantiteVisee } : null } : x)),
    }));
    api("/plan/" + encodeURIComponent(a.id), { method: "POST", body: { decision, quantiteVisee } }).then(charger).catch(() => setErreur(true));
  }

  const total = donnees ? donnees.articles.reduce((s, a) => s + economie(a, a.choix), 0) * echelle.facteur : 0;

  return createPortal(
    <div className={"fiche-fond fiche-fond--plan" + (ferme ? " ferme" : "")} onClick={fermer}>
      <aside ref={zone} className={"fiche fiche--liste tickets plan" + (ferme ? " ferme" : "")} role="dialog" aria-modal="true" aria-label="Mon plan" onClick={(e) => e.stopPropagation()}>
        <span className="fiche__poignee poignee-feuille" aria-hidden="true" />
        <header className="tickets__entete" data-entete-feuille>
          <button type="button" className="tickets__retour" aria-label="Retour aux tickets" onClick={fermer} />
          <span className="plan__icone" aria-hidden="true" />
          <span className="tickets__titre"><h2>Mon plan</h2><span className="discret">D'après 12 mois d'achats</span></span>
          <BoutonFermer onClick={fermer} />
        </header>
        <div className="tickets__defile">
          <div className="segmente" role="group" aria-label="Période">
            {ECHELLES.map((e) => (
              <button key={e.valeur} type="button" className={echelle.valeur === e.valeur ? "actif" : undefined} aria-pressed={echelle.valeur === e.valeur} onClick={() => setEchelle(e)}>{e.texte}</button>
            ))}
          </div>
          {donnees && (
            <div className="tickets__total plan__total">
              <b className={total > 0 ? "plan__gain" : undefined}><NombreAnime valeur={total} format={(n) => (n > 0 ? "−" : "") + euros(n, 2)} /></b>
              <span className="discret">{echelle.unite}{echelle.valeur !== "annee" && total > 0 ? ` · ${euros((total / echelle.facteur) * 12)} par an` : ""}</span>
            </div>
          )}
          {erreur && !donnees && <p className="vide">Plan indisponible pour le moment.</p>}
          {donnees && SECTIONS.map((s) => {
            const articles = donnees.articles.filter((a) => a.section === s.id);
            if (!articles.length) return null;
            const gain = articles.reduce((t, a) => t + economie(a, a.choix), 0) * echelle.facteur;
            return (
              <section key={s.id} className={"plan__section " + s.classe}>
                <h3><span className="plan__point" aria-hidden="true" />{s.titre}<span className="plan__gain">{gain > 0 ? "−" + euros(gain, 2) : ""}</span></h3>
                <ul className="tickets__liste">
                  {articles.map((a, i) => <LignePlan key={a.id} a={a} i={i} echelle={echelle} euros={euros} onChoisir={choisir} />)}
                </ul>
              </section>
            );
          })}
        </div>
      </aside>
    </div>,
    document.body
  );
}
