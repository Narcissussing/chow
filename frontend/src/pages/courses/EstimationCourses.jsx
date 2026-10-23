import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import "./EstimationCourses.css";

const euros = (n, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €";
const nombre = (n) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// Valeur qui défile vers sa nouvelle cible quand la liste change (≈ 450 ms).
function useDefilement(cible) {
  const [valeur, setValeur] = useState(cible);
  const actuelle = useRef(cible);
  actuelle.current = valeur;
  useEffect(() => {
    const depart = actuelle.current;
    if (depart === cible || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValeur(cible);
      return;
    }
    let image;
    const debut = performance.now();
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / 450);
      setValeur(Math.round(depart + (cible - depart) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible]);
  return valeur;
}

function Ligne({ d, rang, max }) {
  const prixUnite = d.unite && d.dernierPrix != null ? ` / ${d.unite === "pièce" ? "pièce" : d.unite}` : "";
  return (
    <li className={"estimation__ligne" + (d.estimation == null ? " estimation__ligne--sans-prix" : "")} style={{ "--rang": rang, "--part": d.estimation ? d.estimation / max : 0 }}>
      <span className="estimation__emoji" aria-hidden="true">{d.emoji}</span>
      <span className="estimation__nom">
        <b>{d.nom}</b>
        {d.source === "habitudes" && d.quantite != null && (
          <span className="estimation__detail">
            {nombre(d.quantite)} {d.unite === "pièce" ? (d.quantite > 1 ? "pièces" : "pièce") : d.unite} par achat · dernier prix {euros(d.dernierPrix)}{prixUnite}
            {d.prixHabituel != null && Math.abs(d.dernierPrix - d.prixHabituel) >= 0.01 && (
              <span className={d.dernierPrix > d.prixHabituel ? "plus-cher" : "moins-cher"}> (d’habitude {euros(d.prixHabituel)})</span>
            )}
          </span>
        )}
        {d.source === "habitudes" && d.quantite == null && <span className="estimation__detail">d’après les {d.passages} derniers achats</span>}
        {d.source === "prix-habituel" && <span className="estimation__detail">jamais acheté sur un ticket · prix moyen en magasin</span>}
        {d.source === "sans-prix" && <span className="estimation__detail">aucun prix connu</span>}
      </span>
      <span className="estimation__montant">{d.estimation != null ? euros(d.estimation) : "—"}</span>
      <span className="estimation__part" aria-hidden="true" />
    </li>
  );
}

// Fourchette des Courses à côté du titre ; un clic ouvre le détail du calcul, article par article.
export default function EstimationCourses({ estimation }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  const bulle = useRef(null);
  const zones = useMemo(() => [zone, bulle], []);
  const [position, setPosition] = useState(null);

  // La bulle est rendue dans <body> (au-dessus de la barre d'outils collante) et suit le bouton.
  useLayoutEffect(() => {
    if (!ouvert) return;
    const placer = () => {
      const r = zone.current?.getBoundingClientRect();
      if (r) setPosition({ top: r.bottom + 10, left: Math.min(r.left, window.innerWidth - Math.min(380, window.innerWidth - 32) - 16) });
    };
    placer();
    window.addEventListener("scroll", placer, { passive: true });
    window.addEventListener("resize", placer);
    return () => {
      window.removeEventListener("scroll", placer);
      window.removeEventListener("resize", placer);
    };
  }, [ouvert]);
  useClicExterieur(zones, () => setOuvert(false), ouvert);
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [ouvert]);
  const bas = useDefilement(estimation.bas);
  const haut = useDefilement(estimation.haut);
  const details = estimation.details || [];

  return (
    <span className="estimation" ref={zone}>
      <button type="button" className="courses-fourchette" aria-expanded={ouvert} title="Voir le calcul" onClick={() => setOuvert((o) => !o)}>
        {bas} € – {haut} €
      </button>
      {ouvert && position && createPortal(
        <div ref={bulle} className="estimation__popup" role="dialog" aria-label="Calcul de l’estimation" style={position}>
          <div className="estimation__entete">
            <div>
              <span className="estimation__surtitre">Prochaines courses · {estimation.articles} articles</span>
              <b className="estimation__total">≈ {euros(estimation.estimation, 0)}</b>
            </div>
            <button type="button" className="estimation__fermer" aria-label="Fermer" onClick={() => setOuvert(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
            </button>
          </div>
          <div className="estimation__jauge" aria-hidden="true">
            <span className="estimation__jauge-barre">
              <span className="estimation__jauge-repere" style={{ left: `${((estimation.estimation - estimation.bas) / Math.max(1, estimation.haut - estimation.bas)) * 100}%` }} />
            </span>
            <span className="estimation__jauge-bornes"><span>{estimation.bas} €</span><span>{estimation.haut} €</span></span>
          </div>
          <ul className="estimation__liste">
            {details.map((d, i) => <Ligne key={d.nom} d={d} rang={i} max={Math.max(...details.map((x) => x.estimation || 0), 1)} />)}
          </ul>
        </div>,
        document.body
      )}
    </span>
  );
}
