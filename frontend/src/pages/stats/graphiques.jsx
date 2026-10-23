// Graphiques SVG de la page Stats, sans bibliothèque : courbe, barres, anneau et mini-courbe.
import { useEffect, useRef, useState } from "react";

const TEINTES_BARRES = [[246, 201, 168], [231, 111, 81]];

function teinte(t, opacite = 1) {
  const [a, b] = TEINTES_BARRES;
  return "rgba(" + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",") + "," + opacite + ")";
}

// Fait glisser les bornes de l'axe vers leur nouvelle valeur (≈ 400 ms, ralenti à la fin).
function useBornesAnimees([basCible, hautCible]) {
  const [bornes, setBornes] = useState([basCible, hautCible]);
  const actuelles = useRef(bornes);
  actuelles.current = bornes;
  useEffect(() => {
    const [b0, h0] = actuelles.current;
    if (b0 === basCible && h0 === hautCible) return;
    let image;
    const debut = performance.now();
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / 400);
      const e = 1 - Math.pow(1 - p, 3);
      setBornes([b0 + (basCible - b0) * e, h0 + (hautCible - h0) * e]);
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [basCible, hautCible]);
  return bornes;
}

// Courbe : chaque segment est rouge quand le prix monte, vert quand il baisse. Une seconde série facultative
// (`national`, ex. l'INSEE) est tracée en pointillés bleus. Graduations à gauche ; au survol, un repère vertical et
// une bulle donnent les valeurs du mois.
export function Courbe({ points, largeur = 600, hauteur = 180, id = "courbe", format = (v) => v, graduations = false, depuisZero = false, onDoubleClic, formatAxe = format }) {
  const [survol, setSurvol] = useState(null);
  const valeurs = points.map((p) => p.valeur);
  const nationales = points.map((p) => p.national ?? null);
  const toutes = [...valeurs, ...nationales.filter((v) => v !== null)];
  const ecart = Math.max(...toutes) - Math.min(...toutes) || 1;
  // Axe zoomé sur les valeurs, ou partant de 0 pour garder les vraies proportions ; le passage est animé.
  const cible = depuisZero ? [0, Math.max(...toutes) * 1.08] : [Math.min(...toutes) - ecart * 0.1, Math.max(...toutes) + ecart * 0.1];
  const [bas, haut] = useBornesAnimees(cible);
  if (valeurs.length < 2) return null;
  const marge = 6;
  const x = (i) => marge + (i * (largeur - 2 * marge)) / (valeurs.length - 1);
  const y = (v) => hauteur - 6 - ((v - bas) / (haut - bas)) * (hauteur - 14);
  const trace = valeurs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const traceNational = nationales.map((v, i) => (v === null ? "" : `${i && nationales[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join(" ");
  const pas = haut - bas > 40 ? 25 : haut - bas > 12 ? 5 : haut - bas > 5 ? 2 : haut - bas > 2 ? 1 : 0.5;
  const reperes = [];
  for (let v = Math.ceil(bas / pas) * pas; v <= haut; v += pas) reperes.push(v);
  const dernier = valeurs.length - 1;
  const actif = survol ?? dernier;
  const pourcent = (i) => [(x(i) / largeur) * 100, (y(valeurs[i]) / hauteur) * 100];
  const hausse = valeurs[dernier] >= valeurs[0];
  return (
    <div className={"courbe" + (graduations ? " courbe--graduee" : "")} onMouseLeave={() => setSurvol(null)}
      onDoubleClick={onDoubleClic} title={onDoubleClic ? (depuisZero ? "Double-clic : zoomer" : "Double-clic : axe depuis 0") : undefined}>
      <div className="courbe__trace">
        {graduations && reperes.map((v) => (
          <span key={v} className="courbe__graduation" style={{ top: (y(v) / hauteur) * 100 + "%" }}>{formatAxe(v)}</span>
        ))}
        <svg viewBox={`0 0 ${largeur} ${hauteur}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={id + "-aire"} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={hausse ? "#e76f51" : "#2f6f62"} stopOpacity="0.25" />
              <stop offset="1" stopColor={hausse ? "#f4c27a" : "#9fd0bd"} stopOpacity="0" />
            </linearGradient>
          </defs>
          {graduations && reperes.map((v) => (
            <line key={v} x1="0" x2={largeur} y1={y(v)} y2={y(v)} stroke="#ece5da" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${trace} L${x(dernier)} ${hauteur} L${x(0)} ${hauteur} Z`} fill={`url(#${id}-aire)`} />
          {traceNational && (
            <path d={traceNational} fill="none" stroke="#3e7cb1" strokeOpacity="0.8" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
          {valeurs.slice(1).map((v, i) => (
            <line key={i} x1={x(i)} y1={y(valeurs[i])} x2={x(i + 1)} y2={y(v)} stroke={v > valeurs[i] ? "#c8472b" : v < valeurs[i] ? "#2f6f62" : "#9a9189"}
              strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {survol !== null && <span className="courbe__repere" style={{ left: pourcent(survol)[0] + "%" }} />}
        <span className={"courbe__point" + (valeurs[actif] < valeurs[Math.max(0, actif - 1)] ? " courbe__point--baisse" : "")}
          style={{ left: pourcent(actif)[0] + "%", top: pourcent(actif)[1] + "%" }} />
        {survol !== null && (
          <span className="bulle" style={{ left: pourcent(survol)[0] + "%", top: pourcent(survol)[1] + "%" }}>
            {points[survol].titre || points[survol].etiquette} · <b>{format(valeurs[survol])}</b>
            {nationales[survol] !== null && <> · 🇫🇷 {format(nationales[survol])}</>}
          </span>
        )}
        <div className="courbe__zones">
          {points.map((p, i) => <span key={i} onMouseEnter={() => setSurvol(i)} />)}
        </div>
      </div>
      <div className="axe">
        {points.map((p, i) => (
          <span key={i} className={i === actif ? "axe--fort" : undefined}>{p.etiquette}</span>
        ))}
      </div>
    </div>
  );
}

export function Barres({ seaux, moyenne, pic, selection, enCours, euros }) {
  const max = Math.max(...seaux.map((s) => s.total), moyenne, 1);
  const bas = Math.min(...seaux.filter((s) => s.total > 0).map((s) => s.total), max);
  const classeDe = (s) => (s.debut === selection ? " barre--selection" : s.debut === enCours ? " barre--en-cours" : "");
  return (
    <div className="barres">
      <div className="barres__zone">
        {moyenne > 0 && <span className="barres__moyenne" style={{ bottom: `${(moyenne / max) * 82}%` }} />}
        {seaux.map((s) => {
          const t = max === bas ? 1 : (s.total - bas) / (max - bas);
          const classe = classeDe(s);
          return (
            <div key={s.debut} className={"barre-col" + classe}>
              <span className="bulle bulle--barre">
                {s.titre || s.etiquette} · <b>{euros(s.total)}</b>
                {s.passages > 0 && <> · {s.passages} passage{s.passages > 1 ? "s" : ""} · {euros(s.total / s.passages)} en moyenne</>}
              </span>
              <span className="barre__montant">{s.total > 0 ? euros(s.total) : ""}</span>
              <span
                className={"barre" + classe}
                style={{ height: `${(s.total / max) * 82}%`, ...(classe ? {} : { background: `linear-gradient(${teinte(t)}, ${teinte(t, 0.55)})` }) }}
              />
            </div>
          );
        })}
      </div>
      <div className="axe axe--barres">
        {seaux.map((s) => (
          <span key={s.debut} className={s.debut === selection ? "axe--selection" : s.debut === pic ? "axe--fort" : undefined}>{s.etiquette}</span>
        ))}
      </div>
      {moyenne > 0 && <p className="barres__legende"><span className="tirets" /> moy. {euros(moyenne)}</p>}
    </div>
  );
}

export const COULEURS_RAYONS = ["#c8472b", "#2f6f62", "#d9a441", "#7a8fb8", "#cfc5b6", "#8f8579"];

// Une couleur fixe par rayon, quelle que soit la période ; Autres et Non Chow en tons neutres.
const COULEUR_PAR_RAYON = {
  "Fruits & légumes": "#c8472b", "Viandes & poissons": "#2f6f62", Crèmerie: "#7a8fb8", Épicerie: "#d9a441",
  "Autres": "#cfc5b6", "Non Chow": "#8f8579",
};
export const couleurRayon = (nom, i) => COULEUR_PAR_RAYON[nom] || COULEURS_RAYONS[i % COULEURS_RAYONS.length];

// Anneau : survoler une part (ou sa ligne de légende, via `survol`) la fait ressortir et l'affiche au centre.
export function Anneau({ parts, centre, survol, onSurvol }) {
  const total = parts.reduce((s, p) => s + p.total, 0) || 1;
  const r = 15.9155;
  let decalage = 25;
  const part = survol !== null && survol !== undefined ? parts[survol] : null;
  return (
    <div className="anneau" onMouseLeave={() => onSurvol(null)}>
      <svg viewBox="0 0 42 42" aria-hidden="true">
        {parts.map((p, i) => {
          const pourcent = (p.total / total) * 100;
          const arc = (
            <circle key={p.nom} cx="21" cy="21" r={r} fill="none" stroke={couleurRayon(p.nom, i)}
              strokeWidth={survol === i ? 7.5 : 6} opacity={part && survol !== i ? 0.35 : 1}
              strokeDasharray={`${Math.max(0, pourcent - 0.6)} ${100 - pourcent + 0.6}`} strokeDashoffset={decalage}
              onMouseEnter={() => onSurvol(i)} style={{ transition: "opacity .15s, stroke-width .15s", cursor: "default" }} />
          );
          decalage -= pourcent;
          return arc;
        })}
      </svg>
      <span className="anneau__centre">
        {part ? (
          <span><small>{part.nom}</small><br />{Math.round((part.total / total) * 100)} %</span>
        ) : centre}
      </span>
    </div>
  );
}

export function MiniCourbe({ valeurs, hausse, className = "" }) {
  if (valeurs.length < 2) return <span className={"mini-courbe " + className} />;
  const min = Math.min(...valeurs), max = Math.max(...valeurs);
  const y = (v) => (max === min ? 10 : 18 - ((v - min) / (max - min)) * 16);
  const d = valeurs.map((v, i) => `${i ? "L" : "M"}${((i * 58) / (valeurs.length - 1) + 1).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className={"mini-courbe " + className} viewBox="0 0 60 20" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={hausse > 0 ? "#c8472b" : hausse < 0 ? "#2f6f62" : "#6b6257"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
