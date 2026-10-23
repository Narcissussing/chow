import { useMemo, useRef, useState } from "react";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";

export const ENSEIGNES = [
  { nom: "Leclerc", logo: "/magasins/leclerc.png" },
  { nom: "Carrefour", logo: "/magasins/carrefour.png" },
  { nom: "Marché Frais", logo: "/magasins/marche-frais.png" },
];

const NATURES = [
  { valeur: "semaine", texte: "Semaine" },
  { valeur: "mois", texte: "Mois" },
  { valeur: "annee", texte: "Année" },
  { valeur: "12mois", texte: "12 derniers mois", separe: true },
  { valeur: "tout", texte: "Tout" },
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const date = (s) => new Date(s + "T00:00:00");
const court = (s, options) => date(s).toLocaleDateString("fr-FR", options);

export function libellePeriode(p) {
  if (p.periode === "semaine") {
    const d = date(p.ref), f = new Date(d);
    f.setDate(f.getDate() + 6);
    return `${d.getDate()}–${court(iso(f), { day: "numeric", month: "short" })}`;
  }
  if (p.periode === "mois") return court(p.ref, { month: "short", year: "numeric" });
  if (p.periode === "annee") return p.ref.slice(0, 4);
  if (p.periode === "12mois") return "12 derniers mois";
  if (p.periode === "tout") return "Tout";
  return `${court(p.debut, { day: "numeric", month: "short" })} – ${court(p.fin, { day: "numeric", month: "short" })}`;
}

// Recule ou avance d'une semaine, d'un mois ou d'une année.
export function decaler(p, sens) {
  const d = date(p.ref);
  if (p.periode === "semaine") d.setDate(d.getDate() + 7 * sens);
  if (p.periode === "mois") d.setMonth(d.getMonth() + sens, 1);
  if (p.periode === "annee") d.setFullYear(d.getFullYear() + sens, 0, 1);
  return { ...p, ref: iso(d) };
}

// Dernier jour de la période (semaine, mois ou année) qui contient `ref`.
function finDePeriode(p) {
  const d = date(p.ref);
  if (p.periode === "semaine") d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 6);
  if (p.periode === "mois") d.setMonth(d.getMonth() + 1, 0);
  if (p.periode === "annee") d.setMonth(11, 31);
  return iso(d);
}

export function SelecteurPeriode({ periode, onChange, dernierAchat, premierAchat }) {
  const [ouvert, setOuvert] = useState(false);
  const [dates, setDates] = useState(null);
  const zone = useRef(null);
  const zones = useMemo(() => [zone], []);
  useClicExterieur(zones, () => {
    setOuvert(false);
    setDates(null);
  }, ouvert || dates !== null);
  const avecFleches = ["semaine", "mois", "annee"].includes(periode.periode);
  const aujourdhui = iso(new Date());
  const suivantImpossible = avecFleches && decaler(periode, 1).ref > aujourdhui;
  const precedentImpossible = avecFleches && !!premierAchat && finDePeriode(decaler(periode, -1)) < premierAchat;

  function choisir(valeur) {
    setOuvert(false);
    onChange({ periode: valeur, ref: valeur === "semaine" && dernierAchat ? dernierAchat : aujourdhui });
  }

  return (
    <div className="periode" ref={zone}>
      <button type="button" className="periode__fleche" aria-label="Période précédente" hidden={!avecFleches} disabled={precedentImpossible} onClick={() => onChange(decaler(periode, -1))}>‹</button>
      <button type="button" className="periode__choix" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <span className="periode__libelle">{libellePeriode(periode)}</span>
        <svg className="chevron-bas" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <button type="button" className="periode__fleche" aria-label="Période suivante" hidden={!avecFleches} disabled={suivantImpossible} onClick={() => onChange(decaler(periode, 1))}>›</button>
      {ouvert && (
        <div className="periode__menu" role="menu">
          {NATURES.map((n) => (
            <button key={n.valeur} type="button" role="menuitem" className={(n.separe ? "separe " : "") + (periode.periode === n.valeur ? "actif" : "")} onClick={() => choisir(n.valeur)}>
              {n.texte}
            </button>
          ))}
          <button type="button" role="menuitem" className={"separe" + (periode.periode === "dates" ? " actif" : "")} onClick={() => { setOuvert(false); setDates({ debut: periode.debut || aujourdhui, fin: periode.fin || aujourdhui }); }}>
            Dates…
          </button>
        </div>
      )}
      {dates && (
        <div className="periode__menu periode__dates">
          <label>Du <input type="date" value={dates.debut} max={dates.fin} onChange={(e) => setDates({ ...dates, debut: e.target.value })} /></label>
          <label>Au <input type="date" value={dates.fin} min={dates.debut} max={aujourdhui} onChange={(e) => setDates({ ...dates, fin: e.target.value })} /></label>
          <button type="button" className="periode__appliquer" disabled={!dates.debut || !dates.fin} onClick={() => { onChange({ periode: "dates", ref: aujourdhui, ...dates }); setDates(null); }}>
            Appliquer
          </button>
        </div>
      )}
    </div>
  );
}

export function SelecteurMagasin({ enseigne, onChange }) {
  return (
    <div className="magasins" role="group" aria-label="Magasin">
      <button type="button" className={enseigne === "tous" ? "actif" : undefined} aria-pressed={enseigne === "tous"} aria-label="Tous les magasins" onClick={() => onChange("tous")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9.5 4.5 4h15L21 9.5M3 9.5h18M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5h3c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S21 10.9 21 9.5M5 12v8h14v-8M10 20v-5h4v5" />
        </svg>
      </button>
      {ENSEIGNES.map((e) => (
        <button key={e.nom} type="button" className={enseigne === e.nom ? "actif" : undefined} aria-pressed={enseigne === e.nom} aria-label={e.nom} onClick={() => onChange(e.nom)}>
          <img src={e.logo} alt="" />
        </button>
      ))}
    </div>
  );
}
