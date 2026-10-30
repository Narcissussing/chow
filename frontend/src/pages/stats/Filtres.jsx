import { useCallback, useMemo, useRef, useState } from "react";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";


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
// Lundi de la semaine qui contient `s` : une semaine va du lundi au dimanche.
const lundi = (s) => { const d = date(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };

export function libellePeriode(p) {
  if (p.periode === "semaine") {
    const d = lundi(p.ref), f = new Date(d);
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
  const d = p.periode === "semaine" ? lundi(p.ref) : date(p.ref);
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

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const moisDecale = (m, n) => iso(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)).slice(0, 7);

// Un seul calendrier pour la plage : 1er toucher = début, 2e = fin, appliquée aussitôt (sans bouton).
// Un jour avant le début devient le début ; pas de jour après aujourd'hui ni avant le premier achat.
function CalendrierPlage({ debut, fin, min, max, ferme, onAppliquer }) {
  const [mois, setMois] = useState((fin || max).slice(0, 7));
  const [plage, setPlage] = useState({ debut, fin });
  const [survol, setSurvol] = useState(null);
  // Zoom comme les calendriers des téléphones : le titre du mois ouvre les mois, l'année ouvre les années.
  const [vue, setVue] = useState({ niveau: "jours", sens: "" });
  const annee = Number(mois.slice(0, 4));
  const anneeMin = Number((min || max).slice(0, 4)), anneeMax = Number(max.slice(0, 4));
  const premier = date(mois + "-01");
  const vides = (premier.getDay() + 6) % 7;
  const nbJours = new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
  const jours = Array.from({ length: nbJours }, (_, i) => mois + "-" + String(i + 1).padStart(2, "0"));
  // Fin provisoire au survol, pour voir la plage avant le 2e clic.
  const finVue = plage.fin || (plage.debut && survol && survol >= plage.debut ? survol : null);
  const moisPossible = (m) => m <= max.slice(0, 7) && (!min || m >= min.slice(0, 7));
  const zoomer = (niveau, sens) => setVue({ niveau, sens });

  function toucher(j) {
    if (!plage.debut || plage.fin) return setPlage({ debut: j, fin: null });
    const choisie = j < plage.debut ? { debut: j, fin: plage.debut } : { debut: plage.debut, fin: j };
    setPlage(choisie);
    // Court temps pour voir la plage s'allumer avant que le calendrier se ferme.
    setTimeout(() => onAppliquer(choisie), 350);
  }

  return (
    <div className={"periode__menu calendrier" + (ferme ? " ferme" : "")} role="dialog" aria-label="Choisir les dates">
      <div className="calendrier__entete">
        {vue.niveau === "jours" && (
          <button type="button" aria-label="Précédent" disabled={!!min && mois <= min.slice(0, 7)} onClick={() => setMois(moisDecale(mois, -1))}>‹</button>
        )}
        {vue.niveau === "jours" && (
          <button type="button" className="calendrier__titre" onClick={() => zoomer("mois", "sortie")}>
            {premier.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </button>
        )}
        {vue.niveau === "mois" && (
          <button type="button" className="calendrier__titre" onClick={() => zoomer("annees", "sortie")}>{annee}</button>
        )}
        {vue.niveau === "annees" && <b className="calendrier__titre">Année</b>}
        {vue.niveau === "jours" && (
          <button type="button" aria-label="Suivant" disabled={mois >= max.slice(0, 7)} onClick={() => setMois(moisDecale(mois, 1))}>›</button>
        )}
      </div>

      {vue.niveau === "jours" && (
        <div className={"calendrier__grille calendrier--" + vue.sens} key={"j" + mois} onMouseLeave={() => setSurvol(null)}>
          {JOURS.map((j, i) => <span key={i} className="calendrier__jour-nom">{j}</span>)}
          {Array.from({ length: vides }, (_, i) => <span key={"v" + i} />)}
          {jours.map((j) => {
            const bornes = j === plage.debut || j === finVue;
            const dedans = plage.debut && finVue && j > plage.debut && j < finVue;
            return (
              <button key={j} type="button" data-jour={j} disabled={j > max || (!!min && j < min)}
                className={"calendrier__jour" + (bornes ? " borne" : "") + (dedans ? " dedans" : "") + (j === max ? " aujourdhui" : "")}
                aria-pressed={bornes} aria-label={court(j, { day: "numeric", month: "long", year: "numeric" })}
                onMouseEnter={() => setSurvol(j)} onClick={() => toucher(j)}>
                {Number(j.slice(8))}
              </button>
            );
          })}
        </div>
      )}

      {vue.niveau === "mois" && (
        <div className={"calendrier__choix calendrier--" + vue.sens} key={"m" + annee}>
          {Array.from({ length: 12 }, (_, i) => {
            const m = `${annee}-${String(i + 1).padStart(2, "0")}`;
            return (
              <button key={m} type="button" data-mois={m} disabled={!moisPossible(m)} className={m === mois ? "actif" : undefined}
                onClick={() => { setMois(m); zoomer("jours", "entree"); }}>
                {court(m + "-01", { month: "short" })}
              </button>
            );
          })}
        </div>
      )}

      {vue.niveau === "annees" && (
        // Années qui défilent, la plus récente en bas, ouvertes sur l'année affichée.
        <div className={"calendrier__choix calendrier__annees calendrier--" + vue.sens}
          ref={(el) => {
            const actif = el?.querySelector(".actif");
            if (actif) el.scrollTop = actif.offsetTop - el.clientHeight / 2;
          }}>
          {Array.from({ length: anneeMax - anneeMin + 1 }, (_, i) => anneeMin + i).map((a) => (
            <button key={a} type="button" data-annee={a} className={a === annee ? "actif" : undefined}
              onClick={() => {
                // Même mois dans l'année choisie, ramené dans les mois possibles.
                const voulu = `${a}-${mois.slice(5, 7)}`;
                setMois(moisPossible(voulu) ? voulu : voulu > max.slice(0, 7) ? max.slice(0, 7) : min.slice(0, 7));
                zoomer("mois", "entree");
              }}>
              {a}
            </button>
          ))}
        </div>
      )}

      <p className="calendrier__etat" aria-live="polite">
        {plage.debut && plage.fin ? libellePeriode({ periode: "dates", ...plage }) : plage.debut ? court(plage.debut, { day: "numeric", month: "short" }) + " → …" : "Début → fin"}
      </p>
    </div>
  );
}

export function SelecteurPeriode({ periode, onChange, dernierAchat, premierAchat }) {
  const [ouvert, setOuvert] = useState(false);
  const [dates, setDates] = useState(null);
  const zone = useRef(null);
  const zones = useMemo(() => [zone], []);
  // Menu et calendrier se referment en jouant leur sortie.
  const [ferme, fermer] = useFermetureAnimee(useCallback(() => {
    setOuvert(false);
    setDates(null);
  }, []), 180);
  useClicExterieur(zones, fermer, ouvert || dates !== null);
  const avecFleches = ["semaine", "mois", "annee"].includes(periode.periode);
  const aujourdhui = iso(new Date());
  const suivantImpossible = avecFleches && decaler(periode, 1).ref > aujourdhui;
  const precedentImpossible = avecFleches && !!premierAchat && finDePeriode(decaler(periode, -1)) < premierAchat;

  function choisir(valeur) {
    fermer();
    onChange({ periode: valeur, ref: valeur === "semaine" && dernierAchat ? dernierAchat : aujourdhui });
  }

  return (
    <div className="periode" ref={zone}>
      <button type="button" className="periode__fleche" aria-label="Période précédente" hidden={!avecFleches} disabled={precedentImpossible} onClick={() => onChange(decaler(periode, -1))}>‹</button>
      <button type="button" className="periode__choix" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => (ouvert ? fermer() : setOuvert(true))}>
        <span className="periode__libelle">{libellePeriode(periode)}</span>
        <svg className="chevron-bas" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <button type="button" className="periode__fleche" aria-label="Période suivante" hidden={!avecFleches} disabled={suivantImpossible} onClick={() => onChange(decaler(periode, 1))}>›</button>
      {ouvert && (
        <div className={"periode__menu" + (ferme ? " ferme" : "")} role="menu">
          {NATURES.map((n) => (
            <button key={n.valeur} type="button" role="menuitem" className={(n.separe ? "separe " : "") + (periode.periode === n.valeur ? "actif" : "")} onClick={() => choisir(n.valeur)}>
              {n.texte}
            </button>
          ))}
          <button type="button" role="menuitem" className={"separe" + (periode.periode === "dates" ? " actif" : "")} onClick={() => { setOuvert(false); setDates({ debut: periode.debut || null, fin: periode.fin || null }); }}>
            Dates…
          </button>
        </div>
      )}
      {dates && (
        <CalendrierPlage debut={dates.debut} fin={dates.fin} min={premierAchat} max={aujourdhui} ferme={ferme}
          onAppliquer={(plage) => { onChange({ periode: "dates", ref: aujourdhui, ...plage }); fermer(); }} />
      )}
    </div>
  );
}
